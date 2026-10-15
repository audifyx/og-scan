/**
 * NFT marketplace — backend-signed actions through the in-app wallet.
 *
 * Mint, buy, list, transfer, and burn all run through the supercomputer MCP
 * (orbitx_app_nft_*). The backend holds the in-app wallet key and signs —
 * no popup, no Phantom, no wallet-adapter. Every call needs the billing
 * authCode (one-time dashboard link).
 */
import { callSupercomputerTool, type McpToolResult } from "@/tokenomics/mcpClient";
import { getBillingAuthCode } from "@/tokenomics/auth";

function requireAuthCode(): string {
  const code = getBillingAuthCode();
  if (!code) {
    throw new Error("Link your in-app wallet first — one tap, then NFT actions are seamless.");
  }
  return code;
}

function assertOk(res: McpToolResult, action: string): McpToolResult {
  if (!res.ok) {
    throw new Error(res.message || res.error || `${action} failed.`);
  }
  return res;
}

/** Mint a real Metaplex NFT from the in-app wallet. Returns the mint address. */
export async function deskNftMint(args: {
  name: string;
  symbol?: string;
  uri: string;
  royaltyBps?: number;
  imageUrl?: string;
  collectionId?: string;
  collectionMint?: string;
  attributes?: { trait_type: string; value: string }[];
}): Promise<{ mint: string; signature: string }> {
  const authCode = requireAuthCode();
  const res = await callSupercomputerTool("orbitx_app_nft_mint", { authCode, ...args });
  const ok = assertOk(res, "Mint");
  const mint = (ok as any).mint as string | undefined;
  if (!mint) throw new Error("Mint returned no mint address.");
  return { mint, signature: (ok as any).signature as string };
}

/** Buy an NFT listing or settle an auction. Returns the tx signature. */
export async function deskNftBuy(args: {
  listingId?: string;
  auctionId?: string;
  mode?: "listing" | "auction";
}): Promise<{ signature: string; totalSol?: number }> {
  const authCode = requireAuthCode();
  const res = await callSupercomputerTool("orbitx_app_nft_buy", {
    authCode,
    listingId: args.listingId,
    auctionId: args.auctionId,
    mode: args.mode ?? (args.auctionId ? "auction" : "listing"),
  });
  const ok = assertOk(res, "Buy") as any;
  if (!ok.signature) throw new Error("Buy returned no transaction signature.");
  return { signature: ok.signature as string, totalSol: ok.breakdown?.totalSol };
}

/** List an owned NFT for sale. Returns the tx signature. */
export async function deskNftList(args: {
  nftId: string;
  mint: string;
  priceSol: number;
}): Promise<string> {
  const authCode = requireAuthCode();
  const res = await callSupercomputerTool("orbitx_app_nft_list", { authCode, ...args });
  const ok = assertOk(res, "List") as any;
  if (!ok.signature) throw new Error("List returned no transaction signature.");
  return ok.signature as string;
}

/** Approve the marketplace delegate over one NFT (for auctions). Returns the tx signature. */
export async function deskNftApproveDelegate(mint: string): Promise<string> {
  const authCode = requireAuthCode();
  const res = await callSupercomputerTool("orbitx_app_nft_approve_delegate", { authCode, mint });
  const ok = assertOk(res, "Approve delegate") as any;
  if (!ok.signature) throw new Error("Approve returned no transaction signature.");
  return ok.signature as string;
}

/** Transfer an SPL NFT to another wallet. Returns the tx signature. */
export async function deskNftTransfer(mint: string, destination: string): Promise<string> {
  const authCode = requireAuthCode();
  const res = await callSupercomputerTool("orbitx_app_nft_transfer", { authCode, mint, destination });
  const ok = assertOk(res, "Transfer") as any;
  if (!ok.signature) throw new Error("Transfer returned no transaction signature.");
  return ok.signature as string;
}

/** Burn an SPL NFT (reclaims rent). Returns the tx signature. */
export async function deskNftBurn(mint: string): Promise<string> {
  const authCode = requireAuthCode();
  const res = await callSupercomputerTool("orbitx_app_burn", { authCode, mint, percent: 100 });
  const ok = assertOk(res, "Burn") as any;
  if (!ok.signature) throw new Error("Burn returned no transaction signature.");
  return ok.signature as string;
}
