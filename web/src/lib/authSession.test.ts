import { beforeEach, describe, expect, it, vi } from "vitest";
import { installSupabaseSession, persistSessionLocally, readPersistedSession, tokensFromAuthPayload } from "./authSession";

describe("authSession", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

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

  it("persistSessionLocally writes the supabase storage key", () => {
    persistSessionLocally({ access_token: "tok", refresh_token: "ref" }, { id: "u1" });
    const parsed = JSON.parse(localStorage.getItem("sol-tools-auth") ?? "{}");
    expect(parsed.access_token).toBe("tok");
    expect(parsed.refresh_token).toBe("ref");
    expect(parsed.user).toMatchObject({ id: "u1" });
  });

  it("writes tokens to localStorage and reloads instead of calling hung GoTrue setSession", async () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });

    await installSupabaseSession({
      access_token: "access-token",
      refresh_token: "refresh-token",
    });

    const stored = JSON.parse(localStorage.getItem("sol-tools-auth") ?? "{}");
    expect(stored.access_token).toBe("access-token");
    expect(stored.refresh_token).toBe("refresh-token");
    expect(localStorage.getItem("orbitx-auth-backup")).toBeTruthy();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("readPersistedSession returns a backup session if supabase storage was wiped", () => {
    persistSessionLocally({ access_token: "tok", refresh_token: "ref" }, { id: "u1" });
    localStorage.removeItem("sol-tools-auth");
    expect(readPersistedSession()?.user).toMatchObject({ id: "u1" });
  });
});
