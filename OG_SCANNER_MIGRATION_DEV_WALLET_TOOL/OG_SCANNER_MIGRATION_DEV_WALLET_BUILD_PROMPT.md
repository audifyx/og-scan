# OG Scanner + Migration Tracker + Dev Wallet Intel Build Prompt

Copy and paste this prompt into Rork or another app builder when you want to create a focused mobile app section containing only these three OGScan tools:

1. **OG Scanner**
2. **Migration Tracker**
3. **Dev Wallet Intel**

This is not the full OGScan website. It is a mobile-native tool suite that can be merged into the main app.

---

## Prompt

Build a mobile-first crypto intelligence app section called **OGScan Tools** for Solana traders.

The app must include exactly three premium tools:

1. **OG Scanner** — search any Solana ticker, token name, or contract address and inspect token quality, liquidity, holders, audit flags, OG score, and risk.
2. **Migration Tracker** — find coins that recently migrated or graduated from launchpads like Pump.fun / PumpSwap, Moonshot, Jupiter Studio, Meteora, or other Solana launch sources into real DEX liquidity.
3. **Dev Wallet Intel** — track creator/dev wallets, show repeat launches, previous wins, rugs, average liquidity, risk profile, watched wallets, and alerts.

Do **not** build a long website. Do **not** build every OGScan tool. Build these three tools as separate mobile app tabs/screens with a native iOS/Android feel.

---

## Brand and constants

Product name: **OGScan Tools**  
Parent ecosystem: **OGScan / SolTools**  
Official website: `https://www.ogscan.fun`  
X/Twitter: `https://x.com/ogscanfun`

Official live coin mint / CA:

```txt
EfnZmcFKMXofKA5V5ujvjqtSorvuQD2MzJPz3dxXpump
```

Official dev wallet:

```txt
CicbPxARTDrwQ4XcxWsn6SYeG4FMJHirS633cZUJeQDh
```

Use these constants:

```ts
export const OGSCAN_TOKEN_MINT = "EfnZmcFKMXofKA5V5ujvjqtSorvuQD2MzJPz3dxXpump";
export const OGSCAN_DEV_WALLET = "CicbPxARTDrwQ4XcxWsn6SYeG4FMJHirS633cZUJeQDh";
export const JUPITER_BASE = "https://lite-api.jup.ag";
export const DEXSCREENER_BASE = "https://api.dexscreener.com";
export const SOL_MINT = "So11111111111111111111111111111111111111112";
```

---

## Mobile app structure

Use a bottom tab layout with three main tabs:

```txt
Bottom Tabs:
- Scanner
- Migrations
- Dev Wallets
```

Each tool must feel like its own screen, not a section in one giant page.

Suggested file structure:

```txt
src/
  constants/
    ogscan.ts
  api/
    jupiterApi.ts
    dexscreenerApi.ts
    walletIntelApi.ts
  utils/
    formatters.ts
    risk.ts
    scoring.ts
    clipboard.ts
  components/
    AppShell.tsx
    BottomTabs.tsx
    SearchBar.tsx
    RiskBadge.tsx
    StatCard.tsx
    TokenCard.tsx
    TokenDetailSheet.tsx
    MigrationCard.tsx
    DevWalletCard.tsx
    EmptyState.tsx
    LoadingState.tsx
  screens/
    OgScannerScreen.tsx
    MigrationTrackerScreen.tsx
    DevWalletIntelScreen.tsx
```

If building with Expo React Native, use:

- TypeScript
- React Navigation bottom tabs or Expo Router tabs
- TanStack Query / React Query for API caching
- Expo Clipboard for copy actions
- Expo Linking for external chart links
- Haptics for copy/select feedback
- SafeAreaView for native spacing

---

## Visual direction

Design it like a premium crypto command-center mobile app, not a desktop website.

Theme:

- Background: deep black/navy `#03070D`
- Cards: ink blue `#07111F`
- Borders: dark grid blue `#163044`
- Primary accent: electric lime `#B7FF2A`
- Secondary accent: cyan `#28D7FF`
- Premium accent: gold `#FFD166`
- Danger: red `#FF3B5C`
- Text: white / cool gray

Mobile UI rules:

- Use safe-area top and bottom spacing.
- Use large tap targets.
- Use cards, sheets, and compact stat grids.
- Use sticky top search where useful.
- Use bottom sheets for token details and dev wallet profiles.
- Use copy confirmation toast: `CA copied` or `Wallet copied`.
- Do not make one huge scrolling website.
- Do not use generic purple SaaS gradients.
- Do not hide the search input below large marketing banners.

