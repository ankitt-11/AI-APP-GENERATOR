'use client';

import { useQuery } from '@tanstack/react-query';
import { workflowsApi } from '@/lib/api/endpoints';
import { appsApi } from '@/lib/api/endpoints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Workflow, Plus, Zap, Clock, CheckCircle, XCircle } from 'lucide-react';
import { timeAgo } from '@/lib/utils';

export default function WorkflowsPage() {
  const { data: appsData } = useQuery({ queryKey: ['apps'], queryFn: () => appsApi.list() });
  const apps = appsData?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workflow Automation</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Automate actions triggered by data events</p>
        </div>
      </div>

      {apps.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16">
            <Workflow className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
            <h2 className="text-xl font-semibold">No applications yet</h2>
            <p className="text-muted-foreground text-sm mt-1">Create an application first to manage workflows</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {apps.map((app: any) => (
            <AppWorkflows key={app.id} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}

function AppWorkflows({ app }: { app: any }) {
  const { data: workflows, isLoading } = useQuery({
    queryKey: ['workflows', app.id],
    queryFn: () => workflowsApi.list(app.id),
  });

  const wfList = Array.isArray(workflows) ? workflows : [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center text-white text-xs font-bold">
            {app.name.charAt(0)}
          </span>
          {app.name}
          <Badge variant="secondary" className="text-xs ml-1">{wfList.length} workflows</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="h-12 shimmer-bg animate-shimmer rounded-lg" />
        ) : wfList.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No workflows yet. Open the app to create one.
          </p>
        ) : (
          <div className="space-y-2">
            {wfList.map((wf: any) => (
              <div key={wf.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <Zap className={`w-4 h-4 ${wf.isActive ? 'text-amber-500' : 'text-muted-foreground'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{wf.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Trigger: <span className="font-mono">{wf.trigger}</span>
                    {' · '}
                    {(wf.actions as any[]).length} action{(wf.actions as any[]).length !== 1 ? 's' : ''}
                    {' · '}
                    {wf._count?.runs ?? 0} runs
                  </p>
                </div>
                <Badge variant={wf.isActive ? 'success' : 'secondary'} className="text-xs shrink-0">
                  {wf.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
