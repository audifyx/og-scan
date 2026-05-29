/**
 * trackActivity — write a row to public.user_activity
 *
 * Fire-and-forget: call without await wherever user actions happen.
 * RLS policy ensures auth.uid() must match user_id — only logged-in users can write.
 *
 * activity_type examples:
 *   auth.signin | auth.signup | auth.signout
 *   scanner.scan | scan.token_viewed
 *   community.joined | community.post_created | community.post_liked
 *   space.joined | space.created
 *   wallet.searched | whale.viewed
 *   profile.updated
 */
import { supabase } from "@/lib/supabase";

export interface ActivityPayload {
  user_id: string;
  activity_type: string;
  title?: string;
  description?: string;
  data?: Record<string, unknown>;
  is_public?: boolean;
}

/**
 * Write one activity row. Never throws — failures are silent to avoid
 * disrupting the user experience.
 */
export async function trackActivity(payload: ActivityPayload): Promise<void> {
  try {
    await supabase.from("user_activity").insert({
      user_id: payload.user_id,
      activity_type: payload.activity_type,
      title: payload.title ?? null,
      description: payload.description ?? null,
      data: payload.data ?? {},
      is_public: payload.is_public ?? false,
    });
  } catch {
    // Silent — tracking must never break the app
  }
}
