/**
 * Jupiter-only City shop checkout: buy ORBITX, then burn that amount.
 */
import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { JUPITER_BASE, OGSCAN_TOKEN_MINT, SOL_MINT, USDC_MINT, jupSwapTransaction, type JupQuote } from "@/lib/og";
import { buildBurnTransaction, scanBurnableTokens } from "@/lib/orbitx/rescue";
import { fetchTokenDetail } from "./tokenApi";
import {
  CITY_SHOP_MINT,
  getShopItem,
  orbitxNeeded,
  upsertPurchase,
  type ShopPurchase,
} from "./cityShop";

export interface ShopQuote {
  itemId: string;
  priceUsd: number;
  orbitxPriceUsd: number;
  orbitxUi: number;
  orbitxRaw: string;
  decimals: number;
  solLamports: string;
  jup: JupQuote;
}

async function jupQuoteFlexible(
  input: string,
  output: string,
  amount: string,
  swapMode: "ExactIn" | "ExactOut",
  slippageBps = 150,
): Promise<JupQuote> {
  const url = `${JUPITER_BASE}/swap/v1/quote?inputMint=${input}&outputMint=${output}&amount=${amount}&slippageBps=${slippageBps}&restrictIntermediateTokens=true&swapMode=${swapMode}`;
  const res = await fetch(url);
  const json = (await res.json()) as JupQuote & { error?: string };
  if (!res.ok || !json?.outAmount) throw new Error(json?.error || "Jupiter quote failed");
  return json;
}

export async function quoteShopItem(itemId: string): Promise<ShopQuote> {
  const item = getShopItem(itemId);
  if (!item) throw new Error("Unknown shop item");
  const token = await fetchTokenDetail(CITY_SHOP_MINT);
  const orbitxPriceUsd = token?.priceUsd ?? 0;
  if (!(orbitxPriceUsd > 0)) throw new Error("ORBITX price unavailable — try again");
  const decimals = token?.decimals ?? 6;
  const ui = orbitxNeeded(item.priceUsd, orbitxPriceUsd);
  const raw = BigInt(Math.ceil(ui * 10 ** decimals));
  if (raw <= BigInt(0)) throw new Error("Burn amount too small");

  try {
    const jup = await jupQuoteFlexible(SOL_MINT, OGSCAN_TOKEN_MINT, raw.toString(), "ExactOut");
    return {
      itemId,
      priceUsd: item.priceUsd,
      orbitxPriceUsd,
      orbitxUi: Number(jup.outAmount) / 10 ** decimals,
      orbitxRaw: jup.outAmount,
      decimals,
      solLamports: jup.inAmount,
      jup,
    };
  } catch {
    const solUsd = await fetchTokenDetail(SOL_MINT);
    const solPrice = solUsd?.priceUsd ?? 0;
    let solLamports: string;
    if (solPrice > 0) {
      solLamports = String(Math.ceil((item.priceUsd / solPrice) * 1.08 * 1e9));
    } else {
      const usdc = await jupQuoteFlexible(USDC_MINT, SOL_MINT, String(Math.ceil(item.priceUsd * 1e6 * 1.08)), "ExactIn");
      solLamports = usdc.outAmount;
    }
    const jup = await jupQuoteFlexible(SOL_MINT, OGSCAN_TOKEN_MINT, solLamports, "ExactIn");
    return {
      itemId,
      priceUsd: item.priceUsd,
      orbitxPriceUsd,
      orbitxUi: Number(jup.outAmount) / 10 ** decimals,
      orbitxRaw: jup.outAmount,
      decimals,
      solLamports: jup.inAmount,
      jup,
    };
  }
}

export interface ShopWallet {
  publicKey: PublicKey;
  signSwap: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
  signLegacy: (tx: Transaction) => Promise<Transaction>;
}

export async function buyAndBurnShopItem(opts: {
  connection: Connection;
  wallet: ShopWallet;
  quote: ShopQuote;
  listingMint?: string;
  bannerTitle?: string;
  bannerSubtitle?: string;
  bannerImageUrl?: string;
}): Promise<ShopPurchase> {
  const item = getShopItem(opts.quote.itemId);
  if (!item) throw new Error("Unknown shop item");
  const walletKey = opts.wallet.publicKey.toBase58();

  const swapB64 = await jupSwapTransaction(opts.quote.jup, walletKey);
  const swapTx = VersionedTransaction.deserialize(Uint8Array.from(atob(swapB64), (c) => c.charCodeAt(0)));
  const signedSwap = await opts.wallet.signSwap(swapTx);
  const swapSig = await opts.connection.sendRawTransaction(signedSwap.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });
  await opts.connection.confirmTransaction(swapSig, "confirmed");

  const held = await scanBurnableTokens(opts.connection, opts.wallet.publicKey);
  const orbitx = held.find((t) => t.mint === OGSCAN_TOKEN_MINT);
  if (!orbitx) throw new Error("ORBITX arrived but the token account is missing — retry the purchase");
  const want = BigInt(opts.quote.orbitxRaw);
  const burnRaw = want > orbitx.balanceRaw ? orbitx.balanceRaw : want;
  if (burnRaw <= BigInt(0)) throw new Error("Nothing to burn");

  const { tx } = await buildBurnTransaction(opts.connection, opts.wallet.publicKey, orbitx, burnRaw);
  const { blockhash, lastValidBlockHeight } = await opts.connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = opts.wallet.publicKey;
  const signedBurn = await opts.wallet.signLegacy(tx);
  const burnSig = await opts.connection.sendRawTransaction(signedBurn.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });
  await opts.connection.confirmTransaction({ signature: burnSig, blockhash, lastValidBlockHeight }, "confirmed");

  const purchase: ShopPurchase = {
    itemId: item.id,
    wallet: walletKey,
    boughtAt: Date.now(),
    expiresAt: item.adDays ? Date.now() + item.adDays * 86_400_000 : undefined,
    swapSig,
    burnSig,
    usd: item.priceUsd,
    orbitxBurned: Number(burnRaw) / 10 ** opts.quote.decimals,
    equipped: item.category === "wear" || item.category === "character",
    listingMint: opts.listingMint,
    bannerTitle: opts.bannerTitle,
    bannerSubtitle: opts.bannerSubtitle,
    bannerImageUrl: opts.bannerImageUrl,
  };
  upsertPurchase(walletKey, purchase);
  return purchase;
}
