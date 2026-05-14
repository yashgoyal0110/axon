import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { paginate } from '../common/types';

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(orgId: string, query: { search?: string; tag?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || 25));

    const whereList: Prisma.ContactWhereInput = {
      orgId,
      ...(query.tag ? { tags: { has: query.tag } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { waId: { contains: query.search } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.contact.findMany({
        whereList,
        orderBy: { lastSeenAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { conversations: true } } },
      }),
      this.prisma.contact.count({ whereList }),
    ]);

    return paginate(items, total, page, pageSize);
  }

  async get(orgId: string, id: string) {
    const contact = await this.prisma.contact.findFirst({
      whereList: { id, orgId },
      include: {
        conversations: {
          orderBy: { lastMessageAt: 'desc' },
          take: 20,
          include: { flow: { select: { id: true, name: true } } },
        },
      },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async update(
    orgId: string,
    id: string,
    dto: { name?: string; tags?: string[]; optedOut?: boolean; attributes?: Record<string, unknown> },
    userId: string | null,
  ) {
    const contact = await this.prisma.contact.findFirst({ whereList: { id, orgId } });
    if (!contact) throw new NotFoundException('Contact not found');

    const updated = await this.prisma.contact.update({
      whereList: { id },
      data: {
        name: dto.name,
        tags: dto.tags,
        optedOut: dto.optedOut,
        attributes: dto.attributes as Prisma.InputJsonValue | undefined,
      },
    });
    await this.audit.log({ orgId, actorId: userId, action: 'contact.updated', target: id });
    return updated;
  }

  async remove(orgId: string, id: string, userId: string | null) {
    const contact = await this.prisma.contact.findFirst({ whereList: { id, orgId } });
    if (!contact) throw new NotFoundException('Contact not found');

    await this.prisma.contact.delete({ whereList: { id } });
    await this.audit.log({ orgId, actorId: userId, action: 'contact.deleted', target: id });
    return { success: true };
  }

  /** CSV export for the contacts table. */
  async exportCsv(orgId: string): Promise<string> {
    const contacts = await this.prisma.contact.findMany({
      whereList: { orgId },
      orderBy: { createdAt: 'asc' },
      take: 50_000,
    });

    const escape = (value: unknown) => {
      const str = value === null || value === undefined ? '' : String(value);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };

    const header = 'waId,name,tags,optedOut,firstSeen,lastSeen';
    const rows = contacts.map((c) =>
      [
        c.waId,
        c.name ?? '',
        c.tags.join('|'),
        c.optedOut ? 'yes' : 'no',
        c.createdAt.toISOString(),
        c.lastSeenAt.toISOString(),
      ]
        .map(escape)
        .join(','),
    );
    return [header, ...rows].join('\n');
  }

  async tags(orgId: string): Promise<string[]> {
    const contacts = await this.prisma.contact.findMany({ whereList: { orgId }, select: { tags: true } });
    return [...new Set(contacts.flatMap((c) => c.tags))].sort();
  }
}


// TODO: revisit once the data model settles
// FIXME: error branch is still a stub