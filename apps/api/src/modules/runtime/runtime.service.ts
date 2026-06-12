import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MetadataService } from '../metadata/metadata.service';
import { WorkflowEngine } from '../workflow/workflow.engine';
import { NotificationsService } from '../notifications/notifications.service';
import type { AppMetadata, EntityDefinition, FieldDefinition, EntityRecord } from '@repo/shared/types';

interface ListOptions {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

interface ValidationError {
  field: string;
  message: string;
}

/**
 * RuntimeService — the heart of the metadata-driven runtime.
 *
 * All entity operations are completely generic.
 * The service:
 * 1. Resolves entity definition from metadata
 * 2. Validates incoming data against field definitions
 * 3. Executes CRUD against entity_records (JSONB)
 * 4. Triggers workflow engine on mutations
 *
 * No entity-specific code exists here.
 * Adding a new entity type requires zero code changes.
 */
@Injectable()
export class RuntimeService {
  private readonly logger = new Logger(RuntimeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metadataService: MetadataService,
    private readonly workflowEngine: WorkflowEngine,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── Schema Resolution ──────────────────────────────────────────────────────

  async getEntitySchema(appId: string, entitySlug: string) {
    const metadata = await this.metadataService.getActiveMetadata(appId);
    if (!metadata) throw new NotFoundException('Application has no active metadata');

    const entity = this.findEntity(metadata, entitySlug);
    return {
      entity: {
        name: entity.name,
        slug: entity.slug,
        icon: entity.icon,
        description: entity.description,
        display: entity.display,
      },
      fields: entity.fields.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      entities: metadata.entities.map((e) => ({ name: e.name, slug: e.slug, icon: e.icon })),
    };
  }

  async getAppSchema(appId: string) {
    const metadata = await this.metadataService.getActiveMetadata(appId);
    if (!metadata) throw new NotFoundException('Application has no active metadata');

    return {
      name: metadata.name,
      description: metadata.description,
      entities: metadata.entities.map((e) => ({
        name: e.name,
        slug: e.slug,
        icon: e.icon,
        description: e.description,
        fieldCount: e.fields.length,
      })),
      navigation: metadata.navigation,
    };
  }

  // ─── List Records ───────────────────────────────────────────────────────────

  async listRecords(appId: string, entitySlug: string, options: ListOptions, userId: string) {
    const { page = 1, limit = 25, search, sort, order = 'desc' } = options;
    const skip = (page - 1) * Math.min(limit, 100);

    const entity = await this.resolveEntity(appId, entitySlug);
    const metadata = await this.metadataService.getActiveMetadata(appId);
    const entityDef = this.findEntity(metadata!, entitySlug);

    // Build base query
    const where: any = { entityId: entity.id };

    // Search across searchable fields using JSONB contains
    if (search && search.trim()) {
      const searchableFields = entityDef.display?.searchableFields || entityDef.fields.filter((f) => f.type === 'text' || f.type === 'email').map((f) => f.slug);

      if (searchableFields.length > 0) {
        // Prisma JSONB path query — checks if any searchable field contains the search string
        where.OR = searchableFields.map((fieldSlug) => ({
          data: {
            path: [fieldSlug],
            string_contains: search,
            mode: 'insensitive',
          },
        }));
      }
    }

    // Sort by field in JSONB
    const orderBy: any = [{ createdAt: order }]; // Default sort
    if (sort) {
      orderBy.unshift({
        data: { path: [sort], sort: order },
      });
    }

    const [records, total] = await Promise.all([
      this.prisma.entityRecord.findMany({
        where,
        skip,
        take: Math.min(limit, 100),
        orderBy: [{ createdAt: 'desc' }], // Simple stable sort
      }),
      this.prisma.entityRecord.count({ where }),
    ]);

    // Sort in-memory if JSONB field sort requested (simpler than complex SQL)
    let data = records.map((r) => ({ id: r.id, ...(r.data as object), _createdAt: r.createdAt, _updatedAt: r.updatedAt }));

    if (sort) {
      data = data.sort((a: any, b: any) => {
        const aVal = a[sort] ?? '';
        const bVal = b[sort] ?? '';
        const comparison = String(aVal).localeCompare(String(bVal));
        return order === 'asc' ? comparison : -comparison;
      });
    }

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      entityDef: {
        name: entityDef.name,
        slug: entityDef.slug,
        fields: entityDef.fields.filter((f) => f.displayIn?.includes('table') !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      },
    };
  }

  // ─── Get Record ─────────────────────────────────────────────────────────────

  async getRecord(appId: string, entitySlug: string, recordId: string) {
    const entity = await this.resolveEntity(appId, entitySlug);
    const metadata = await this.metadataService.getActiveMetadata(appId);
    const entityDef = this.findEntity(metadata!, entitySlug);

    const record = await this.prisma.entityRecord.findFirst({
      where: { id: recordId, entityId: entity.id },
    });

    if (!record) throw new NotFoundException('Record not found');

    return {
      id: record.id,
      ...(record.data as object),
      _createdAt: record.createdAt,
      _updatedAt: record.updatedAt,
      _entityDef: entityDef,
    };
  }

  // ─── Create Record ──────────────────────────────────────────────────────────

  async createRecord(
    appId: string,
    entitySlug: string,
    data: Record<string, unknown>,
    userId: string,
  ) {
    const entity = await this.resolveEntity(appId, entitySlug);
    const metadata = await this.metadataService.getActiveMetadata(appId);
    const entityDef = this.findEntity(metadata!, entitySlug);

    // Validate against entity field definitions
    const { validated, errors } = this.validateRecordData(entityDef, data);
    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Record validation failed',
        errors: errors.reduce((acc, e) => ({ ...acc, [e.field]: [e.message] }), {}),
      });
    }