---

# Tool 1: OG Scanner

## Purpose

The OG Scanner lets users search any Solana ticker, token name, or mint address and quickly decide if the token looks clean, risky, copied, liquid, verified, or suspicious.

## Core user flow

1. User opens the **Scanner** tab.
2. Top header says:

```txt
OG Scanner
Search any Solana ticker, token name, or CA.
```

3. User types `BONK`, `WIF`, `OG`, or pastes a full mint address.
4. App searches Jupiter token data.
5. Results appear as mobile token cards.
6. User taps a token.
7. App opens a token detail sheet with score, risk, audit, CA copy, chart links, and scan actions.

## Required scanner UI

Scanner screen must include:

- Search input placeholder: `$OG · BONK · WIF · paste CA`
- Quick chips: `$OG`, `$BONK`, `$WIF`, `$MOG`, `$POPCAT`, `$FARTCOIN`
- Filter card:
  - minimum liquidity
  - minimum market cap
  - verified only toggle
  - green 24h only toggle
- Results count, for example: `8 shown · 2 filtered`
- Empty state:

```txt
Ready to scan.
Type 2+ characters or paste a CA to inspect liquidity, holders, audit flags, and risk.
```

- Error state:

```txt
Scanner could not reach token data.
Check your connection and try again.
```

## Token result card must show

- Token icon
- Symbol
- Name
- Short mint address
- Verified badge
- Price
- 24h change
- Liquidity
- Market cap / FDV
- Holder count
- Risk badge
- Copy CA button
- Tap to open detail

## Token detail sheet must show

- Large token icon
- Symbol and name
- Full CA with copy button
- Verified / unverified badge
- OG score from 0–100
- Risk label: `Clean`, `Watch`, `Risky`, `Danger`
- Stats grid:
  - Price
  - Market Cap
  - FDV
  - Liquidity
  - Holders
  - 24h Change
  - Organic Score
  - Age / first pool date
- Audit section:
  - Mint authority disabled
  - Freeze authority disabled
  - Top holders percentage
- Actions:
  - Copy CA
  - Open DexScreener
  - Open Jupiter
  - Send to Dev Wallet Intel if creator data exists
  - Scan another token

## Jupiter token type

```ts
export type JupTokenInfo = {
  id: string;
  name: string;
  symbol: string;
  icon?: string;
  decimals: number;
  usdPrice?: number;
  mcap?: number;
  fdv?: number;
  liquidity?: number;
  holderCount?: number;
  organicScore?: number;
  organicScoreLabel?: string;
  isVerified?: boolean;
  stats24h?: {
    priceChange?: number;
    buyVolume?: number;
    sellVolume?: number;
    numTraders?: number;
    numBuys?: number;
    numSells?: number;
  };
  stats1h?: { priceChange?: number };
  stats5m?: { priceChange?: number };
  audit?: {
    mintAuthorityDisabled?: boolean;
    freezeAuthorityDisabled?: boolean;
    topHoldersPercentage?: number;
  };
  firstPool?: { createdAt?: string };
  ctLikes?: number;
  smartCtLikes?: number;
};
```

## Scanner API

```ts
export async function jupSearchToken(query: string): Promise<JupTokenInfo[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const url = `${JUPITER_BASE}/tokens/v2/search?query=${encodeURIComponent(cleanQuery)}`;
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Token search failed: ${response.status}`);
  }

  return (await response.json()) as JupTokenInfo[];
}
```

## Scanner filter logic

```ts
type ScanFilters = {
  minLiq: number;
  minMcap: number;
  verifiedOnly: boolean;
  greenOnly: boolean;
};

const DEFAULT_SCAN_FILTERS: ScanFilters = {
  minLiq: 0,
  minMcap: 0,
  verifiedOnly: false,
  greenOnly: false,
};

