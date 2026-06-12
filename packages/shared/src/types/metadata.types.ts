// Core enums — single source of truth for both frontend and backend

export type FieldType = 'text' | 'number' | 'email' | 'boolean' | 'date' | 'select';

export type ComponentType =
  | 'input'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'date-picker'
  | 'table'
  | 'card'
  | 'search'
  | 'filter';

export type WorkflowTrigger = 'record_created' | 'record_updated' | 'record_deleted';

export type WorkflowActionType = 'create_notification' | 'create_record' | 'log_event';

export type WorkflowStatus = 'pending' | 'running' | 'success' | 'failed';

export type ImportStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type NotificationType =
  | 'workflow_executed'
  | 'record_created'
  | 'record_updated'
  | 'record_deleted'
  | 'csv_imported'
  | 'validation_warning';

export type AuditAction =
  | 'login'
  | 'logout'
  | 'register'
  | 'app_created'
  | 'app_updated'
  | 'app_deleted'
  | 'app_cloned'
  | 'metadata_updated'
  | 'metadata_published'
  | 'record_created'
  | 'record_updated'
  | 'record_deleted'
  | 'workflow_run'
  | 'csv_import_started'
  | 'csv_import_completed';

// ─── Metadata Types ──────────────────────────────────────────────────────────

export interface SelectOption {
  label: string;
  value: string;
}

export interface ValidationConfig {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  message?: string;
}

export interface DisplayConfig {
  labelField?: string;         // Field used as the display label in table rows
  defaultSort?: string;        // Field slug to sort by default
  defaultSortOrder?: 'asc' | 'desc';
  pageSize?: number;
  searchableFields?: string[]; // Field slugs that support search
}

export interface FieldDefinition {
  name: string;                        // Human-readable: "Email Address"
  slug: string;                        // URL-safe: "email_address"
  type: FieldType;
  required?: boolean;
  defaultValue?: string | number | boolean | null;
  options?: SelectOption[];            // Only for type: 'select'
  validation?: ValidationConfig;
  component?: ComponentType;           // Override default component
  displayIn?: ('table' | 'form' | 'detail')[];
  order?: number;
  placeholder?: string;
  helpText?: string;
}

export interface EntityDefinition {
  name: string;                        // "Employee"
  slug: string;                        // "employee"
  icon?: string;                       // Lucide icon name
  description?: string;
  fields: FieldDefinition[];
  display?: DisplayConfig;
}

export interface NavigationItem {
  label: string;
  entitySlug?: string;
  icon?: string;
  order?: number;
}

export interface ThemeConfig {
  primaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
}

export interface AppMetadata {
  name: string;
  description?: string;
  version: string;                     // semver e.g. "1.0.0"
  entities: EntityDefinition[];
  navigation?: NavigationItem[];
  theme?: ThemeConfig;
}

// ─── Workflow Types ───────────────────────────────────────────────────────────

export interface WorkflowActionConfig {
  title?: string;
  message?: string;
  entitySlug?: string;
  data?: Record<string, string>;       // Template strings: "{{record.name}}"
  level?: 'info' | 'warn' | 'error';
}

export interface WorkflowAction {
  type: WorkflowActionType;
  config: WorkflowActionConfig;
}

export interface WorkflowDefinition {
  name: string;
  entitySlug: string;
  trigger: WorkflowTrigger;
  isActive?: boolean;
  actions: WorkflowAction[];
}

// ─── Runtime Types ────────────────────────────────────────────────────────────

export type EntityRecord = Record<string, string | number | boolean | null>;

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ListQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

// ─── Validation / Repair Types ────────────────────────────────────────────────

export interface ValidationWarning {
  path: string;
  message: string;
  originalValue?: unknown;
  repairedValue?: unknown;
}

export interface ValidationError {
  path: string;
  message: string;
}

export interface RepairEntry {
  path: string;
  originalValue: unknown;
  repairedValue: unknown;
  reason: string;
}

export interface ValidationResult {
  isValid: boolean;
  repaired: AppMetadata;
  warnings: ValidationWarning[];
  errors: ValidationError[];
  repairs: RepairEntry[];
}

// ─── CSV Import Types ─────────────────────────────────────────────────────────

export interface DetectedColumn {
  name: string;
  inferredType: FieldType;
  confidence: number;       // 0–1
  sampleValues: string[];
}

export interface FieldMapping {
  csvColumn: string;
  fieldSlug: string;
}

export interface ImportRowFailure {
  rowNumber: number;
  rawData: Record<string, string>;
  errors: string[];
}

export interface ImportReport {
  totalRows: number;
  successRows: number;
  failedRows: number;
  failures: ImportRowFailure[];
}

// ─── AI Types ─────────────────────────────────────────────────────────────────

export interface AiSuggestion {
  type: 'add_field' | 'change_type' | 'add_workflow' | 'repair_schema';
  path: string;
  message: string;
  currentValue?: unknown;
  suggestedValue?: unknown;
}

export interface AiAnalysisResult {
  original: AppMetadata;
  repaired: AppMetadata;
  suggestions: AiSuggestion[];
  warnings: ValidationWarning[];
}

// ─── API Response Envelope ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: ValidationError[];
}

export interface ApiError {
  success: false;
  statusCode: number;
  message: string;
  errors?: Record<string, string[]>;
  timestamp: string;
  path: string;
}
