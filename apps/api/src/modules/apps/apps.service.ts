import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAppDto, UpdateAppDto } from './dto/app.dto';
import { AuditService } from '../audit/audit.service';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

@Injectable()
export class AppsService {
  private readonly logger = new Logger(AppsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listApps(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [apps, total] = await Promise.all([
      this.prisma.app.findMany({
        where: { ownerId: userId },
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: { select: { entities: true } },
          metadataVersions: {
            where: { isActive: true },
            select: { version: true, createdAt: true },
            take: 1,
          },
        },
      }),
      this.prisma.app.count({ where: { ownerId: userId } }),
    ]);

    return {
      data: apps,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getApp(appId: string, userId: string) {
    const app = await this.prisma.app.findFirst({
      where: { id: appId, ownerId: userId },
      include: {
        entities: {
          include: { fields: { orderBy: { order: 'asc' } } },
          orderBy: { name: 'asc' },
        },
        metadataVersions: {
          where: { isActive: true },
          take: 1,
        },
        _count: { select: { workflows: true, imports: true } },
      },
    });

    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  async createApp(userId: string, dto: CreateAppDto) {
    const slug = slugify(dto.name);

    // Ensure unique slug for this user
    const existing = await this.prisma.app.findUnique({
      where: { ownerId_slug: { ownerId: userId, slug } },
    });

    const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

    const app = await this.prisma.app.create({
      data: {
        name: dto.name,
        slug: finalSlug,
        description: dto.description,
        ownerId: userId,
        // Create initial empty metadata version
        metadataVersions: {
          create: {
            version: 1,
            isActive: true,
            definition: {
              name: dto.name,
              description: dto.description || '',
              version: '1.0.0',
              entities: [],
            },
            changelog: 'Initial version',
          },
        },
      },
      include: { metadataVersions: { where: { isActive: true }, take: 1 } },
    });

    await this.audit.log({
      userId,
      action: 'app_created',
      resource: 'apps',
      resourceId: app.id,
      after: { name: app.name, slug: app.slug },
    });

    this.logger.log(`App created: ${app.name} (${app.id}) by user ${userId}`);
    return app;
  }

  async updateApp(appId: string, userId: string, dto: UpdateAppDto) {
    const app = await this.getApp(appId, userId);

    const updated = await this.prisma.app.update({
      where: { id: appId },
      data: { name: dto.name, description: dto.description },
    });

    await this.audit.log({
      userId,
      action: 'app_updated',
      resource: 'apps',
      resourceId: appId,
      before: { name: app.name, description: app.description },
      after: { name: dto.name, description: dto.description },
    });

    return updated;
  }

  async deleteApp(appId: string, userId: string) {
    const app = await this.getApp(appId, userId);

    await this.prisma.app.delete({ where: { id: appId } });

    await this.audit.log({
      userId,
      action: 'app_deleted',
      resource: 'apps',
      resourceId: appId,
      before: { name: app.name },
    });

    return { deleted: true };
  }

  async cloneApp(appId: string, userId: string) {
    const source = await this.getApp(appId, userId);
    const activeVersion = source.metadataVersions[0];

    const cloneName = `${source.name} (Copy)`;
    const cloneSlug = slugify(cloneName) + '-' + Date.now();

    const clone = await this.prisma.app.create({
      data: {
        name: cloneName,
        slug: cloneSlug,
        description: source.description,
        ownerId: userId,
        // Clone entities and fields
        entities: {
          create: source.entities.map((entity) => ({
            name: entity.name,
            slug: entity.slug,
            icon: entity.icon,
            description: entity.description,
            displayConfig: entity.displayConfig ?? undefined,
            fields: {
              create: entity.fields.map((f) => ({
                name: f.name,
                slug: f.slug,
                type: f.type,
                required: f.required,
                defaultValue: f.defaultValue,
                options: f.options ?? undefined,
                validation: f.validation ?? undefined,
                component: f.component,
                displayIn: f.displayIn,
                order: f.order,
                placeholder: f.placeholder,
                helpText: f.helpText,
              })),
            },
          })),
        },
        // Clone active metadata version
        metadataVersions: {
          create: activeVersion
            ? [{
                version: 1,
                definition: activeVersion.definition as any,
                changelog: `Cloned from ${source.name}`,
                isActive: true,
              }]
            : [],
        },
      },
    });

    await this.audit.log({
      userId,
      action: 'app_cloned',
      resource: 'apps',
      resourceId: clone.id,
      after: { sourceAppId: appId, clonedAppId: clone.id },
    });

    this.logger.log(`App cloned: ${source.name} → ${clone.name}`);
    return clone;
  }

  async getDashboardStats(userId: string) {
    const [appCount, totalRecords, recentApps, recentAuditLogs] = await Promise.all([
      this.prisma.app.count({ where: { ownerId: userId } }),
      this.prisma.entityRecord.count({
        where: { entity: { app: { ownerId: userId } } },
      }),
      this.prisma.app.findMany({
        where: { ownerId: userId },
        take: 5,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, name: true, slug: true, updatedAt: true },
      }),
      this.prisma.auditLog.findMany({
        where: { userId },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: { action: true, resource: true, resourceId: true, createdAt: true },
      }),
    ]);

    return { appCount, totalRecords, recentApps, recentAuditLogs };
  }
}
