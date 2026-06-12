import { Injectable, Logger } from '@nestjs/common';
import * as Papa from 'papaparse';
import type { FieldType, DetectedColumn, FieldMapping, ImportReport, ImportRowFailure } from '@repo/shared/types';

/**
 * CsvParser — streaming CSV parser with type inference.
 *
 * Uses PapaParse for robust CSV handling (quoted fields, multi-line, etc.)
 * Type inference uses heuristic analysis of sample values.
 */
@Injectable()
export class CsvParser {
  private readonly logger = new Logger(CsvParser.name);

  /**
   * Parse CSV buffer into headers + rows.
   * Handles BOM, quoted fields, and variable delimiters.
   */
  parse(buffer: Buffer): { headers: string[]; rows: Record<string, string>[] } {
    const csv = buffer.toString('utf-8').replace(/^\uFEFF/, ''); // Strip BOM

    const result = Papa.parse<Record<string, string>>(csv, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      transform: (value) => value.trim(),
    });

    if (result.errors.length > 0) {
      this.logger.warn(`CSV parse warnings: ${result.errors.map((e) => e.message).join(', ')}`);
    }

    const headers = result.meta.fields ?? [];
    const rows = result.data;

    return { headers, rows };
  }

  /**
   * Infer field types from sample values using heuristic analysis.
   */
  inferTypes(headers: string[], rows: Record<string, string>[]): DetectedColumn[] {
    const sampleRows = rows.slice(0, 20); // Analyze first 20 rows

    return headers.map((header) => {
      const sampleValues = sampleRows
        .map((row) => row[header])
        .filter((v) => v !== undefined && v !== '');

      const inferredType = this.inferType(header, sampleValues);
      const confidence = this.calculateConfidence(inferredType, sampleValues);

      return {
        name: header,
        inferredType,
        confidence,
        sampleValues: sampleValues.slice(0, 5),
      };
    });
  }

  private inferType(columnName: string, values: string[]): FieldType {
    if (values.length === 0) return 'text';

    // Email heuristic — column name + value pattern
    const nameHint = columnName.toLowerCase();
    if (nameHint.includes('email') || nameHint.includes('mail')) {
      if (values.some((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))) return 'email';
    }

    // Boolean heuristic
    const boolValues = new Set(['true', 'false', 'yes', 'no', '1', '0', 'active', 'inactive']);
    if (values.every((v) => boolValues.has(v.toLowerCase()))) return 'boolean';

    // Date heuristic
    const dateFormats = [/^\d{4}-\d{2}-\d{2}$/, /^\d{2}\/\d{2}\/\d{4}$/, /^\d{2}-\d{2}-\d{4}$/];
    if (values.every((v) => dateFormats.some((re) => re.test(v)))) return 'date';

    // Number heuristic
    if (values.every((v) => !isNaN(Number(v)) && v !== '')) return 'number';

    // Select heuristic — low cardinality (≤ 10 unique values in sample)
    const uniqueValues = new Set(values.map((v) => v.toLowerCase()));
    if (uniqueValues.size <= 10 && values.length >= 5) return 'select';

    // Email value pattern check
    if (values.some((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))) return 'email';

    return 'text';
  }

  private calculateConfidence(type: FieldType, values: string[]): number {
    if (values.length === 0) return 0.5;

    const matches = values.filter((v) => {
      switch (type) {
        case 'email': return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        case 'number': return !isNaN(Number(v)) && v !== '';
        case 'boolean': return ['true', 'false', 'yes', 'no', '1', '0'].includes(v.toLowerCase());
        case 'date': return !isNaN(Date.parse(v));
        default: return true;
      }
    }).length;

    return Math.round((matches / values.length) * 100) / 100;
  }
}

@Injectable()
export class ImportProcessor {
  private readonly logger = new Logger(ImportProcessor.name);

  /**
   * Process rows in batches, validate against entity fields, collect failures.
   * Bad rows are quarantined — never stop the entire import.
   */
  async processRows(
    rows: Record<string, string>[],
    mappings: FieldMapping[],
    entityFields: Array<{ slug: string; type: string; required: boolean; options?: any }>,
  ): Promise<{
    validRecords: Record<string, unknown>[];
    report: ImportReport;
  }> {
    const validRecords: Record<string, unknown>[] = [];
    const failures: ImportRowFailure[] = [];

    const fieldMap = new Map(entityFields.map((f) => [f.slug, f]));
    const columnToField = new Map(mappings.map((m) => [m.csvColumn, m.fieldSlug]));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowErrors: string[] = [];
      const record: Record<string, unknown> = {};

      // Map CSV columns to entity field slugs
      for (const [csvColumn, fieldSlug] of columnToField.entries()) {
        const rawValue = row[csvColumn];
        const field = fieldMap.get(fieldSlug);

        if (!field) continue;

        if (!rawValue && field.required) {
          rowErrors.push(`"${csvColumn}" is required but was empty`);
          continue;
        }

        if (rawValue) {
          const coerced = this.coerceValue(rawValue, field.type, field.options);
          if (coerced.error) {
            rowErrors.push(`"${csvColumn}": ${coerced.error}`);
          } else {
            record[fieldSlug] = coerced.value;
          }
        }
      }

      if (rowErrors.length === 0) {
        validRecords.push(record);
      } else {
        failures.push({
          rowNumber: i + 2, // +2 for header row + 1-indexed
          rawData: row,
          errors: rowErrors,
        });
      }
    }

    const report: ImportReport = {
      totalRows: rows.length,
      successRows: validRecords.length,
      failedRows: failures.length,
      failures,
    };

    this.logger.log(`Import processed: ${validRecords.length} success, ${failures.length} failures of ${rows.length} total`);

    return { validRecords, report };
  }

  private coerceValue(
    raw: string,
    type: string,
    options?: { label: string; value: string }[],
  ): { value?: unknown; error?: string } {
    const trimmed = raw.trim();

    switch (type) {
      case 'number': {
        const n = Number(trimmed);
        if (isNaN(n)) return { error: `"${raw}" is not a valid number` };
        return { value: n };
      }
      case 'boolean': {
        const lower = trimmed.toLowerCase();
        if (['true', 'yes', '1', 'active'].includes(lower)) return { value: true };
        if (['false', 'no', '0', 'inactive'].includes(lower)) return { value: false };
        return { error: `"${raw}" is not a valid boolean` };
      }
      case 'date': {
        const date = new Date(trimmed);
        if (isNaN(date.getTime())) return { error: `"${raw}" is not a valid date` };
        return { value: date.toISOString().split('T')[0] };
      }
      case 'email': {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return { error: `"${raw}" is not a valid email` };
        return { value: trimmed };
      }
      case 'select': {
        if (options && options.length > 0) {
          const valid = options.find((o) => o.value === trimmed || o.label.toLowerCase() === trimmed.toLowerCase());
          if (!valid) return { error: `"${raw}" is not a valid option` };
          return { value: valid.value };
        }
        return { value: trimmed };
      }
      default:
        return { value: trimmed };
    }
  }
}
