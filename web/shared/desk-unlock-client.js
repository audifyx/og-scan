/**
 * Browser helper for /api/orbitx-desk-unlock.
 * Does not contain the PIN. Session token is issued by Vercel.
 */
export const DESK_UNLOCK_PATH = "/api/orbitx-desk-unlock";
export const DESK_TOKEN_KEY = "ox_desk_token_v1";
export const DESK_SESS_KEY = "ox_desk_sess_v2";
export const DESK_UNLOCK_EVENT = "ox-desk-unlock";
export const DESK_SESSION_PREFIX = "oxdesk1";

export async function requestDeskUnlock(code, bearer) {
  const headers = { "Content-Type": "application/json" };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
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
    const err = new Error(
      json.error === "not_configured"
        ? "Desk pin is not set on the server."
        : json.error === "revoked"
          ? "That code is retired."
          : json.error === "unavailable"
            ? "Desk unlock is unavailable."
            : "Incorrect code",
    );
    err.code = json.error || "denied";
    throw err;
  }
  return json.token;
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
