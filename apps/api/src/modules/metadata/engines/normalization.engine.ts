import { Injectable } from '@nestjs/common';
import type { AppMetadata, EntityDefinition, FieldDefinition } from '@repo/shared/types';

/**
 * NormalizationEngine — post-validation pass that enforces canonical form.
 *
 * It runs AFTER ValidationEngine confirms the structure is valid.
 * Responsibilities:
 * - Ensure slugs are canonical (lowercase, underscored)
 * - De-duplicate field slugs within an entity
 * - Sort fields by order property
 * - Ensure select fields have options array
 * - Ensure navigation matches entity slugs
 */
@Injectable()
export class NormalizationEngine {
  normalize(metadata: AppMetadata): { normalized: AppMetadata; changes: string[] } {
    const changes: string[] = [];

    const normalized: AppMetadata = {
      ...metadata,
      name: metadata.name.trim(),
      version: metadata.version || '1.0.0',
      entities: metadata.entities.map((entity) => this.normalizeEntity(entity, changes)),
    };

    // Normalize navigation — remove entries pointing to non-existent entities
    if (normalized.navigation) {
      const entitySlugs = new Set(normalized.entities.map((e) => e.slug));
      const originalNavLength = normalized.navigation.length;
      normalized.navigation = normalized.navigation.filter(
        (nav) => !nav.entitySlug || entitySlugs.has(nav.entitySlug),
      );
      if (normalized.navigation.length !== originalNavLength) {
        changes.push(`Removed ${originalNavLength - normalized.navigation.length} navigation items with invalid entity slugs`);
      }
      // Sort by order
      normalized.navigation.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }

    return { normalized, changes };
  }

  private normalizeEntity(entity: EntityDefinition, changes: string[]): EntityDefinition {
    const slug = this.canonicalSlug(entity.slug || entity.name);
    if (slug !== entity.slug) {
      changes.push(`Entity slug normalized: "${entity.slug}" → "${slug}"`);
    }

    // De-duplicate field slugs
    const seenSlugs = new Set<string>();
    const fields = entity.fields
      .map((field) => this.normalizeField(field, changes))
      .filter((field) => {
        if (seenSlugs.has(field.slug)) {
          changes.push(`Duplicate field slug "${field.slug}" in entity "${slug}" removed`);
          return false;
        }
        seenSlugs.add(field.slug);
        return true;
      })
      // Sort by order, then name
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // Assign sequential order
    const sortedFields = fields.map((f, idx) => ({ ...f, order: idx }));

    return { ...entity, slug, fields: sortedFields };
  }

  private normalizeField(field: FieldDefinition, changes: string[]): FieldDefinition {
    const slug = this.canonicalSlug(field.slug || field.name);
    if (slug !== field.slug) {
      changes.push(`Field slug normalized: "${field.slug}" → "${slug}"`);
    }

    // Select fields must have options
    if (field.type === 'select' && (!field.options || field.options.length === 0)) {
      changes.push(`Select field "${slug}" had no options; added placeholder`);
      return {
        ...field,
        slug,
        options: [{ label: 'Option 1', value: 'option_1' }],
      };
    }

    // Boolean fields should not have options
    if (field.type === 'boolean' && field.options) {
      changes.push(`Boolean field "${slug}" had options removed (not applicable)`);
      const { options: _removed, ...rest } = field;
      return { ...rest, slug };
    }

    return { ...field, slug };
  }

  private canonicalSlug(input: string): string {
    return input
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 64);
  }
}
