import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { AuditService } from '../audit/audit.service';
import { randomToken, sha256 } from '../common/crypto.util';

@Injectable()
export class OrgsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async get(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: { _count: { select: { memberships: true, flows: true, channels: true, contacts: true } } },
    });
    if (!org) throw new NotFoundException('Workspace not found');
    return org;
  }

  async update(orgId: string, dto: { name?: string; billingEmail?: string; settings?: Record<string, unknown> }, userId: string | null) {
    const org = await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        name: dto.name,
        billingEmail: dto.billingEmail,
        settings: dto.settings as Prisma.InputJsonValue | undefined,
      },
    });
    await this.audit.log({ orgId, actorId: userId, action: 'org.updated' });
    return org;
  }

  // -- members ---------------------------------------------------------------

  async members(orgId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { orgId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, lastLoginAt: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const invitations = await this.prisma.invitation.findMany({
      where: { orgId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    return { members: memberships, invitations };
  }

  /**
   * Creates an invitation. Without an email provider wired up the token is
   * returned so the admin can share the link directly.
   */
  async invite(orgId: string, email: string, role: Role, userId: string | null) {
    await this.billing.assertCanCreate(orgId, 'seats');

    const normalised = email.toLowerCase().trim();
    const existing = await this.prisma.membership.findFirst({
      where: { orgId, user: { email: normalised } },
    });
    if (existing) throw new BadRequestException('That person is already a member of this workspace');

    const token = randomToken(24);
    const invitation = await this.prisma.invitation.create({
      data: {
        orgId,
        email: normalised,
        role,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await this.audit.log({ orgId, actorId: userId, action: 'member.invited', metadata: { email: normalised, role } });

    const base = (this.config.get<string>('app.publicUrl') ?? '').replace(/\/$/, '');
    return { ...invitation, inviteUrl: `${base}/accept-invite?token=${token}` };
  }

  async revokeInvite(orgId: string, id: string, userId: string | null) {
    const invitation = await this.prisma.invitation.findFirst({ where: { id, orgId } });
    if (!invitation) throw new NotFoundException('Invitation not found');

    await this.prisma.invitation.delete({ where: { id } });
    await this.audit.log({ orgId, actorId: userId, action: 'member.invite_revoked', target: id });
    return { success: true };
  }

  /** Accepts an invite, creating the account when the invitee is new. */
  async acceptInvite(token: string, profile?: { name: string; password: string }) {
    const invitation = await this.prisma.invitation.findUnique({ where: { token } });
    if (!invitation) throw new NotFoundException('That invitation link is not valid');
    if (invitation.acceptedAt) throw new BadRequestException('This invitation has already been used');
    if (invitation.expiresAt < new Date()) throw new BadRequestException('This invitation has expired');

    let user = await this.prisma.user.findUnique({ where: { email: invitation.email } });
    if (!user) {
      if (!profile?.password || !profile.name) {
        // Signals the UI to collect a name + password before retrying.
        throw new BadRequestException({
          message: 'Create an account to accept this invitation',
          error: 'AccountRequired',
          email: invitation.email,
        });
      }
      user = await this.prisma.user.create({
        data: {
          email: invitation.email,
          name: profile.name,
          passwordHash: await bcrypt.hash(profile.password, 12),
          emailVerified: true,
        },
      });
    }

    await this.prisma.$transaction([
      this.prisma.membership.upsert({
        where: { userId_orgId: { userId: user.id, orgId: invitation.orgId } },
        create: { userId: user.id, orgId: invitation.orgId, role: invitation.role },
        update: { role: invitation.role },
      }),
      this.prisma.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } }),
    ]);

    await this.audit.log({ orgId: invitation.orgId, actorId: user.id, action: 'member.joined' });
    return { success: true, email: user.email, orgId: invitation.orgId };
  }

  async updateMemberRole(orgId: string, memberUserId: string, role: Role, actorId: string | null) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_orgId: { userId: memberUserId, orgId } },
    });
    if (!membership) throw new NotFoundException('That person is not a member of this workspace');

    // A workspace must always retain at least one owner.
    if (membership.role === Role.OWNER && role !== Role.OWNER) {
      const owners = await this.prisma.membership.count({ where: { orgId, role: Role.OWNER } });
      if (owners <= 1) throw new ForbiddenException('A workspace needs at least one owner');
    }

    const updated = await this.prisma.membership.update({
      where: { userId_orgId: { userId: memberUserId, orgId } },
      data: { role },
    });
    await this.audit.log({ orgId, actorId, action: 'member.role_changed', target: memberUserId, metadata: { role } });
    return updated;
  }

  async removeMember(orgId: string, memberUserId: string, actorId: string | null) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_orgId: { userId: memberUserId, orgId } },
    });
    if (!membership) throw new NotFoundException('That person is not a member of this workspace');

    if (membership.role === Role.OWNER) {
      const owners = await this.prisma.membership.count({ where: { orgId, role: Role.OWNER } });
      if (owners <= 1) throw new ForbiddenException('A workspace needs at least one owner');
    }

    await this.prisma.membership.delete({ where: { userId_orgId: { userId: memberUserId, orgId } } });
    await this.audit.log({ orgId, actorId, action: 'member.removed', target: memberUserId });
    return { success: true };
  }

  // -- API keys --------------------------------------------------------------

  async listApiKeys(orgId: string) {
    return this.prisma.apiKey.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, prefix: true, scopes: true, lastUsedAt: true, revokedAt: true, createdAt: true },
    });
  }

  /** The full key is shown exactly once, at creation. */
  async createApiKey(orgId: string, name: string, userId: string | null) {
    await this.billing.assertCanCreate(orgId, 'apiKeys');

    const prefix = randomToken(6).replace(/[-_]/g, '').slice(0, 10);
    const secret = randomToken(24);

    const key = await this.prisma.apiKey.create({
      data: { orgId, name, prefix, keyHash: sha256(secret) },
    });
    await this.audit.log({ orgId, actorId: userId, action: 'apikey.created', target: key.id, metadata: { name } });

    return { id: key.id, name: key.name, prefix, createdAt: key.createdAt, key: `ax_${prefix}_${secret}` };
  }

  async revokeApiKey(orgId: string, id: string, userId: string | null) {
    const key = await this.prisma.apiKey.findFirst({ where: { id, orgId } });
    if (!key) throw new NotFoundException('API key not found');

    await this.prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
    await this.audit.log({ orgId, actorId: userId, action: 'apikey.revoked', target: id });
    return { success: true };
  }
}
