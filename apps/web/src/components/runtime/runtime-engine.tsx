'use client';

import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { FieldDefinition } from '@repo/shared/types';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Info, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Field Renderer ───────────────────────────────────────────────────────────

interface FieldRendererProps {
  field: FieldDefinition;
  value?: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  disabled?: boolean;
}

export const FieldRenderer = React.memo(function FieldRenderer({
  field, value, onChange, error, disabled,
}: FieldRendererProps) {
  const component = field.component || getDefaultComponent(field.type);
  const commonProps = {
    id: `field-${field.slug}`,
    disabled,
    placeholder: field.placeholder,
    'aria-describedby': error ? `error-${field.slug}` : undefined,
  };

  const renderInput = () => {
    switch (component) {
      case 'input':
      case undefined: {
        const inputType = field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text';
        return (
          <Input
            {...commonProps}
            type={inputType}
            value={value as string || ''}
            onChange={(e) => onChange(e.target.value)}
            className={cn(error && 'border-destructive')}
          />
        );
      }

      case 'textarea':
        return (
          <Textarea
            {...commonProps}
            value={value as string || ''}
            onChange={(e) => onChange(e.target.value)}
            className={cn('min-h-[100px]', error && 'border-destructive')}
          />
        );

      case 'select':
        return (
          <select
            {...commonProps}
            value={value as string || ''}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-destructive',
            )}
          >
            <option value="">{field.placeholder || `Select ${field.name}...`}</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        );

      case 'checkbox':
        return (
          <div className="flex items-center gap-2">
            <input
              {...commonProps}
              type="checkbox"
              checked={value === true || value === 'true'}
              onChange={(e) => onChange(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
            />
            <span className="text-sm text-muted-foreground">{field.helpText || field.name}</span>
          </div>
        );

      case 'date-picker':
        return (
          <Input
            {...commonProps}
            type="date"
            value={value as string || ''}
            onChange={(e) => onChange(e.target.value)}
            className={cn(error && 'border-destructive')}
          />
        );

      default:
        // Graceful fallback for unknown components
        return (
          <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50 border border-dashed border-border">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-sm text-muted-foreground">
              Unknown component &quot;{component}&quot; — using text input
            </span>
            <Input
              {...commonProps}
              value={value as string || ''}
              onChange={(e) => onChange(e.target.value)}
            />
          </div>
        );
    }
  };

  if (component === 'checkbox') {
    return (
      <div className="space-y-1">
        {renderInput()}
        {error && (
          <p id={`error-${field.slug}`} className="text-xs text-destructive flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`field-${field.slug}`}>
        {field.name}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {renderInput()}
      {field.helpText && !error && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Info className="w-3 h-3" />
          {field.helpText}
        </p>
      )}
      {error && (
        <p id={`error-${field.slug}`} className="text-xs text-destructive flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
});

// ─── Form Engine ──────────────────────────────────────────────────────────────

interface FormEngineProps {
  fields: FieldDefinition[];
  initialValues?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  submitLabel?: string;
  onCancel?: () => void;
  serverErrors?: Record<string, string[]>;
}

export function FormEngine({
  fields,
  initialValues,
  onSubmit,
  submitLabel = 'Save',
  onCancel,
  serverErrors,
}: FormEngineProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamically build Zod schema from field definitions
  const zodSchema = React.useMemo(() => buildZodSchema(fields), [fields]);
  const defaultValues = React.useMemo(() => buildDefaultValues(fields, initialValues), [fields, initialValues]);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(zodSchema),
    defaultValues,
  });

  // Form fields displayed in form view
  const formFields = fields
    .filter((f) => !f.displayIn || f.displayIn.includes('form'))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const handleFormSubmit = async (data: Record<string, unknown>) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit as any)} className="space-y-5">
      {formFields.map((field) => {
        const fieldError = (errors as any)[field.slug]?.message as string | undefined;
        const serverError = serverErrors?.[field.slug]?.[0];
        const error = fieldError || serverError;

        return (
          <Controller
            key={field.slug}
            name={field.slug as any}
            control={control}
            render={({ field: { value, onChange } }) => (
              <FieldRenderer
                field={field}
                value={value}
                onChange={onChange}
                error={error}
                disabled={isSubmitting}
              />
            )}
          />
        );
      })}

      <div className="flex gap-3 justify-end pt-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="gradient" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

// ─── Table Renderer ───────────────────────────────────────────────────────────

interface TableRendererProps {
  fields: FieldDefinition[];
  records: Record<string, unknown>[];
  onEdit?: (record: Record<string, unknown>) => void;
  onDelete?: (id: string) => void;
  isLoading?: boolean;
}

export function TableRenderer({ fields, records, onEdit, onDelete, isLoading }: TableRendererProps) {
  const tableFields = fields
    .filter((f) => !f.displayIn || f.displayIn.includes('table'))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .slice(0, 6); // Max 6 columns in table view

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg shimmer-bg animate-shimmer" />
        ))}
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
        <p className="text-muted-foreground text-sm">No records yet. Create the first one!</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {tableFields.map((f) => (
                <th key={f.slug} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                  {f.name}
                  {f.required && <span className="text-destructive ml-1 text-xs">*</span>}
                </th>
              ))}
              {(onEdit || onDelete) && (
                <th className="px-4 py-3 text-right font-medium text-muted-foreground w-24">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {records.map((record, idx) => (
              <tr
                key={(record.id as string) || idx}
                className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
              >
                {tableFields.map((f) => (
                  <td key={f.slug} className="px-4 py-3 whitespace-nowrap max-w-[200px] truncate">
                    {formatCellValue(record[f.slug], f)}
                  </td>
                ))}
                {(onEdit || onDelete) && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {onEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => onEdit(record)}
                        >
                          Edit
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs hover:text-destructive"
                          onClick={() => {
                            if (confirm('Delete this record?')) {
                              onDelete(record.id as string);
                            }
                          }}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDefaultComponent(type: string): string {
  switch (type) {
    case 'boolean': return 'checkbox';
    case 'select': return 'select';
    case 'date': return 'date-picker';
    default: return 'input';
  }
}

function formatCellValue(value: unknown, field: FieldDefinition): React.ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  switch (field.type) {
    case 'boolean':
      return (
        <Badge variant={value === true || value === 'true' ? 'success' : 'secondary'} className="text-xs">
          {value === true || value === 'true' ? 'Yes' : 'No'}
        </Badge>
      );
    case 'select': {
      const option = field.options?.find((o) => o.value === String(value));
      return option ? (
        <Badge variant="outline" className="text-xs">{option.label}</Badge>
      ) : String(value);
    }
    case 'email':
      return <a href={`mailto:${value}`} className="text-primary hover:underline">{String(value)}</a>;
    case 'number':
      return <span className="font-mono">{Number(value).toLocaleString()}</span>;
    default:
      return String(value);
  }
}

function buildZodSchema(fields: FieldDefinition[]): z.ZodObject<any> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    let schema: z.ZodTypeAny;

    switch (field.type) {
      case 'number':
        schema = z.coerce.number({ invalid_type_error: `${field.name} must be a number` });
        if (field.validation?.min !== undefined) schema = (schema as z.ZodNumber).min(field.validation.min);
        if (field.validation?.max !== undefined) schema = (schema as z.ZodNumber).max(field.validation.max);
        if (!field.required) schema = schema.optional();
        break;

      case 'boolean':
        schema = z.boolean().optional();
        break;

      case 'email':
        schema = z.string().email(`${field.name} must be a valid email`);
        if (!field.required) schema = schema.optional().or(z.literal(''));
        break;

      case 'date':
        schema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${field.name} must be a valid date`);
        if (!field.required) schema = schema.optional().or(z.literal(''));
        break;

      default:
        schema = z.string();
        if (field.validation?.maxLength) schema = (schema as z.ZodString).max(field.validation.maxLength);
        if (!field.required) schema = schema.optional().or(z.literal(''));
    }

    if (field.required && field.type !== 'boolean' && field.type !== 'number') {
      schema = z.string().min(1, `${field.name} is required`);
      if (field.type === 'email') schema = z.string().email(`${field.name} must be a valid email`);
    }

    shape[field.slug] = schema;
  }

  return z.object(shape);
}

function buildDefaultValues(
  fields: FieldDefinition[],
  initialValues?: Record<string, unknown>,
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const field of fields) {
    defaults[field.slug] = initialValues?.[field.slug] ?? field.defaultValue ?? (field.type === 'boolean' ? false : '');
  }
  return defaults;
}
