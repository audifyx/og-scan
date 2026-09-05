import { beforeEach, describe, expect, it, vi } from "vitest";
import { signInWithWallet } from "./walletAuth";

const invokeEdgeFn = vi.fn();
const getSession = vi.fn();
const installSupabaseSession = vi.fn();

vi.mock("@/lib/edgeFn", () => ({
  invokeEdgeFn: (...args: unknown[]) => invokeEdgeFn(...args),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSession(...args),
    },
  },
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
}));

vi.mock("@/lib/authSession", () => ({
  installSupabaseSession: (...args: unknown[]) => installSupabaseSession(...args),
}));

describe("signInWithWallet", () => {
  beforeEach(() => {
    invokeEdgeFn.mockReset();
    getSession.mockReset();
    installSupabaseSession.mockReset();
    getSession.mockResolvedValue({ data: { session: null } });
    installSupabaseSession.mockResolvedValue(undefined);
    vi.unstubAllGlobals();
  });

  it("uses native Web3 via /api/auth-web3 and does not call wallet-auth when that succeeds", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "at",
        refresh_token: "rt",
        user: { id: "u1", created_at: "2024-01-01T00:00:00.000Z", last_sign_in_at: "2026-09-01T00:00:00.000Z" },
      }),
      headers: { get: () => "application/json" },
    });
    vi.stubGlobal("fetch", fetchMock);
    const signed = new Uint8Array([1, 2, 3, 4]);
    const signMessage = vi.fn(async () => signed);
    const result = await signInWithWallet("WalletPubkey111", signMessage);
    expect(result.isNew).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth-web3");
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body.chain).toBe("solana");
    expect(body.message).toContain("wants you to sign in with your Solana account:");
    expect(body.message).toContain("WalletPubkey111");
    expect(invokeEdgeFn).not.toHaveBeenCalled();
    expect(installSupabaseSession).toHaveBeenCalledWith(
      { access_token: "at", refresh_token: "rt" },
      expect.objectContaining({
        id: "u1",
        user_metadata: expect.objectContaining({ wallet: "WalletPubkey111", login: "web3" }),
      }),
    );
  });

  it("falls back to wallet-auth when Web3 is down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: "Wallet login timed out. Please try again." }),
        headers: { get: () => "application/json" },
      }),
    );
    invokeEdgeFn
      .mockResolvedValueOnce({ nonce: "n1", message: "sign this n1" })
      .mockResolvedValueOnce({ access_token: "at", refresh_token: "rt", isNew: false, user: { id: "u1" } });
    const signed = new Uint8Array([1, 2, 3, 4]);
    const signMessage = vi.fn(async () => signed);
    const result = await signInWithWallet("WalletPubkey111", signMessage);
    expect(result.isNew).toBe(false);
    expect(invokeEdgeFn.mock.calls[0][0]).toBe("wallet-auth");
    expect(invokeEdgeFn.mock.calls[0][1]).toEqual({ action: "nonce", pubkey: "WalletPubkey111" });
    expect(invokeEdgeFn.mock.calls[1][1]).toMatchObject({
      action: "verify",
      pubkey: "WalletPubkey111",
      nonce: "n1",
    });
    expect(installSupabaseSession).toHaveBeenCalledWith({ access_token: "at", refresh_token: "rt" }, { id: "u1" });
  });

  it("does not overwrite an existing email session", async () => {
    getSession.mockResolvedValue({
      data: { session: { user: { email: "owner@orbitx.world" } } },
    });
    const result = await signInWithWallet("WalletPubkey111", async () => new Uint8Array([1]));
    expect(result).toEqual({ isNew: false });
    expect(invokeEdgeFn).not.toHaveBeenCalled();
  });

  it("skips getSession and overwrites email when replaceEmailSession is true", async () => {
    getSession.mockResolvedValue({
      data: { session: { user: { email: "owner@orbitx.world" } } },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "at2",
          refresh_token: "rt2",
          user: { id: "u2", created_at: new Date().toISOString() },
        }),
        headers: { get: () => "application/json" },
      }),
    );
    const result = await signInWithWallet("WalletPubkey111", async () => new Uint8Array([1]), {
      replaceEmailSession: true,
    });
    expect(result.isNew).toBe(true);
    expect(getSession).not.toHaveBeenCalled();
    expect(invokeEdgeFn).not.toHaveBeenCalled();
    expect(installSupabaseSession).toHaveBeenCalledWith(
      { access_token: "at2", refresh_token: "rt2" },
      expect.objectContaining({ id: "u2" }),
    );
  });

  it("does not fall back to wallet-auth when the user rejects the Web3 signature", async () => {
    const signMessage = vi.fn(async () => {
      throw new Error("User rejected the request");
    });
    await expect(signInWithWallet("WalletPubkey111", signMessage)).rejects.toThrow(/reject/i);
    expect(invokeEdgeFn).not.toHaveBeenCalled();
  });
});
