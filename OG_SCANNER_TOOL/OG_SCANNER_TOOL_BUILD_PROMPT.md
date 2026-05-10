# OG Scanner Tool Build Prompt

Copy and paste this prompt into Rork or another app builder when you want to create **only the OG Scanner tool** as a standalone mobile app feature.

---

## Prompt

Build a mobile-first crypto tool called **OG Scanner** for the OGScan / SolTools ecosystem.

This should be a focused Solana token scanner that helps users search any token by ticker, token name, or contract address / mint address, then quickly understand whether the token looks healthy, risky, original, copied, verified, liquid, active, or suspicious.

Do **not** build the full SolTools ecosystem. Do **not** build every OGScan tool. Build only the **OG Scanner** tool as a polished iOS/Android-style mobile app screen that can later be merged into a larger app.

---

## Product identity

- Product name: **OG Scanner**
- Parent brand: **OGScan / SolTools**
- Purpose: scan Solana tokens fast and show token safety/intelligence signals
- Style: crypto command-center, black/navy background, electric lime/cyan/gold accents
- Official token mint / CA: `EfnZmcFKMXofKA5V5ujvjqtSorvuQD2MzJPz3dxXpump`
- Official dev wallet: `CicbPxARTDrwQ4XcxWsn6SYeG4FMJHirS633cZUJeQDh`
- Website: `https://www.ogscan.fun`
- X/Twitter: `https://x.com/ogscanfun`

The tool should feel like a premium mobile scanner, not a long website section.

---

## Core user flow

1. User opens the OG Scanner screen.
2. At the top, they see a clear header:
   - **OG Scanner**
   - Short subtitle: “Search any Solana ticker, token name, or CA.”
3. User types a ticker like `BONK`, `WIF`, `OG`, or pastes a mint address.
4. The app searches the token registry and shows matching tokens.
5. User taps a token result.
6. The app opens a token detail panel/screen with:
   - token identity
   - price
   - market cap
   - liquidity
   - holder count
   - 24h change
   - verification status
   - audit flags
   - OG score
   - risk level
   - copy CA button
   - open chart button
   - scan again button

---

## Required screens/components

### 1. Scanner Home Screen

Mobile-first full-screen layout.

Must include:

- Safe-area top spacing
- Header card with OG Scanner title
- Search input with placeholder: `$OG · BONK · WIF · paste CA`
- Search icon inside input
- Loading spinner while searching
- Quick search chips:
  - `$OG`
  - `$BONK`
  - `$WIF`
  - `$MOG`
  - `$POPCAT`
  - `$FARTCOIN`
- Filter row/card:
  - minimum liquidity
  - minimum market cap
  - verified only toggle
  - green 24h only toggle
- Result count text, for example: `8 shown · 2 filtered`
- Empty state when no search has started:
  - “Type 2+ characters to scan a token.”
- Empty state when no matches:
  - “No matches found. Try another ticker or CA.”

### 2. Token Result Card

Each result card should show:

- token icon if available
- token symbol
- token name
- mint short address
- verified badge if verified
- price
- 24h change colored green/red
- liquidity
- market cap or FDV
- holder count if available
- small risk badge
- tap action to open token detail
- copy CA action

### 3. Token Detail Screen / Bottom Sheet

When a token is selected, show a premium mobile detail view.

Must include:

- Large token icon
- symbol and name
- full mint address with copy button
- verified / unverified badge
- OG score from 0–100
- risk label: `Clean`, `Watch`, `Risky`, or `Danger`
- stats grid:
  - Price
  - Market Cap
  - FDV
  - Liquidity
  - Holders
  - 24h Change
  - Organic Score
  - Age / first pool date if available
- Audit section:
  - Mint authority disabled: yes/no
  - Freeze authority disabled: yes/no
  - Top holders percentage
- Action buttons:
  - Copy CA
  - Open DexScreener
  - Open Jupiter
  - Scan another token

---

## API/data layer

Create a reusable API file for the scanner.

Recommended structure:

```txt
src/
  constants/
    ogScanner.ts
  api/
    jupiterApi.ts
  utils/
    formatters.ts
    tokenRisk.ts
  components/
    ScannerSearch.tsx
    TokenResultCard.tsx
    TokenDetailSheet.tsx
    RiskBadge.tsx
  screens/
    OgScannerScreen.tsx
```

Use TypeScript everywhere.

### Constants

