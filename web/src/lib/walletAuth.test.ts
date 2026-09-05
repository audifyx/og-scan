import { beforeEach, describe, expect, it, vi } from "vitest";
import { signInWithWallet } from "./walletAuth";

const invokeEdgeFn = vi.fn();
const getSession = vi.fn();
const setSession = vi.fn();

vi.mock("@/lib/edgeFn", () => ({
  invokeEdgeFn: (...args: unknown[]) => invokeEdgeFn(...args),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSession(...args),
      setSession: (...args: unknown[]) => setSession(...args),
    },
  },
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
}));

describe("signInWithWallet", () => {
  beforeEach(() => {
    invokeEdgeFn.mockReset();
    getSession.mockReset();
    setSession.mockReset();
    getSession.mockResolvedValue({ data: { session: null } });
    setSession.mockResolvedValue({ error: null });
  });

  it("requests a nonce, then verifies with that nonce before setSession", async () => {
    invokeEdgeFn
      .mockResolvedValueOnce({ nonce: "n1", message: "sign this n1" })
      .mockResolvedValueOnce({ access_token: "at", refresh_token: "rt", isNew: false });
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
    expect(setSession).toHaveBeenCalledWith({ access_token: "at", refresh_token: "rt" });
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
    invokeEdgeFn
      .mockResolvedValueOnce({ nonce: "n2", message: "sign this n2" })
      .mockResolvedValueOnce({ access_token: "at2", refresh_token: "rt2", isNew: false });
    const result = await signInWithWallet("WalletPubkey111", async () => new Uint8Array([1]), {
      replaceEmailSession: true,
    });
    expect(result.isNew).toBe(false);
    expect(getSession).not.toHaveBeenCalled();
    expect(invokeEdgeFn).toHaveBeenCalled();
    expect(setSession).toHaveBeenCalledWith({ access_token: "at2", refresh_token: "rt2" });
  });
});
