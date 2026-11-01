import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  LibraryItem, 
  SermonPlan, 
  CareItem, 
  CalendarEvent, 
  HouseMemory, 
  AppSettings,
  SyncStatus 
} from '../types/minos';

const SUPABASE_URL = 'https://wsotdmzolzysxcjaehpw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indzb3RkbXpvbHp5c3hjamFlaHB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MTM5MTQsImV4cCI6MjEwMDk4OTkxNH0.PrdDxZGwwd645s9RxK_albf583lVK_q07IZzq20B5gk';

let supabase: SupabaseClient | null = null;
try {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
} catch {
  supabase = null;
}

// Storage keys
const STORAGE_KEYS = {
  API_KEY: 'minos_ds_ak',
  GCP_KEY: 'minos_gcp',
  BRAVE_KEY: 'minos_brave_key',
  GOOGLE_KEY: 'minos_google_key',
  GOOGLE_CX: 'minos_google_cx',
  CUSTOM_ADDONS: 'minos_prompt_addons',
  PASTOR_COMMAND: 'minos_pastor_command_v1',
  HOUSE_MEMORY: 'minos_house_memory_v1',
  LIBRARY_ITEMS: 'minos_local_library_v1',
  INSTALLED: 'minos_ds_installed',
  REC_DATE: 'minos_ds_rec_date'
};

export function getStoredSettings(): AppSettings {
  try {
    const addons = JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOM_ADDONS) || '[]');
    return {
      deepseekApiKey: localStorage.getItem(STORAGE_KEYS.API_KEY) || '',
      googleTtsKey: localStorage.getItem(STORAGE_KEYS.GCP_KEY) || '',
      braveSearchKey: localStorage.getItem(STORAGE_KEYS.BRAVE_KEY) || '',
      googleSearchKey: localStorage.getItem(STORAGE_KEYS.GOOGLE_KEY) || '',
      googleCx: localStorage.getItem(STORAGE_KEYS.GOOGLE_CX) || '',
      customAddons: Array.isArray(addons) ? addons : []
    };
  } catch {
    return {
      deepseekApiKey: '',
      googleTtsKey: '',
      braveSearchKey: '',
      googleSearchKey: '',
      googleCx: '',
      customAddons: []
    };
  }
}

export function saveSettings(settings: Partial<AppSettings>): void {
  try {
    if (settings.deepseekApiKey !== undefined) localStorage.setItem(STORAGE_KEYS.API_KEY, settings.deepseekApiKey);
    if (settings.googleTtsKey !== undefined) localStorage.setItem(STORAGE_KEYS.GCP_KEY, settings.googleTtsKey);
    if (settings.braveSearchKey !== undefined) localStorage.setItem(STORAGE_KEYS.BRAVE_KEY, settings.braveSearchKey);
    if (settings.googleSearchKey !== undefined) localStorage.setItem(STORAGE_KEYS.GOOGLE_KEY, settings.googleSearchKey);
    if (settings.googleCx !== undefined) localStorage.setItem(STORAGE_KEYS.GOOGLE_CX, settings.googleCx);
    if (settings.customAddons !== undefined) localStorage.setItem(STORAGE_KEYS.CUSTOM_ADDONS, JSON.stringify(settings.customAddons));
  } catch {
    // Ignore storage quota
  }
}

export function getStoredHouseMemory(): HouseMemory {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HOUSE_MEMORY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return {
    vision: "To raise a people of deep spiritual conviction, biblical apostolic power, and moral integrity in Ikot Ambon and Akwa Ibom.",
    doctrine: "Pentecostal holiness, sovereign grace, baptism in the Holy Ghost, prophetic authority, Christ's bodily return.",
    series: "Unshakable Foundations",
    style: "Expository, weighty, prophetic, warm and fatherly",
    focus: "Church growth to 40 dedicated disciples, establishing youth leadership, discipleship class"
  };
}

export function saveStoredHouseMemory(memory: HouseMemory): void {
  try {
    localStorage.setItem(STORAGE_KEYS.HOUSE_MEMORY, JSON.stringify(memory));
  } catch {
    // Ignore
  }
}

