import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  async list(appId: string) {
    return this.prisma.workflow.findMany({
      where: { appId },
      include: { _count: { select: { runs: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(appId: string, userId: string, dto: { name: string; entitySlug: string; trigger: string; isActive?: boolean; actions: any[] }) {
    const entity = await this.prisma.entity.findFirst({ where: { appId, slug: dto.entitySlug } });

    return this.prisma.workflow.create({
      data: {
        appId,
        name: dto.name,
        entityId: entity?.id,
        trigger: dto.trigger,
        isActive: dto.isActive ?? true,
        actions: dto.actions,
      },
    });
  }

  async update(appId: string, workflowId: string, userId: string, dto: any) {
    const existing = await this.prisma.workflow.findFirst({ where: { id: workflowId, appId } });
    if (!existing) throw new NotFoundException('Workflow not found');

    return this.prisma.workflow.update({
      where: { id: workflowId },
      data: { name: dto.name, isActive: dto.isActive, actions: dto.actions },
    });
  }

  async delete(appId: string, workflowId: string, userId: string) {
    const existing = await this.prisma.workflow.findFirst({ where: { id: workflowId, appId } });
    if (!existing) throw new NotFoundException('Workflow not found');
    await this.prisma.workflow.delete({ where: { id: workflowId } });
    return { deleted: true };
  }

  async getRuns(workflowId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [runs, total] = await Promise.all([
      this.prisma.workflowRun.findMany({
        where: { workflowId },
        skip,
        take: limit,
        orderBy: { executedAt: 'desc' },
      }),
      this.prisma.workflowRun.count({ where: { workflowId } }),
    ]);
    return { data: runs, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
