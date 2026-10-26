import { supabase } from "@/lib/supabase";
import type {
  DeskWidget,
  InstalledApp,
  OsBookmark,
  OsNote,
  OsPriceAlert,
  OsSettings,
  StoredFolder,
  ThemePack,
  IconPos,
} from "./osStore";

/**
 * OrbitX OS layout sync — the desktop follows the account, not the device.
 * Mirrors the Hub widget-sync pattern: Supabase table `os_layouts`
 * (user_id PK, layout jsonb, updated_at), fails soft when signed out or
 * when the table doesn't exist yet. Device-local state (lock PIN,
 * notifications) is deliberately NEVER synced.
 */

export interface OsCloudLayout {
  icons: Record<string, IconPos>;
  folders: StoredFolder[];
  settings: OsSettings;
  installed: InstalledApp[];
  deskWidgets: DeskWidget[];
  packs: ThemePack[];
  dnd: boolean;
  alerts: OsPriceAlert[];
  activePackId: string;
  notes: OsNote[];
  bookmarks: OsBookmark[];
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSerialized = "";
let pending: OsCloudLayout | null = null;

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

export interface CloudLayoutRow {
  layout: OsCloudLayout;
  updatedAt: number;
}

/** Fetch the signed-in user's saved OS layout. Null = none / unavailable. */
export async function loadOsLayoutFromCloud(): Promise<CloudLayoutRow | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  try {
    const { data, error } = await supabase
      .from("os_layouts")
      .select("layout, updated_at")
      .eq("user_id", uid)
      .maybeSingle();
    if (error || !data) return null;
    const layout = data.layout as unknown;
    if (!layout || typeof layout !== "object") return null;
    return {
      layout: layout as OsCloudLayout,
      updatedAt: data.updated_at ? new Date(data.updated_at as string).getTime() : 0,
    };
  } catch {
    return null;
  }
}

async function pushLayout(layout: OsCloudLayout): Promise<boolean> {
  const uid = await currentUserId();
  if (!uid) return false;
  try {
    const { error } = await supabase.from("os_layouts").upsert({
      user_id: uid,
      layout,
      updated_at: new Date().toISOString(),
    });
    return !error;
  } catch {
    return false;
  }
}

/** Debounced cloud save (2s); identical layouts are skipped. */
export function saveOsLayoutToCloud(layout: OsCloudLayout) {
  const serialized = JSON.stringify(layout);
  if (serialized === lastSerialized) return;
  pending = layout;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    if (!pending) return;
    const ok = await pushLayout(pending);
    if (ok) {
      lastSerialized = JSON.stringify(pending);
      pending = null;
    }
  }, 2000);
}

/** Flush a pending save immediately (tab hide / unload). */
export function flushOsLayoutToCloud() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (!pending) return;
  const layout = pending;
  pending = null;
  void pushLayout(layout).then((ok) => {
    if (ok) lastSerialized = JSON.stringify(layout);
  });
}

/** Mark a layout as already in sync (used right after applying cloud state). */
export function markOsLayoutSynced(layout: OsCloudLayout) {
  lastSerialized = JSON.stringify(layout);
  pending = null;
}
