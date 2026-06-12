import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import {
  AppMetadataSchema,
  FIELD_TYPE_ALIASES,
  COMPONENT_ALIASES,
} from '@repo/shared/validators';
import type {
  AppMetadata,
  ValidationResult,
  ValidationWarning,
  RepairEntry,
} from '@repo/shared/types';

/**
 * ValidationEngine — the metadata quality gate.
 *
 * Design Principles:
 * 1. NEVER throw — always return a result with repair information
 * 2. Repair what can be repaired (typos, missing defaults)
 * 3. Warn about issues that cannot be auto-repaired
 * 4. Produce structured reports for the UI diagnostics page
 */
@Injectable()
export class ValidationEngine {
  private readonly logger = new Logger(ValidationEngine.name);

  validate(rawInput: unknown): ValidationResult {
    const warnings: ValidationWarning[] = [];
    const repairs: RepairEntry[] = [];

    // Step 1: Pre-process — fix known typos before Zod validation
    const preprocessed = this.preprocess(rawInput, warnings, repairs);

    // Step 2: Parse with Zod (safe parse — never throws)
    const parsed = AppMetadataSchema.safeParse(preprocessed);

    if (parsed.success) {
      return {
        isValid: true,
        repaired: parsed.data as AppMetadata,
        warnings,
        errors: [],
        repairs,
      };
    }

    // Step 3: Attempt partial repair on Zod errors
    const { repaired, additionalWarnings, additionalRepairs } = this.repairFromZodErrors(
      preprocessed,
      parsed.error,
    );
    warnings.push(...additionalWarnings);
    repairs.push(...additionalRepairs);

    // Step 4: Re-parse repaired result
    const reParsed = AppMetadataSchema.safeParse(repaired);

    if (reParsed.success) {
      this.logger.warn(`Metadata repaired — ${repairs.length} corrections made`);
      return {
        isValid: true,
        repaired: reParsed.data as AppMetadata,
        warnings,
        errors: [],
        repairs,
      };
    }

    // Step 5: Some errors remain — still return repaired with remaining error list
    const remainingErrors = reParsed.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));

    this.logger.error(`Metadata has ${remainingErrors.length} unresolvable errors`);
    return {
      isValid: false,
      repaired: (reParsed.data ?? repaired) as AppMetadata,
      warnings,
      errors: remainingErrors,
      repairs,
    };
  }

  /**
   * Pre-processes raw input to fix known typos before Zod validation.
   * This runs BEFORE Zod to maximize the chance of clean validation.
   */
  private preprocess(
    input: unknown,
    warnings: ValidationWarning[],
    repairs: RepairEntry[],
  ): unknown {
    if (typeof input !== 'object' || input === null) return input;

    const obj = { ...(input as Record<string, unknown>) };

    // Fix missing top-level fields
    if (!obj.entities) {
      repairs.push({ path: 'entities', originalValue: undefined, repairedValue: [], reason: 'Missing entities array; defaulted to empty' });
      obj.entities = [];
    }

    if (!obj.version) {
      obj.version = '1.0.0';
    }

    // Process entities array
    if (Array.isArray(obj.entities)) {
      obj.entities = obj.entities.map((entity: unknown, entityIdx: number) => {
        if (typeof entity !== 'object' || entity === null) return entity;
        const e = { ...(entity as Record<string, unknown>) };

        // Fix entity slug
        if (!e.slug && e.name) {
          e.slug = String(e.name).toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        }

        // Default fields array
        if (!e.fields) {
          repairs.push({ path: `entities[${entityIdx}].fields`, originalValue: undefined, repairedValue: [], reason: 'Missing fields; defaulted to empty' });
          e.fields = [];
        }

        // Process fields
        if (Array.isArray(e.fields)) {
          e.fields = e.fields.map((field: unknown, fieldIdx: number) => {
            if (typeof field !== 'object' || field === null) return field;
            const f = { ...(field as Record<string, unknown>) };

            // Fix field slug
            if (!f.slug && f.name) {
              f.slug = String(f.name).toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
            }

            // Repair field type typos
            if (f.type && typeof f.type === 'string') {
              const normalized = f.type.toLowerCase().trim();
              if (FIELD_TYPE_ALIASES[normalized]) {
                const original = f.type;
                f.type = FIELD_TYPE_ALIASES[normalized];
                repairs.push({
                  path: `entities[${entityIdx}].fields[${fieldIdx}].type`,
                  originalValue: original,
                  repairedValue: f.type,
                  reason: `Unknown type "${original}" corrected to "${f.type}"`,
                });
                warnings.push({
                  path: `entities[${entityIdx}].fields[${fieldIdx}].type`,
                  message: `Field type "${original}" was corrected to "${f.type}"`,
                  originalValue: original,
                  repairedValue: f.type,
                });
              }
            }

            // Repair component type typos
            if (f.component && typeof f.component === 'string') {
              const normalized = f.component.toLowerCase().trim().replace(/[-_]/g, '');
              if (COMPONENT_ALIASES[normalized]) {
                const original = f.component;
                f.component = COMPONENT_ALIASES[normalized];
                repairs.push({
                  path: `entities[${entityIdx}].fields[${fieldIdx}].component`,
                  originalValue: original,
                  repairedValue: f.component,
                  reason: `Unknown component "${original}" mapped to "${f.component}"`,
                });
                warnings.push({
                  path: `entities[${entityIdx}].fields[${fieldIdx}].component`,
                  message: `Component "${original}" was mapped to fallback "${f.component}"`,
                  originalValue: original,
                  repairedValue: f.component,
                });
              } else if (!['input','textarea','select','checkbox','date-picker','table','card','search','filter'].includes(f.component)) {
                // Unknown component — remove and warn, UI will use default
                warnings.push({
                  path: `entities[${entityIdx}].fields[${fieldIdx}].component`,
                  message: `Unknown component "${f.component}" removed; default component will be used`,
                  originalValue: f.component,
                  repairedValue: undefined,
                });
                delete f.component;
              }
            }

            return f;
          });
        }

        return e;
      });
    }

    return obj;
  }

  /**
   * Attempts to repair specific Zod validation errors.
   */
  private repairFromZodErrors(
    input: unknown,
    error: z.ZodError,
  ): {
    repaired: unknown;
    additionalWarnings: ValidationWarning[];
    additionalRepairs: RepairEntry[];
  } {
    const additionalWarnings: ValidationWarning[] = [];
    const additionalRepairs: RepairEntry[] = [];

    // Deep clone to avoid mutation
    let repaired = JSON.parse(JSON.stringify(input));

    for (const issue of error.issues) {
      const path = issue.path;

      if (issue.code === 'invalid_enum_value') {
        // Try alias lookup again
        const received = (issue as z.ZodInvalidEnumValueIssue).received;
        if (typeof received === 'string') {
          const normalized = received.toLowerCase().trim();
          const fixed = FIELD_TYPE_ALIASES[normalized] || COMPONENT_ALIASES[normalized];
          if (fixed) {
            repaired = this.setNestedValue(repaired, path, fixed);
            additionalRepairs.push({
              path: path.join('.'),
              originalValue: received,
              repairedValue: fixed,
              reason: `Enum alias correction`,
            });
          } else {
            // Cannot repair — set to first valid value
            const firstValid = (issue as z.ZodInvalidEnumValueIssue).options[0];
            repaired = this.setNestedValue(repaired, path, firstValid);
            additionalWarnings.push({
              path: path.join('.'),
              message: `Invalid value "${received}" replaced with default "${firstValid}"`,
              originalValue: received,
              repairedValue: firstValid,
            });
          }
        }
      }
    }

    return { repaired, additionalWarnings, additionalRepairs };
  }

  private setNestedValue(obj: unknown, path: (string | number)[], value: unknown): unknown {
    if (path.length === 0) return value;
    if (typeof obj !== 'object' || obj === null) return obj;

    const clone = Array.isArray(obj) ? [...(obj as unknown[])] : { ...(obj as Record<string, unknown>) };
    const [head, ...rest] = path;

    if (rest.length === 0) {
      (clone as Record<string | number, unknown>)[head] = value;
    } else {
      (clone as Record<string | number, unknown>)[head] = this.setNestedValue(
        (clone as Record<string | number, unknown>)[head],
        rest,
        value,
      );
    }

    return clone;
  }
}
