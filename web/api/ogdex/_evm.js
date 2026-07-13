// EVM token enrichment: live trades (GeckoTerminal) + security/holders (GoPlus).
// Keeps the /api/ogdex/token EVM path at parity with the Solana intel payload:
//   intel.trades  → Live Trades tab / Overview buy-sell split
//   intel.holders → Holders tab
//   safety        → risk score, LP lock %, creator, risk flags
//
// Robinhood (and any chain GoPlus doesn't index) returns trades but
// safety=null + holders=[] with unsupported:true — the UI shows "—" honestly
// rather than faking security data that no provider has for that chain.

const GT_HDR = { Accept: "application/json;version=20230302" };
const GT = "https://api.geckoterminal.com/api/v2";

// DexScreener chainId (string) → GoPlus numeric chain id. Chains absent here
// (e.g. "robinhood") have no security provider yet.
const GOPLUS_CHAIN = {
  ethereum: 1, bsc: 56, base: 8453, arbitrum: 42161, polygon: 137,
  avalanche: 43114, optimism: 10, blast: 81457, sonic: 146,
  berachain: 80094, linea: 59144, scroll: 534352, zksync: 324,
  mantle: 5000, celo: 42220,
};

const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : null; };

// ── Live trades via GeckoTerminal (works for every GT-indexed chain) ──────────
export async function evmTrades(gtNet, pool, mint, limit = 100) {
  if (!gtNet || !pool) return [];
  try {
    const raw = await fetch(
      `${GT}/networks/${gtNet}/pools/${pool}/trades?trade_volume_in_usd_greater_than=0`,
      { headers: GT_HDR }
    ).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const rows = raw?.data || [];
    const base = String(mint).toLowerCase();
    return rows.slice(0, limit).map((t) => {
      const a = t.attributes || {};
      const toIsBase = String(a.to_token_address || "").toLowerCase() === base;
      return {
        time:        a.block_timestamp || null,
        side:        a.kind === "sell" ? "sell" : "buy",
        priceUsd:    n(toIsBase ? a.price_to_in_usd : a.price_from_in_usd),
        tokenAmount: n(toIsBase ? a.to_token_amount : a.from_token_amount),
        volumeUsd:   n(a.volume_in_usd),
        owner:       a.tx_from_address || null,
        txHash:      a.tx_hash || null,
      };
    }).filter((x) => x.volumeUsd != null);
  } catch { return []; }
}

// ── Security + holders via GoPlus (major EVM chains only) ─────────────────────
export async function evmSecurity(dexChainId, mint, token = {}) {
  const gp = GOPLUS_CHAIN[dexChainId];
  if (!gp) return { safety: null, holders: [], holderCount: null, unsupported: true };
  try {
    const raw = await fetch(
      `https://api.gopluslabs.io/api/v1/token_security/${gp}?contract_addresses=${mint}`,
      { headers: { Accept: "application/json" } }
    ).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const key = String(mint).toLowerCase();
    const v = raw?.result?.[key] || raw?.result?.[mint];
    if (!v) return { safety: null, holders: [], holderCount: null, unsupported: false };

    const risks = [];
    let score = 0;
    const flag = (cond, level, name, desc) => { if (cond) { risks.push({ level, name, desc }); score += level === "danger" ? 25 : 10; } };
    const honeypot = v.is_honeypot === "1" || v.is_honeypot === 1;
    if (honeypot) { risks.push({ level: "danger", name: "Honeypot", desc: "Sells may be blocked" }); score += 70; }
    const buyTax = n(v.buy_tax) != null ? n(v.buy_tax) * 100 : null;
    const sellTax = n(v.sell_tax) != null ? n(v.sell_tax) * 100 : null;
    if (buyTax != null && buyTax >= 5)  { flag(true, buyTax >= 10 ? "danger" : "warn", `Buy tax ${buyTax.toFixed(0)}%`); }
    if (sellTax != null && sellTax >= 5) { flag(true, sellTax >= 10 ? "danger" : "warn", `Sell tax ${sellTax.toFixed(0)}%`); }
    flag(v.is_open_source === "0", "warn", "Not open source", "Contract source unverified");
    flag(v.is_mintable === "1", "warn", "Mintable", "Supply can be increased");
    flag(v.hidden_owner === "1", "danger", "Hidden owner");
    flag(v.can_take_back_ownership === "1", "danger", "Ownership reclaimable");
    flag(v.transfer_pausable === "1", "warn", "Transfers pausable");
    flag(v.is_blacklisted === "1", "warn", "Blacklist function");
    const riskScore = Math.min(100, score);

    // LP locked % — sum of locked LP holder shares.
    let lpLockedPct = null;
    if (Array.isArray(v.lp_holders)) {
      const locked = v.lp_holders.filter((h) => h.is_locked === 1 || h.is_locked === "1")
        .reduce((s, h) => s + (n(h.percent) || 0), 0);
      lpLockedPct = locked * 100;
    }

    const mcap = n(token.mcap);
    const holders = (v.holders || []).slice(0, 50).map((h) => {
      const pct = n(h.percent);
      return {
        owner: h.address,
        uiAmount: n(h.balance) ?? 0,
        pct: pct != null ? pct * 100 : null,
        usdValue: pct != null && mcap != null ? pct * mcap : null,
        label: h.tag || undefined,
        isContract: h.is_contract === 1 || h.is_contract === "1",
      };
    });

    const safety = {
      riskScore,
      creator: v.creator_address || null,
      creatorTokensCount: null,
      launchpad: null,
      lpLockedPct,
      honeypot,
      buyTax, sellTax,
      risks,
      holderCount: n(v.holder_count),
      source: "goplus",
    };
    return { safety, holders, holderCount: n(v.holder_count), unsupported: false };
  } catch {
    return { safety: null, holders: [], holderCount: null, unsupported: false };
  }
}
