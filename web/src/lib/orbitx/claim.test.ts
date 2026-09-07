// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  COLLECT_CREATOR_FEE_DISCRIMINATOR,
} from "../../../shared/pump-claim.js";
import {
  PUMP_PROGRAM_ID,
  SYSTEM_ACCOUNT_RENT_LAMPORTS,
  buildCollectCreatorFeeInstruction,
  buildLocalPumpClaimTransaction,
  buildPumpClaimTransaction,
  getPumpClaimableSol,
  pumpCreatorVaultPda,
  pumpEventAuthorityPda,
} from "./claim";

const CREATOR = new PublicKey("CicbPxARTDrwQ4XcxWsn6SYeG4FMJHirS633cZUJeQDh");

function mockConnection(overrides: Partial<Connection> = {}): Connection {
  return {
    rpcEndpoint: "https://example.invalid/rpc",
    getLatestBlockhash: vi.fn().mockResolvedValue({
      blockhash: "11111111111111111111111111111111",
      lastValidBlockHeight: 1,
    }),
    getBalance: vi.fn().mockResolvedValue(SYSTEM_ACCOUNT_RENT_LAMPORTS + 1_000_000_000),
    getMinimumBalanceForRentExemption: vi.fn().mockRejectedValue(new Error("method not allowed")),
    ...overrides,
  } as unknown as Connection;
}

describe("pump collectCreatorFee local builder", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("derives creator-vault and event-authority PDAs", () => {
    const vault = pumpCreatorVaultPda(CREATOR);
    const event = pumpEventAuthorityPda();
    expect(vault).toBeInstanceOf(PublicKey);
    expect(event).toBeInstanceOf(PublicKey);
    expect(vault.equals(CREATOR)).toBe(false);
    expect(event.equals(vault)).toBe(false);
  });

  it("builds the official 5-account collectCreatorFee instruction", () => {
    const ix = buildCollectCreatorFeeInstruction(CREATOR);
    expect(ix.programId.equals(PUMP_PROGRAM_ID)).toBe(true);
    expect([...ix.data]).toEqual(COLLECT_CREATOR_FEE_DISCRIMINATOR);
    expect(ix.keys).toHaveLength(5);
    expect(ix.keys[0].pubkey.equals(CREATOR)).toBe(true);
    expect(ix.keys[0].isSigner).toBe(true);
    expect(ix.keys[0].isWritable).toBe(true);
    expect(ix.keys[1].pubkey.equals(pumpCreatorVaultPda(CREATOR))).toBe(true);
    expect(ix.keys[1].isWritable).toBe(true);
    expect(ix.keys[2].pubkey.equals(SystemProgram.programId)).toBe(true);
    expect(ix.keys[3].pubkey.equals(pumpEventAuthorityPda())).toBe(true);
    expect(ix.keys[4].pubkey.equals(PUMP_PROGRAM_ID)).toBe(true);
  });

  it("uses the hardcoded rent floor when getMinimumBalanceForRentExemption fails", async () => {
    const sol = await getPumpClaimableSol(mockConnection(), CREATOR);
    expect(sol).toBe(1);
  });

  it("builds a local claim tx without PumpPortal", async () => {
    const conn = mockConnection();
    const tx = await buildLocalPumpClaimTransaction(CREATOR, conn);
    expect(tx).toBeInstanceOf(VersionedTransaction);
    const ixs = TransactionMessage.decompile(tx.message).instructions;
    const collect = ixs[ixs.length - 1];
    expect([...collect.data]).toEqual(COLLECT_CREATOR_FEE_DISCRIMINATOR);
    expect(collect.programId.equals(PUMP_PROGRAM_ID)).toBe(true);
    expect(conn.getLatestBlockhash).toHaveBeenCalled();
  });

  it("falls back to local collectCreatorFee when PumpPortal returns 429 max usage reached", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      text: async () => "max usage reached",
      arrayBuffer: async () => new ArrayBuffer(0),
    }));
    const tx = await buildPumpClaimTransaction(CREATOR, mockConnection());
    expect(tx).toBeInstanceOf(VersionedTransaction);
    const ixs = TransactionMessage.decompile(tx.message).instructions;
    expect([...ixs[ixs.length - 1].data]).toEqual(COLLECT_CREATOR_FEE_DISCRIMINATOR);
  });
});
