import { api } from './client';
import type { AppMetadata } from '@repo/shared/types';

// ─── Auth ──────────────────────────────────────────────────────────────────

export const authApi = {
  register: (body: { email: string; name: string; password: string }) =>
    api.post<{ user: any; accessToken: string }>('/auth/register', body),

  login: (body: { email: string; password: string }) =>
    api.post<{ user: any; accessToken: string }>('/auth/login', body),

  getMe: () => api.get<any>('/auth/me'),

  updateProfile: (body: { name?: string }) => api.patch<any>('/auth/me', body),
};

// ─── Apps ──────────────────────────────────────────────────────────────────

export const appsApi = {
  getDashboard: () => api.get<any>('/apps/dashboard'),

  list: (page = 1, limit = 20) =>
    api.get<any>(`/apps?page=${page}&limit=${limit}`),

  get: (appId: string) => api.get<any>(`/apps/${appId}`),

  create: (body: { name: string; description?: string }) =>
    api.post<any>('/apps', body),

  update: (appId: string, body: { name?: string; description?: string }) =>
    api.patch<any>(`/apps/${appId}`, body),

  delete: (appId: string) => api.delete<any>(`/apps/${appId}`),

  clone: (appId: string) => api.post<any>(`/apps/${appId}/clone`),
};

// ─── Metadata ────────────────────────────────────────────────────────────────

export const metadataApi = {
  listVersions: (appId: string) =>
    api.get<any[]>(`/apps/${appId}/metadata`),

  getActive: (appId: string) =>
    api.get<AppMetadata>(`/apps/${appId}/metadata/active`),

  validate: (appId: string, definition: unknown) =>
    api.post<any>(`/apps/${appId}/metadata/validate`, { definition }),

  save: (appId: string, definition: unknown, changelog?: string) =>
    api.post<any>(`/apps/${appId}/metadata/save`, { definition, changelog }),

  publish: (appId: string, versionId: string) =>
    api.post<any>(`/apps/${appId}/metadata/${versionId}/publish`),
};

// ─── Runtime ──────────────────────────────────────────────────────────────────

export const runtimeApi = {
  getAppSchema: (appId: string) => api.get<any>(`/runtime/${appId}/schema`),

  getEntitySchema: (appId: string, entity: string) =>
    api.get<any>(`/runtime/${appId}/${entity}/schema`),

  list: (appId: string, entity: string, params?: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: string;
    order?: 'asc' | 'desc';
  }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.search) qs.set('search', params.search);
    if (params?.sort) qs.set('sort', params.sort);
    if (params?.order) qs.set('order', params.order);
    return api.get<any>(`/runtime/${appId}/${entity}?${qs.toString()}`);
  },

  get: (appId: string, entity: string, id: string) =>
    api.get<any>(`/runtime/${appId}/${entity}/${id}`),

  create: (appId: string, entity: string, body: Record<string, unknown>) =>
    api.post<any>(`/runtime/${appId}/${entity}`, body),

  update: (appId: string, entity: string, id: string, body: Record<string, unknown>) =>
    api.patch<any>(`/runtime/${appId}/${entity}/${id}`, body),

  delete: (appId: string, entity: string, id: string) =>
    api.delete<any>(`/runtime/${appId}/${entity}/${id}`),
};

// ─── Workflows ────────────────────────────────────────────────────────────────

export const workflowsApi = {
  list: (appId: string) => api.get<any[]>(`/apps/${appId}/workflows`),
  create: (appId: string, body: any) => api.post<any>(`/apps/${appId}/workflows`, body),
  update: (appId: string, wId: string, body: any) => api.patch<any>(`/apps/${appId}/workflows/${wId}`, body),
  delete: (appId: string, wId: string) => api.delete<any>(`/apps/${appId}/workflows/${wId}`),
  getRuns: (appId: string, wId: string, page = 1) =>
    api.get<any>(`/apps/${appId}/workflows/${wId}/runs?page=${page}`),
};

// ─── Notifications ────────────────────────────────────────────────────────────

export const notificationsApi = {
  list: (params?: { isRead?: boolean; page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.isRead !== undefined) qs.set('isRead', String(params.isRead));
    if (params?.page) qs.set('page', String(params.page));
    return api.get<any>(`/notifications?${qs.toString()}`);
  },
  getUnreadCount: () => api.get<number>('/notifications/unread-count'),
  markAsRead: (id: string) => api.patch<any>(`/notifications/${id}/read`),
  markAllAsRead: () => api.post<any>('/notifications/read-all'),
};

// ─── Audit ────────────────────────────────────────────────────────────────────

export const auditApi = {
  getLogs: (params?: { resource?: string; action?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.resource) qs.set('resource', params.resource);
    if (params?.action) qs.set('action', params.action);
    if (params?.page) qs.set('page', String(params.page));
    return api.get<any>(`/audit?${qs.toString()}`);
  },
};

// ─── AI ───────────────────────────────────────────────────────────────────────

export const aiApi = {
  analyze: (metadata: unknown) => api.post<any>('/ai/analyze', { metadata }),
};

// ─── CSV ──────────────────────────────────────────────────────────────────────

export const csvApi = {
  list: (appId: string, page = 1) =>
    api.get<any>(`/apps/${appId}/imports?page=${page}`),

  get: (appId: string, importId: string) =>
    api.get<any>(`/apps/${appId}/imports/${importId}`),

  upload: (appId: string, entityId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    form.append('entityId', entityId);
    return api.upload<any>(`/apps/${appId}/imports`, form);
  },

  process: (appId: string, importId: string, mappings: Array<{ csvColumn: string; fieldSlug: string }>) =>
    api.post<any>(`/apps/${appId}/imports/${importId}/process`, { mappings }),
};
