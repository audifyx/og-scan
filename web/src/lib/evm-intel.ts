/**
 * EVM Token Intelligence — powered by GoPlus Security API (free, no key needed).
 * Provides the EVM equivalent of Solana's Helius/Pump.fun/bundle data:
 *   - Contract security (verified, mintable, proxy, selfdestruct, honeypot)
 *   - Holder concentration (top holders, whale wallets, creator %)
 *   - Trading safety (buy/sell tax, blacklist, pause, cooldown)
 *   - Owner/creator intel
 */

import { getChain } from "./chains";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EvmTokenSecurity {
  // Contract
  isOpenSource: boolean;
  isProxy: boolean;
  isMintable: boolean;
  canSelfDestruct: boolean;
  hasExternalCall: boolean;
  hiddenOwner: boolean;
  canTakeBackOwnership: boolean;

  // Trading
  isHoneypot: boolean;
  honeypotReason: string;
  honeypotRiskLevel: number;
  buyTax: string;
  sellTax: string;
  cannotBuy: boolean;
  slippageModifiable: boolean;
  isAntiWhale: boolean;
  isBlacklisted: boolean;
  isWhitelisted: boolean;
  transferPausable: boolean;
  tradingCooldown: boolean;

  // Ownership
  ownerAddress: string | null;
  ownerPercent: number;
  creatorAddress: string | null;
  creatorPercent: number;

  // Holders
  holderCount: number;
  topHolders: EvmHolder[];
  top10Percent: number;
  topHolderPercent: number;

  // Meta
  tokenName: string;
  tokenSymbol: string;
  totalSupply: string;
  honeypotWithSameCreator: boolean;
}

export interface EvmHolder {
  address: string;
  tag: string;
  isContract: boolean;
  balance: string;
  percent: number;
  isLocked: boolean;
}

// ─── Honeypot.is types ────────────────────────────────────────────────────────

