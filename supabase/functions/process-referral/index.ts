/**
 * process-referral — Edge Function
 * Called after signup when user was referred via ?ref=CODE.
 * Grants XP to inviter, records referral, notifies inviter.
 *
 * Points: +100 XP per signup, +50 XP milestone every 5 invites
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SIGNUP_XP = 100;
const MILESTONE_XP = 50;
const MILESTONE_EVERY = 5;

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

    // Count existing invites for milestone calc
    const { count } = await sb.from("referrals").select("id", { count: "exact", head: true }).eq("inviter_id", inviterId);
    const newTotal = (count || 0) + 1;
    const milestone = newTotal % MILESTONE_EVERY === 0 ? MILESTONE_XP : 0;
    const xpAwarded = SIGNUP_XP + milestone;

    // Insert referral
    await sb.from("referrals").insert({ inviter_id: inviterId, invitee_id: inviteeId, code: inviteCode, reward_credits: xpAwarded });

    // Increment invite_codes uses
    if (fromTable && ic) await sb.from("invite_codes").update({ uses: (ic.uses || 0) + 1 }).eq("code", inviteCode);

    // Set referred_by on invitee
    await sb.from("profiles").update({ referred_by: inviterId }).eq("user_id", inviteeId);

    // Grant XP to inviter (increment xp + total_xp on profiles)
    const { data: inviterProfile } = await sb.from("profiles").select("xp, total_xp").eq("user_id", inviterId).single();
    if (inviterProfile) {
      await sb.from("profiles").update({
        xp: (inviterProfile.xp || 0) + xpAwarded,
        total_xp: (inviterProfile.total_xp || 0) + xpAwarded,
      }).eq("user_id", inviterId);
    }

    // Notify inviter
    const { data: inv } = await sb.from("profiles").select("username").eq("user_id", inviteeId).maybeSingle();
    await sb.from("notifications").insert({
      user_id: inviterId, type: "referral",
      title: "🎉 New invite signup!",
      message: `${inv?.username || "Someone"} joined via your link! +${xpAwarded} XP${milestone ? ` (includes ${milestone} milestone bonus!)` : ""}`,
      data: { invitee_id: inviteeId, xp: xpAwarded, url: "/leaderboard" },
      is_read: false,
    });

    return new Response(JSON.stringify({ ok: true, xpAwarded, milestone, totalInvited: newTotal }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("process-referral error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
