'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appsApi, metadataApi, workflowsApi } from '@/lib/api/endpoints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Settings, Play, Database, Workflow, History, Sparkles,
  CheckCircle2, AlertCircle, Calendar, ChevronRight, Plus, Loader2, ArrowRight,
  Shield, Upload, RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { timeAgo } from '@/lib/utils';
import { toast } from 'sonner';

export default function AppOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const appId = params.id as string;

  const [activeTab, setActiveTab] = useState<'entities' | 'versions' | 'workflows'>('entities');

  // Query App Details (which includes entities, metadata, count of workflows/imports)
  const { data: app, isLoading: isAppLoading, error: appError } = useQuery({
    queryKey: ['apps', appId],
    queryFn: () => appsApi.get(appId),
  });

  // Query metadata versions
  const { data: versions, isLoading: isVersionsLoading } = useQuery({
    queryKey: ['metadata-versions', appId],
    queryFn: () => metadataApi.listVersions(appId),
    enabled: !!appId,
  });

  // Query workflows
  const { data: workflows, isLoading: isWorkflowsLoading } = useQuery({
    queryKey: ['workflows', appId],
    queryFn: () => workflowsApi.list(appId),
    enabled: !!appId,
  });

  // Publish metadata version mutation
  const publishMutation = useMutation({
    mutationFn: (versionId: string) => metadataApi.publish(appId, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps', appId] });
      queryClient.invalidateQueries({ queryKey: ['metadata-versions', appId] });
      toast.success('Metadata version published successfully!');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to publish version');
    },
  });

  if (isAppLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Loading application data...</p>
      </div>
    );
  }

  if (appError || !app) {
    return (
      <div className="text-center py-16 max-w-md mx-auto space-y-4">
        <AlertCircle className="w-16 h-16 text-destructive mx-auto" />
        <h2 className="text-xl font-semibold">Failed to load application</h2>
        <p className="text-muted-foreground text-sm">
          The application might not exist, or you might not have permission to view it.
        </p>
        <Button asChild variant="outline">
          <Link href="/apps">Back to Applications</Link>
        </Button>
      </div>
    );
  }

  const activeMetadata = app.metadataVersions?.[0];

  return (
    <div className="space-y-8">
      {/* Breadcrumbs & Navigation */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/apps" className="hover:text-foreground">Applications</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground font-medium">{app.name}</span>
      </div>

      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-50 font-bold text-xl">
            {app.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{app.name}</h1>
              {activeMetadata && (
                <Badge variant="outline" className="border-zinc-200 text-zinc-800 bg-zinc-50 font-normal">
                  v{activeMetadata.definition.version || '1.0.0'}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              {app.description || 'No description provided.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button asChild variant="outline" size="sm">
            <Link href={`/apps/${appId}/builder`} className="flex items-center gap-1.5">
              <Settings className="w-4 h-4" />
              JSON Builder
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/apps/${appId}/entities`} className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              Visual Builder
            </Link>
          </Button>
          <Button asChild variant="default" size="sm">
            <Link href={`/apps/${appId}/preview`} className="flex items-center gap-1.5">
              <Play className="w-4 h-4" />
              Live Preview
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick stats / actions grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover:border-zinc-350 transition-all shadow-none bg-white">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-zinc-100 border border-zinc-200 text-zinc-900">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <p className="text-2xl font-bold">{app.entities?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Defined Entities</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:border-zinc-350 transition-all shadow-none bg-white">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-zinc-100 border border-zinc-200 text-zinc-900">
              <Workflow className="w-4 h-4" />
            </div>
            <div>
              <p className="text-2xl font-bold">{app._count?.workflows ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Workflows Automation</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:border-zinc-350 transition-all shadow-none bg-white">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-zinc-100 border border-zinc-200 text-zinc-900">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <p className="text-2xl font-bold">{app._count?.imports ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-0.5">CSV Import History</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Layout */}
      <div className="space-y-4">
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('entities')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-all -mb-px flex items-center gap-2 ${
              activeTab === 'entities'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Database className="w-4 h-4" />
            Entities
          </button>
          <button
            onClick={() => setActiveTab('versions')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-all -mb-px flex items-center gap-2 ${
              activeTab === 'versions'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <History className="w-4 h-4" />
            Metadata Version History
          </button>
          <button
            onClick={() => setActiveTab('workflows')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-all -mb-px flex items-center gap-2 ${
              activeTab === 'workflows'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Workflow className="w-4 h-4" />
            Workflows
          </button>
        </div>

        {/* Tab Contents */}
        {activeTab === 'entities' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Defined Entities</h3>
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/apps/${appId}/builder`}>
                    <Settings className="w-4 h-4" /> JSON
                  </Link>
                </Button>
                <Button asChild variant="default" size="sm">
                  <Link href={`/apps/${appId}/entities`}>
                    <Plus className="w-4 h-4" /> Add Entity
                  </Link>
                </Button>
              </div>
            </div>

            {app.entities?.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
                <Database className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                <h4 className="font-medium text-sm">No entities defined</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Use the Visual Builder to add entities with a simple form — no JSON needed.
                </p>
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button asChild variant="default" size="sm">
                    <Link href={`/apps/${appId}/entities`}>
                      <Sparkles className="w-3.5 h-3.5 mr-1" /> Visual Builder
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/apps/${appId}/builder`}>JSON Editor</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {app.entities.map((entity: any) => (
                  <Card key={entity.id} className="hover:shadow-md transition-shadow group">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-zinc-100 border border-zinc-200 text-zinc-950 flex items-center justify-center">
                              <Database className="w-4 h-4" />
                            </div>
                          <div>
                            <h4 className="font-bold text-base leading-none">{entity.name}</h4>
                            <p className="text-xs text-muted-foreground mt-1 font-mono">{entity.slug}</p>
                          </div>
                        </div>
                        <Button asChild variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                          <Link href={`/runtime/${appId}/${entity.slug}`}>
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                          </Link>
                        </Button>
                      </div>

                      {entity.description && (
                        <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                          {entity.description}
                        </p>
                      )}

                      <div className="mt-4 pt-4 border-t border-border space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fields ({entity.fields?.length ?? 0})</p>
                        <div className="flex flex-wrap gap-1">
                          {entity.fields?.map((field: any) => (
                            <Badge key={field.id} variant="secondary" className="text-[10px] font-normal px-2 py-0.5">
                              {field.name} <span className="text-muted-foreground ml-1">({field.type})</span>
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Updated {timeAgo(entity.updatedAt)}</span>
                        <Link href={`/runtime/${appId}/${entity.slug}`} className="text-primary font-medium hover:underline flex items-center gap-1">
                          Manage Data <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Versions Tab */}
        {activeTab === 'versions' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Metadata Release History</h3>
            {isVersionsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-xl shimmer-bg animate-shimmer" />
                ))}
              </div>
            ) : versions?.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
                <History className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No versions found</p>
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-6 py-3 font-medium text-muted-foreground">Version</th>
                      <th className="text-left px-6 py-3 font-medium text-muted-foreground">Changelog</th>
                      <th className="text-left px-6 py-3 font-medium text-muted-foreground">Created</th>
                      <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-right px-6 py-3 font-medium text-muted-foreground w-32">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versions?.map((ver: any) => (
                      <tr key={ver.id} className="border-b border-border last:border-0 hover:bg-muted/10">
                        <td className="px-6 py-4 font-semibold text-foreground">
                          v{ver.version}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground max-w-xs truncate">
                          {ver.changelog || <span className="italic text-xs">No description</span>}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                          {new Date(ver.createdAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          {ver.isActive ? (
                            <Badge variant="success" className="flex items-center gap-1 w-fit">
                              <CheckCircle2 className="w-3 h-3" /> Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="w-fit">Inactive</Badge>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {!ver.isActive && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs font-semibold"
                              disabled={publishMutation.isPending}
                              onClick={() => publishMutation.mutate(ver.id)}
                            >
                              {publishMutation.isPending && publishMutation.variables === ver.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : 'Publish'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Workflows Tab */}
        {activeTab === 'workflows' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Active Automations</h3>
              <Button asChild variant="outline" size="sm">
                <Link href="/workflows">
                  <Plus className="w-4 h-4" /> Create Workflow
                </Link>
              </Button>
            </div>

            {isWorkflowsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-32 rounded-xl shimmer-bg animate-shimmer" />
                ))}
              </div>
            ) : workflows?.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
                <Workflow className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                <h4 className="font-medium text-sm">No workflows configured</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Create trigger-based automations (e.g. send a notification when a record is created).
                </p>
                <Button asChild variant="default" className="mt-4" size="sm">
                  <Link href="/workflows">Build Workflow</Link>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workflows?.map((wf: any) => {
                  const targetEntity = app.entities?.find((e: any) => e.id === wf.entityId);
                  return (
                    <Card key={wf.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6 space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded bg-zinc-100 border border-zinc-200 text-zinc-900">
                              <Workflow className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <h4 className="font-bold text-sm leading-none">{wf.name}</h4>
                              <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                                Trigger: <Badge variant="secondary" className="text-[10px] font-mono lowercase px-1.5 py-0">{wf.trigger}</Badge>
                              </p>
                            </div>
                          </div>
                          <Badge variant={wf.isActive ? 'success' : 'secondary'}>
                            {wf.isActive ? 'Active' : 'Disabled'}
                          </Badge>
                        </div>

                        <div className="space-y-1.5 text-xs text-muted-foreground">
                          <p>
                            Target: <span className="text-foreground font-medium">{targetEntity ? targetEntity.name : 'All Entities'}</span>
                          </p>
                          <p>
                            Actions: <span className="text-foreground font-medium">{wf.actions?.length ?? 0} executors</span>
                          </p>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-4 border-t border-border">
                          <span>Configured {timeAgo(wf.createdAt)}</span>
                          <Link href="/workflows" className="text-primary font-medium hover:underline flex items-center gap-0.5">
                            Manage Workflow <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
