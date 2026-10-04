/**
 * Shared LiveKit token fetch for OrbitX voice.
 * Uses the deployed Supabase edge function `livekit-token`, which mints
 * a LiveKit JWT server-side (keys never touch the client).
 * Requires a Supabase auth session — guests get a clear sign_in_required error.
 */

import { supabase, SUPABASE_URL } from "@/lib/supabase";

export interface LiveKitCreds {
  token: string;
  url: string;
  roomName: string;
  identity: string;
}

export async function fetchLiveKitToken(
  roomName: string,
  identity: string,
  displayName: string
): Promise<LiveKitCreds> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("sign_in_required");
  }
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/livekit-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ roomName, identity, name: displayName }),
  });
  if (resp.status === 401) throw new Error("sign_in_required");
  if (!resp.ok) throw new Error(`token_error_${resp.status}`);
  const data = await resp.json();
  if (!data?.token || !data?.url) {
    throw new Error(data?.error || "token_error");
  }
  return {
    token: data.token,
    url: data.url,
    roomName: data.roomName || roomName,
    identity: data.identity || identity,
  };
}

/** Room names are sanitized for LiveKit. */
export function slugifyRoom(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "lobby"
  );
}

/** The always-on main lobby room. */
export const MAIN_LOBBY_ROOM = "orbitx-main-lobby";

/** Prefix for user-created lobby rooms. */
export const USER_LOBBY_PREFIX = "orbitx-vc-";

/** Proximity voice room for OrbitX City. */
export const CITY_VOICE_ROOM = "orbitx-city-voice";
