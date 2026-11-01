export type LibraryCategory = 
  | 'sermon' 
  | 'notes' 
  | 'whatsapp' 
  | 'facebook' 
  | 'partner' 
  | 'prayer' 
  | 'study' 
  | 'other';

export interface CategoryConfig {
  label: string;
  tag: string;
  stripe: string;
  bgHex: string;
  textHex: string;
}

export const CATEGORIES: Record<LibraryCategory, CategoryConfig> = {
  sermon: { label: 'Sermon', tag: 'cat-sermon', stripe: 'stripe-sermon', bgHex: '#dbeafe', textHex: '#1e3a8a' },
  notes: { label: 'Pulpit Notes', tag: 'cat-notes', stripe: 'stripe-notes', bgHex: '#fef3c7', textHex: '#92400e' },
  whatsapp: { label: 'WhatsApp', tag: 'cat-whatsapp', stripe: 'stripe-whatsapp', bgHex: '#dcfce7', textHex: '#14532d' },
  facebook: { label: 'Facebook', tag: 'cat-facebook', stripe: 'stripe-facebook', bgHex: '#dbeafe', textHex: '#1e40af' },
  partner: { label: 'Partner Devotional', tag: 'cat-partner', stripe: 'stripe-partner', bgHex: '#ffedd5', textHex: '#9a3412' },
  prayer: { label: 'Prayer Guide', tag: 'cat-prayer', stripe: 'stripe-prayer', bgHex: '#f3e8ff', textHex: '#6b21a8' },
  study: { label: 'Deep Study', tag: 'cat-study', stripe: 'stripe-study', bgHex: '#cffafe', textHex: '#164e63' },
  other: { label: 'Other', tag: 'cat-other', stripe: 'stripe-other', bgHex: '#f1f5f9', textHex: '#475569' }
};

export interface LibraryItem {
  id: string;
  title: string;
  cat: LibraryCategory;
  content: string;
  date: number;
}

export interface SermonPlan {
  id: string;
  title: string;
  text?: string;
  date?: string;
  goal?: string;
}

export interface CareItem {
  id: string;
  name: string;
  need: string;
  type: 'Prayer' | 'Follow-up' | 'Visit' | 'Counselling';
  due?: string;
  done: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date?: string;
  time?: string;
}

export interface HouseMemory {
  vision?: string;
  doctrine?: string;
  series?: string;
  style?: string;
  focus?: string;
  updated?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
  cost?: number;
}

export interface SmartContextField {
  id: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'select';
  options?: string[];
}

export interface SmartContextConfig {
  title: string;
  fields: SmartContextField[];
  build: (values: Record<string, string>) => string;
}

export interface AppSettings {
  deepseekApiKey: string;
  googleTtsKey: string;
  braveSearchKey: string;
  googleSearchKey: string;
  googleCx: string;
  customAddons: string[];
}

export type SyncStatus = 'live' | 'busy' | 'offline';
