'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '@/lib/api/endpoints';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ClipboardList, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { timeAgo } from '@/lib/utils';

const actionColors: Record<string, string> = {
  login: 'info',
  register: 'success',
  app_created: 'success',
  app_deleted: 'warning',
  app_cloned: 'info',
  metadata_updated: 'info',
  metadata_published: 'success',
  record_created: 'success',
  record_updated: 'info',
  record_deleted: 'warning',
  workflow_run: 'info',
  csv_import_started: 'info',
  csv_import_completed: 'success',
};

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit', { page }],
    queryFn: () => auditApi.getLogs({ page }),
  });

  const logs = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Track all activity and changes in your workspace</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Filter by action or resource..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl shimmer-bg animate-shimmer" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">No audit logs yet</h2>
        </div>
      ) : (
        <div className="space-y-1.5">
          {logs
            .filter((log: any) =>
              !search ||
              log.action.includes(search.toLowerCase()) ||
              log.resource.includes(search.toLowerCase()),
            )
            .map((log: any, i: number) => (
              <Card key={i} className="hover:shadow-sm transition-shadow">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex-1 flex items-center gap-3 min-w-0">
                    <Badge variant={(actionColors[log.action] || 'secondary') as any} className="text-xs shrink-0">
                      {log.action.replace(/_/g, ' ')}
                    </Badge>
                    <span className="text-sm text-muted-foreground truncate">
                      {log.resource}
                      {log.resourceId && <span className="text-xs ml-1 font-mono opacity-60">{log.resourceId.slice(0, 8)}…</span>}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{timeAgo(log.createdAt)}</span>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
