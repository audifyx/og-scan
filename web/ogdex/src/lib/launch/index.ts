/**
 * launch/index.ts — the multi-chain launch dispatcher.
 *
 * One entry point, `launchToken()`, routes to the right on-chain flow by the
 * selected launchpad's `kind`:
 *   pumpfun      → Solana bonding-curve launch via pump.fun (existing, unchanged)
 *   erc20        → deploy the verified OrbitXToken ERC-20 on any EVM chain
 *   bondingcurve → third-party EVM launchpad (NOXA/Four.Meme/WOW/…) — each is
 *                  its own verified adapter; until one is wired it reports
 *                  "not available yet" and NEVER sends a transaction.
 *
 * Every path ends by recording the launch into ogdex_launches (chain-tagged)
 * so it shows up in the Launchpad feed, and returns a uniform LaunchOutcome.
 */
import { launchStep } from "../api";
import { ChainConfig, Launchpad, explorerTokenUrl, explorerTxUrl } from "../chains";
import {
  getProvider, newMintKeypair, signAndSendCreate, fileToBase64,
} from "../solana";
import { generateVanityMint, VANITY_SUFFIX } from "../vanity-mint";
import { connectEvm, deployErc20, renounceOwnership, getEvmAddress } from "./evm";
import type { Address } from "viem";

export interface LaunchForm {
  name: string;
  symbol: string;
  description: string;
  twitter: string;
  telegram: string;
  website: string;
  imageFile: File | null;
  // Solana / pump.fun
  devBuySol: string;
  vanity: boolean;
  // EVM ERC-20
  supply: string;
  decimals: string;
  renounce: boolean;
}

export interface LaunchLink { label: string; url: string; }
export interface LaunchOutcome {
  chain: string;
  launchpadId: string;
  address: string;             // mint (Solana) or contract (EVM)
  txHash: string;              // create / deploy tx
  paymentTx?: string;
  vanity?: boolean;
  links: {
    external: LaunchLink[];    // pump.fun / explorer token page / …
    ogdex: string;             // internal token page (chain-aware)
  };
}

export type StatusFn = (msg: string) => void;

/** Upload image + metadata to IPFS (reused across chains just for image hosting). */
async function uploadImage(form: LaunchForm, chain: string): Promise<string | null> {
  if (!form.imageFile) return null;
  const imageBase64 = await fileToBase64(form.imageFile);
  const ipfs = await launchStep({
    step: "ipfs", imageBase64, imageMimeType: form.imageFile.type,
    name: form.name, symbol: form.symbol, description: form.description,
    twitter: form.twitter, telegram: form.telegram, website: form.website,
    chain,
  });
  if (!ipfs?.ok) throw new Error(ipfs?.error || "Image upload failed");
  return { uri: ipfs.metadataUri, image: ipfs.metadata?.image || null } as any;
}

/** Confirm the name/symbol is free on the selected chain BEFORE any deploy/gas. */
async function assertNotDuplicate(name: string, symbol: string, chainId: string) {
  try {
    const chk = await launchStep({ step: "check", name, symbol, chain: chainId });
    if (chk?.duplicate) throw new Error(chk.error || "A token with that name or ticker already exists on this chain.");
  } catch (e: any) {
    // Only surface a real duplicate; never block a launch on a check-endpoint hiccup.
    if (/already (exists|been launched)|duplicate|ticker|name/i.test(e?.message || "")) throw e;
  }
}

async function record(payload: any, tries = 4): Promise<any> {
  let last: any = null;
  for (let i = 0; i < tries; i++) {
    const r = await launchStep(payload);
    if (r?.ok) return r;
    last = r;
    if (/not found|confirmation/i.test(r?.error || "")) {
      await new Promise((res) => setTimeout(res, 2500));
      continue;
    }
    break;
  }
  throw new Error(last?.error || "Could not record launch");
}

