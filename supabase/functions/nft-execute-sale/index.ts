// OrbitX NFT Hub — atomic marketplace settlement.
//
// Trust model: OrbitX holds ONE dedicated "marketplace authority" keypair
// (MARKETPLACE_AUTHORITY_SECRET_KEY, an edge-function-only secret, never
// sent to any client). Sellers approve that authority as an SPL Token
// *delegate* over exactly 1 unit of their listed NFT when they list/auction
// it (a normal, revocable, non-custodial `approve` instruction the seller
// signs themselves) — the seller keeps the NFT in their own wallet the
// whole time. That lets a buyer complete a purchase later, atomically,
// without the seller needing to be online.
//
// Flow:
//   action="build"  -> server loads the listing/offer/auction, computes the
//                       seller/creator-royalty/platform-fee split, builds ONE
//                       transaction (SOL transfers + a delegated SPL token
//                       transfer), partially signs it with the marketplace
//                       authority (a required signer of the token transfer),
//                       stages the exact amounts in orbitx_nft_pending_sales,
//                       and returns the partially-signed tx (base64) + a
//                       pendingSaleId. Nothing has moved yet.
//   action="submit" -> client returns the SAME transaction after the buyer
//                       signs it in Phantom. The server does not need to
//                       re-validate instruction contents: Solana's signature
//                       verification means if the buyer (or anyone) altered
//                       any instruction after the marketplace authority
//                       signed, the transaction becomes invalid and the
//                       cluster rejects it outright. The server just submits
//                       it, confirms it, and records the sale.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL,
} from "https://esm.sh/@solana/web3.js@1.98.4?bundle";
import {
  getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, createTransferInstruction,
} from "https://esm.sh/@solana/spl-token@0.4.13?bundle";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const HELIUS_API_KEY = Deno.env.get("HELIUS_API_KEY") ?? "";
const MARKETPLACE_AUTHORITY_SECRET_KEY = Deno.env.get("MARKETPLACE_AUTHORITY_SECRET_KEY") ?? "";
const PLATFORM_FEE_WALLET = Deno.env.get("ORBITX_NFT_FEE_WALLET") ?? "";
const PLATFORM_FEE_BPS = 100; // 1% OrbitX marketplace fee, per the spec's worked example

