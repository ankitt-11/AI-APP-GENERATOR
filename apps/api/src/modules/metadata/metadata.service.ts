import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../prisma/prisma.service';
import { ValidationEngine } from './engines/validation.engine';
import { NormalizationEngine } from './engines/normalization.engine';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { AppMetadata } from '@repo/shared/types';

@Injectable()
export class MetadataService {
  private readonly logger = new Logger(MetadataService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly validationEngine: ValidationEngine,
    private readonly normalizationEngine: NormalizationEngine,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /**
   * Get the active metadata version for an app.
   * Uses cache to avoid DB reads on every runtime request.
   */
  async getActiveMetadata(appId: string): Promise<AppMetadata | null> {
    const cacheKey = `metadata:${appId}:active`;
    const cached = await this.cache.get<AppMetadata>(cacheKey);
    if (cached) return cached;

    const version = await this.prisma.metadataVersion.findFirst({
      where: { appId, isActive: true },
      orderBy: { version: 'desc' },
    });

    if (!version) return null;

    const definition = version.definition as unknown as AppMetadata;
    await this.cache.set(cacheKey, definition, 60000); // 60s TTL
    return definition;
  }

  async listVersions(appId: string) {
    return this.prisma.metadataVersion.findMany({
      where: { appId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, changelog: true, isActive: true, createdAt: true },
    });
  }

  /**
   * Save and validate a new metadata version.
   * Runs full validation + normalization pipeline.
   * Does NOT activate — requires separate publish call.
   */
  async saveVersion(
    appId: string,
    userId: string,
    rawDefinition: unknown,
    changelog?: string,
  ) {
    // 1. Validate
    const validationResult = this.validationEngine.validate(rawDefinition);

    // 2. Normalize (only if validation produced a result)
    const { normalized, changes: normalizationChanges } = this.normalizationEngine.normalize(
      validationResult.repaired,
    );

    // 3. Get next version number
    const lastVersion = await this.prisma.metadataVersion.findFirst({
      where: { appId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (lastVersion?.version ?? 0) + 1;

    // 4. Persist
    const saved = await this.prisma.metadataVersion.create({
      data: {
        appId,
        version: nextVersion,
        definition: normalized as object,
        changelog: changelog || `Version ${nextVersion}`,
        isActive: false, // Requires explicit publish
      },
    });

    // 5. Audit
    await this.audit.log({
      userId,
      action: 'metadata_updated',
      resource: 'apps',
      resourceId: appId,
      after: { version: nextVersion, normalizationChanges: normalizationChanges.length },
    });

    // 6. Create notification if there were repairs
    if (validationResult.repairs.length > 0 || normalizationChanges.length > 0) {
      await this.notifications.create({
        userId,
        type: 'validation_warning',
        title: 'Metadata Auto-Repaired',
        message: `${validationResult.repairs.length} field corrections and ${normalizationChanges.length} normalization changes were applied`,
        metadata: { appId, versionId: saved.id },
      });
    }

    return {
      version: saved,
      validationResult,
      normalizationChanges,
    };
  }

  /**
   * Publish (activate) a specific version.
   * Deactivates all other versions for this app atomically.
   */
  async publishVersion(appId: string, userId: string, versionId: string) {
    const version = await this.prisma.metadataVersion.findFirst({
      where: { id: versionId, appId },
    });

    if (!version) {
      throw new NotFoundException('Metadata version not found');
    }

    // Atomic transaction: deactivate all, activate target
    await this.prisma.$transaction([
      this.prisma.metadataVersion.updateMany({
        where: { appId },
        data: { isActive: false },
      }),
      this.prisma.metadataVersion.update({
        where: { id: versionId },
        data: { isActive: true },
      }),
    ]);

    // Sync entities and fields from the published metadata definition
    await this.syncEntitiesFromMetadata(appId, version.definition as unknown as AppMetadata);

    // Invalidate cache
    await this.cache.del(`metadata:${appId}:active`);

    await this.audit.log({
      userId,
      action: 'metadata_published',
      resource: 'apps',
      resourceId: appId,
      after: { publishedVersion: version.version },
    });

    this.logger.log(`Metadata v${version.version} published for app ${appId}`);
    return { published: true, version: version.version };
  }

  /**
   * Syncs Entity and EntityField records from published metadata definition.
   * This keeps the relational entity/field tables consistent with the active metadata JSON.
   */
  private async syncEntitiesFromMetadata(appId: string, metadata: AppMetadata) {
    for (const entityDef of metadata.entities) {
      const entity = await this.prisma.entity.upsert({
        where: { appId_slug: { appId, slug: entityDef.slug } },
        update: {
          name: entityDef.name,
          icon: entityDef.icon,
          description: entityDef.description,
          displayConfig: entityDef.display as object ?? null,
        },
        create: {
          appId,
          name: entityDef.name,
          slug: entityDef.slug,
          icon: entityDef.icon,
          description: entityDef.description,
          displayConfig: entityDef.display as object ?? null,
        },
      });

      for (const fieldDef of entityDef.fields) {
        await this.prisma.entityField.upsert({
          where: { entityId_slug: { entityId: entity.id, slug: fieldDef.slug } },
          update: {
            name: fieldDef.name,
            type: fieldDef.type as any,
            required: fieldDef.required ?? false,
            defaultValue: fieldDef.defaultValue?.toString() ?? null,
            options: fieldDef.options as object ?? null,
            validation: fieldDef.validation as object ?? null,
            component: fieldDef.component,
            displayIn: fieldDef.displayIn ?? [],
            order: fieldDef.order ?? 0,
            placeholder: fieldDef.placeholder,
            helpText: fieldDef.helpText,
          },
          create: {
            entityId: entity.id,
            name: fieldDef.name,
            slug: fieldDef.slug,
            type: fieldDef.type as any,
            required: fieldDef.required ?? false,
            defaultValue: fieldDef.defaultValue?.toString() ?? null,
            options: fieldDef.options as object ?? null,
            validation: fieldDef.validation as object ?? null,
            component: fieldDef.component,
            displayIn: fieldDef.displayIn ?? [],
            order: fieldDef.order ?? 0,
            placeholder: fieldDef.placeholder,
            helpText: fieldDef.helpText,
          },
        });
      }
    }
  }

  async validateOnly(rawDefinition: unknown) {
    const validationResult = this.validationEngine.validate(rawDefinition);
    const { changes: normalizationChanges } = this.normalizationEngine.normalize(
      validationResult.repaired,
    );
    return { ...validationResult, normalizationChanges };
  }
}
