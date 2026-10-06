import {
  ActivityItem,
  Attachment,
  DashboardSummary,
  GalleryItem,
  Memory,
  Reminder,
  SearchResponse,
  SuggestResponse,
  Tag,
  User,
} from './types';

const TOKEN_KEY = 'memovault_token';
const USER_KEY = 'memovault_user';

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

export function setSession(token: string, user: User, remember = true): void {
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getCurrentStoredUser(): User | null {
  const raw = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearSession();
    window.dispatchEvent(new CustomEvent('auth:expired'));
    throw new Error('Please log in first.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = data.error || data.detail || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  // Auth
  register: (username: string, password: string, displayName?: string) =>
    request<{ userId: string; username: string; displayName?: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, display_name: displayName }),
    }),

  login: (username: string, password: string) =>
    request<{ token: string; refreshToken: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  getMe: () => request<User>('/api/auth/me'),

  // Dashboard
  getDashboardSummary: (range = '1Y') =>
    request<DashboardSummary>(`/api/dashboard/summary?range=${encodeURIComponent(range)}`),

  // Memories
  listMemories: (params?: {
    category?: string;
    mood?: string;
    tag?: string;
    from?: string;
    to?: string;
    is_favorite?: boolean;
    is_archived?: boolean;
    trash_only?: boolean;
  }) => {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.mood) query.set('mood', params.mood);
    if (params?.tag) query.set('tag', params.tag);
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    if (params?.is_favorite) query.set('is_favorite', 'true');
    if (params?.is_archived) query.set('is_archived', 'true');
    if (params?.trash_only) query.set('trash_only', 'true');
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request<Memory[]>(`/api/memories${qs}`);
  },

  getMemory: (id: string) => request<Memory>(`/api/memories/${id}`),

  createMemory: (data: {
    title: string;
    date: string;
    description: string;
    category?: string;
    mood?: string;
    location_name?: string;
    latitude?: number | null;
    longitude?: number | null;
    people?: string[];
    tags?: string[];
    is_favorite?: boolean;
    is_pinned?: boolean;
  }) =>
    request<Memory & { suggestedCategory?: string; suggestionConfidence?: number }>('/api/memories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateMemory: (id: string, data: Partial<{
    title: string;
    date: string;
    description: string;
    category: string;
    mood: string;
    location_name: string;
    latitude: number | null;
    longitude: number | null;
    people: string[];
    tags: string[];
    is_favorite: boolean;
    is_pinned: boolean;
    is_archived: boolean;
  }>) =>
    request<{ message: string; memoryId: string }>(`/api/memories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteMemory: (id: string, purge = false) =>
    request<{ message: string; memoryId: string }>(
      `/api/memories/${id}?confirm=true${purge ? '&purge=true' : ''}`,
      { method: 'DELETE' }
    ),

  restoreMemory: (id: string) =>
    request<{ message: string; memoryId: string }>(`/api/memories/${id}/restore`, {
      method: 'POST',
    }),

  // Attachments
  uploadAttachments: (memoryId: string, files: File[]) => {
    const formData = new FormData();
    for (const f of files) {
      formData.append('files', f);
    }
    return request<Attachment[]>(`/api/memories/${memoryId}/attachments`, {
      method: 'POST',
      body: formData,
    });
  },

  deleteAttachment: (attachmentId: string) =>
    request<{ message: string }>(`/api/attachments/${attachmentId}`, {
      method: 'DELETE',
    }),

  getAttachmentUrl: (attachmentId: string) => {
    const token = getToken();
    return `/api/attachments/${attachmentId}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },

  // Gallery
  listGallery: (params?: { category?: string; year?: string; type?: string }) => {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.year) query.set('year', params.year);
    if (params?.type) query.set('type', params.type);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request<GalleryItem[]>(`/api/gallery${qs}`);
  },

  // Tags & Reminders
  listTags: () => request<Tag[]>('/api/tags'),

  listReminders: () => request<Reminder[]>('/api/reminders'),

  createReminder: (data: { memory_id: string; due_at: string; repeat_interval?: string }) =>
    request<{ id: string; memory_id: string; due_at: string }>('/api/reminders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  completeReminder: (id: string) =>
    request<{ message: string }>(`/api/reminders/${id}/complete`, {
      method: 'PUT',
    }),

  // Activity Log
  listActivity: () => request<ActivityItem[]>('/api/activity'),

  // Search & AI
  search: (q: string, filters?: { category?: string; from?: string; to?: string }) => {
    const query = new URLSearchParams();
    query.set('q', q);
    if (filters?.category) query.set('category', filters.category);
    if (filters?.from) query.set('from', filters.from);
    if (filters?.to) query.set('to', filters.to);
    return request<SearchResponse>(`/api/memories/search?${query.toString()}`);
  },

  suggest: (title: string, description: string) =>
    request<SuggestResponse>('/api/ai/suggest', {
      method: 'POST',
      body: JSON.stringify({ title, description }),
    }),

  autoTitle: (description: string) =>
    request<{ suggestedTitle: string }>('/api/ai/auto-title', {
      method: 'POST',
      body: JSON.stringify({ description }),
    }),

  autoSummary: (description: string) =>
    request<{ summary: string }>('/api/ai/auto-summary', {
      method: 'POST',
      body: JSON.stringify({ description }),
    }),

  // Export JSON
  exportJson: () => request<any>('/api/export/json'),
};