function passesScanFilters(token: JupTokenInfo, filters: ScanFilters): boolean {
  if ((token.liquidity ?? 0) < filters.minLiq) return false;
  if ((token.mcap ?? token.fdv ?? 0) < filters.minMcap) return false;
  if (filters.verifiedOnly && !token.isVerified) return false;
  if (filters.greenOnly && (token.stats24h?.priceChange ?? 0) < 0) return false;
  return true;
}
```

---

# Tool 2: Migration Tracker

## Purpose

The Migration Tracker finds tokens that recently graduated from launch platforms into real DEX pools. It helps users catch coins after chaos but before mainstream attention.

It should track sources like:

- Pump.fun / PumpSwap
- Moonshot
- Jupiter Studio
- Meteora / DLMM
- Fresh Solana pairs from DexScreener

## Core user flow

1. User opens the **Migrations** tab.
2. Top header says:

```txt
Migration Tracker
Fresh Solana launches that graduated into live liquidity.
```

3. User picks source: `Pump.fun`, `Moonshot`, `Jup Studio`, or `All Fresh`.
4. App pulls matching Solana pairs from DexScreener.
5. App ranks them by liquidity, volume, buys, age, and momentum.
6. User can filter by liquidity, volume, age, and buys.
7. User taps a migration card to inspect it, copy CA, open chart, scan token, or watch dev.

## Required migration UI

Migration screen must include:

- Source selector cards:
  - `PUMP.FUN`
  - `MOONSHOT`
  - `JUP STUDIO`
  - `ALL FRESH`
- Live refresh button
- Loading state while polling
- Summary stats:
  - total migrations found
  - newest migration age
  - total liquidity
  - total 24h volume
- Quality filter presets:
  - `All`
  - `Good`
  - `Strict`
- Manual filters:
  - min liquidity
  - min volume
  - max age hours
  - min buys
- Result cards sorted by migration score

## DexScreener pair type

```ts
export type DexPair = {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  labels?: string[];
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd?: string;
  priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number };
  liquidity?: { usd?: number; base?: number; quote?: number };
  volume?: { m5?: number; h1?: number; h6?: number; h24?: number };
  txns?: {
    m5?: { buys: number; sells: number };
    h1?: { buys: number; sells: number };
    h24?: { buys: number; sells: number };
  };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: {
    imageUrl?: string;
    websites?: { url: string }[];
    socials?: { type: string; url: string }[];
  };
};
```

## Migration API

```ts
type DexSearchResponse = { pairs?: DexPair[] | null };