```ts
export const OGSCAN_TOKEN_MINT = "EfnZmcFKMXofKA5V5ujvjqtSorvuQD2MzJPz3dxXpump";
export const OGSCAN_DEV_WALLET = "CicbPxARTDrwQ4XcxWsn6SYeG4FMJHirS633cZUJeQDh";
export const JUPITER_BASE = "https://lite-api.jup.ag";
export const SOL_MINT = "So11111111111111111111111111111111111111112";
```

### Token type

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

### Search function

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

Use React Query / TanStack Query for caching if building React Native with Expo.

---

## Scanner filter logic

Create filter state:

```ts
type ScanFilters = {
  minLiq: number;
  minMcap: number;
  verifiedOnly: boolean;
  greenOnly: boolean;
};

const DEFAULT_FILTERS: ScanFilters = {
  minLiq: 0,
  minMcap: 0,
  verifiedOnly: false,
  greenOnly: false,
};
```

Filtering function:

```ts
function passesScanFilters(token: JupTokenInfo, filters: ScanFilters): boolean {
  if ((token.liquidity ?? 0) < filters.minLiq) return false;
  if ((token.mcap ?? token.fdv ?? 0) < filters.minMcap) return false;
  if (filters.verifiedOnly && !token.isVerified) return false;
  if (filters.greenOnly && (token.stats24h?.priceChange ?? 0) < 0) return false;
  return true;
}
```

---

## OG score logic

Create a score from 0–100 that helps users quickly judge token quality.

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

---

## Risk logic

```ts
export type RiskLevel = "clean" | "watch" | "risky" | "danger";

export function getRiskLevel(token: JupTokenInfo): RiskLevel {
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

Risk badge colors:

- `Clean`: lime/green
- `Watch`: gold/yellow
- `Risky`: orange/red
- `Danger`: deep red

---

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

## Mobile UI requirements

The design must feel native and app-like.

Use:

- bottom-safe spacing
- large tap targets
- sticky search area or easy return-to-search action
- cards instead of table rows
- bottom sheet for token details if possible
- haptic feedback when copying CA or selecting token
- pull-to-refresh if supported
- loading skeletons while fetching
- clear error states if APIs fail
- copy confirmation toast: “CA copied”

Avoid:

- a giant one-page website layout
- tiny desktop table UI
- purple generic SaaS gradients
- too much text before the scanner
- hiding the search input below banners

---

## Visual direction

Theme:

- background: `#03070D` / deep black navy
- card: `#07111F`
- border: dark blue grid line
- primary accent: electric lime
- secondary accent: cyan
- premium accent: gold
- danger: red
- text: white and cool gray

The app should feel like a Solana command terminal merged with a clean iOS crypto scanner.

Suggested header copy:

```txt
OG Scanner
Search any Solana ticker, token name, or contract address.
```

Suggested empty state:

```txt
Ready to scan.
Type 2+ characters or paste a CA to inspect liquidity, holders, audit flags, and risk.
```

Suggested error state:

```txt
Scanner could not reach token data.
Check your connection and try again.
```

---

## Required interactions

- Debounce search by 300ms.
- Search only when query length is at least 2 characters.
- If user pastes a full mint address, show exact matches first.
- Save recent searches locally.
- Allow clearing the search input.
- Allow resetting filters.
- Copy CA must work reliably.
- External links should open outside the app.

DexScreener link format:

```ts
const dexUrl = `https://dexscreener.com/solana/${mint}`;
```

Jupiter link format:

```ts
const jupiterUrl = `https://jup.ag/swap/SOL-${mint}`;
```

---

## Acceptance checklist

The OG Scanner tool is complete when:

- [ ] User can search by ticker, token name, or mint address.
- [ ] Search results come from Jupiter token search.
- [ ] Filters work for liquidity, market cap, verified only, and green 24h only.
- [ ] Each token card shows price, liquidity, 24h change, verification, and CA copy.
- [ ] Selecting a token opens a detail view.
- [ ] Detail view shows OG score and risk label.
- [ ] Audit flags are shown clearly.
- [ ] Copy CA button works and confirms success.
- [ ] DexScreener/Jupiter buttons open correctly.
- [ ] UI feels like a native mobile app, not a website.
- [ ] The screen can be merged later into a bigger app as `OgScannerScreen`.

---

## Final instruction to the builder

Build only the **OG Scanner** tool. Keep the code modular so it can later be dropped into the full OGScan mobile app. Prioritize fast search, clear risk signals, reliable copy buttons, and a polished mobile-native UI.
