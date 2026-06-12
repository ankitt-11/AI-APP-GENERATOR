'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appsApi } from '@/lib/api/endpoints';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Search, AppWindow, Calendar, Database,
  Copy, Trash2, ArrowRight, MoreVertical, Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { timeAgo } from '@/lib/utils';
import { toast } from 'sonner';
import { ApiClientError } from '@/lib/api/client';

export default function AppsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newApp, setNewApp] = useState({ name: '', description: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['apps'],
    queryFn: () => appsApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: appsApi.create,
    onSuccess: (app) => {
      queryClient.invalidateQueries({ queryKey: ['apps'] });
      toast.success(`"${app.name}" created!`);
      setShowCreateForm(false);
      setNewApp({ name: '', description: '' });
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : 'Failed to create app');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (appId: string) => appsApi.delete(appId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps'] });
      toast.success('Application deleted');
    },
  });

  const cloneMutation = useMutation({
    mutationFn: (appId: string) => appsApi.clone(appId),
    onSuccess: (app) => {
      queryClient.invalidateQueries({ queryKey: ['apps'] });
      toast.success(`Cloned as "${app.name}"`);
    },
  });

  const apps = data?.data ?? [];
  const filtered = apps.filter((a: any) =>
    a.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Applications</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage your metadata-driven applications</p>
        </div>
        <Button variant="default" onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4" />
          New App
        </Button>
      </div>

      {/* Create form inline */}
      {showCreateForm && (
        <Card className="border-zinc-200 shadow-none animate-fade-in">
          <CardContent className="p-6 space-y-4">
            <h2 className="font-semibold">Create New Application</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="app-name">Application Name *</Label>
                <Input
                  id="app-name"
                  placeholder="e.g. HR Management System"
                  value={newApp.name}
                  onChange={(e) => setNewApp((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="app-desc">Description</Label>
                <Input
                  id="app-desc"
                  placeholder="Optional description"
                  value={newApp.description}
                  onChange={(e) => setNewApp((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setShowCreateForm(false)}>Cancel</Button>
              <Button
                variant="default"
                disabled={!newApp.name.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate(newApp)}
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Create Application
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search applications..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Apps Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 rounded-xl shimmer-bg animate-shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <AppWindow className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
          <h2 className="text-lg font-semibold">No applications found</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {search ? 'Try a different search term' : 'Create your first application to get started'}
          </p>
          {!search && (
            <Button variant="default" className="mt-4" onClick={() => setShowCreateForm(true)}>
              <Plus className="w-4 h-4" />
              Create First App
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((app: any) => (
            <Card key={app.id} className="group relative overflow-hidden border border-zinc-200 hover:border-zinc-350 transition-all duration-150 shadow-none bg-white">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-8 h-8 rounded bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-950 font-bold text-sm">
                    {app.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => cloneMutation.mutate(app.id)}
                      title="Clone"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Delete "${app.name}"? This cannot be undone.`)) {
                          deleteMutation.mutate(app.id);
                        }
                      }}
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mb-4">
                  <h3 className="font-semibold text-lg leading-tight">{app.name}</h3>
                  {app.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{app.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                  <span className="flex items-center gap-1">
                    <Database className="w-3.5 h-3.5" />
                    {app._count?.entities ?? 0} entities
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {timeAgo(app.updatedAt)}
                  </span>
                </div>

                <Link
                  href={`/apps/${app.id}`}
                  className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-muted/50 hover:bg-accent transition-colors text-sm font-medium group/link"
                >
                  Open Application
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover/link:text-foreground group-hover/link:translate-x-0.5 transition-transform" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
