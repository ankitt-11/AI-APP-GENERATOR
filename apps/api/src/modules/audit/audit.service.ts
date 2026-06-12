import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface AuditLogInput {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    // Fire-and-forget — audit failures must never break business logic
    this.prisma.auditLog
      .create({
        data: {
          userId: input.userId,
          action: input.action,
          resource: input.resource,
          resourceId: input.resourceId,
          before: input.before as any,
          after: input.after as any,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        },
      })
      .catch((err) => console.error('Audit log failed (non-critical):', err.message));
  }

  async getLogs(userId: string, options: {
    resource?: string;
    action?: string;
    from?: Date;
    to?: Date;
    page?: number;
    limit?: number;
  }) {
    const { resource, action, from, to, page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(resource && { resource }),
      ...(action && { action }),
      ...(from || to ? {
        createdAt: {
          ...(from && { gte: from }),
          ...(to && { lte: to }),
        },
      } : {}),
    };

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data: logs, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