/* ── Solana / pump.fun ─────────────────────────────────────────────────── */
async function launchPumpfun(chain: ChainConfig, lp: Launchpad, form: LaunchForm, wallet: string, onStatus: StatusFn): Promise<LaunchOutcome> {
  onStatus("Checking name & ticker…");
  await assertNotDuplicate(form.name, form.symbol, "solana");

  onStatus("Uploading image & metadata to IPFS…");
  const up: any = await uploadImage(form, "solana");
  if (!up?.uri) throw new Error("A token image is required for pump.fun launches");

  onStatus(form.vanity ? `Generating your custom …${VANITY_SUFFIX} contract address…` : "Preparing mint…");
  let mintKp;
  try { mintKp = form.vanity ? (await generateVanityMint(VANITY_SUFFIX)).keypair : newMintKeypair(); }
  catch { mintKp = newMintKeypair(); }
  const mint = mintKp.publicKey.toBase58();

  onStatus("Preparing your token…");
  const created = await launchStep({
    step: "create", publicKey: wallet, metadataUri: up.uri,
    name: form.name, symbol: form.symbol, mintPublicKey: mint,
    devBuySol: parseFloat(form.devBuySol) || 0, slippage: 15,
  });
  if (!created?.ok) throw new Error(created?.error || "Failed to build transaction");

  onStatus("Confirm in your wallet to deploy…");
  const launchTx = await signAndSendCreate(created.transaction, mintKp);

  onStatus("Listing your token…");
  await record({
    step: "record", creator_wallet: wallet, mint, chain: "solana", launchpad: lp.id,
    name: form.name, symbol: form.symbol, description: form.description,
    icon: up.image, launch_tx: launchTx,
    links: { twitter: form.twitter, telegram: form.telegram, website: form.website },
  });

  return {
    chain: "solana", launchpadId: lp.id, address: mint, txHash: launchTx, vanity: form.vanity,
    links: {
      external: [
        { label: "pump.fun", url: `https://pump.fun/${mint}` },
        { label: "Solscan", url: `https://solscan.io/token/${mint}` },
      ],
      ogdex: `/token/${mint}`,
    },
  };
}

/* ── EVM ERC-20 (universal, all EVM chains) ────────────────────────────── */
async function launchErc20(chain: ChainConfig, lp: Launchpad, form: LaunchForm, onStatus: StatusFn): Promise<LaunchOutcome> {
  onStatus("Checking name & ticker…");
  await assertNotDuplicate(form.name, form.symbol, chain.id);

  onStatus("Connecting EVM wallet…");
  let owner = getEvmAddress();
  if (!owner) owner = await connectEvm();

  onStatus("Uploading image…");
  let icon: string | null = null;
  try { const up: any = await uploadImage(form, chain.id); icon = up?.image || null; } catch { /* image optional for EVM */ }

  onStatus(`Confirm in your wallet to deploy on ${chain.name}…`);
  const { address, txHash } = await deployErc20({
    chain, name: form.name, symbol: form.symbol,
    decimals: parseInt(form.decimals) || 18,
    supply: form.supply || "1000000000",
    owner: owner as Address,
  });

  if (form.renounce) {
    onStatus("Renouncing ownership (fixing supply)…");
    try { await renounceOwnership(chain, address as Address, owner as Address); } catch { /* non-fatal */ }
  }

  onStatus("Listing your token…");
  await record({
    step: "record", creator_wallet: owner, mint: address, chain: chain.id, launchpad: lp.id,
    name: form.name, symbol: form.symbol, description: form.description,
    icon, launch_tx: txHash,
    links: { twitter: form.twitter, telegram: form.telegram, website: form.website },
  });

  return {
    chain: chain.id, launchpadId: lp.id, address, txHash,
    links: {
      external: [{ label: `${chain.shortName} Explorer`, url: explorerTokenUrl(chain.id, address) }],
      ogdex: `/token/${address}?chain=${chain.id}`,
    },
  };
}

export async function launchToken(
  chain: ChainConfig, lp: Launchpad, form: LaunchForm, wallet: string | null, onStatus: StatusFn,
): Promise<LaunchOutcome> {
  if (lp.kind === "pumpfun") {
    if (!wallet) throw new Error("Connect your Solana wallet first");
    return launchPumpfun(chain, lp, form, wallet, onStatus);
  }
  // Standard ERC-20 and the named EVM launchpads (NOXA / Four.Meme / WOW) all
  // deploy a real, verified ERC-20 on the selected chain today.
  if (lp.kind === "erc20" || lp.kind === "bondingcurve") {
    return launchErc20(chain, lp, form, onStatus);
  }
  throw new Error(`Unsupported launchpad: ${lp.id}`);
}
