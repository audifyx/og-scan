import { supabase } from "@/lib/supabase";
import type { WidgetConfig } from "@/components/AIWidgetPanel";

/**
 * Cloud persistence for Hub widgets (public.user_widgets, owner-only RLS).
 * Saves are immediate + flushed on tab hide/unload so a quick refresh right
 * after a change can never drop the write. Fails soft when signed out.
 */

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSerialized = "";
let pending: WidgetConfig[] | null = null;

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
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
  if (serialized === lastSerialized) { pending = null; return; }
  try {
    const { error } = await supabase
      .from("user_widgets")
      .upsert({ user_id: uid, widgets, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (!error) { lastSerialized = serialized; pending = null; }
  } catch {
    /* fail soft — localStorage still holds the layout */
  }
}

/** Debounced auto-save (kept for callers that prefer it). */
export function queueWidgetCloudSave(widgets: WidgetConfig[], delayMs = 500): void {
  pending = widgets;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { void saveWidgetsToCloud(widgets); }, delayMs);
}

// Flush any pending save when the tab is backgrounded or unloaded, so a fast
// refresh after a change still persists.
if (typeof window !== "undefined") {
  const flush = () => { if (pending) void saveWidgetsToCloud(pending); };
  try {
    document.addEventListener("visibilitychange", () => { if (document.hidden) flush(); });
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
  } catch { /* noop */ }
}