const RPC = HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}` : "https://api.mainnet-beta.solana.com";

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors() });
}
function loadAuthorityKeypair(): Keypair {
  const parsed = JSON.parse(MARKETPLACE_AUTHORITY_SECRET_KEY);
  return Keypair.fromSecretKey(Uint8Array.from(parsed));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors() });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !MARKETPLACE_AUTHORITY_SECRET_KEY || !PLATFORM_FEE_WALLET) {
    return json({ error: "Marketplace settlement is not configured yet" }, 503);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const connection = new Connection(RPC, "confirmed");
  const authority = loadAuthorityKeypair();

  try {
    const body = await req.json();

    if (body.action === "build") {
      const { mode, sourceId, buyerWallet } = body as { mode: "listing" | "offer" | "auction"; sourceId: string; buyerWallet: string };
      if (!mode || !sourceId || !buyerWallet) return json({ error: "mode, sourceId, buyerWallet are required" }, 400);

      let nftId: string, sellerWallet: string, priceSol: number;
      if (mode === "listing") {
        const { data: listing, error } = await supabase.from("orbitx_nft_listings").select("*").eq("id", sourceId).eq("status", "active").single();
        if (error || !listing) return json({ error: "Listing not found or no longer active" }, 404);
        nftId = listing.nft_id; sellerWallet = listing.seller_wallet; priceSol = Number(listing.price_sol);
      } else if (mode === "offer") {
        const { data: offer, error } = await supabase.from("orbitx_nft_offers").select("*").eq("id", sourceId).eq("status", "accepted").single();
        if (error || !offer) return json({ error: "Offer not found or not accepted yet" }, 404);
        if (offer.buyer_wallet !== buyerWallet) return json({ error: "Only the original offerer can settle this offer" }, 403);
        const { data: nft } = await supabase.from("orbitx_nfts").select("id, current_owner").eq("id", offer.nft_id).single();
        nftId = offer.nft_id; sellerWallet = nft?.current_owner ?? ""; priceSol = Number(offer.price_sol);
      } else if (mode === "auction") {
        const { data: auction, error } = await supabase.from("orbitx_nft_auctions").select("*").eq("id", sourceId).eq("status", "ended").single();
        if (error || !auction) return json({ error: "Auction not found or not ready to settle" }, 404);
        if (auction.highest_bidder !== buyerWallet) return json({ error: "Only the winning bidder can settle this auction" }, 403);
        nftId = auction.nft_id; sellerWallet = auction.seller_wallet; priceSol = Number(auction.highest_bid_sol);
      } else {
        return json({ error: "Invalid mode" }, 400);
      }

      const { data: nft, error: nftErr } = await supabase.from("orbitx_nfts").select("*").eq("id", nftId).single();
      if (nftErr || !nft) return json({ error: "NFT not found" }, 404);
      if (!nft.delegate_approved) return json({ error: "Seller has not approved marketplace settlement for this NFT yet" }, 409);
      if (nft.current_owner !== sellerWallet) return json({ error: "Seller no longer owns this NFT" }, 409);

      const royaltyBps = Number(nft.royalty_bps) || 0;
      const feeLamports = Math.round(priceSol * (PLATFORM_FEE_BPS / 10000) * LAMPORTS_PER_SOL);
      const royaltyLamports = nft.creator_wallet !== sellerWallet ? Math.round(priceSol * (royaltyBps / 10000) * LAMPORTS_PER_SOL) : 0;
      const totalLamports = Math.round(priceSol * LAMPORTS_PER_SOL);
      const sellerLamports = totalLamports - feeLamports - royaltyLamports;
      if (sellerLamports <= 0) return json({ error: "Fee/royalty configuration leaves nothing for the seller" }, 400);

      const buyer = new PublicKey(buyerWallet);
      const seller = new PublicKey(sellerWallet);
      const creator = new PublicKey(nft.creator_wallet);
      const feeWallet = new PublicKey(PLATFORM_FEE_WALLET);
      const mint = new PublicKey(nft.mint_address);

      const sellerAta = getAssociatedTokenAddressSync(mint, seller);
      const buyerAta = getAssociatedTokenAddressSync(mint, buyer);

      const tx = new Transaction();
      tx.add(SystemProgram.transfer({ fromPubkey: buyer, toPubkey: seller, lamports: sellerLamports }));
      if (royaltyLamports > 0) tx.add(SystemProgram.transfer({ fromPubkey: buyer, toPubkey: creator, lamports: royaltyLamports }));
      if (feeLamports > 0) tx.add(SystemProgram.transfer({ fromPubkey: buyer, toPubkey: feeWallet, lamports: feeLamports }));
      tx.add(createAssociatedTokenAccountIdempotentInstruction(buyer, buyerAta, buyer, mint));
      tx.add(createTransferInstruction(sellerAta, buyerAta, authority.publicKey, 1));

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = buyer;
      tx.partialSign(authority);

      const { data: pending, error: pendingErr } = await supabase.from("orbitx_nft_pending_sales").insert({
        nft_id: nftId, mode, source_id: sourceId, buyer_wallet: buyerWallet, seller_wallet: sellerWallet, creator_wallet: nft.creator_wallet,
        seller_amount_sol: sellerLamports / LAMPORTS_PER_SOL, creator_amount_sol: royaltyLamports / LAMPORTS_PER_SOL,
        fee_amount_sol: feeLamports / LAMPORTS_PER_SOL, total_amount_sol: priceSol,
      }).select("id").single();
      if (pendingErr || !pending) return json({ error: "Failed to stage sale" }, 500);

      return json({
        pendingSaleId: pending.id,
        transactionBase64: tx.serialize({ requireAllSignatures: false }).toString("base64"),
        lastValidBlockHeight,
        breakdown: { sellerAmountSol: sellerLamports / LAMPORTS_PER_SOL, creatorRoyaltySol: royaltyLamports / LAMPORTS_PER_SOL, platformFeeSol: feeLamports / LAMPORTS_PER_SOL, totalSol: priceSol },
      });
    }

    if (body.action === "submit") {
      const { pendingSaleId, signedTransactionBase64 } = body as { pendingSaleId: string; signedTransactionBase64: string };
      if (!pendingSaleId || !signedTransactionBase64) return json({ error: "pendingSaleId and signedTransactionBase64 are required" }, 400);

      const { data: pending, error: pendingErr } = await supabase.from("orbitx_nft_pending_sales").select("*").eq("id", pendingSaleId).eq("status", "pending").single();
      if (pendingErr || !pending) return json({ error: "Pending sale not found or already used" }, 404);
      if (new Date(pending.expires_at).getTime() < Date.now()) {
        await supabase.from("orbitx_nft_pending_sales").update({ status: "expired" }).eq("id", pendingSaleId);
        return json({ error: "This sale offer expired — please retry the purchase" }, 410);
      }

      const raw = Uint8Array.from(atob(signedTransactionBase64), (c) => c.charCodeAt(0));
      const tx = Transaction.from(raw);

      let signature: string;
      try {
        signature = await connection.sendRawTransaction(raw, { skipPreflight: false, maxRetries: 3 });
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
      } catch (chainErr) {
        return json({ error: `Transaction failed on-chain: ${chainErr instanceof Error ? chainErr.message : String(chainErr)}` }, 400);
      }

      await supabase.from("orbitx_nft_pending_sales").update({ status: "consumed" }).eq("id", pendingSaleId);
      await supabase.rpc("orbitx_nft_record_sale", {
        p_nft_id: pending.nft_id, p_buyer_wallet: pending.buyer_wallet, p_seller_wallet: pending.seller_wallet,
        p_creator_wallet: pending.creator_wallet, p_amount_sol: pending.total_amount_sol, p_tx_signature: signature,
        p_listing_id: pending.mode === "listing" ? pending.source_id : null,
        p_offer_id: pending.mode === "offer" ? pending.source_id : null,
        p_auction_id: pending.mode === "auction" ? pending.source_id : null,
      });

      return json({ signature });
    }

    if (body.action === "authority") {
      // Public endpoint: the seller's wallet needs this pubkey to run the
      // on-chain `approve` (delegate) instruction when listing. Not a secret.
      return json({ authorityPubkey: authority.publicKey.toString(), feeWallet: PLATFORM_FEE_WALLET });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("[nft-execute-sale]", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
