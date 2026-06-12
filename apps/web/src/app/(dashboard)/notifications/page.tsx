'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api/endpoints';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Bell, CheckCheck, Workflow, Database, Upload, AlertTriangle, Info } from 'lucide-react';
import { timeAgo } from '@/lib/utils';
import { toast } from 'sonner';

const typeConfig: Record<string, { icon: React.ElementType; variant: 'success' | 'info' | 'warning' | 'secondary' }> = {
  workflow_executed: { icon: Workflow, variant: 'success' },
  record_created: { icon: Database, variant: 'info' },
  record_updated: { icon: Database, variant: 'info' },
  record_deleted: { icon: Database, variant: 'warning' },
  csv_imported: { icon: Upload, variant: 'success' },
  validation_warning: { icon: AlertTriangle, variant: 'warning' },
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list({ page: 1 }),
  });

  const markAllMutation = useMutation({
    mutationFn: notificationsApi.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      toast.success('All notifications marked as read');
    },
  });

  const markReadMutation = useMutation({
    mutationFn: notificationsApi.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  const notifications = data?.data ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            Notifications
            {unreadCount > 0 && (
              <Badge variant="default" className="text-xs">{unreadCount} new</Badge>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Stay updated with your application activity</p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
          >
            <CheckCheck className="w-4 h-4 mr-2" />
            Mark all as read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl shimmer-bg animate-shimmer" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">All caught up!</h2>
          <p className="text-muted-foreground text-sm mt-1">No notifications to show</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif: any) => {
            const config = typeConfig[notif.type] || { icon: Info, variant: 'secondary' as const };
            const Icon = config.icon;

            return (
              <Card
                key={notif.id}
                className={`transition-all cursor-pointer ${!notif.isRead ? 'border-primary/30 bg-primary/2' : ''}`}
                onClick={() => !notif.isRead && markReadMutation.mutate(notif.id)}
              >
                <CardContent className="flex items-start gap-4 p-4">
                  <div className={`p-2 rounded-xl shrink-0 ${!notif.isRead ? 'bg-primary/10' : 'bg-muted/50'}`}>
                    <Icon className={`w-4 h-4 ${!notif.isRead ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium ${!notif.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {notif.title}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        {!notif.isRead && <div className="w-2 h-2 rounded-full bg-primary" />}
                        <span className="text-xs text-muted-foreground">{timeAgo(notif.createdAt)}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{notif.message}</p>
                    <Badge variant={config.variant as any} className="text-xs mt-2">
                      {notif.type.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
