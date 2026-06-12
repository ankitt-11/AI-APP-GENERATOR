'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/lib/api/endpoints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  User, Mail, Shield, Save, CheckCircle2,
  Server, Database, AlertCircle, Loader2, Sparkles, Key
} from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || '');

  const updateMutation = useMutation({
    mutationFn: () => authApi.updateProfile({ name }),
    onSuccess: (updatedUser) => {
      updateUser(updatedUser);
      toast.success('Profile details updated successfully!');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update profile');
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    updateMutation.mutate();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Settings</h1>
        <p className="text-muted-foreground mt-1">Configure profile details and review platform API specifications</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Form Column */}
        <div className="md:col-span-2 space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-border py-4">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4.5 h-4.5 text-primary" /> Profile Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSave} className="space-y-5">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name-input">Display Name *</Label>
                    <Input
                      id="name-input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                      disabled={updateMutation.isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email-display">Email Address (Primary Account)</Label>
                    <div className="relative">
                      <Input
                        id="email-display"
                        value={user?.email || ''}
                        disabled
                        className="bg-muted/40 cursor-not-allowed pl-9"
                      />
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Contact support to modify the account username or primary email address.</p>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-border mt-6">
                  <Button
                    type="submit"
                    variant="default"
                    disabled={updateMutation.isPending || !name.trim() || name === user?.name}
                  >
                    {updateMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    ) : (
                      <Save className="w-4 h-4 mr-1.5" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* System Diagnostics */}
          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-border py-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="w-4.5 h-4.5 text-zinc-900" /> Platform Connections & Diagnostics
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-success/10 text-success flex items-center justify-center">
                    <Server className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">NestJS REST Core API</p>
                    <p className="text-[10px] text-muted-foreground">Gateway & Microservice Controller</p>
                  </div>
                </div>
                <Badge variant="success" className="text-[9px] uppercase tracking-wider">Connected</Badge>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-success/10 text-success flex items-center justify-center">
                    <Database className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">PostgreSQL Relational DB</p>
                    <p className="text-[10px] text-muted-foreground">ACID Persisted JSONB Storage</p>
                  </div>
                </div>
                <Badge variant="success" className="text-[9px] uppercase tracking-wider">Operational</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Info Column */}
        <div className="space-y-6">
          <Card className="border-border shadow-sm bg-gradient-to-br from-card to-muted/20">
            <CardHeader className="py-4 px-5 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5 uppercase tracking-wider text-muted-foreground">
                <Shield className="w-4 h-4 text-primary" /> API Specifications
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold flex items-center justify-between">
                    <span>Default Rate Limit</span>
                    <Badge variant="secondary" className="text-[9px]">100 req/min</Badge>
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Enforced globally across non-state-mutating API gateway routes per client IP.</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-semibold flex items-center justify-between">
                    <span>State Mutation limits</span>
                    <Badge variant="secondary" className="text-[9px]">20 req/min</Badge>
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Enforced on register, login, create, update, delete, and metadata release actions.</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-semibold flex items-center justify-between">
                    <span>CSV Upload Limits</span>
                    <Badge variant="secondary" className="text-[9px]">10 MB</Badge>
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Max CSV dataset size limit. Processing is streamed in batches directly in-memory.</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-semibold flex items-center justify-between">
                    <span>Security Protocol</span>
                    <Badge variant="outline" className="border-zinc-200 text-zinc-900 text-[9px] bg-zinc-50">JWT Auth</Badge>
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Token expiration is set to 15m. Sub-second ownership validation is forced on every request.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
