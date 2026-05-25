/**
 * notifications.ts — Unified notification helper.
 *
 * Calls the `send-push` edge function which:
 * 1. Inserts into `notifications` table (for in-app feed) using service role
 * 2. Sends Web Push to all registered devices (for when app is closed)
 *
 * This avoids RLS issues since the edge function uses the service role key.
 */
import { supabase } from "@/lib/supabase";

interface NotifyOptions {
  /** Target user ID */
  userId: string;
  /** Notification type (space_live, dm, price_alert, whale_alert, etc.) */
  type: string;
  /** Title shown in notification */
  title: string;
  /** Body text */
  message: string;
  /** URL to open when notification is tapped */
  url?: string;
  /** Extra JSON data */
  data?: Record<string, unknown>;
}

/**
 * Send a notification to a user — in-app + push.
 * Fire-and-forget: errors are logged but don't throw.
 */
export async function notifyUser({ userId, type, title, message, url, data }: NotifyOptions) {
  try {
    const { error } = await supabase.functions.invoke("send-push", {
      body: {
        userId,
        type,
        title,
        body: message,
        url: url || "/app",
        tag: `${type}-${Date.now()}`,
        data,
      },
    });
    if (error) console.error("[notify] Edge function failed:", error);
  } catch (e) {
    console.error("[notify] Error:", e);
  }
}

/**
 * Notify multiple users at once (e.g., all followers of a space).
 */
export async function notifyUsers(userIds: string[], opts: Omit<NotifyOptions, "userId">) {
  await Promise.allSettled(userIds.map((uid) => notifyUser({ ...opts, userId: uid })));
}
