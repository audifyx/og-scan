/**
 * public-listener-token — Supabase Edge Function
 * Generates a LiveKit token for unauthenticated (public) listeners.
 * No JWT required. Token is listener-only (canSubscribe: true, canPublish: false).
 *
 * POST body: { spaceId: string, guestName?: string }
 * Returns: { token: string }
 */
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
// @deno-types="https://esm.sh/@livekit/server-sdk@1.2.7/dist/index.d.ts"
import {
  AccessToken,
} from "https://esm.sh/@livekit/server-sdk@1.2.7";

const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY") ?? "";
const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return new Response(JSON.stringify({ error: "LiveKit is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { spaceId, guestName } = await req.json();
    if (!spaceId) {
      return new Response(JSON.stringify({ error: "spaceId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate a unique guest identity
    const guestId = `guest-${Math.random().toString(36).slice(2, 10)}`;
    const displayName = guestName?.trim() || `Guest-${guestId.slice(6)}`;
    const roomName = `space-${spaceId}`;

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: guestId,
      name: displayName,
      ttl: 60 * 60 * 6, // 6 hours
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: false,          // guests cannot publish audio
      canSubscribe: true,         // guests can receive/listen
      canPublishData: false,      // no data channel
      hidden: false,
    });

    const token = at.toJwt();

    return new Response(JSON.stringify({ token, guestId, displayName }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("public-listener-token error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
