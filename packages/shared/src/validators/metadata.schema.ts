import { z } from 'zod';
import type { FieldType, ComponentType, WorkflowTrigger, WorkflowActionType } from '../types/metadata.types';

// ─── Primitive Field Type Validator ──────────────────────────────────────────

const VALID_FIELD_TYPES: FieldType[] = ['text', 'number', 'email', 'boolean', 'date', 'select'];
const VALID_COMPONENTS: ComponentType[] = [
  'input', 'textarea', 'select', 'checkbox', 'date-picker',
  'table', 'card', 'search', 'filter',
];

// Typo correction map — used by normalization engine
export const FIELD_TYPE_ALIASES: Record<string, FieldType> = {
  txt: 'text',
  string: 'text',
  str: 'text',
  num: 'number',
  int: 'number',
  integer: 'number',
  float: 'number',
  decimal: 'number',
  bool: 'boolean',
  flag: 'boolean',
  mail: 'email',
  'e-mail': 'email',
  datetime: 'date',
  timestamp: 'date',
  dropdown: 'select',
  enum: 'select',
  choice: 'select',
};

export const COMPONENT_ALIASES: Record<string, ComponentType> = {
  textinput: 'input',
  text: 'input',
  textfield: 'input',
  textarea: 'textarea',
  multiline: 'textarea',
  dropdown: 'select',
  combobox: 'select',
  toggle: 'checkbox',
  datepicker: 'date-picker',
  calendar: 'date-picker',
  grid: 'table',
  datagrid: 'table',
  megagrid: 'table',
  list: 'table',
};

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

export const SelectOptionSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
});

export const ValidationConfigSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  pattern: z.string().optional(),
  message: z.string().optional(),
}).optional();

export const FieldDefinitionSchema = z.object({
  name: z.string().min(1, 'Field name is required'),
  slug: z.string().min(1).regex(/^[a-z0-9_]+$/, 'Slug must be lowercase letters, numbers, and underscores'),
  type: z.enum(['text', 'number', 'email', 'boolean', 'date', 'select']),
  required: z.boolean().optional().default(false),
  defaultValue: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  options: z.array(SelectOptionSchema).optional(),
  validation: ValidationConfigSchema,
  component: z.enum(['input', 'textarea', 'select', 'checkbox', 'date-picker', 'table', 'card', 'search', 'filter']).optional(),
  displayIn: z.array(z.enum(['table', 'form', 'detail'])).optional(),
  order: z.number().int().optional().default(0),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
});

export const DisplayConfigSchema = z.object({
  labelField: z.string().optional(),
  defaultSort: z.string().optional(),
  defaultSortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  pageSize: z.number().int().min(1).max(100).optional().default(25),
  searchableFields: z.array(z.string()).optional(),
}).optional();

export const EntityDefinitionSchema = z.object({
  name: z.string().min(1, 'Entity name is required'),
  slug: z.string().min(1).regex(/^[a-z0-9_]+$/, 'Slug must be lowercase letters, numbers, and underscores'),
  icon: z.string().optional(),
  description: z.string().optional(),
  fields: z.array(FieldDefinitionSchema).default([]),
  display: DisplayConfigSchema,
});

export const NavigationItemSchema = z.object({
  label: z.string().min(1),
  entitySlug: z.string().optional(),
  icon: z.string().optional(),
  order: z.number().int().optional(),
});

export const ThemeConfigSchema = z.object({
  primaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  fontFamily: z.string().optional(),
}).optional();

export const AppMetadataSchema = z.object({
  name: z.string().min(1, 'App name is required').max(100),
  description: z.string().max(500).optional(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be semver format (e.g. 1.0.0)').default('1.0.0'),
  entities: z.array(EntityDefinitionSchema).default([]),
  navigation: z.array(NavigationItemSchema).optional(),
  theme: ThemeConfigSchema,
});

// ─── Workflow Schemas ─────────────────────────────────────────────────────────

export const WorkflowActionConfigSchema = z.object({
  title: z.string().optional(),
  message: z.string().optional(),
  entitySlug: z.string().optional(),
  data: z.record(z.string()).optional(),
  level: z.enum(['info', 'warn', 'error']).optional().default('info'),
});

export const WorkflowActionSchema = z.object({
  type: z.enum(['create_notification', 'create_record', 'log_event']),
  config: WorkflowActionConfigSchema,
});

export const WorkflowDefinitionSchema = z.object({
  name: z.string().min(1, 'Workflow name is required'),
  entitySlug: z.string().min(1, 'Entity slug is required'),
  trigger: z.enum(['record_created', 'record_updated', 'record_deleted']),
  isActive: z.boolean().optional().default(true),
  actions: z.array(WorkflowActionSchema).min(1, 'At least one action is required'),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type AppMetadataInput = z.input<typeof AppMetadataSchema>;
export type AppMetadataOutput = z.output<typeof AppMetadataSchema>;
export type EntityDefinitionInput = z.input<typeof EntityDefinitionSchema>;
export type FieldDefinitionInput = z.input<typeof FieldDefinitionSchema>;
export type WorkflowDefinitionInput = z.input<typeof WorkflowDefinitionSchema>;

export { VALID_FIELD_TYPES, VALID_COMPONENTS };
