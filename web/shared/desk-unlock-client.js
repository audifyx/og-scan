/**
 * Browser helper for /api/orbitx-desk-unlock.
 * Does not contain the PIN. Session token is issued by Vercel.
 */
export const DESK_UNLOCK_PATH = "/api/orbitx-desk-unlock";
export const DESK_TOKEN_KEY = "ox_desk_token_v1";
export const DESK_SESS_KEY = "ox_desk_sess_v2";
export const DESK_UNLOCK_EVENT = "ox-desk-unlock";
export const DESK_SESSION_PREFIX = "oxdesk1";

/** Same storage key as web/src/lib/supabase.ts — DEX is same-origin. */
export function readOrbitXAccessToken() {
  try {
    const raw = localStorage.getItem("sol-tools-auth");
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return String(parsed?.access_token || parsed?.currentSession?.access_token || "").trim();
  } catch {
    return "";
  }
}

function unlockError(json) {
  const err = new Error(
    json.error === "not_configured"
      ? "Access code is not set on the server."
      : json.error === "revoked"
        ? "That code is retired."
        : json.error === "unavailable"
          ? "Unlock is unavailable."
          : "Incorrect code",
  );
  err.code = json.error || "denied";
  return err;
}

export async function requestDeskUnlock(code, bearer) {
  const headers = { "Content-Type": "application/json" };
  const token = bearer || readOrbitXAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(DESK_UNLOCK_PATH, {
      method: "POST",
      headers,
      body: JSON.stringify({ code: String(code || "").trim() }),
    });
  } catch {
    const err = new Error("Desk unlock is unavailable.");
    err.code = "unavailable";
    throw err;
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok || !json.token) {
    throw unlockError(json);
  }
  return json.token;
}

/** Site-wide maintenance unlock — same Vercel ADMIN_AUTH, no desk session. */
export async function requestMaintenanceUnlock(code) {
  let res;
  try {
    res = await fetch(DESK_UNLOCK_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: String(code || "").trim(), purpose: "maintenance" }),
    });
  } catch {
    const err = new Error("Unlock is unavailable.");
    err.code = "unavailable";
    throw err;
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw unlockError(json);
  return true;
}

export function persistDeskUnlock(token) {
  try {
    sessionStorage.setItem(DESK_TOKEN_KEY, token);
    sessionStorage.setItem(DESK_SESS_KEY, "true");
    sessionStorage.removeItem("ox_desk_sess_v1");
    sessionStorage.removeItem("orbitx_admin_unlocked");
    window.dispatchEvent(new Event(DESK_UNLOCK_EVENT));
  } catch {
    /* storage unavailable */
  }
}

export function clearDeskUnlock() {
  try {
    sessionStorage.removeItem(DESK_TOKEN_KEY);
    sessionStorage.removeItem(DESK_SESS_KEY);
    sessionStorage.removeItem("ox_desk_sess_v1");
    sessionStorage.removeItem("orbitx_admin_unlocked");
    window.dispatchEvent(new Event(DESK_UNLOCK_EVENT));
  } catch {
    /* storage unavailable */
  }
}

export function readDeskSessionToken() {
  try {
    return sessionStorage.getItem(DESK_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function hasDeskSession() {
  try {
    const token = readDeskSessionToken();
    return sessionStorage.getItem(DESK_SESS_KEY) === "true" && token.startsWith(`${DESK_SESSION_PREFIX}.`);
  } catch {
    return false;
  }
}
