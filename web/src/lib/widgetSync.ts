import { supabase } from "@/lib/supabase";
import type { WidgetConfig } from "@/components/AIWidgetPanel";

/**
 * Cloud persistence for Hub widgets.
 *
 * Widgets auto-save to the user's account so the "My Widgets" list survives
 * refresh and follows the user across devices. Storage: the existing
 * `user_settings` table (one row per user, owner RLS), under
 * `data.hub_widgets` — verified working end-to-end against production, no
 * schema changes required.
 *
 * All calls fail soft: if the user is signed out or Supabase is unavailable,
 * we silently fall back to the localStorage copy AIWidgetPanel already keeps.
 */

const DATA_KEY = "hub_widgets";

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSerialized = "";

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

/** Fetch the signed-in user's saved widget layout from their account. */
export async function loadWidgetsFromCloud(): Promise<WidgetConfig[] | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  try {
    const { data, error } = await supabase
      .from("user_settings")
      .select("data")
      .eq("user_id", uid)
      .maybeSingle();
    if (error || !data) return null;
    const bag = (data.data ?? {}) as Record<string, unknown>;
    const widgets = bag[DATA_KEY];
    if (!Array.isArray(widgets)) return null;
    lastSerialized = JSON.stringify(widgets);
    return widgets as WidgetConfig[];
  } catch {
    return null;
  }
}

/** Upsert the widget layout to the account immediately (preserves other data keys). */
export async function saveWidgetsToCloud(widgets: WidgetConfig[]): Promise<void> {
  const uid = await currentUserId();
  if (!uid) return;
  const serialized = JSON.stringify(widgets);
  if (serialized === lastSerialized) return; // no-op if unchanged
  try {
    // Read-merge-write so we never clobber other keys stored in data.
    const { data: existing } = await supabase
      .from("user_settings")
      .select("data")
      .eq("user_id", uid)
      .maybeSingle();
    const bag = { ...((existing?.data ?? {}) as Record<string, unknown>), [DATA_KEY]: widgets };
    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: uid, data: bag }, { onConflict: "user_id" });
    if (!error) lastSerialized = serialized;
  } catch {
    /* fail soft — localStorage still holds the layout */
  }
}

/** Debounced auto-save; called on every widget change. */
export function queueWidgetCloudSave(widgets: WidgetConfig[], delayMs = 800): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { void saveWidgetsToCloud(widgets); }, delayMs);
}
