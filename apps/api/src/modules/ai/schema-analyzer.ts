import { Injectable, Logger } from '@nestjs/common';
import type {
  AppMetadata,
  AiSuggestion,
  AiAnalysisResult,
  ValidationWarning,
} from '@repo/shared/types';

/**
 * SchemaAnalyzer — rule-based AI suggestion engine.
 *
 * Design: Rule-based for MVP with zero external LLM dependency.
 * Rules are data-driven: new rules can be added without modifying control flow.
 *
 * Future: Replace or augment with Gemini/OpenAI via Vercel AI SDK
 * by wrapping this service behind an LlmAnalyzer interface.
 */
@Injectable()
export class SchemaAnalyzer {
  private readonly logger = new Logger(SchemaAnalyzer.name);

  analyze(metadata: AppMetadata): AiAnalysisResult {
    const suggestions: AiSuggestion[] = [];
    const warnings: ValidationWarning[] = [];
    let repaired = JSON.parse(JSON.stringify(metadata)) as AppMetadata;

    for (let i = 0; i < metadata.entities.length; i++) {
      const entity = metadata.entities[i];
      const entityPath = `entities[${i}]`;

      // Rule: Entity with no fields
      if (entity.fields.length === 0) {
        suggestions.push({
          type: 'add_field',
          path: `${entityPath}.fields`,
          message: `Entity "${entity.name}" has no fields. Consider adding core fields.`,
          suggestedValue: this.suggestCoreFields(entity.name),
        });
      }

      // Rule: Entity likely needs email field (contains "user", "customer", "employee", "contact")
      const emailEntities = ['user', 'customer', 'employee', 'contact', 'person', 'client', 'member'];
      const needsEmail = emailEntities.some((kw) => entity.name.toLowerCase().includes(kw));
      const hasEmail = entity.fields.some((f) => f.type === 'email' || f.slug.includes('email'));

      if (needsEmail && !hasEmail) {
        suggestions.push({
          type: 'add_field',
          path: `${entityPath}.fields`,
          message: `Entity "${entity.name}" likely needs an email field`,
          suggestedValue: { name: 'Email', slug: 'email', type: 'email', required: true },
        });
      }

      // Rule: Entity with "date" in name but no date field
      const needsDate = entity.name.toLowerCase().includes('event') || entity.name.toLowerCase().includes('appointment');
      const hasDate = entity.fields.some((f) => f.type === 'date');
      if (needsDate && !hasDate) {
        suggestions.push({
          type: 'add_field',
          path: `${entityPath}.fields`,
          message: `Entity "${entity.name}" likely needs a date field`,
          suggestedValue: { name: 'Date', slug: 'date', type: 'date', required: true },
        });
      }

      // Rule: Field named "phone" should be text (tel) not number
      for (let j = 0; j < entity.fields.length; j++) {
        const field = entity.fields[j];
        const fieldPath = `${entityPath}.fields[${j}]`;

        if ((field.slug.includes('phone') || field.name.toLowerCase().includes('phone')) && field.type === 'number') {
          suggestions.push({
            type: 'change_type',
            path: `${fieldPath}.type`,
            message: `Field "${field.name}" should be type "text" not "number" — phone numbers can contain +, -, and spaces`,
            currentValue: 'number',
            suggestedValue: 'text',
          });
          repaired.entities[i].fields[j] = { ...field, type: 'text' };
        }

        // Rule: Field named "status" should be select
        if ((field.slug === 'status' || field.name.toLowerCase() === 'status') && field.type === 'text') {
          suggestions.push({
            type: 'change_type',
            path: `${fieldPath}`,
            message: `Field "status" is typically better as a select field with predefined options`,
            currentValue: { type: 'text' },
            suggestedValue: {
              type: 'select',
              options: [
                { label: 'Active', value: 'active' },
                { label: 'Inactive', value: 'inactive' },
                { label: 'Pending', value: 'pending' },
              ],
            },
          });
        }

        // Rule: Field named "is_*" or "has_*" or "active" should be boolean
        const boolPrefixes = ['is_', 'has_', 'can_', 'should_'];
        const isBoolLike = boolPrefixes.some((p) => field.slug.startsWith(p)) ||
          field.slug === 'active' || field.slug === 'enabled' || field.slug === 'verified';

        if (isBoolLike && field.type !== 'boolean') {
          suggestions.push({
            type: 'change_type',
            path: `${fieldPath}.type`,
            message: `Field "${field.name}" (slug: ${field.slug}) looks like a boolean flag`,
            currentValue: field.type,
            suggestedValue: 'boolean',
          });
        }
      }

      // Rule: Suggest workflow for common entity types
      const workflowEntities = ['employee', 'order', 'ticket', 'task', 'lead'];
      if (workflowEntities.some((kw) => entity.slug.includes(kw))) {
        suggestions.push({
          type: 'add_workflow',
          path: `workflows`,
          message: `Consider adding a notification workflow for "${entity.name}" creation`,
          suggestedValue: {
            name: `Notify on ${entity.name} Created`,
            entitySlug: entity.slug,
            trigger: 'record_created',
            actions: [{ type: 'create_notification', config: { title: `New ${entity.name}`, message: `A new ${entity.name.toLowerCase()} was created` } }],
          },
        });
      }
    }

    this.logger.log(`Schema analysis complete: ${suggestions.length} suggestions for "${metadata.name}"`);

    return {
      original: metadata,
      repaired,
      suggestions,
      warnings,
    };
  }

  private suggestCoreFields(entityName: string): object[] {
    const name = entityName.toLowerCase();
    const fields: object[] = [
      { name: 'Name', slug: 'name', type: 'text', required: true, order: 0 },
    ];

    if (['user', 'employee', 'customer', 'contact'].some((k) => name.includes(k))) {
      fields.push({ name: 'Email', slug: 'email', type: 'email', required: true, order: 1 });
    }

    fields.push({ name: 'Created Date', slug: 'created_date', type: 'date', required: false, order: fields.length });

    return fields;
  }
}