export function getStoredPastorCommand(): {
  sermons: SermonPlan[];
  care: CareItem[];
  events: CalendarEvent[];
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PASTOR_COMMAND);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return {
    sermons: [
      {
        id: 's1',
        title: 'The Rock That Cannot Be Moved',
        text: 'Matthew 7:24-27; Isaiah 28:16',
        date: '2026-11-08',
        goal: 'Anchor the youth and workers in genuine conversion and unwavering commitment.'
      }
    ],
    care: [
      {
        id: 'c1',
        name: 'Bro. Emmanuel & Family',
        need: 'New job opportunity in Uyo; praying for divine favour and traveling mercies.',
        type: 'Prayer',
        due: '2026-11-05',
        done: false
      },
      {
        id: 'c2',
        name: 'Sis. Grace Udofia',
        need: 'Follow up on youth discipleship attendance and Bible study reading.',
        type: 'Follow-up',
        due: '2026-11-06',
        done: false
      }
    ],
    events: [
      { id: 'e1', title: 'Sunday Workers Class & Main Service', date: '2026-11-08', time: '07:00' },
      { id: 'e2', title: 'Wednesday Prayer Meeting', date: '2026-11-11', time: '17:30' },
      { id: 'e3', title: 'Thursday Word & Communion', date: '2026-11-12', time: '18:00' }
    ]
  };
}

export function saveStoredPastorCommand(data: {
  sermons: SermonPlan[];
  care: CareItem[];
  events: CalendarEvent[];
}): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PASTOR_COMMAND, JSON.stringify(data));
  } catch {
    // Ignore
  }
}

// Initial default library items if none exist
const DEFAULT_LIBRARY_ITEMS: LibraryItem[] = [
  {
    id: 'lib_init_1',
    title: 'The Mystery of Covenant Partnership',
    cat: 'partner',
    date: Date.now() - 86400000 * 2,
    content: `# The Mystery of Covenant Partnership
**Anchor Scripture:** Philippians 4:15-19  
*Now ye Philippians know also, that in the beginning of the gospel, when I departed from Macedonia, no church communicated with me as concerning giving and receiving, but ye only.*

### Revelation
Partnership in the kingdom is not an exchange of charity for sentiment; it is a spiritual conduit where the grace upon the altar flows into the house of the partner. When you partner with Light Assembly Bible Church in Ikot Ambon, you are yoking your harvest to apostolic soil.

### Declaration for Partners
*“I declare that my seed is speaking in the heavens. My giving is an odor of a sweet smell, a sacrifice acceptable, wellpleasing to God. My God supplies all my need according to His riches in glory by Christ Jesus.”*`
  },
  {
    id: 'lib_init_2',
    title: 'The Fire on the Altar Must Not Go Out',
    cat: 'sermon',
    date: Date.now() - 86400000 * 4,
    content: `# The Fire on the Altar Must Not Go Out
**Main Scripture:** Leviticus 6:12-13  
**One Core Truth:** The fire is kept alive not by emotion, but by continuous spiritual fuel.

### KEY POINT
God gives the initial fire, but man must provide the morning wood. In pastoral consecration, daily surrender is the fuel that keeps the supernatural flame burning through dry seasons in Ikot Ambon.`
  }
];

export function getLocalLibraryItems(): Record<string, LibraryItem> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LIBRARY_ITEMS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  const initMap: Record<string, LibraryItem> = {};
  DEFAULT_LIBRARY_ITEMS.forEach(i => { initMap[i.id] = i; });
  return initMap;
}

export function saveLocalLibraryItems(items: Record<string, LibraryItem>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LIBRARY_ITEMS, JSON.stringify(items));
  } catch {
    // Ignore
  }
}

// Supabase sync
export async function syncWithSupabase(
  onStatusChange: (status: SyncStatus) => void,
  onItemsLoaded: (items: Record<string, LibraryItem>) => void
): Promise<void> {
  if (!supabase) {
    onStatusChange('offline');
    return;
  }

  try {
    onStatusChange('busy');
    const { data, error } = await supabase.from('library_items').select('*');
    if (error) {
      onStatusChange('offline');
      return;
    }

    if (data && data.length > 0) {
      const remoteItems: Record<string, LibraryItem> = {};
      data.forEach((row: LibraryItem) => {
        remoteItems[row.id] = row;
      });
      saveLocalLibraryItems(remoteItems);
      onItemsLoaded(remoteItems);
    }
    onStatusChange('live');
  } catch {
    onStatusChange('offline');
  }
}

export async function saveItemToSupabase(
  item: LibraryItem,
  onStatusChange?: (status: SyncStatus) => void
): Promise<void> {
  if (!supabase) return;
  try {
    onStatusChange?.('busy');
    const { error } = await supabase.from('library_items').upsert(item);
    if (error) {
      onStatusChange?.('offline');
      return;
    }
    onStatusChange?.('live');
  } catch {
    onStatusChange?.('offline');
  }
}

export async function deleteItemFromSupabase(
  id: string,
  onStatusChange?: (status: SyncStatus) => void
): Promise<void> {
  if (!supabase) return;
  try {
    onStatusChange?.('busy');
    const { error } = await supabase.from('library_items').delete().eq('id', id);
    if (error) {
      onStatusChange?.('offline');
      return;
    }
    onStatusChange?.('live');
  } catch {
    onStatusChange?.('offline');
  }
}
