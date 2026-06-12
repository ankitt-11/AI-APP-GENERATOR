import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CsvParser, ImportProcessor } from './csv.parser';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import type { FieldMapping } from '@repo/shared/types';

@Injectable()
export class CsvService {
  private readonly logger = new Logger(CsvService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly csvParser: CsvParser,
    private readonly importProcessor: ImportProcessor,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Stage 1: Upload and analyze CSV.
   * Returns detected columns and sample data for the user to review field mapping.
   */
  async uploadAndAnalyze(
    appId: string,
    userId: string,
    entityId: string,
    file: Express.Multer.File,
  ) {
    const { headers, rows } = this.csvParser.parse(file.buffer);
    const detectedColumns = this.csvParser.inferTypes(headers, rows);

    // Get entity fields for mapping suggestions
    const entity = await this.prisma.entity.findFirst({
      where: { id: entityId, appId },
      include: { fields: { orderBy: { order: 'asc' } } },
    });
    if (!entity) throw new NotFoundException('Entity not found');

    // Create import record
    const importRecord = await this.prisma.import.create({
      data: {
        appId,
        userId,
        entityId,
        filename: file.originalname,
        status: 'pending',
        totalRows: rows.length,
      },
    });

    // Store parsed rows temporarily in import.report for later processing
    // (In production, store to object storage like S3; here we store in DB for simplicity)
    await this.prisma.import.update({
      where: { id: importRecord.id },
      data: {
        report: { _parsedRows: rows, _detectedColumns: detectedColumns } as any,
      },
    });

    // Suggest field mappings — match by name similarity
    const suggestedMappings = this.suggestMappings(detectedColumns, entity.fields);

    await this.audit.log({
      userId,
      action: 'csv_import_started',
      resource: 'imports',
      resourceId: importRecord.id,
      after: { filename: file.originalname, totalRows: rows.length, entityId },
    });

    return {
      importId: importRecord.id,
      filename: file.originalname,
      totalRows: rows.length,
      detectedColumns,
      entityFields: entity.fields.map((f) => ({ slug: f.slug, name: f.name, type: f.type, required: f.required })),
      suggestedMappings,
    };
  }

  /**
   * Stage 2: Process import with confirmed field mappings.
   */
  async processImport(
    importId: string,
    appId: string,
    userId: string,
    mappings: FieldMapping[],
  ) {
    const importRecord = await this.prisma.import.findFirst({
      where: { id: importId, appId, userId },
    });
    if (!importRecord) throw new NotFoundException('Import not found');

    const entity = await this.prisma.entity.findFirst({
      where: { id: importRecord.entityId },
      include: { fields: true },
    });
    if (!entity) throw new NotFoundException('Entity not found');

    // Mark as processing
    await this.prisma.import.update({
      where: { id: importId },
      data: { status: 'processing', mappings: mappings as any },
    });

    // Retrieve parsed rows from temp storage
    const storedReport = importRecord.report as any;
    const rows = storedReport?._parsedRows ?? [];

    // Process in batches
    const { validRecords, report } = await this.importProcessor.processRows(
      rows,
      mappings,
      entity.fields.map((f) => ({
        slug: f.slug,
        type: f.type,
        required: f.required,
        options: f.options as any,
      })),
    );

    // Bulk insert valid records
    if (validRecords.length > 0) {
      // Batch in groups of 100 for performance
      const batches = this.chunk(validRecords, 100);
      for (const batch of batches) {
        await this.prisma.entityRecord.createMany({
          data: batch.map((data) => ({ entityId: entity.id, data: data as any })),
        });
      }
    }

    // Update import record
    const finalReport = { ...report, _parsedRows: undefined, _detectedColumns: undefined };
    await this.prisma.import.update({
      where: { id: importId },
      data: {
        status: 'completed',
        successRows: report.successRows,
        failedRows: report.failedRows,
        totalRows: report.totalRows,
        report: finalReport as any,
        completedAt: new Date(),
      },
    });

    // Notify user
    await this.notifications.create({
      userId,
      type: 'csv_imported',
      title: 'CSV Import Completed',
      message: `Imported ${report.successRows} records successfully. ${report.failedRows} rows had errors.`,
      metadata: { appId, importId, entitySlug: entity.slug },
    });

    await this.audit.log({
      userId,
      action: 'csv_import_completed',
      resource: 'imports',
      resourceId: importId,
      after: { successRows: report.successRows, failedRows: report.failedRows },
    });

    return { importId, report: finalReport };
  }

  async listImports(appId: string, userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [imports, total] = await Promise.all([
      this.prisma.import.findMany({
        where: { appId, userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, filename: true, status: true, totalRows: true,
          successRows: true, failedRows: true, createdAt: true, completedAt: true,
        },
      }),
      this.prisma.import.count({ where: { appId, userId } }),
    ]);
    return { data: imports, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getImport(importId: string, appId: string, userId: string) {
    const importRecord = await this.prisma.import.findFirst({
      where: { id: importId, appId, userId },
    });
    if (!importRecord) throw new NotFoundException('Import not found');
    return importRecord;
  }

  private suggestMappings(
    detectedColumns: Array<{ name: string; inferredType: string }>,
    entityFields: Array<{ slug: string; name: string; type: string }>,
  ): FieldMapping[] {
    return detectedColumns.map((col) => {
      const colNormalized = col.name.toLowerCase().replace(/[\s_-]/g, '');

      // Find best matching field by name similarity
      const match = entityFields.find((f) => {
        const fieldNormalized = f.slug.replace(/_/g, '');
        const fieldNameNorm = f.name.toLowerCase().replace(/[\s_-]/g, '');
        return fieldNormalized === colNormalized || fieldNameNorm === colNormalized;
      });

      return {
        csvColumn: col.name,
        fieldSlug: match?.slug ?? '',
      };
    }).filter((m) => m.fieldSlug !== '');
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
      arr.slice(i * size, i * size + size),
    );
  }
}