export async function dexSearchPairs(query: string): Promise<DexPair[]> {
  const url = `${DEXSCREENER_BASE}/latest/dex/search?q=${encodeURIComponent(query)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`DexScreener search failed: ${response.status}`);
  }

  const json = (await response.json()) as DexSearchResponse;
  return (json.pairs ?? []).filter((pair) => pair.chainId === "solana");
}
```

## Source matching

```ts
type MigrationSource = {
  id: "pumpfun" | "moonshot" | "jupiter" | "all";
  label: string;
  query: string;
  description: string;
  matches: (pair: DexPair) => boolean;
};

export const MIGRATION_SOURCES: MigrationSource[] = [
  {
    id: "pumpfun",
    label: "PUMP.FUN",
    query: "pumpswap",
    description: "Bonding curves that graduated into PumpSwap / Raydium style liquidity.",
    matches: (pair) =>
      pair.chainId === "solana" &&
      (pair.dexId === "pumpswap" ||
        /pump/i.test(pair.dexId) ||
        (pair.labels ?? []).some((label) => /pump/i.test(label))),
  },
  {
    id: "moonshot",
    label: "MOONSHOT",
    query: "moonshot",
    description: "Moonshot launches that completed the curve and entered live trading.",
    matches: (pair) =>
      pair.chainId === "solana" &&
      (pair.dexId === "moonshot" ||
        (pair.labels ?? []).some((label) => /moonshot/i.test(label))),
  },
  {
    id: "jupiter",
    label: "JUP STUDIO",
    query: "meteora",
    description: "Jupiter Studio / Meteora DLMM fresh launches.",
    matches: (pair) =>
      pair.chainId === "solana" &&
      (pair.dexId === "meteora" ||
        (pair.labels ?? []).some((label) => /dlmm|dynamic/i.test(label))),
  },
  {
    id: "all",
    label: "ALL FRESH",
    query: "SOL",
    description: "All fresh Solana pairs ranked by quality and recency.",
    matches: (pair) => pair.chainId === "solana",
  },
];
```

## Migration quality and scoring

```ts
type MigrationQuality = {
  minLiq: number;
  minVol: number;
  maxAgeHours: number;
  minBuys: number;
};

export const DEFAULT_MIGRATION_QUALITY: MigrationQuality = {
  minLiq: 0,
  minVol: 0,
  maxAgeHours: 168,
  minBuys: 0,
};

export const GOOD_MIGRATION_QUALITY: MigrationQuality = {
  minLiq: 5_000,
  minVol: 1_000,
  maxAgeHours: 72,
  minBuys: 10,
};

export const STRICT_MIGRATION_QUALITY: MigrationQuality = {
  minLiq: 25_000,
  minVol: 10_000,
  maxAgeHours: 24,
  minBuys: 50,
};

export function passesMigrationQuality(pair: DexPair, quality: MigrationQuality): boolean {
  const liquidity = pair.liquidity?.usd ?? 0;
  const volume = pair.volume?.h24 ?? 0;
  const created = pair.pairCreatedAt ?? 0;
  const ageHours = created ? (Date.now() - created) / 3_600_000 : Number.POSITIVE_INFINITY;
  const buys = pair.txns?.h24?.buys ?? 0;

  if (liquidity < quality.minLiq) return false;
  if (volume < quality.minVol) return false;
  if (ageHours > quality.maxAgeHours) return false;
  if (buys < quality.minBuys) return false;
  return true;
}

export function calculateMigrationScore(pair: DexPair): number {
  const liquidity = pair.liquidity?.usd ?? 0;
  const volume = pair.volume?.h24 ?? 0;
  const buys = pair.txns?.h24?.buys ?? 0;
  const sells = pair.txns?.h24?.sells ?? 0;
  const totalTxns = buys + sells;
  const buyRatio = totalTxns > 0 ? buys / totalTxns : 0.5;
  const change24h = pair.priceChange?.h24 ?? 0;
  const ageHours = pair.pairCreatedAt ? (Date.now() - pair.pairCreatedAt) / 3_600_000 : 24;
  const recencyBoost = Math.max(0, 24 - ageHours) * 1000;

  return liquidity * 0.3 + volume * 0.5 + totalTxns * 50 + buyRatio * 5000 + change24h * 100 + recencyBoost;
}
```

## Migration card must show

- Token icon if available
- Symbol and name
- Migration source badge
- Age since pair creation
- Liquidity
- 24h volume
- 24h price change
- Buys / sells
- Migration score
- Social links found / missing
- Copy CA button
- Open chart button
- Scan token button
- Watch dev wallet button if creator/dev wallet data is available

---

# Tool 3: Dev Wallet Intel

## Purpose

The Dev Wallet Intel tool lets users inspect Solana creator/dev wallets and understand whether a wallet has a good or bad launch history.

It should answer:

- Has this wallet launched multiple coins?
- Did previous launches gain liquidity or die?
- Does the wallet repeatedly rug?
- Are any launches hot right now?
- Should the user watch this dev wallet?

## Core user flow

1. User opens the **Dev Wallets** tab.
2. Top header says:

```txt
Dev Wallet Intel
Track creators, repeat launches, rugs, wins, and watch alerts.
```

3. User pastes a wallet address or selects one from a migration / launch card.
4. App loads the wallet profile.
5. App shows score, launches, wins, rugs, average liquidity, confidence, and recent tokens.
6. User can copy wallet, watch wallet, open Solscan, or inspect related launches.

## Required Dev Wallet UI

Dev Wallet screen must include:

- Search / paste wallet input
- Official OGScan dev wallet pinned card
- Watched wallets list
- Recent/high-signal dev wallets list
- Wallet profile sheet/card
- Launch history timeline
- Risk labels: `Clean`, `Watch`, `Risky`, `Danger`
- Actions:
  - Copy wallet
  - Watch / unwatch wallet
  - Open Solscan
  - Open recent token chart
  - Send token to OG Scanner

## Dev wallet data model

```ts
export type DevWalletIntel = {
  wallet: string;
  score: number;
  launches: number;
  wins: number;
  rugs: number;
  avgLiquidity: number;
  confidence: "low" | "medium" | "high";
  latestLaunches: DevWalletLaunch[];
  riskLevel: "clean" | "watch" | "risky" | "danger";
  notes: string[];
};

export type DevWalletLaunch = {
  mint: string;
  symbol: string;
  name: string;
  icon?: string;
  dexUrl?: string;
  createdAtMs: number;
  liquidity: number;
  volume24h: number;
  marketCap?: number;
  priceChange24h?: number;
  launchScore: number;
  riskFlags: string[];
};
```

## Dev wallet scoring

Use available launch data to estimate wallet quality. If exact creator wallet data is not available from free APIs, clearly label the confidence as `low` or `estimated` and still let the user manually track wallet addresses.

```ts
export function calculateDevWalletScore(intel: Omit<DevWalletIntel, "score" | "riskLevel" | "notes">): number {
  let score = 50;

  score += Math.min(25, intel.wins * 5);
  score -= Math.min(35, intel.rugs * 10);
  score += Math.min(15, Math.log10(intel.avgLiquidity + 1) * 3);
  score += Math.min(10, intel.launches * 1.5);

  if (intel.confidence === "high") score += 5;
  if (intel.confidence === "low") score -= 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getDevWalletRisk(score: number, rugs: number): DevWalletIntel["riskLevel"] {
  if (rugs >= 4 || score < 25) return "danger";
  if (rugs >= 2 || score < 45) return "risky";
  if (score < 70) return "watch";
  return "clean";
}
```

## Dev wallet notes

Generate simple notes from wallet behavior:

```ts
export function buildDevWalletNotes(intel: DevWalletIntel): string[] {
  const notes: string[] = [];

  if (intel.wallet === OGSCAN_DEV_WALLET) {
    notes.push("Official OGScan dev wallet.");
  }

  if (intel.wins > 0) notes.push(`${intel.wins} previous launch(es) reached strong liquidity.`);
  if (intel.rugs > 0) notes.push(`${intel.rugs} previous launch(es) showed rug-like signals.`);
  if (intel.avgLiquidity > 25_000) notes.push("Average liquidity is stronger than most fresh launches.");
  if (intel.confidence === "low") notes.push("Creator attribution is estimated from available public data.");
  if (intel.launches === 0) notes.push("No recent launches found for this wallet yet.");

  return notes;
}
```

## Wallet persistence

Save watched wallets locally.

```ts
const STORAGE_WATCHED_DEV_WALLETS = "ogscan.watched_dev_wallets";

export function loadWatchedDevWallets(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_WATCHED_DEV_WALLETS);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveWatchedDevWallets(wallets: string[]): void {
  try {
    localStorage.setItem(STORAGE_WATCHED_DEV_WALLETS, JSON.stringify(wallets.slice(0, 60)));
  } catch {
    // local storage may be unavailable
  }
}
```

For React Native, use AsyncStorage instead of localStorage.

## Dev wallet profile card must show

- Wallet short address
- Copy wallet button
- Watch / unwatch button
- Score from 0–100
- Risk label
- Confidence label
- Total launches
- Wins
- Rugs
- Average liquidity
- Notes
- Latest launches timeline
- Open Solscan button

Solscan link format:

```ts
const solscanUrl = `https://solscan.io/account/${wallet}`;
```

---

# Shared scoring and risk logic

## Token OG score

```ts
export function calculateOgScore(token: JupTokenInfo): number {
  let score = 0;

  const liquidity = token.liquidity ?? 0;
  const holders = token.holderCount ?? 0;
  const organicScore = token.organicScore ?? 0;
  const marketCap = token.mcap ?? token.fdv ?? 0;
  const volume24h = (token.stats24h?.buyVolume ?? 0) + (token.stats24h?.sellVolume ?? 0);
  const topHolders = token.audit?.topHoldersPercentage ?? 0;
  const createdAt = token.firstPool?.createdAt ? new Date(token.firstPool.createdAt).getTime() : null;

  if (token.isVerified) score += 15;
  if (liquidity > 0) score += Math.min(20, (Math.log10(liquidity + 1) / 6) * 20);
  if (marketCap > 0) score += Math.min(15, (Math.log10(marketCap + 1) / 8) * 15);
  if (holders > 0) score += Math.min(15, (Math.log10(holders + 1) / 5) * 15);
  if (organicScore > 0) score += Math.min(15, organicScore * 1.5);
  if (volume24h > 0) score += Math.min(10, (Math.log10(volume24h + 1) / 7) * 10);

  if (createdAt) {
    const ageDays = Math.max(0, (Date.now() - createdAt) / 86_400_000);
    score += Math.min(10, ageDays / 30);
  }

  if (token.audit?.mintAuthorityDisabled) score += 3;
  if (token.audit?.freezeAuthorityDisabled) score += 3;

  if (liquidity < 1_000) score -= 20;
  if (holders < 10) score -= 15;
  if (topHolders > 50) score -= 15;
  if (!token.audit?.mintAuthorityDisabled) score -= 8;
  if (!token.audit?.freezeAuthorityDisabled) score -= 8;

  return Math.max(0, Math.min(100, Math.round(score)));
}
```

## Risk level

```ts
export type RiskLevel = "clean" | "watch" | "risky" | "danger";

export function getTokenRiskLevel(token: JupTokenInfo): RiskLevel {
  let flags = 0;

  if (!token.isVerified) flags += 1;
  if ((token.liquidity ?? 0) < 5_000) flags += 1;
  if ((token.holderCount ?? 0) < 25) flags += 1;
  if (!token.audit?.mintAuthorityDisabled) flags += 1;
  if (!token.audit?.freezeAuthorityDisabled) flags += 1;
  if ((token.audit?.topHoldersPercentage ?? 0) > 40) flags += 1;
  if ((token.stats24h?.priceChange ?? 0) < -35) flags += 1;

  if (flags >= 5) return "danger";
  if (flags >= 3) return "risky";
  if (flags >= 1) return "watch";
  return "clean";
}
```

## Formatting helpers

```ts
export function fmtUsd(value: number | undefined | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value === 0) return "$0";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  if (abs >= 1) return `$${value.toFixed(4)}`;
  if (abs >= 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toExponential(3)}`;
}

export function fmtNum(value: number | undefined | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function fmtPct(value: number | undefined | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function shortAddr(address: string | undefined, size = 4): string {
  if (!address) return "—";
  return `${address.slice(0, size)}…${address.slice(-size)}`;
}
```

---

# Required interactions

All three tools must include:

- Pull-to-refresh or refresh button.
- Loading skeletons.
- Clear API error states.
- Copy buttons that reliably copy CA/wallet.
- Haptic feedback on copy/select when supported.
- Recent searches / recent wallets saved locally.
- External links opened outside the app.
- Beginner-friendly labels instead of overwhelming technical text.

External links:

```ts
const dexUrl = `https://dexscreener.com/solana/${mint}`;
const jupiterUrl = `https://jup.ag/swap/SOL-${mint}`;
const solscanWalletUrl = `https://solscan.io/account/${wallet}`;
const solscanTokenUrl = `https://solscan.io/token/${mint}`;
```

---

# Data/API expectations

Use free/public APIs first:

- Jupiter token search for token lookup, token metadata, price, liquidity, organic score, audit flags when available.
- DexScreener search for pairs, migrations, charts, liquidity, volume, buys/sells, pair age, socials.
- Optional Helius/Birdeye/Solana RPC if keys are available for deeper holder, wallet, and transaction analysis.

Important:

- If creator/dev wallet attribution is not available from public APIs, label it clearly as estimated or unavailable.
- Do not fake exact wallet attribution. Let users manually paste and watch dev wallets.
- Always keep the official OGScan dev wallet pinned.

---

# Acceptance checklist

The build is complete when:

- [ ] The app has three bottom tabs: Scanner, Migrations, Dev Wallets.
- [ ] OG Scanner searches by ticker, token name, or mint address.
- [ ] Scanner results use Jupiter token data.
- [ ] Scanner filters work for liquidity, market cap, verified only, and green 24h only.
- [ ] Token detail sheet shows OG score, risk, audit, stats, CA copy, DexScreener, Jupiter, and scan actions.
- [ ] Migration Tracker shows Pump.fun, Moonshot, Jup Studio, and All Fresh sources.
- [ ] Migration data comes from DexScreener search and is filtered to Solana pairs.
- [ ] Migrations can be filtered by liquidity, volume, age, and buys.
- [ ] Migration cards show score, liquidity, volume, age, buys/sells, copy CA, chart, and scan actions.
- [ ] Dev Wallet Intel lets users paste a wallet and inspect a profile.
- [ ] The official OGScan dev wallet is pinned by default.
- [ ] Users can watch/unwatch dev wallets.
- [ ] Dev wallet profile shows score, launches, wins, rugs, average liquidity, confidence, notes, and recent launches.
- [ ] Copy CA and copy wallet buttons work reliably.
- [ ] UI feels native mobile, not like a desktop website.
- [ ] The three tools are modular enough to merge into the full OGScan mobile app later.

---

## Final instruction to the builder

Build only these three tools: **OG Scanner**, **Migration Tracker**, and **Dev Wallet Intel**. Keep them separated as mobile tabs, connect them through shared token selection and wallet selection, use real public data where available, clearly label estimated wallet data, and prioritize fast scanning, reliable copy actions, readable risk signals, and a premium mobile app experience.
