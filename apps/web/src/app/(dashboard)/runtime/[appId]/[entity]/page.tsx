'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { runtimeApi } from '@/lib/api/endpoints';
import { FormEngine, TableRenderer } from '@/components/runtime/runtime-engine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Plus, Search, ChevronLeft, ChevronRight, X,
  Database, Loader2, ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ApiClientError } from '@/lib/api/client';
import * as LucideIcons from 'lucide-react';

export default function EntityRuntimePage() {
  const params = useParams();
  const appId = params.appId as string;
  const entitySlug = params.entity as string;
  const queryClient = useQueryClient();

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

  // Fetch entity schema (field definitions)
  const { data: schema, isLoading: schemaLoading } = useQuery({
    queryKey: ['runtime', appId, entitySlug, 'schema'],
    queryFn: () => runtimeApi.getEntitySchema(appId, entitySlug),
    staleTime: 5 * 60 * 1000, // Schema changes rarely
  });

  // Fetch records
  const { data: records, isLoading: recordsLoading } = useQuery({
    queryKey: ['runtime', appId, entitySlug, 'records', { page, search: debouncedSearch }],
    queryFn: () => runtimeApi.list(appId, entitySlug, { page, limit: 25, search: debouncedSearch || undefined }),
    enabled: !!schema,
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => runtimeApi.create(appId, entitySlug, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runtime', appId, entitySlug, 'records'] });
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

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      runtimeApi.update(appId, entitySlug, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runtime', appId, entitySlug, 'records'] });
      toast.success('Record updated!');
      setEditingRecord(null);
      setServerErrors({});
    },
    onError: (err) => {
      if (err instanceof ApiClientError && err.errors) setServerErrors(err.errors);
      else toast.error('Failed to update record');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => runtimeApi.delete(appId, entitySlug, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runtime', appId, entitySlug, 'records'] });
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

  if (schemaLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!schema) {
    return (
      <div className="text-center py-16">
        <Database className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
        <h2 className="text-xl font-semibold">Entity not found</h2>
        <p className="text-muted-foreground mt-2">The entity &quot;{entitySlug}&quot; could not be found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href={`/apps/${appId}`}><ArrowLeft className="w-4 h-4 mr-2" /> Back to app</Link>
        </Button>
      </div>
    );
  }

  const { entity, fields } = schema;
  const IconComponent = entity.icon ? (LucideIcons as any)[entity.icon] : Database;
  const totalPages = records?.totalPages ?? 1;

  const isFormVisible = showForm || !!editingRecord;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link href={`/apps/${appId}`}><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <div className="p-2 rounded-xl bg-primary/10">
            <IconComponent className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{entity.name}</h1>
            {entity.description && (
              <p className="text-sm text-muted-foreground">{entity.description}</p>
            )}
          </div>
          <Badge variant="secondary" className="ml-2">
            {records?.total ?? 0} records
          </Badge>
        </div>
        <Button
          variant="default"
          onClick={() => { setShowForm(true); setEditingRecord(null); setServerErrors({}); }}
        >
          <Plus className="w-4 h-4" />
          New {entity.name}
        </Button>
      </div>

      {/* Inline Form Panel */}
      {isFormVisible && (
        <Card className="border-zinc-200 shadow-none animate-fade-in bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base">
              {editingRecord ? `Edit ${entity.name}` : `New ${entity.name}`}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => { setShowForm(false); setEditingRecord(null); setServerErrors({}); }}
            >
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <FormEngine
              fields={fields}
              initialValues={editingRecord ?? undefined}
              onSubmit={handleSubmit}
              submitLabel={editingRecord ? 'Update' : `Create ${entity.name}`}
              onCancel={() => { setShowForm(false); setEditingRecord(null); }}
              serverErrors={serverErrors}
            />
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={`Search ${entity.name.toLowerCase()}s...`}
          className="pl-9"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {/* Table */}
      <TableRenderer
        fields={fields}
        records={records?.data ?? []}
        onEdit={(record) => { setEditingRecord(record); setShowForm(false); setServerErrors({}); }}
        onDelete={(id) => deleteMutation.mutate(id)}
        isLoading={recordsLoading}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} · {records?.total} total records
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
