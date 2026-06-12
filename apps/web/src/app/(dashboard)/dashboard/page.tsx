'use client';

import { useQuery } from '@tanstack/react-query';
import { appsApi } from '@/lib/api/endpoints';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AppWindow, Database, Activity, TrendingUp, Plus, ArrowRight, Zap } from 'lucide-react';
import Link from 'next/link';
import { timeAgo, formatNumber } from '@/lib/utils';

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => appsApi.getDashboard(),
  });

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {greeting},{' '}
            <span className="text-gradient">{user?.name?.split(' ')[0] || 'there'}</span> 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            Here&apos;s what&apos;s happening with your applications today.
          </p>
        </div>
        <Button asChild variant="gradient">
          <Link href="/apps">
            <Plus className="w-4 h-4" />
            New Application
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Applications',
            value: stats?.appCount ?? 0,
            icon: AppWindow,
            color: 'text-zinc-800',
            bg: 'bg-zinc-100 border border-zinc-200/80',
            change: 'All time',
          },
          {
            label: 'Total Records',
            value: stats?.totalRecords ?? 0,
            icon: Database,
            color: 'text-zinc-800',
            bg: 'bg-zinc-100 border border-zinc-200/80',
            change: 'Across all entities',
          },
          {
            label: 'Workflows',
            value: 0,
            icon: Zap,
            color: 'text-zinc-800',
            bg: 'bg-zinc-100 border border-zinc-200/80',
            change: 'Active automations',
          },
          {
            label: 'Activity',
            value: stats?.recentAuditLogs?.length ?? 0,
            icon: Activity,
            color: 'text-zinc-800',
            bg: 'bg-zinc-100 border border-zinc-200/80',
            change: 'Recent events',
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="relative overflow-hidden group">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{isLoading ? '—' : formatNumber(stat.value)}</p>
                  <p className="text-sm font-medium mt-1">{stat.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.change}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Two-column section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Apps */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base">Recent Applications</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/apps">
                View all <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 rounded-lg shimmer-bg animate-shimmer" />
              ))
            ) : stats?.recentApps?.length === 0 ? (
              <div className="text-center py-8">
                <AppWindow className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No applications yet</p>
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link href="/apps">Create your first app</Link>
                </Button>
              </div>
            ) : (
              stats?.recentApps?.map((app: any) => (
                <Link
                  key={app.id}
                  href={`/apps/${app.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 border border-transparent hover:border-zinc-200 transition-all duration-150 group"
                >
                  <div className="w-8 h-8 rounded bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-950 text-xs font-bold shrink-0">
                    {app.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{app.name}</p>
                    <p className="text-xs text-muted-foreground">Updated {timeAgo(app.updatedAt)}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/audit">
                View all <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 rounded-lg shimmer-bg animate-shimmer" />
              ))
            ) : stats?.recentAuditLogs?.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No activity yet</p>
              </div>
            ) : (
              stats?.recentAuditLogs?.map((log: any, i: number) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <Badge variant="secondary" className="text-xs mr-2">{log.resource}</Badge>
                      {log.action.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0">{timeAgo(log.createdAt)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="bg-zinc-50 border border-zinc-250/70 shadow-none">
        <CardContent className="p-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1">
              <h3 className="font-semibold">Get started quickly</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Create an app, define entities, and start managing data in minutes
              </p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Button asChild variant="outline" size="sm">
                <Link href="/apps">Create App</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/imports">Import CSV</Link>
              </Button>
              <Button asChild size="sm" variant="default">
                <Link href="/workflows">Build Workflow</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
