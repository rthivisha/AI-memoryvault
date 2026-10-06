export type CategoryType =
  | 'ACHIEVEMENT'
  | 'EVENT'
  | 'STUDY'
  | 'TRAVEL'
  | 'REMINDER'
  | 'PERSONAL';

export type MoodType =
  | 'happy'
  | 'proud'
  | 'calm'
  | 'sad'
  | 'excited'
  | 'neutral';

export interface User {
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface Attachment {
  id: string;
  memory_id?: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  created_at?: string;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
  count?: number;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  cover_image_url?: string;
  memory_count?: number;
}

export interface Reminder {
  id: string;
  memory_id: string;
  memory_title?: string;
  memory_category?: string;
  due_at: string;
  repeat_interval?: string;
  is_completed?: number;
  created_at?: string;
}

export interface ActivityItem {
  id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  created_at: string;
}

export interface Memory {
  memoryId: string;
  ownerId: string;
  title: string;
  category: CategoryType;
  date: string;
  description: string;
  keywords: string[];
  mood?: MoodType;
  locationName?: string;
  latitude?: number | null;
  longitude?: number | null;
  people?: string[];
  tags?: Tag[];
  attachments?: Attachment[];
  isFavorite?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
  deletedAt?: string | null;
  collectionId?: string | null;
}

export interface SearchResultItem {
  memory: Memory;
  score: number;
  bm25Score?: number;
  why?: string;
}

export interface SearchResponse {
  tokens: string[];
  results: SearchResultItem[];
  elapsed_ms: number;
  total: number;
}

export interface SuggestResponse {
  category: CategoryType;
  confidence: number;
  keywords_preview: string[];
  tokens: string[];
}

export interface DashboardKPIs {
  totalMemories: number;
  thisMonthCount: number;
  currentStreak: number;
  longestStreak: number;
  storageUsedBytes: number;
  storageQuotaBytes: number;
  favoritesCount: number;
  upcomingRemindersCount: number;
  overdueRemindersCount: number;
}

export interface DashboardSummary {
  kpis: DashboardKPIs;
  timeline: { month: string; count: number }[];
  categoryBreakdown: { name: string; value: number }[];
  moodDistribution: { mood: string; count: number }[];
  activityHeatmap: Record<string, number>;
  wordCloud: { text: string; value: number }[];
  onThisDay: Memory[];
  geoPins: {
    id: string;
    title: string;
    category: string;
    date: string;
    location_name?: string;
    latitude: number;
    longitude: number;
  }[];
  upcomingReminders: Reminder[];
}

export interface GalleryItem extends Attachment {
  memory_title: string;
  memory_category: string;
  memory_date: string;
}

export interface ToastMessage {
  id: string;
  type: 'error' | 'success' | 'info';
  text: string;
}