interface HoneypotIsResult {
  isHoneypot: boolean;
  honeypotReason: string;
  riskLevel: number;
  flags: { flag: string; description: string; severity: string }[];
  sellTax: number;
  buyTax: number;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const securityCache = new Map<string, Promise<EvmTokenSecurity | null>>();
const honeypotCache = new Map<string, Promise<HoneypotIsResult | null>>();

// ─── GoPlus API ───────────────────────────────────────────────────────────────

function goPlusChainId(dexScreenerChainId: string): number | null {
  const chain = getChain(dexScreenerChainId);
  return chain.etherscanChainId ?? null;
}

function flag(val: string | number | undefined | null): boolean {
  return val === "1" || val === 1;
}

async function fetchHoneypotIs(
  chainId: string,
  contractAddress: string,
): Promise<HoneypotIsResult | null> {
  const cacheKey = `${chainId}:${contractAddress.toLowerCase()}`;
  const cached = honeypotCache.get(cacheKey);
  if (cached) return cached;

  const task = (async (): Promise<HoneypotIsResult | null> => {
    const numericChainId = goPlusChainId(chainId);
    if (numericChainId == null) return null;
    try {
      const url = `https://api.honeypot.is/v2/IsHoneypot?address=${contractAddress.toLowerCase()}&chainID=${numericChainId}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const json = await res.json();
      const result = json.honeypotResult ?? {};
      const sim = json.simulationResult ?? {};
      return {
        isHoneypot: result.isHoneypot === true,
        honeypotReason: result.honeypotReason ?? "",
        riskLevel: json.summary?.riskLevel ?? 0,
        flags: (json.summary?.flags ?? []).map((f: Record<string, string>) => ({
          flag: f.flag ?? "",
          description: f.description ?? "",
          severity: f.severity ?? "",
        })),
        sellTax: sim.sellTax ?? 0,
        buyTax: sim.buyTax ?? 0,
      };
    } catch {
      return null;
    }
  })();

  honeypotCache.set(cacheKey, task);
  return task;
}

export async function fetchEvmTokenSecurity(
  chainId: string,
  contractAddress: string,
): Promise<EvmTokenSecurity | null> {
  const cacheKey = `${chainId}:${contractAddress.toLowerCase()}`;
  const cached = securityCache.get(cacheKey);
  if (cached) return cached;

  const task = (async (): Promise<EvmTokenSecurity | null> => {
    const numericChainId = goPlusChainId(chainId);
    if (numericChainId == null) return null;

    const url = `https://api.gopluslabs.io/api/v1/token_security/${numericChainId}?contract_addresses=${contractAddress.toLowerCase()}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const json = await res.json();
    const results = json.result ?? {};
    const data = Object.values(results)[0] as Record<string, unknown> | undefined;
    if (!data) return null;

    const holders: EvmHolder[] = (Array.isArray(data.holders) ? data.holders : [])
      .slice(0, 10)
      .map((h: Record<string, unknown>) => ({
        address: String(h.address ?? ""),
        tag: String(h.tag ?? ""),
        isContract: flag(h.is_contract),
        balance: String(h.balance ?? "0"),
        percent: parseFloat(String(h.percent ?? "0")) * 100,
        isLocked: flag(h.is_locked),
      }));

    const top10Pct = holders.reduce((sum, h) => sum + h.percent, 0);
    const topHolderPct = holders.length > 0 ? holders[0].percent : 0;

    // Cross-check with honeypot.is for more accurate honeypot detection
    const hpIs = await fetchHoneypotIs(chainId, contractAddress).catch(() => null);
    const goPlusHoneypot = flag(data.is_honeypot);
    const honeypotIsHoneypot = hpIs?.isHoneypot === true;
    // Also flag as honeypot if GoPlus returns empty sell_tax (can't simulate sell)
    const sellTaxEmpty = data.sell_tax === "" || data.sell_tax == null;
    const isHoneypot = goPlusHoneypot || honeypotIsHoneypot || (sellTaxEmpty && !goPlusHoneypot && flag(data.is_in_dex));

    return {
      isOpenSource: flag(data.is_open_source),
      isProxy: flag(data.is_proxy),
      isMintable: flag(data.is_mintable),
      canSelfDestruct: flag(data.selfdestruct),
      hasExternalCall: flag(data.external_call),
      hiddenOwner: flag(data.hidden_owner),
      canTakeBackOwnership: flag(data.can_take_back_ownership),

      isHoneypot,
      honeypotReason: honeypotIsHoneypot ? (hpIs?.honeypotReason ?? "Honeypot detected") : sellTaxEmpty ? "Sell simulation failed — cannot sell" : "",
      honeypotRiskLevel: hpIs?.riskLevel ?? (isHoneypot ? 100 : 0),
      buyTax: hpIs ? String(hpIs.buyTax) : String(data.buy_tax ?? ""),
      sellTax: hpIs ? String(hpIs.sellTax) : String(data.sell_tax ?? ""),
      cannotBuy: flag(data.cannot_buy),
      slippageModifiable: flag(data.slippage_modifiable),
      isAntiWhale: flag(data.is_anti_whale),
      isBlacklisted: flag(data.is_blacklisted),
      isWhitelisted: flag(data.is_whitelisted),
      transferPausable: flag(data.transfer_pausable),
      tradingCooldown: flag(data.trading_cooldown),

      ownerAddress: typeof data.owner_address === "string" && data.owner_address ? data.owner_address : null,
      ownerPercent: parseFloat(String(data.owner_percent ?? "0")) * 100,
      creatorAddress: typeof data.creator_address === "string" && data.creator_address ? data.creator_address : null,
      creatorPercent: parseFloat(String(data.creator_percent ?? "0")) * 100,

      holderCount: parseInt(String(data.holder_count ?? "0"), 10) || 0,
      topHolders: holders,
      top10Percent: Math.round(top10Pct * 10) / 10,
      topHolderPercent: Math.round(topHolderPct * 10) / 10,

      tokenName: String(data.token_name ?? ""),
      tokenSymbol: String(data.token_symbol ?? ""),
      totalSupply: String(data.total_supply ?? ""),
      honeypotWithSameCreator: flag(data.honeypot_with_same_creator),
    };
  })();

  securityCache.set(cacheKey, task);
  return task;
}
