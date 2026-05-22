import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Plan, PlanStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { randomToken, sha256, slugify } from '../common/crypto.util';
import type { AccessTokenPayload } from '../common/guards/auth.guard';
import { ChangePasswordDto, LoginDto, RegisterDto, UpdateProfileDto } from './dto/auth.dto';

export interface SessionResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    isSuperAdmin: boolean;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    plan: Plan;
    planStatus: PlanStatus;
    role: Role;
  };
  organizations: Array<{ id: string; name: string; slug: string; role: Role; plan: Plan }>;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDto, ctx: { ip?: string; userAgent?: string }): Promise<SessionResponse> {
    if (!this.config.get<boolean>('app.signupsEnabled')) {
      throw new ForbiddenException('Self-serve signups are disabled on this instance');
    }

    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('An account with that email already exists');

    const orgName = dto.organizationName?.trim() || `${dto.name.split(' ')[0]}'s workspace`;
    const passwordHash = await bcrypt.hash(dto.password, 12);

    const { user, org } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, name: dto.name.trim(), passwordHash },
      });

      const org = await tx.organization.create({
        data: {
          name: orgName,
          slug: await this.uniqueSlug(orgName, tx as unknown as PrismaService),
          billingEmail: email,
          plan: Plan.FREE,
          planStatus: PlanStatus.TRIALING,
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });

      await tx.membership.create({ data: { userId: user.id, orgId: org.id, role: Role.OWNER } });

      // Every new workspace gets a sandbox channel so it is usable before the
      // customer has any WhatsApp credentials at all.
      await tx.channel.create({
        data: {
          orgId: org.id,
          name: 'Sandbox',
          provider: 'SANDBOX',
          status: 'ACTIVE',
          phoneNumber: '+1 555 0100',
          webhookId: randomToken(12),
        },
      });

      return { user, org };
    });

    await this.audit.log({ orgId: org.id, actorId: user.id, action: 'auth.register', ip: ctx.ip });
    return this.issueSession(user.id, org.id, ctx);
  }

  async login(dto: LoginDto, ctx: { ip?: string; userAgent?: string }): Promise<SessionResponse> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { memberships: { orderBy: { createdAt: 'asc' }, take: 1 } },
    });

    // Same error for unknown-user and wrong-password so the endpoint does not
    // double as an account-enumeration oracle.
    const invalid = new UnauthorizedException('Invalid email or password');
    if (!user) {
      await bcrypt.compare(dto.password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva');
      throw invalid;
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw invalid;

    const membership = user.memberships[0];
    if (!membership) throw new ForbiddenException('Your account is not attached to a workspace');

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.log({ orgId: membership.orgId, actorId: user.id, action: 'auth.login', ip: ctx.ip });

    return this.issueSession(user.id, membership.orgId, ctx);
  }

  async refresh(refreshToken: string, ctx: { ip?: string; userAgent?: string }): Promise<SessionResponse> {
    const tokenHash = sha256(refreshToken);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { memberships: { orderBy: { createdAt: 'asc' }, take: 1 } } } },
    });

    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    // Rotation: the presented token is burned as part of issuing the new pair.
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    const membership = record.user.memberships[0];
    if (!membership) throw new ForbiddenException('Your account is not attached to a workspace');

    return this.issueSession(record.userId, membership.orgId, ctx);
  }

  async logout(refreshToken?: string, userId?: string): Promise<{ success: boolean }> {
    if (refreshToken) {
      await this.prisma.refreshToken
        .updateMany({ where: { tokenHash: sha256(refreshToken) }, data: { revokedAt: new Date() } })
        .catch(() => undefined);
    } else if (userId) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { success: true };
  }

  /** Re-issues a session bound to a different workspace the user belongs to. */
  async switchOrg(userId: string, orgId: string, ctx: { ip?: string; userAgent?: string }): Promise<SessionResponse> {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId } },
    });
    if (!membership) throw new ForbiddenException('You are not a member of that workspace');
    return this.issueSession(userId, orgId, ctx);
  }

  async me(userId: string, orgId: string): Promise<Omit<SessionResponse, 'accessToken' | 'refreshToken' | 'expiresIn'>> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: { org: true },
      orderBy: { createdAt: 'asc' },
    });
    const active = memberships.find((m) => m.orgId === orgId) ?? memberships[0];
    if (!active) throw new ForbiddenException('No workspace available');

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        isSuperAdmin: user.isSuperAdmin,
      },
      organization: {
        id: active.org.id,
        name: active.org.name,
        slug: active.org.slug,
        plan: active.org.plan,
        planStatus: active.org.planStatus,
        role: active.role,
      },
      organizations: memberships.map((m) => ({
        id: m.org.id,
        name: m.org.name,
        slug: m.org.slug,
        role: m.role,
        plan: m.org.plan,
      })),
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name, avatarUrl: dto.avatarUrl },
    });
    return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl };
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('Current password is incorrect');

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, 12) },
    });
    // Changing a password invalidates every other device.
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  // -------------------------------------------------------------------------

  private async issueSession(
    userId: string,
    orgId: string,
    ctx: { ip?: string; userAgent?: string },
  ): Promise<SessionResponse> {
    const profile = await this.me(userId, orgId);

    const payload: AccessTokenPayload = {
      sub: profile.user.id,
      email: profile.user.email,
      name: profile.user.name,
      orgId: profile.organization.id,
      role: profile.organization.role,
      sadmin: profile.user.isSuperAdmin,
    };

    const accessTtl = this.config.get<string>('app.jwt.accessTtl') ?? '15m';
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('app.jwt.secret'),
      expiresIn: accessTtl as never,
    });

    const refreshDays = this.config.get<number>('app.jwt.refreshTtlDays') ?? 30;
    const refreshToken = randomToken(48);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000),
        ip: ctx.ip,
        userAgent: ctx.userAgent?.slice(0, 250),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.ttlToSeconds(accessTtl),
      ...profile,
    };
  }

  private ttlToSeconds(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 900;
    const value = Number(match[1]);
    const unit = { s: 1, m: 60, h: 3600, d: 86400 }[match[2]] ?? 60;
    return value * unit;
  }

  private async uniqueSlug(name: string, tx: PrismaService): Promise<string> {
    const base = slugify(name);
    let candidate = base;
    let n = 1;
    // Slug collisions are rare; a bounded probe keeps registration snappy.
    while (await tx.organization.findUnique({ where: { slug: candidate } })) {
      candidate = `${base}-${++n}`;
      if (n > 50) {
        candidate = `${base}-${randomToken(4).toLowerCase()}`;
        break;
      }
    }
    return candidate;
  }
}