    const record = await this.prisma.entityRecord.create({
      data: { entityId: entity.id, data: validated as any },
    });

    // Trigger workflows
    await this.workflowEngine.trigger('record_created', {
      appId,
      entityId: entity.id,
      entitySlug,
      recordId: record.id,
      userId,
      data: validated,
    });

    // Create notification
    const labelField = entityDef.display?.labelField;
    const label = labelField ? (validated[labelField] as string) : record.id;
    await this.notifications.create({
      userId,
      type: 'record_created',
      title: `${entityDef.name} Created`,
      message: `New ${entityDef.name.toLowerCase()} "${label}" was created`,
      metadata: { appId, entitySlug, recordId: record.id },
    });

    return { id: record.id, ...(record.data as object), _createdAt: record.createdAt };
  }

  // ─── Update Record ──────────────────────────────────────────────────────────

  async updateRecord(
    appId: string,
    entitySlug: string,
    recordId: string,
    data: Record<string, unknown>,
    userId: string,
  ) {
    const entity = await this.resolveEntity(appId, entitySlug);
    const metadata = await this.metadataService.getActiveMetadata(appId);
    const entityDef = this.findEntity(metadata!, entitySlug);

    const existing = await this.prisma.entityRecord.findFirst({
      where: { id: recordId, entityId: entity.id },
    });
    if (!existing) throw new NotFoundException('Record not found');

    // Partial validation — only validate provided fields
    const { validated, errors } = this.validateRecordData(entityDef, data, true);
    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Record validation failed',
        errors: errors.reduce((acc, e) => ({ ...acc, [e.field]: [e.message] }), {}),
      });
    }

    // Merge with existing data
    const mergedData = { ...(existing.data as object), ...validated };

    const updated = await this.prisma.entityRecord.update({
      where: { id: recordId },
      data: { data: mergedData as any },
    });

    await this.workflowEngine.trigger('record_updated', {
      appId,
      entityId: entity.id,
      entitySlug,
      recordId,
      userId,
      data: validated,
      previousData: existing.data as Record<string, unknown>,
    });

    return { id: updated.id, ...(updated.data as object), _updatedAt: updated.updatedAt };
  }

  // ─── Delete Record ──────────────────────────────────────────────────────────

  async deleteRecord(appId: string, entitySlug: string, recordId: string, userId: string) {
    const entity = await this.resolveEntity(appId, entitySlug);
    const existing = await this.prisma.entityRecord.findFirst({
      where: { id: recordId, entityId: entity.id },
    });
    if (!existing) throw new NotFoundException('Record not found');

    await this.prisma.entityRecord.delete({ where: { id: recordId } });

    await this.workflowEngine.trigger('record_deleted', {
      appId,
      entityId: entity.id,
      entitySlug,
      recordId,
      userId,
      data: existing.data as Record<string, unknown>,
    });

    return { deleted: true, id: recordId };
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private async resolveEntity(appId: string, entitySlug: string) {
    const entity = await this.prisma.entity.findFirst({
      where: { appId, slug: entitySlug },
    });
    if (!entity) {
      throw new NotFoundException(`Entity "${entitySlug}" not found in this application`);
    }
    return entity;
  }

  private findEntity(metadata: AppMetadata, entitySlug: string): EntityDefinition {
    const entity = metadata.entities.find((e) => e.slug === entitySlug);
    if (!entity) {
      throw new NotFoundException(`Entity definition "${entitySlug}" not found in metadata`);
    }
    return entity;
  }

  /**
   * Validates record data against entity field definitions.
   * Applies type coercion, required field checks, and format validation.
   *
   * @param partial - If true, skips required field checks (for PATCH)
   */
  private validateRecordData(
    entityDef: EntityDefinition,
    data: Record<string, unknown>,
    partial = false,
  ): { validated: Record<string, unknown>; errors: ValidationError[] } {
    const errors: ValidationError[] = [];
    const validated: Record<string, unknown> = {};

    const fieldMap = new Map(entityDef.fields.map((f) => [f.slug, f]));

    // Check required fields
    if (!partial) {
      for (const field of entityDef.fields) {
        if (field.required && (data[field.slug] === undefined || data[field.slug] === null || data[field.slug] === '')) {
          errors.push({ field: field.slug, message: `${field.name} is required` });
        }
      }
    }

    // Validate and coerce provided fields
    for (const [key, rawValue] of Object.entries(data)) {
      const fieldDef = fieldMap.get(key);

      // Strip unknown fields (not in entity definition)
      if (!fieldDef) continue;

      const { coerced, error } = this.coerceFieldValue(fieldDef, rawValue);
      if (error) {
        errors.push({ field: key, message: error });
      } else {
        validated[key] = coerced;
      }
    }

    // Apply defaults for unset optional fields (on create only)
    if (!partial) {
      for (const field of entityDef.fields) {
        if (validated[field.slug] === undefined && field.defaultValue !== undefined) {
          validated[field.slug] = field.defaultValue;
        }
      }
    }

    return { validated, errors };
  }

  /**
   * Type-safe coercion of field values based on FieldDefinition.type
   */
  private coerceFieldValue(
    field: FieldDefinition,
    value: unknown,
  ): { coerced: unknown; error?: string } {
    if (value === null || value === undefined || value === '') {
      if (field.required) {
        return { coerced: null, error: `${field.name} is required` };
      }
      return { coerced: null };
    }

    switch (field.type) {
      case 'text':
      case 'email': {
        const str = String(value).trim();
        if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
          return { coerced: null, error: `${field.name} must be a valid email address` };
        }
        if (field.validation?.maxLength && str.length > field.validation.maxLength) {
          return { coerced: null, error: `${field.name} must be at most ${field.validation.maxLength} characters` };
        }
        return { coerced: str };
      }

      case 'number': {
        const num = Number(value);
        if (isNaN(num)) return { coerced: null, error: `${field.name} must be a number` };
        if (field.validation?.min !== undefined && num < field.validation.min) {
          return { coerced: null, error: `${field.name} must be at least ${field.validation.min}` };
        }
        if (field.validation?.max !== undefined && num > field.validation.max) {
          return { coerced: null, error: `${field.name} must be at most ${field.validation.max}` };
        }
        return { coerced: num };
      }

      case 'boolean':
        if (value === 'true' || value === true || value === 1) return { coerced: true };
        if (value === 'false' || value === false || value === 0) return { coerced: false };
        return { coerced: null, error: `${field.name} must be true or false` };

      case 'date': {
        const date = new Date(String(value));
        if (isNaN(date.getTime())) return { coerced: null, error: `${field.name} must be a valid date` };
        return { coerced: date.toISOString().split('T')[0] };
      }

      case 'select': {
        const validValues = field.options?.map((o) => o.value) ?? [];
        if (validValues.length > 0 && !validValues.includes(String(value))) {
          return { coerced: null, error: `${field.name} must be one of: ${validValues.join(', ')}` };
        }
        return { coerced: String(value) };
      }

      default:
        return { coerced: String(value) };
    }
  }
}
