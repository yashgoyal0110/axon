import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { sha256 } from '../crypto.util';
import { IS_PUBLIC_KEY, NO_API_KEY, ROLES_KEY } from '../decorators';
import type { AuthedRequest } from '../types';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  name: string;
  orgId: string;
  role: Role;
  sadmin: boolean;
}

// Higher number wins. Used for "at least this role" checks.
const ROLE_RANK: Record<Role, number> = {
  VIEWER: 0,
  AGENT: 1,
  ADMIN: 2,
  OWNER: 3,
};

export function roleAtLeast(actual: Role, required: Role): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

/**
 * Single gate for both auth schemes. Resolves a principal that always carries
 * an `orgId`, so every downstream query can scope by tenant without repeating
 * the lookup.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const apiKey = req.header('x-api-key');
    const authHeader = req.header('authorization');

    if (apiKey) {
      const userOnly = this.reflector.getAllAndOverride<boolean>(NO_API_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (userOnly) throw new ForbiddenException('This endpoint requires a user session');
      await this.authenticateApiKey(req, apiKey);
    } else if (authHeader?.startsWith('Bearer ')) {
      await this.authenticateJwt(req, authHeader.slice(7));
    } else {
      throw new UnauthorizedException('Authentication required');
    }

    return this.checkRoles(context, req);
  }

  private async authenticateJwt(req: AuthedRequest, token: string): Promise<void> {
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.get<string>('app.jwt.secret'),
      });
    } catch {
      throw new UnauthorizedException('Session expired or invalid');
    }

    // Re-check the membership on every request so a revoked seat takes effect
    // immediately instead of when the access token expires.
    const membership = await this.prisma.membership.findUnique({
      where: { userId_orgId: { userId: payload.sub, orgId: payload.orgId } },
      select: { role: true, user: { select: { id: true, email: true, name: true, isSuperAdmin: true } } },
    });
    if (!membership) throw new UnauthorizedException('You no longer have access to this workspace');

    req.principal = {
      userId: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
      isSuperAdmin: membership.user.isSuperAdmin,
      orgId: payload.orgId,
      role: membership.role,
      via: 'jwt',
    };
  }

  private async authenticateApiKey(req: AuthedRequest, rawKey: string): Promise<void> {
    // Format: ax_<prefix>_<secret>
    const parts = rawKey.split('_');
    if (parts.length !== 3 || parts[0] !== 'ax') throw new UnauthorizedException('Malformed API key');
    const [, prefix, secret] = parts;

    const record = await this.prisma.apiKey.findUnique({ where: { prefix } });
    if (!record || record.revokedAt) throw new UnauthorizedException('API key revoked or unknown');
    if (record.keyHash !== sha256(secret)) throw new UnauthorizedException('Invalid API key');

    // Fire-and-forget: last-used tracking must not add latency to the request.
    void this.prisma.apiKey
      .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    req.principal = {
      userId: null,
      isSuperAdmin: false,
      orgId: record.orgId,
      role: Role.ADMIN,
      via: 'api-key',
      apiKeyId: record.id,
    };
  }

  private checkRoles(context: ExecutionContext, req: AuthedRequest): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const role = req.principal?.role;
    if (!role) throw new ForbiddenException('Insufficient permissions');
    // A required list is treated as "any of", ranked - ADMIN satisfies AGENT.
    const ok = required.some((r) => roleAtLeast(role, r));
    if (!ok) throw new ForbiddenException(`Requires one of: ${required.join(', ')}`);
    return true;
  }
}
