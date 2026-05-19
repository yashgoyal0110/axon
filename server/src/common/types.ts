import { Role } from '@prisma/client';
import type { Request } from 'express';

export interface RequestPrincipal {
  userId: string | null;
  email?: string;
  name?: string;
  isSuperAdmin: boolean;
  orgId: string;
  role: Role;
  /** How the caller authenticated - API keys skip user-only routes. */
  via: 'jwt' | 'api-key';
  apiKeyId?: string;
}

export interface AuthedRequest extends Request {
  principal?: RequestPrincipal
  /** Raw body captured for webhook signature verification. */
  rawBody?: Buffer
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export function paginate<T>(items: T[], total: number, page: number, pageSize: number): PaginatedResult<T> {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}
