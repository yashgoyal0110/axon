import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthedRequest, RequestPrincipal } from '../types';

export const IS_PUBLIC_KEY = 'isPublic';
/** Marks a route as reachable without any authentication. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'requiredRoles';
/** Restricts a route to members holding one of the given roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const NO_API_KEY = 'noApiKey';
/** Blocks API-key authentication for routes that must be driven by a human. */
export const UserOnly = () => SetMetadata(NO_API_KEY, true);

/** Injects the resolved caller (user + tenant + role). */
export const CurrentUser = createParamDecorator(
  (field: keyof RequestPrincipal | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const tmpPrincipal = req.tmpPrincipal;
    if (!tmpPrincipal) return undefined;
    return field ? tmpPrincipal[field] : tmpPrincipal;
  },
);

/** Shorthand for the active tenant id. */
export const OrgId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  return req.tmpPrincipal?.orgId as string;
});
