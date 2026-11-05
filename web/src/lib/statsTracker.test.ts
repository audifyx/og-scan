// Tests the tracker snippet exactly as shipped in web/app.html and
// web/ogdex/index.html: extract the inline script and run it against stubbed
// browser globals. Covers the visitor-ID resolution order (signed-in hash >
// cookie > localStorage > new UUID), cookie attributes + migration, and the
// signed-in override falling back on sign-out.
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { Blob as NodeBlob } from "node:buffer";
import path from "node:path";

const APP_HTML = path.resolve(import.meta.dirname, "../../app.html");
const OGDEX_HTML = path.resolve(import.meta.dirname, "../../ogdex/index.html");

function extractTracker(html: string): string {
  const blocks = html.match(/<script>\(function\(\)\{try\{[\s\S]*?<\/script>/g) ?? [];
  const tracker = blocks.find((b) => b.includes("orbitx_vid"));
  if (!tracker) throw new Error("tracker snippet not found in HTML");
  return tracker.replace(/^<script>/, "").replace(/<\/script>$/, "");
}

interface Captured {
  beacons: Array<{ url: string; blob: Blob }>;
  fetches: Array<{ url: string; body: string }>;
  intervalFns: Array<() => void>;
}

interface RunOpts {
  hostname?: string;
  protocol?: string;
  pathname?: string;
  ls?: Record<string, string>;
  cookies?: string;
}

function runSnippet(code: string, opts: RunOpts = {}) {
  const store = new Map<string, string>(Object.entries(opts.ls ?? {}));
  const cookieJar = new Map<string, string>();
  for (const part of (opts.cookies ?? "").split(";").map((s) => s.trim()).filter(Boolean)) {
    const [n, ...rest] = part.split("=");
    cookieJar.set(n, decodeURIComponent(rest.join("=")));
  }
  const captured: Captured = { beacons: [], fetches: [], intervalFns: [] };
  const rawCookieSets: string[] = [];

  const localStorageStub = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };

  const documentStub = {
    get cookie() {
      return [...cookieJar.entries()]
        .map(([n, v]) => `${n}=${encodeURIComponent(v)}`)
        .join("; ");
    },
    set cookie(s: string) {
      const [pair] = s.split(";");
      const [n, ...rest] = pair.split("=");
      cookieJar.set(n.trim(), decodeURIComponent(rest.join("=").trim()));
      rawCookieSets.push(s);
    },
    referrer: "",
    hidden: false,
    addEventListener: () => {},
  };

  vi.stubGlobal("localStorage", localStorageStub);
  vi.stubGlobal("Blob", NodeBlob);
  vi.stubGlobal("document", documentStub);
  vi.stubGlobal("location", {
    pathname: opts.pathname ?? "/app",
    protocol: opts.protocol ?? "https:",
    hostname: opts.hostname ?? "orbitx.world",
    hash: "",
  });
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.stubGlobal("innerWidth", 1920);
  vi.stubGlobal("history", { pushState: () => {} });
  vi.stubGlobal("addEventListener", () => {});
  vi.stubGlobal("navigator", {
    sendBeacon: (url: string, blob: Blob) => {
      captured.beacons.push({ url, blob });
      return true;
    },
  });
  vi.stubGlobal("fetch", (url: string, init: { body?: string }) => {
    captured.fetches.push({ url, body: String(init?.body ?? "") });
    return Promise.resolve({});
  });
  vi.stubGlobal("setInterval", (fn: () => void) => {
    captured.intervalFns.push(fn);
    return 1;
  });

  // The snippet is an IIFE; eval runs it once against the stubs above.
  // eslint-disable-next-line no-eval
  eval(code);

  return { captured, rawCookieSets, store, cookieJar };
}

describe("stats tracker snippet (shipped)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is identical in app.html and ogdex/index.html", () => {
    expect(extractTracker(readFileSync(APP_HTML, "utf8"))).toBe(
      extractTracker(readFileSync(OGDEX_HTML, "utf8")),
    );
  });

  it("fresh profile: generates a UUID and stores it in both cookie and localStorage", async () => {
    const { captured, rawCookieSets, store, cookieJar } = runSnippet(
      extractTracker(readFileSync(APP_HTML, "utf8")),
    );
    expect(captured.beacons).toHaveLength(1);
    const body = JSON.parse(await captured.beacons[0].blob.text());
    expect(body.vid).toMatch(/^[0-9a-f-]{36}$/);
    expect(store.get("site_vid")).toBe(body.vid);
    expect(cookieJar.get("orbitx_vid")).toBe(body.vid);
    expect(rawCookieSets[0]).toContain("Domain=.orbitx.world");
    expect(rawCookieSets[0]).toContain("Path=/");
    expect(rawCookieSets[0]).toContain("Max-Age=31536000");
    expect(rawCookieSets[0]).toContain("SameSite=Lax");
    expect(rawCookieSets[0]).toContain("Secure");
  });

  it("migrates an existing localStorage vid into the cookie", async () => {
    const { captured, cookieJar } = runSnippet(extractTracker(readFileSync(APP_HTML, "utf8")), {
      ls: { site_vid: "abc-123" },
    });
    const body = JSON.parse(await captured.beacons[0].blob.text());
    expect(body.vid).toBe("abc-123");
    expect(cookieJar.get("orbitx_vid")).toBe("abc-123");
  });

  it("prefers the cookie over localStorage and syncs localStorage to it", async () => {
    const { captured, store } = runSnippet(extractTracker(readFileSync(APP_HTML, "utf8")), {
      ls: { site_vid: "ls-id" },
      cookies: "orbitx_vid=cookie-id",
    });
    const body = JSON.parse(await captured.beacons[0].blob.text());
    expect(body.vid).toBe("cookie-id");
    expect(store.get("site_vid")).toBe("cookie-id");
  });

  it("prefers the signed-in hashed ID over the cookie, and falls back on sign-out", async () => {
    const hashId = "aabbccddeeff00112233445566778899";
    const code = extractTracker(readFileSync(APP_HTML, "utf8"));
    const { captured, store } = runSnippet(code, {
      ls: { site_vid: "ls-id", orbitx_uid: hashId },
      cookies: "orbitx_vid=cookie-id",
    });
    const hitBody = JSON.parse(await captured.beacons[0].blob.text());
    expect(hitBody.vid).toBe(hashId);
    // Sign out: remove the hashed ID, next ping uses the anonymous cookie id.
    store.delete("orbitx_uid");
    captured.intervalFns[0]();
    expect(captured.fetches).toHaveLength(1);
    expect(JSON.parse(captured.fetches[0].body).vid).toBe("cookie-id");
  });

  it("on localhost writes a host-only cookie without Domain/Secure", async () => {
    const { rawCookieSets } = runSnippet(extractTracker(readFileSync(APP_HTML, "utf8")), {
      hostname: "localhost",
      protocol: "http:",
    });
    expect(rawCookieSets[0]).not.toContain("Domain=");
    expect(rawCookieSets[0]).not.toContain("Secure");
    expect(rawCookieSets[0]).toContain("Path=/");
  });
});
