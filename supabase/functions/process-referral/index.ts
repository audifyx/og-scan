/**
 * process-referral — Edge Function
 * Called after signup when user was referred via ?ref=CODE.
 * Records the referral (count-based, no XP/points).
 * Notifies the inviter.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = {
  "Access-Control-Allow-Origin": "https://ogscan.fun",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { inviteeId, inviteCode } = await req.json();
    if (!inviteeId || !inviteCode)
      return new Response(JSON.stringify({ error: "inviteeId and inviteCode required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Resolve code → inviter (check invite_codes first, then profiles.referral_code)
    let inviterId: string | null = null;
    let fromTable = false;
    const { data: ic } = await sb.from("invite_codes").select("owner_id, uses, max_uses").eq("code", inviteCode).maybeSingle();
    if (ic) {
      if (ic.max_uses && ic.uses >= ic.max_uses) return new Response(JSON.stringify({ error: "code_exhausted" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      inviterId = ic.owner_id; fromTable = true;
    } else {
      const { data: p } = await sb.from("profiles").select("user_id").eq("referral_code", inviteCode).maybeSingle();
      if (p) inviterId = p.user_id;
    }
    if (!inviterId) return new Response(JSON.stringify({ error: "invalid_code" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    if (inviterId === inviteeId) return new Response(JSON.stringify({ error: "self_referral" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    // Prevent duplicate
    const { data: dup } = await sb.from("referrals").select("id").eq("invitee_id", inviteeId).maybeSingle();
    if (dup) return new Response(JSON.stringify({ ok: true, duplicate: true }), { headers: { ...cors, "Content-Type": "application/json" } });

    // Count existing invites
    const { count } = await sb.from("referrals").select("id", { count: "exact", head: true }).eq("inviter_id", inviterId);
    const newTotal = (count || 0) + 1;

    // Insert referral (count-based, no points)
    await sb.from("referrals").insert({ inviter_id: inviterId, invitee_id: inviteeId, code: inviteCode });

    // Increment invite_codes uses
    if (fromTable && ic) await sb.from("invite_codes").update({ uses: (ic.uses || 0) + 1 }).eq("code", inviteCode);

    // Set referred_by on invitee
    await sb.from("profiles").update({ referred_by: inviterId }).eq("user_id", inviteeId);

    // Notify inviter
    const { data: inv } = await sb.from("profiles").select("username").eq("user_id", inviteeId).maybeSingle();
    await sb.from("notifications").insert({
      user_id: inviterId, type: "referral",
      title: "🎉 New referral!",
      message: `${inv?.username || "Someone"} signed up via your invite link! That's ${newTotal} total invite${newTotal > 1 ? "s" : ""}.`,
      data: { invitee_id: inviteeId, total: newTotal, url: "/invite" },
      is_read: false,
    });

    return new Response(JSON.stringify({ ok: true, totalInvited: newTotal }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("process-referral error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
