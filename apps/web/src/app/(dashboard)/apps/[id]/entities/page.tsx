'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { metadataApi, appsApi } from '@/lib/api/endpoints';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Trash2, Save, ArrowLeft, Database, Loader2,
  ChevronDown, ChevronUp, GripVertical, CheckCircle2,
  AlertCircle, Sparkles, Type, Hash, Mail, ToggleLeft,
  Calendar, List, Eye, EyeOff
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { FieldType, EntityDefinition, FieldDefinition, AppMetadata } from '@repo/shared/types/metadata.types';

// ─── Constants ─────────────────────────────────────────────────────────────────

const FIELD_TYPES: { value: FieldType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'text',    label: 'Text',     icon: <Type className="w-3.5 h-3.5" />,       description: 'Short text, names, titles' },
  { value: 'number',  label: 'Number',   icon: <Hash className="w-3.5 h-3.5" />,       description: 'Integers and decimals' },
  { value: 'email',   label: 'Email',    icon: <Mail className="w-3.5 h-3.5" />,       description: 'Validated email address' },
  { value: 'boolean', label: 'Boolean',  icon: <ToggleLeft className="w-3.5 h-3.5" />, description: 'True / False toggle' },
  { value: 'date',    label: 'Date',     icon: <Calendar className="w-3.5 h-3.5" />,   description: 'Date picker' },
  { value: 'select',  label: 'Select',   icon: <List className="w-3.5 h-3.5" />,       description: 'Dropdown with options' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function slugify(str: string) {
  return str.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function makeId() {
  return Math.random().toString(36).slice(2, 8);
}

// ─── Sub-components ────────────────────────────────────────────────────────────

interface FieldRowProps {
  field: FieldDefinition & { _id: string };
  onUpdate: (updated: Partial<FieldDefinition>) => void;
  onRemove: () => void;
}

function FieldRow({ field, onUpdate, onRemove }: FieldRowProps) {
  const [open, setOpen] = useState(false);
  const [optionInput, setOptionInput] = useState('');

  const addOption = () => {
    const label = optionInput.trim();
    if (!label) return;
    const options = [...(field.options ?? []), { label, value: slugify(label) }];
    onUpdate({ options });
    setOptionInput('');
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card transition-all">
      {/* Field Header Row */}
      <div className="flex items-center gap-3 p-3 bg-muted/30">
        <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />

        {/* Field Name */}
        <Input
          value={field.name}
          onChange={(e) => {
            const name = e.target.value;
            onUpdate({ name, slug: slugify(name) });
          }}
          placeholder="Field name"
          className="h-8 text-sm flex-1 min-w-0"
        />

        {/* Type Selector */}
        <select
          value={field.type}
          onChange={(e) => onUpdate({ type: e.target.value as FieldType, options: e.target.value === 'select' ? [] : undefined })}
          className="h-8 text-xs px-2 rounded-md border border-input bg-background text-foreground shrink-0"
        >
          {FIELD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        {/* Required Toggle */}
        <button
          onClick={() => onUpdate({ required: !field.required })}
          title={field.required ? 'Required — click to make optional' : 'Optional — click to make required'}
          className={`h-8 px-2.5 text-[11px] font-medium rounded-md border transition-colors shrink-0 ${
            field.required
              ? 'bg-foreground text-background border-foreground'
              : 'bg-background text-muted-foreground border-input hover:border-foreground/40'
          }`}
        >
          {field.required ? 'Required' : 'Optional'}
        </button>

        {/* Expand */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground"
        >
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Delete */}
        <button
          onClick={onRemove}
          className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Slug preview */}
      <div className="px-4 py-1.5 bg-muted/10 border-t border-border/50 flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground font-mono">slug: <span className="text-foreground">{field.slug || '—'}</span></span>
        {field.placeholder !== undefined && (
          <span className="text-[10px] text-muted-foreground ml-3">placeholder: <span className="text-foreground">{field.placeholder || '—'}</span></span>
        )}
      </div>

      {/* Expanded Options */}
      {open && (
        <div className="p-4 border-t border-border space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Placeholder text</Label>
              <Input
                value={field.placeholder ?? ''}
                onChange={(e) => onUpdate({ placeholder: e.target.value })}
                placeholder="e.g. Enter your name..."
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Help text</Label>
              <Input
                value={field.helpText ?? ''}
                onChange={(e) => onUpdate({ helpText: e.target.value })}
                placeholder="e.g. This will be shown in the table"
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Select options */}
          {field.type === 'select' && (
            <div className="space-y-2">
              <Label className="text-xs">Dropdown Options</Label>
              <div className="flex gap-2">
                <Input
                  value={optionInput}
                  onChange={(e) => setOptionInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addOption()}
                  placeholder="Type option label and press Enter"
                  className="h-8 text-sm flex-1"
                />
                <Button size="sm" variant="outline" onClick={addOption} className="h-8">Add</Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(field.options ?? []).map((opt, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted border border-border text-xs">
                    {opt.label}
                    <button
                      onClick={() => onUpdate({ options: field.options?.filter((_, i) => i !== idx) })}
                      className="text-muted-foreground hover:text-destructive ml-0.5"
                    >×</button>
                  </span>
                ))}
                {(field.options ?? []).length === 0 && (
                  <span className="text-xs text-muted-foreground italic">No options yet</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Entity Card ───────────────────────────────────────────────────────────────

interface InternalField extends FieldDefinition { _id: string; }
interface InternalEntity extends Omit<EntityDefinition, 'fields'> { _id: string; fields: InternalField[]; _collapsed: boolean; }

interface EntityCardProps {
  entity: InternalEntity;
  onUpdate: (updated: Partial<InternalEntity>) => void;
  onRemove: () => void;
}

function EntityCard({ entity, onUpdate, onRemove }: EntityCardProps) {
  const addField = () => {
    const newField: InternalField = {
      _id: makeId(),
      name: '',
      slug: '',
      type: 'text',
      required: false,
      order: entity.fields.length,
    };
    onUpdate({ fields: [...entity.fields, newField] });
  };

  const updateField = (idx: number, changes: Partial<FieldDefinition>) => {
    const updated = entity.fields.map((f, i) => (i === idx ? { ...f, ...changes } : f));
    onUpdate({ fields: updated });
  };

  const removeField = (idx: number) => {
    onUpdate({ fields: entity.fields.filter((_, i) => i !== idx) });
  };

  return (
    <Card className="border-border shadow-sm overflow-hidden">
      {/* Entity Header */}
      <div className="flex items-center gap-3 p-4 bg-muted/20 border-b border-border">
        <div className="p-2 rounded-lg bg-foreground text-background shrink-0">
          <Database className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Entity Name *</Label>
            <Input
              value={entity.name}
              onChange={(e) => {
                const name = e.target.value;
                onUpdate({ name, slug: slugify(name) });
              }}
              placeholder="e.g. Product, Employee, Order"
              className="h-9 font-semibold"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Description (optional)</Label>
            <Input
              value={entity.description ?? ''}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="What does this entity represent?"
              className="h-9"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onUpdate({ _collapsed: !entity._collapsed })}
            className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground"
          >
            {entity._collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button
            onClick={onRemove}
            className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Slug */}
      <div className="px-4 py-1.5 bg-muted/10 border-b border-border/50 flex items-center gap-3">
        <span className="text-[10px] font-mono text-muted-foreground">
          slug: <span className="text-foreground font-medium">{entity.slug || '—'}</span>
        </span>
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
          {entity.fields.length} field{entity.fields.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Fields */}
      {!entity._collapsed && (
        <CardContent className="p-4 space-y-3">
          {entity.fields.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-border rounded-xl">
              <Type className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No fields yet — add your first field below</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entity.fields.map((field, idx) => (
                <FieldRow
                  key={field._id}
                  field={field}
                  onUpdate={(changes) => updateField(idx, changes)}
                  onRemove={() => removeField(idx)}
                />
              ))}
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={addField}
            className="w-full h-9 border-dashed text-muted-foreground hover:text-foreground hover:border-foreground/40 mt-1"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Field
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Field Type Legend ─────────────────────────────────────────────────────────

function FieldTypeLegend() {
  return (
    <Card className="border-border bg-card shadow-none">
      <CardContent className="p-4 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Field Types</h3>
        <div className="space-y-2">
          {FIELD_TYPES.map((t) => (
            <div key={t.value} className="flex items-center gap-2.5">
              <div className="p-1 rounded bg-muted text-muted-foreground shrink-0">{t.icon}</div>
              <div>
                <p className="text-xs font-medium">{t.label}</p>
                <p className="text-[10px] text-muted-foreground">{t.description}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function VisualEntityBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const appId = params.id as string;

  const [entities, setEntities] = useState<InternalEntity[]>([]);
  const [changelog, setChangelog] = useState('');
  const [previewJson, setPreviewJson] = useState(false);

  // Fetch active metadata
  const { data: activeMetadata, isLoading } = useQuery({
    queryKey: ['active-metadata', appId],
    queryFn: () => metadataApi.getActive(appId),
    enabled: !!appId,
  });

  // Fetch app info for name/version
  const { data: app } = useQuery({
    queryKey: ['apps', appId],
    queryFn: () => appsApi.get(appId),
    enabled: !!appId,
  });

  // Hydrate from existing metadata
  useEffect(() => {
    if (activeMetadata?.entities) {
      const hydrated: InternalEntity[] = activeMetadata.entities.map((e: EntityDefinition) => ({
        ...e,
        _id: makeId(),
        _collapsed: false,
        fields: (e.fields ?? []).map((f: FieldDefinition) => ({ ...f, _id: makeId() })),
      }));
      setEntities(hydrated);
    }
  }, [activeMetadata]);

  // Build the AppMetadata JSON from current state
  const buildMetadata = useCallback((): AppMetadata => {
    return {
      name: activeMetadata?.name ?? app?.name ?? 'My App',
      description: activeMetadata?.description ?? app?.description ?? '',
      version: activeMetadata?.version ?? '1.0.0',
      entities: entities.map(({ _id, _collapsed, fields, ...entity }) => ({
        ...entity,
        fields: fields.map(({ _id, ...field }) => ({
          ...field,
          order: fields.indexOf({ _id, ...field } as InternalField),
        })),
      })),
      navigation: activeMetadata?.navigation,
      theme: activeMetadata?.theme,
    };
  }, [entities, activeMetadata, app]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (body: { definition: AppMetadata; changelog: string }) =>
      metadataApi.save(appId, body.definition, body.changelog),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['apps', appId] });
      queryClient.invalidateQueries({ queryKey: ['metadata-versions', appId] });
      queryClient.invalidateQueries({ queryKey: ['active-metadata', appId] });
      toast.success(`✅ Saved! Version v${res.version} is now active.`);
      router.push(`/apps/${appId}`);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to save entities');
    },
  });

  const handleSave = () => {
    // Basic validation
    for (const entity of entities) {
      if (!entity.name.trim()) {
        toast.error('Each entity must have a name.');
        return;
      }
      if (entity.fields.length === 0) {
        toast.error(`Entity "${entity.name}" has no fields. Add at least one.`);
        return;
      }
      for (const field of entity.fields) {
        if (!field.name.trim()) {
          toast.error(`All fields in "${entity.name}" must have a name.`);
          return;
        }
        if (field.type === 'select' && (!field.options || field.options.length === 0)) {
          toast.error(`Select field "${field.name}" in "${entity.name}" needs at least one option.`);
          return;
        }
      }
    }
    if (!changelog.trim()) {
      toast.error('Please describe what changed (changelog is required).');
      return;
    }
    saveMutation.mutate({ definition: buildMetadata(), changelog: changelog.trim() });
  };

  const addEntity = () => {
    setEntities((prev) => [
      ...prev,
      {
        _id: makeId(),
        _collapsed: false,
        name: '',
        slug: '',
        description: '',
        fields: [],
      },
    ]);
  };

  const updateEntity = (idx: number, changes: Partial<InternalEntity>) => {
    setEntities((prev) => prev.map((e, i) => (i === idx ? { ...e, ...changes } : e)));
  };

  const removeEntity = (idx: number) => {
    setEntities((prev) => prev.filter((_, i) => i !== idx));
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Loading your app entities…</p>
      </div>
    );
  }

  const generatedJson = JSON.stringify(buildMetadata(), null, 2);

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8">
            <Link href={`/apps/${appId}`}><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Visual Entity Builder
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add entities and fields visually — no JSON required
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPreviewJson((v) => !v)}
            className="h-8 text-xs text-muted-foreground"
          >
            {previewJson ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
            {previewJson ? 'Hide JSON' : 'Preview JSON'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="h-8 text-xs"
          >
            <Link href={`/apps/${appId}/builder`}>Advanced JSON Editor</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Editor */}
        <div className="lg:col-span-8 space-y-4">
          {/* Entities */}
          {entities.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl">
              <Database className="w-14 h-14 text-muted-foreground/15 mx-auto mb-4" />
              <h3 className="font-semibold text-base">No entities yet</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                Click below to add your first entity — like "Product", "Customer", or "Order".
              </p>
              <Button onClick={addEntity} className="mt-5" size="sm">
                <Plus className="w-4 h-4 mr-1.5" /> Add First Entity
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {entities.map((entity, idx) => (
                <EntityCard
                  key={entity._id}
                  entity={entity}
                  onUpdate={(changes) => updateEntity(idx, changes)}
                  onRemove={() => removeEntity(idx)}
                />
              ))}
            </div>
          )}

          {/* Add Entity Button */}
          {entities.length > 0 && (
            <Button
              variant="outline"
              onClick={addEntity}
              className="w-full h-11 border-dashed text-muted-foreground hover:text-foreground hover:border-foreground/40"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Another Entity
            </Button>
          )}

          {/* JSON Preview */}
          {previewJson && (
            <Card className="border-border bg-muted/20 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-b border-border">
                <span className="text-xs font-mono text-muted-foreground">Generated JSON Preview</span>
                <Badge variant="secondary" className="text-[10px]">Read-only</Badge>
              </div>
              <pre className="p-4 text-xs font-mono overflow-auto max-h-[400px] leading-relaxed text-foreground/80">
                {generatedJson}
              </pre>
            </Card>
          )}

          {/* Save Panel */}
          <Card className="border-border bg-card">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">Save Changes</h3>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="changelog-visual" className="text-xs">
                  What changed? <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="changelog-visual"
                  placeholder="e.g. Added Product entity with name, price, and stock fields"
                  value={changelog}
                  onChange={(e) => setChangelog(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  This creates a new metadata version. Your existing data stays safe.
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/apps/${appId}`}>Discard</Link>
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saveMutation.isPending || entities.length === 0 || !changelog.trim()}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  ) : (
                    <Save className="w-4 h-4 mr-1.5" />
                  )}
                  Save & Publish
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          {/* Stats */}
          <Card className="border-border bg-card shadow-none">
            <CardContent className="p-4 space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Summary</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Entities</span>
                  <Badge variant="secondary">{entities.length}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Fields</span>
                  <Badge variant="secondary">
                    {entities.reduce((sum, e) => sum + e.fields.length, 0)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Required Fields</span>
                  <Badge variant="secondary">
                    {entities.reduce((sum, e) => sum + e.fields.filter((f) => f.required).length, 0)}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <FieldTypeLegend />

          {/* Tips */}
          <Card className="border-border bg-card shadow-none">
            <CardContent className="p-4 space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">💡 Tips</h3>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex gap-2"><span className="text-foreground font-bold shrink-0">1.</span> Give each entity a clear name (e.g. "Customer")</li>
                <li className="flex gap-2"><span className="text-foreground font-bold shrink-0">2.</span> Add all the columns/fields you need</li>
                <li className="flex gap-2"><span className="text-foreground font-bold shrink-0">3.</span> Mark important fields as <strong className="text-foreground">Required</strong></li>
                <li className="flex gap-2"><span className="text-foreground font-bold shrink-0">4.</span> Use <strong className="text-foreground">Select</strong> type for dropdowns</li>
                <li className="flex gap-2"><span className="text-foreground font-bold shrink-0">5.</span> Write a changelog and click <strong className="text-foreground">Save & Publish</strong></li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
