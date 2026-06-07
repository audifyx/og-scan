import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://ogscan.fun",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get auth token from request
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "No auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Verify the user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return new Response(JSON.stringify({ error: "Invalid auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { fingerprint, event_type = "login", platform, screen_resolution, timezone, language } = body;

    if (!fingerprint) return new Response(JSON.stringify({ error: "fingerprint required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Extract IP from request headers (Deno/Supabase edge)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip")
      ?? req.headers.get("cf-connecting-ip")
      ?? "unknown";

    const userAgent = req.headers.get("user-agent") ?? "unknown";

    // 1. Upsert device record
    const { data: existingDevice } = await supabase
      .from("user_devices")
      .select("id")
      .eq("user_id", user.id)
      .eq("fingerprint", fingerprint)
      .maybeSingle();

    if (existingDevice) {
      await supabase.from("user_devices").update({
        last_seen_at: new Date().toISOString(),
        ip_address: ip,
        user_agent: userAgent,
      }).eq("id", existingDevice.id);
    } else {
      await supabase.from("user_devices").insert({
        user_id: user.id,
        fingerprint,
        ip_address: ip,
        user_agent: userAgent,
        platform: platform ?? null,
        screen_resolution: screen_resolution ?? null,
        timezone: timezone ?? null,
        language: language ?? null,
      });
    }

    // 2. Log auth event
    await supabase.from("auth_events").insert({
      user_id: user.id,
      event_type,
      fingerprint,
      ip_address: ip,
      user_agent: userAgent,
      metadata: { platform, screen_resolution, timezone, language },
    });

    // 3. Update profile with latest device info
    const deviceInfo = { platform, screen_resolution, timezone, language, user_agent: userAgent };
    await supabase.from("profiles").update({
      last_ip: ip,
      last_fingerprint: fingerprint,
      last_device_info: deviceInfo,
      login_count: (await supabase.from("profiles").select("login_count").eq("user_id", user.id).single()).data?.login_count + 1 || 1,
      ...(!((await supabase.from("profiles").select("first_seen_ip").eq("user_id", user.id).single()).data?.first_seen_ip) ? { first_seen_ip: ip } : {}),
    }).eq("user_id", user.id);

    // 4. Check for duplicate accounts (same fingerprint or IP, different user)
    const { data: sameFingerprint } = await supabase
      .from("user_devices")
      .select("user_id")
      .eq("fingerprint", fingerprint)
      .neq("user_id", user.id);

    const { data: sameIp } = await supabase
      .from("user_devices")
      .select("user_id")
      .eq("ip_address", ip)
      .neq("user_id", user.id);

    const duplicateFingerprints = [...new Set((sameFingerprint ?? []).map(d => d.user_id))];
    const duplicateIps = [...new Set((sameIp ?? []).map(d => d.user_id))];

    // 5. Check if this user is banned/suspended
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_banned, is_suspended, ban_reason, suspension_reason")
      .eq("user_id", user.id)
      .single();

    return new Response(JSON.stringify({
      ok: true,
      ip,
      is_banned: profile?.is_banned ?? false,
      is_suspended: profile?.is_suspended ?? false,
      ban_reason: profile?.ban_reason ?? null,
      suspension_reason: profile?.suspension_reason ?? null,
      duplicate_fingerprints: duplicateFingerprints.length,
      duplicate_ips: duplicateIps.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
