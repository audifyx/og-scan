/* ══════════════════════════════════════════════════════════════
   Admin Dashboard — shared helpers & hooks
   ══════════════════════════════════════════════════════════════ */
import { supabase } from "@/lib/supabase";

/** Log an admin action to admin_audit_log */
export const logAudit = async (
  adminUserId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  oldValues?: any,
  newValues?: any
) => {
  await supabase.from("admin_audit_log").insert({
    admin_user_id: adminUserId,
    action,
    target_type: targetType || null,
    target_id: targetId || null,
    old_values: oldValues || null,
    new_values: newValues || null,
  });
};

/** Confirm with dialog before destructive action */
export const confirmAction = (message: string): boolean => {
  return window.confirm(message);
};

/** Truncate string */
export const truncate = (s: string, len = 20) =>
  s.length > len ? s.slice(0, len) + "…" : s;

/** Format number with commas */
export const fmtNum = (n: number) => n.toLocaleString();

/** Short user id */
export const shortId = (id: string) => id.slice(0, 8) + "…";
