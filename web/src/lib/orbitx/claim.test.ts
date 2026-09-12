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
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  COLLECT_CREATOR_FEE_DISCRIMINATOR,
  COLLECT_CREATOR_FEE_V2_DISCRIMINATOR,
} from "../../../shared/pump-claim.js";
import {
  PUMP_PROGRAM_ID,
  SYSTEM_ACCOUNT_RENT_LAMPORTS,
  buildCollectCreatorFeeInstruction,
  buildCollectCreatorFeeV2Instruction,
  buildLocalPumpClaimTransaction,
  buildPumpClaimTransaction,
  getPumpClaimableSol,
  pumpCreatorVaultPda,
  pumpEventAuthorityPda,
} from "./claim";
import { SOL_MINT } from "./rescue";

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
    getAccountInfo: vi.fn().mockResolvedValue({
      owner: SystemProgram.programId,
      lamports: 1_000_000,
      data: Buffer.alloc(0),
      executable: false,
    }),
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

  it("keeps legacy collectCreatorFee as 5-account creator-signer (not sent)", () => {
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

  it("builds permissionless collect_creator_fee_v2 with creator as non-signer", () => {
    const ix = buildCollectCreatorFeeV2Instruction(CREATOR);
    expect(ix.programId.equals(PUMP_PROGRAM_ID)).toBe(true);
    expect([...ix.data]).toEqual(COLLECT_CREATOR_FEE_V2_DISCRIMINATOR);
    expect(ix.keys).toHaveLength(10);
    expect(ix.keys[0].pubkey.equals(CREATOR)).toBe(true);
    expect(ix.keys[0].isSigner).toBe(false);
    expect(ix.keys[0].isWritable).toBe(true);
    expect(ix.keys[2].pubkey.equals(pumpCreatorVaultPda(CREATOR))).toBe(true);
    expect(ix.keys[4].pubkey.equals(SOL_MINT)).toBe(true);
    expect(ix.keys[5].pubkey.equals(TOKEN_PROGRAM_ID)).toBe(true);
    expect(ix.keys[6].pubkey.equals(ASSOCIATED_TOKEN_PROGRAM_ID)).toBe(true);
    expect(ix.keys[7].pubkey.equals(SystemProgram.programId)).toBe(true);
    expect(ix.keys[8].pubkey.equals(pumpEventAuthorityPda())).toBe(true);
    expect(ix.keys[9].pubkey.equals(PUMP_PROGRAM_ID)).toBe(true);
  });

  it("uses the hardcoded rent floor when getMinimumBalanceForRentExemption fails", async () => {
    const sol = await getPumpClaimableSol(mockConnection(), CREATOR);
    expect(sol).toBe(1);
  });

  it("builds a local v2 claim tx without PumpPortal", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const conn = mockConnection();
    const tx = await buildLocalPumpClaimTransaction(CREATOR, conn);
    expect(tx).toBeInstanceOf(VersionedTransaction);
    const ixs = TransactionMessage.decompile(tx.message).instructions;
    const collect = ixs[ixs.length - 1];
    expect([...collect.data]).toEqual(COLLECT_CREATOR_FEE_V2_DISCRIMINATOR);
    expect(collect.programId.equals(PUMP_PROGRAM_ID)).toBe(true);
    // Fee payer still signs the tx; the v2 ix itself does not require creator as a program signer.
    expect(tx.message.staticAccountKeys[0].equals(CREATOR)).toBe(true);
    expect(conn.getLatestBlockhash).toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not call PumpPortal even when the dead 429 max usage reached path is mocked", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      text: async () => "max usage reached",
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    vi.stubGlobal("fetch", fetchSpy);
    const tx = await buildPumpClaimTransaction(CREATOR, mockConnection());
    expect(tx).toBeInstanceOf(VersionedTransaction);
    const ixs = TransactionMessage.decompile(tx.message).instructions;
    expect([...ixs[ixs.length - 1].data]).toEqual(COLLECT_CREATOR_FEE_V2_DISCRIMINATOR);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
