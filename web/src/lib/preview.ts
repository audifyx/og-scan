/**
 * Read-only PREVIEW MODE
 * ----------------------
 * Lets an external AI/agent VIEW the UI of every page/tab without an account,
 * WITHOUT ever touching real data and WITHOUT being able to write anything.
 *
 * Activate by opening any URL with ?agent=<PREVIEW_KEY> (or ?preview=<KEY>).
 * Guarantees:
 *  - No login required (auth is mocked with a read-only preview identity).
 *  - NO real data: every Supabase REST / edge-function / auth / realtime call is
 *    stubbed locally (reads return empty, so no DMs / users / settings / messages
 *    / tables are ever fetched).
 *  - READ ONLY: all writes (POST/PATCH/PUT/DELETE) are intercepted and no-op'd.
 *  - Public 3rd-party market data (e.g. DexScreener) still loads so the UI looks
 *    alive, but it is public and contains no user data.
 */

// Custom key. Override at build time with VITE_PREVIEW_KEY. (Frontend keys are
// discoverable in the bundle, but preview exposes ZERO real data, so a leaked
// key only reveals the empty UI shell — never anything sensitive.)
export const PREVIEW_KEY: string =
  (import.meta.env.VITE_PREVIEW_KEY as string) ||
  "ogscan_ui_preview_7Qx2v9Lm4Kd8Rn3Tb6Wp1Zc5Hf0Jg2Ss";

let _active = false;

export function initPreview(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    const k = params.get("agent") || params.get("preview");
    if (k && k === PREVIEW_KEY) sessionStorage.setItem("og_preview", "1");
    if (k === "off") sessionStorage.removeItem("og_preview");
    _active = sessionStorage.getItem("og_preview") === "1";
  } catch {
    _active = false;
  }
  return _active;
}

export function isPreview(): boolean {
  if (_active) return true;
  try {
    _active = sessionStorage.getItem("og_preview") === "1";
  } catch { /* noop */ }
  return _active;
}

const MOCK_USER = {
  id: "preview-agent",
  // Owner email so admin/owner-only pages also render for review.
  email: "audifyx@gmail.com",
  user_metadata: { username: "PreviewAgent" },
  app_metadata: { provider: "preview" },
  aud: "authenticated",
  role: "authenticated",
  created_at: new Date().toISOString(),
};

export function previewUser(): any {
  return MOCK_USER;
}

export function previewProfile(): any {
  return {
    user_id: "preview-agent",
    username: "PreviewAgent",
    display_name: "Preview Agent",
    avatar_url: null,
    bio: "Read-only UI preview",
    is_official_account: true,
    referral_code: "PREVIEW",
  };
}

function isBackendUrl(u: string): boolean {
  return (
    /\.supabase\.co\//.test(u) ||
    /\/ai-fn\//.test(u) ||
    /\/functions\/v1\//.test(u) ||
    /\/rest\/v1\//.test(u) ||
    /\/auth\/v1\//.test(u) ||
    /\/realtime\/v1\//.test(u) ||
    /\/storage\/v1\//.test(u)
  );
}

function stubResponse(method: string): Response {
  // Reads -> empty list (no data). Writes -> empty object (silently ignored).
  const isRead = method === "GET" || method === "HEAD";
  return new Response(isRead ? "[]" : "{}", {
    status: 200,
    headers: { "Content-Type": "application/json", "x-preview-stub": "1" },
  });
}

/** Install the read-only / no-data guards. Safe to call once at boot. */
export function installPreviewGuards(): void {
  if ((window as any).__ogPreviewPatched) return;
  (window as any).__ogPreviewPatched = true;

  // 1) Intercept fetch: stub every backend call while in preview.
  const origFetch = window.fetch.bind(window);
  window.fetch = async (input: any, init?: RequestInit): Promise<Response> => {
    if (isPreview()) {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.href : input?.url || "";
      const method = (
        init?.method || (typeof input === "object" && input?.method) || "GET"
      ).toUpperCase();
      if (isBackendUrl(String(url))) return stubResponse(method);
    }
    return origFetch(input, init);
  };

  // 2) Neutralise realtime websockets (carry live user data + presence writes).
  if (isPreview() && (window as any).WebSocket) {
    const OrigWS = (window as any).WebSocket;
    const Dummy: any = function (url: string, protocols?: any) {
      if (/supabase\.co|realtime/.test(String(url))) {
        return {
          close() {}, send() {}, addEventListener() {}, removeEventListener() {},
          readyState: 3, onopen: null, onclose: null, onerror: null, onmessage: null,
        };
      }
      return new OrigWS(url, protocols);
    };
    Dummy.prototype = OrigWS.prototype;
    Dummy.CONNECTING = 0; Dummy.OPEN = 1; Dummy.CLOSING = 2; Dummy.CLOSED = 3;
    (window as any).WebSocket = Dummy;
  }
}
