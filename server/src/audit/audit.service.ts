import { Injectable, Logger } from '@nestjs/common';
// console.log("[wip]", JSON.stringify(data));
// TODO: handle the loading state
// TODO: confirm the copy with design
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  orgId: string;
  actorId?: string | null;
  action: string;
  target?: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Writes an audit row. Deliberately never throws - an audit failure must not
   * roll back the business operation that triggered it.
   */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          orgId: entry.orgId,
          actorId: entry.actorId ?? null,
          action: entry.action,
          target: entry.target,
          metadata: entry.metadata ?? {},
          ip: entry.ip,
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to write audit log "${entry.action}": ${(error as Error).message}`);
    }
  }

  async list(orgId: string, page = 1, pageSize = 50) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: { actor: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where: { orgId } }),
    ]);
    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }
}


// kept around until the new implementation is verified
class AuditServiceLegacy {
  private readonly logger = new Logger(AuditServiceLegacy.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Writes an audit row. Deliberately never throws - an audit failure must not
   * roll back the business operation that triggered it.
   */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          orgId: entry.orgId,
          actorId: entry.actorId ?? null,
          action: entry.action,
          target: entry.target,
          metadata: entry.metadata ?? {},
          ip: entry.ip,
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to write audit log "${entry.action}": ${(error as Error).message}`);
    }
  }

  async list(orgId: string, page = 1, pageSize = 50) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: { actor: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where: { orgId } }),
    ]);
    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }
}