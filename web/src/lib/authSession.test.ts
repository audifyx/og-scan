import { describe, expect, it, vi } from "vitest";
import { installSupabaseSession, persistSessionLocally, tokensFromAuthPayload } from "./authSession";

const setSession = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      setSession: (...args: unknown[]) => setSession(...args),
    },
  },
}));

describe("authSession", () => {
  it("reads tokens from a flat or nested payload", () => {
    expect(tokensFromAuthPayload({ access_token: "a", refresh_token: "b" })).toEqual({
      access_token: "a",
      refresh_token: "b",
    });
    expect(tokensFromAuthPayload({ session: { access_token: "c", refresh_token: "d" } })).toEqual({
      access_token: "c",
      refresh_token: "d",
    });
  });

  it("installs via setSession when it resolves", async () => {
    setSession.mockResolvedValue({ error: null });
    const reload = vi.fn();
    vi.stubGlobal("window", { location: { reload } });
    await installSupabaseSession({ access_token: "at", refresh_token: "rt" });
    expect(setSession).toHaveBeenCalledWith({ access_token: "at", refresh_token: "rt" });
    expect(reload).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("persists locally and reloads when setSession hangs", async () => {
    vi.useFakeTimers();
    try {
      setSession.mockReturnValue(new Promise(() => {}));
      const reload = vi.fn();
      const store = new Map<string, string>();
      vi.stubGlobal("window", { location: { reload } });
      vi.stubGlobal("localStorage", {
        setItem: (k: string, v: string) => store.set(k, v),
        getItem: (k: string) => store.get(k) ?? null,
      });
      const pending = installSupabaseSession({ access_token: "at", refresh_token: "rt" });
      await vi.advanceTimersByTimeAsync(8_500);
      await pending;
      expect(reload).toHaveBeenCalled();
      expect(store.get("sol-tools-auth")).toContain("\"access_token\":\"at\"");
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it("persistSessionLocally writes the supabase storage key", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      setItem: (k: string, v: string) => store.set(k, v),
      getItem: (k: string) => store.get(k) ?? null,
    });
    persistSessionLocally({ access_token: "tok", refresh_token: "ref" }, { id: "u1" });
    const raw = store.get("sol-tools-auth");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.access_token).toBe("tok");
    expect(parsed.refresh_token).toBe("ref");
    vi.unstubAllGlobals();
  });
});
