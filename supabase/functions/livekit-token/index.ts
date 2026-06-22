import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL");
const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY");
const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET");
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
// Base64url encode (no padding)
function b64url(data) {
  let b = "";
  for (const byte of data)b += String.fromCharCode(byte);
  return btoa(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlStr(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function createLiveKitToken(identity, roomName, name) {
  const header = b64urlStr(JSON.stringify({
    alg: "HS256",
    typ: "JWT"
  }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64urlStr(JSON.stringify({
    sub: identity,
    iss: LIVEKIT_API_KEY,
    nbf: now,
    exp: now + 3600,
    name: name || identity,
    video: {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true
    }
  }));
  const signingInput = new TextEncoder().encode(`${header}.${payload}`);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(LIVEKIT_API_SECRET), {
    name: "HMAC",
    hash: "SHA-256"
  }, false, [
    "sign"
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, signingInput);
  const signature = b64url(new Uint8Array(sig));
  return `${header}.${payload}.${signature}`;
}
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: CORS
    });
  }
  try {
    const body = await req.json();
    const identity = body.identity || body.userId || "anonymous";
    const roomName = body.roomName || body.room_name || body.room;
    const name = body.name || body.username || identity;
    if (!roomName) {
      throw new Error("roomName is required");
    }
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
      throw new Error("LiveKit environment variables not configured");
    }
    const token = await createLiveKitToken(identity, roomName, name);
    return new Response(JSON.stringify({
      success: true,
      token,
      url: LIVEKIT_URL,
      roomName,
      identity,
      timestamp: new Date().toISOString()
    }), {
      headers: {
        "Content-Type": "application/json",
        ...CORS
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        ...CORS
      }
    });
  }
});
