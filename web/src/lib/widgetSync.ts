import { supabase } from "@/lib/supabase";
import type { WidgetConfig } from "@/components/AIWidgetPanel";

/**
 * Cloud persistence for Hub widgets.
 *
 * Widgets auto-save to the user's account so the "My Widgets" list survives
 * refresh and follows the user across devices. Storage: `public.user_widgets`
 * (one row per user, owner-only RLS, updated_at trigger) — applied and
 * verified end-to-end against production on 2026-07-06.
 *
 * All calls fail soft: if the user is signed out or Supabase is unavailable,
 * we silently fall back to the localStorage copy AIWidgetPanel already keeps.
 */

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
      .from("user_widgets")
      .select("widgets")
      .eq("user_id", uid)
      .maybeSingle();
    if (error || !data) return null;
    const widgets = data.widgets as unknown;
    if (!Array.isArray(widgets)) return null;
    lastSerialized = JSON.stringify(widgets);
    return widgets as WidgetConfig[];
  } catch {
    return null;
  }
}

/** Upsert the widget layout to the account immediately. */
export async function saveWidgetsToCloud(widgets: WidgetConfig[]): Promise<void> {
  const uid = await currentUserId();
  if (!uid) return;
  const serialized = JSON.stringify(widgets);
  if (serialized === lastSerialized) return; // no-op if unchanged
  try {
    const { error } = await supabase
      .from("user_widgets")
      .upsert({ user_id: uid, widgets }, { onConflict: "user_id" });
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
