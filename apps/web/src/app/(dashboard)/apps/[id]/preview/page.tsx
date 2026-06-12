'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appsApi, runtimeApi } from '@/lib/api/endpoints';
import { FormEngine, TableRenderer } from '@/components/runtime/runtime-engine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Plus, Search, ChevronLeft, ChevronRight, X,
  Database, Loader2, ArrowLeft, Bot, Eye, Play, Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ApiClientError } from '@/lib/api/client';
import * as LucideIcons from 'lucide-react';

export default function AppPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const appId = params.id as string;

  const [selectedEntitySlug, setSelectedEntitySlug] = useState<string>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Record<string, unknown> | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Query App Details (to get all defined entities)
  const { data: app, isLoading: isAppLoading } = useQuery({
    queryKey: ['apps', appId],
    queryFn: () => appsApi.get(appId),
  });

  // Set the first entity as selected by default once app data loads
  useEffect(() => {
    if (app?.entities?.length > 0 && !selectedEntitySlug) {
      setSelectedEntitySlug(app.entities[0].slug);
    }
  }, [app, selectedEntitySlug]);

  // Fetch entity schema (field definitions) for the selected entity
  const { data: schema, isLoading: schemaLoading } = useQuery({
    queryKey: ['runtime', appId, selectedEntitySlug, 'schema'],
    queryFn: () => runtimeApi.getEntitySchema(appId, selectedEntitySlug),
    enabled: !!selectedEntitySlug,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch records for the selected entity
  const { data: records, isLoading: recordsLoading } = useQuery({
    queryKey: ['runtime', appId, selectedEntitySlug, 'records', { page, search: debouncedSearch }],
    queryFn: () => runtimeApi.list(appId, selectedEntitySlug, { page, limit: 25, search: debouncedSearch || undefined }),
    enabled: !!selectedEntitySlug && !!schema,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => runtimeApi.create(appId, selectedEntitySlug, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runtime', appId, selectedEntitySlug, 'records'] });
      toast.success('Record created!');
      setShowForm(false);
      setServerErrors({});
    },
    onError: (err) => {
      if (err instanceof ApiClientError && err.errors) {
        setServerErrors(err.errors);
      } else {
        toast.error(err instanceof ApiClientError ? err.message : 'Failed to create record');
      }
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      runtimeApi.update(appId, selectedEntitySlug, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runtime', appId, selectedEntitySlug, 'records'] });
      toast.success('Record updated!');
      setEditingRecord(null);
      setServerErrors({});
    },
    onError: (err) => {
      if (err instanceof ApiClientError && err.errors) setServerErrors(err.errors);
      else toast.error('Failed to update record');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => runtimeApi.delete(appId, selectedEntitySlug, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runtime', appId, selectedEntitySlug, 'records'] });
      toast.success('Record deleted');
    },
    onError: () => toast.error('Failed to delete record'),
  });

  const handleSubmit = async (data: Record<string, unknown>) => {
    if (editingRecord) {
      await updateMutation.mutateAsync({ id: editingRecord.id as string, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  if (isAppLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Loading preview engine...</p>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="text-center py-16">
        <Database className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
        <h2 className="text-xl font-semibold">Application not found</h2>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/apps">Back to apps</Link>
        </Button>
      </div>
    );
  }

  const entities = app.entities || [];
  const selectedEntity = entities.find((e: any) => e.slug === selectedEntitySlug);
  const totalPages = records?.totalPages ?? 1;
  const isFormVisible = showForm || !!editingRecord;

  return (
    <div className="space-y-6">
      {/* Top Preview Status Banner */}
      <div className="bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-lg p-4 flex items-center justify-between shadow-none">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-zinc-200/60 rounded-md shrink-0">
            <Eye className="w-4 h-4 text-zinc-900" />
          </div>
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-1.5 leading-none">
              Application Sandbox Mode
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              Currently running an isolated instance of <span className="font-semibold underline">{app.name}</span>. Data edited here modifies real records dynamically.
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="bg-white border-zinc-200 text-zinc-900 hover:bg-zinc-50 h-8 text-xs font-semibold">
          <Link href={`/apps/${appId}`}>
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Dashboard
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Entity Sidebar */}
        <div className="md:col-span-3 space-y-3">
          <Card className="border-border">
            <CardHeader className="py-4 px-5 border-b border-border">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                App Entities
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-1">
              {entities.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground italic">
                  No entities defined yet.
                </div>
              ) : (
                entities.map((entity: any) => {
                  const Icon = entity.icon ? (LucideIcons as any)[entity.icon] : Database;
                  const isSelected = selectedEntitySlug === entity.slug;

                  return (
                    <button
                      key={entity.slug}
                      onClick={() => {
                        setSelectedEntitySlug(entity.slug);
                        setSearch('');
                        setPage(1);
                        setShowForm(false);
                        setEditingRecord(null);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        isSelected
                          ? 'bg-zinc-100 text-zinc-950 font-semibold border border-zinc-200/50 shadow-none'
                          : 'text-muted-foreground hover:bg-zinc-50 hover:text-foreground'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-zinc-950' : ''}`} />
                      <span className="truncate">{entity.name}</span>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Live Runtime View Frame */}
        <div className="md:col-span-9 space-y-6">
          {selectedEntitySlug ? (
            schemaLoading ? (
              <div className="flex flex-col items-center justify-center min-h-[300px] space-y-3">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Resolving runtime entity schema...</p>
              </div>
            ) : schema && selectedEntity ? (
              <div className="space-y-6">
                {/* Actions & Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold tracking-tight">{selectedEntity.name}</h3>
                    {selectedEntity.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{selectedEntity.description}</p>
                    )}
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    className="w-fit"
                    onClick={() => { setShowForm(true); setEditingRecord(null); setServerErrors({}); }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    New Record
                  </Button>
                </div>

                {/* Form engine container */}
                {isFormVisible && (
                  <Card className="border-zinc-200 shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between py-3 px-5 border-b border-border">
                      <CardTitle className="text-sm font-bold">
                        {editingRecord ? `Edit ${selectedEntity.name}` : `Create New ${selectedEntity.name}`}
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => { setShowForm(false); setEditingRecord(null); setServerErrors({}); }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </CardHeader>
                    <CardContent className="p-5">
                      <FormEngine
                        fields={schema.fields}
                        initialValues={editingRecord ?? undefined}
                        onSubmit={handleSubmit}
                        submitLabel={editingRecord ? 'Update Record' : `Add ${selectedEntity.name}`}
                        onCancel={() => { setShowForm(false); setEditingRecord(null); }}
                        serverErrors={serverErrors}
                      />
                    </CardContent>
                  </Card>
                )}

                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder={`Search record data...`}
                    className="pl-9"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  />
                </div>

                {/* Table View */}
                <TableRenderer
                  fields={schema.fields}
                  records={records?.data ?? []}
                  onEdit={(record) => { setEditingRecord(record); setShowForm(false); setServerErrors({}); }}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  isLoading={recordsLoading}
                />

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-border pt-4 text-xs">
                    <p className="text-muted-foreground">
                      Page {page} of {totalPages} · {records?.total} total records
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
                <Database className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Selected entity could not be loaded</p>
              </div>
            )
          ) : (
            <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
              <Bot className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
              <h3 className="font-semibold text-sm">Welcome to Sandbox Preview</h3>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-1">
                Select an entity from the sidebar to test editing, adding, and viewing records within this metadata framework!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
