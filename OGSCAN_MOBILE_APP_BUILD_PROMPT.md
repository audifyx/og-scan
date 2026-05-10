# OGScan / SolTools Mobile App Build Prompt

Use this prompt/spec to merge the current OGScan web tools into a real mobile app. The goal is to keep the same product, same tool logic, same data sources, and same community/token information, but rebuild the experience as a native-feeling iOS/Android app with bottom tabs, full-screen tools, saved state, fast search, and mobile-first crypto command-center design.

---

## 1. Product summary

Build **OGScan**, the first product inside the broader **SolTools** ecosystem.

OGScan is a Solana-focused crypto intelligence app for traders, builders, token communities, and project owners. It helps users scan tokens, find originals vs copycats, monitor fresh launches, inspect dev wallets, track whales, watch transaction activity, get swap quotes, and follow the official OGScan/SolTools roadmap.

The larger vision is **SolTools**: a crypto-native home for communities where tools, token discovery, launch intelligence, and social/community systems eventually live together. OGScan is the starting point: useful crypto tools first, then community, then multi-chain expansion.

### Brand positioning

- Not a generic tracker.
- Not just a chart app.
- A fast mobile command center for Solana discovery and safety.
- Built for crypto communities that are tired of scattered X/Twitter, Telegram scams, bots, and tools that do not connect.

### Current official project identity

- Product: **OGScan**
- Ecosystem: **SolTools**
- Website: `https://www.ogscan.fun`
- X/Twitter: `https://x.com/ogscanfun`
- X Community: `https://twitter.com/i/communities/2007536315483685053`
- Telegram: `https://t.me/ogscanner`
- Updates Telegram: `https://t.me/ogupdates`
- Official token mint / CA: `EfnZmcFKMXofKA5V5ujvjqtSorvuQD2MzJPz3dxXpump`
- Official dev wallet: `CicbPxARTDrwQ4XcxWsn6SYeG4FMJHirS633cZUJeQDh`

---

## 2. Mobile app direction

Rebuild the current web experience as a **mobile-first Expo / React Native app**.

Do not make it feel like one long website. Each tool must be its own clear app screen. Use bottom tabs for primary areas and nested screens for deeper tools. The user should always know which tool they are in, what it does, and where to go next.

### Required mobile UX principles

- Use full-screen app pages, not one giant scroll site.
- Use bottom tabs for the main navigation.
- Use cards, sheets, segmented controls, sticky action bars, and large touch targets.
- Use native mobile patterns: safe areas, scroll views, pull-to-refresh, haptics, bottom sheets, copy/share actions, and external link openers.
- Search must feel central: most tools should have an obvious search input for ticker, token name, mint, dev wallet, or pair.
- Keep the existing blue/black/white/cyan/lime/gold crypto-command style, but make it cleaner and easier to use on mobile.
- Every tool gets a header explaining what the tool does in simple language.
- Every list row should have clear actions: scan, copy CA, open chart, watch, share, swap quote when relevant.

### Suggested visual system

- Background: deep black/navy command-center gradient.
- Primary accent: electric lime.
- Secondary accent: cyan.
- Warning accent: gold.
- Danger accent: red.
- Text: white / muted gray.
- Style: sharp crypto terminal energy, but polished mobile app UI.
- Avoid generic purple SaaS gradients.

---

## 3. App navigation structure

Use bottom tabs plus nested screens.

### Bottom tabs

1. **Home**
   - Beta/community welcome.
   - Official token live notice.
   - Market pulse summary.
   - Shortcuts into top tools.

2. **Scan**
   - Token Scanner.
   - OG Finder.
   - Market Pulse / Token Vitals.
   - Launch Analyzer.

3. **Live**
   - Snipe Feed.
   - Trending.
   - New Pair Radar.
   - Migrations.
   - Transaction Tape.

4. **Watch**
   - Watchlist.
   - Alerts Center.
   - Dev Wallet Intel.
   - Whales.

5. **More**
   - Our Coin.
   - Swap Quote.
   - SolTools Roadmap.
   - Tech Stack / API status.
   - Community links.

### Important navigation behavior

- Store the active token mint globally.
- Default active mint must be the official OGScan token mint.
- When a user taps a token anywhere, update global selected mint and offer actions:
  - Open Scanner
  - Open Market Pulse
  - Open Whales
  - Open Transaction Tape
  - Open Swap Quote
  - Copy CA
  - Open DexScreener
- When a user taps a dev wallet anywhere, open Dev Wallet Intel and allow watching/unwatching that dev.

---

## 4. Shared app state

Create a shared store or context for app-wide state.

### Required global state

```ts
type OgScanAppState = {
  selectedMint: string;
  watchedMints: string[];
  watchedDevs: string[];
  recentSearches: string[];
  activeChain: "solana";
};
```

### Default values

```ts
const OGSCAN_TOKEN_MINT = "EfnZmcFKMXofKA5V5ujvjqtSorvuQD2MzJPz3dxXpump";
const OGSCAN_DEV_WALLET = "CicbPxARTDrwQ4XcxWsn6SYeG4FMJHirS633cZUJeQDh";

const DEFAULT_STATE: OgScanAppState = {
  selectedMint: OGSCAN_TOKEN_MINT,
  watchedMints: [OGSCAN_TOKEN_MINT],
  watchedDevs: [OGSCAN_DEV_WALLET],
  recentSearches: [],
  activeChain: "solana",
};
```

### Persistence

Use AsyncStorage/MMKV for:

- selected mint
- active tab or last screen
- watched mints
- watched dev wallets
- tracked tickers
- recent searches
- quality filter presets

---

## 5. Shared data/API layer

Create one reusable data layer so every tool connects to the same APIs instead of duplicating fetch logic in screens.

Recommended file structure:

```txt
src/
  api/
    ogApi.ts
    dexscreenerApi.ts
    jupiterApi.ts
    heliusApi.ts
    birdeyeApi.ts
  constants/
    ogscan.ts
  hooks/
    useTokenSearch.ts
    useSelectedMint.ts
    useSnipeFeed.ts
    useWatchlist.ts
  screens/
    HomeScreen.tsx
    scan/
    live/
    watch/
    more/
  components/
    TokenCard.tsx
    SearchBar.tsx
    RiskBadge.tsx
    StatCard.tsx
    CopyButton.tsx
    ToolHeader.tsx
```

### Data sources used by the current OGScan tools

#### Jupiter Lite API

Base:

```txt
https://lite-api.jup.ag
```

Use for:

- token search
- token metadata
- price
- market cap
- liquidity
- holder count when available
- organic score
- verification status
- swap quotes
- top trending/top traded/top organic lists if needed

Endpoints:

```txt
GET /tokens/v2/search?query={query}
GET /tokens/v2/toptrending/{interval}?limit={limit}
GET /tokens/v2/toptraded/{interval}?limit={limit}
GET /tokens/v2/toporganicscore/{interval}?limit={limit}
GET /price/v3?ids={mint1,mint2}
GET /swap/v1/quote?inputMint={input}&outputMint={output}&amount={amount}&slippageBps={bps}&restrictIntermediateTokens=true
```

Intervals:

```ts
type JupInterval = "5m" | "1h" | "6h" | "24h";
```

#### DexScreener API

Base:

```txt
https://api.dexscreener.com
```

Use for:

- fresh token profiles
- boosted tokens
- top boosted tokens
- pair data
- new pairs
- migrations
- trending based on live pair volume/txns/liquidity
- chart links

Endpoints:

```txt
GET /token-profiles/latest/v1
GET /token-boosts/latest/v1
GET /token-boosts/top/v1
GET /tokens/v1/solana/{commaSeparatedMints}
GET /latest/dex/search?q={query}
```

External chart URL format:

```txt
https://dexscreener.com/solana/{mintOrPair}
```

#### Helius API

Use for:

- parsed transaction history
- dev wallet inference from early transactions
- transaction tape
- largest token accounts
- token supply
- current Solana slot

Endpoints/patterns:

```txt
GET https://api.helius.xyz/v0/addresses/{address}/transactions?api-key={HELIUS_API_KEY}&limit={limit}
POST https://mainnet.helius-rpc.com/?api-key={HELIUS_API_KEY}
```

RPC methods:

```txt
getHealth
getSlot
getTokenLargestAccounts
getTokenSupply
```

#### Birdeye API

Base:

```txt
https://public-api.birdeye.so
```

Use for:

- OHLCV candles
- simple price chart/sparkline data
- 24h chart context

Endpoint:

```txt
GET /defi/ohlcv?address={mint}&type=15m&time_from={unix}&time_to={unix}
Headers:
  X-API-KEY: {BIRDEYE_API_KEY}
  x-chain: solana
```

#### Alchemy / QuickNode

Use as optional redundancy/future realtime layer:

- Alchemy: backup Solana RPC.
- QuickNode WSS: future websocket stream for low-latency subscriptions.

Do not block core app launch on these if Jupiter, DexScreener, Helius, and Birdeye work.

### API key handling

For mobile, do not hardcode real keys inside screens. Put keys in environment/config and centralize usage in the API layer.

Example:

```ts
const HELIUS_API_KEY = process.env.EXPO_PUBLIC_HELIUS_API_KEY;
const BIRDEYE_API_KEY = process.env.EXPO_PUBLIC_BIRDEYE_API_KEY;
```

If keys should be protected later, move Helius/Birdeye calls behind a backend proxy. For the beta, public/free-tier keys can be used if accepted by the project owner.

---

## 6. Shared TypeScript models

Use typed models so all tools share the same data shape.

```ts
export type RiskLevel = "clean" | "watch" | "risky" | "danger";

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

export type DexPair = {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  quoteToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string;
  priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number };
  liquidity?: { usd?: number; base?: number; quote?: number };
  volume?: { m5?: number; h1?: number; h6?: number; h24?: number };
  txns?: {
    m5?: { buys?: number; sells?: number };
    h1?: { buys?: number; sells?: number };
    h6?: { buys?: number; sells?: number };
    h24?: { buys?: number; sells?: number };
  };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: {
    imageUrl?: string;
    websites?: { url?: string; label?: string }[];
    socials?: { type?: string; url?: string }[];
  };
  boosts?: { active?: number };
};

export type HeliusTx = {
  signature: string;
  timestamp: number;
  type: string;
  source?: string;
  description?: string;
  fee?: number;
  feePayer?: string;
  tokenTransfers?: {
    mint: string;
    tokenAmount: number;
    fromUserAccount?: string;
    toUserAccount?: string;
  }[];
};

export type SnipeLaunch = {
  mint: string;
  name: string;
  symbol: string;
  icon?: string;
  dexUrl: string;
  pairAddress?: string;
  createdAtMs: number;
  priceUsd?: number;
  liquidity: number;
  marketCap?: number;
  fdv?: number;
  volume5m: number;
  volume1h: number;
  txns5m: number;
  buys5m: number;
  sells5m: number;
  priceChange5m: number;
  priceChange1h: number;
  boostAmount: number;
  hasSocials: boolean;
  verified: boolean;
  audit?: JupTokenInfo["audit"];
  holderCount?: number;
  organicScore?: number;
  devWallet: string | null;
  devConfidence: "high" | "medium" | "low";
  riskLevel: RiskLevel;
  riskFlags: string[];
  launchScore: number;
  heatScore: number;
  copycatSignal: boolean;
};

export type DevIntel = {
  wallet: string | null;
  confidence: "high" | "medium" | "low";
  launches: number;
  wins: number;
  rugs: number;
  avgLiquidity: number;
  score: number;
  lastSeenMs: number | null;
};
```

---

## 7. Helper functions to port

Create a shared utility file for formatting and scoring.

### Formatting helpers

```ts
export function fmtUsd(n: number | undefined | null): string {
  if (n == null || !isFinite(n)) return "—";
  if (n === 0) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  if (abs >= 1) return `$${n.toFixed(4)}`;
  if (abs >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toExponential(3)}`;
}

export function fmtNum(n: number | undefined | null): string {
  if (n == null || !isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function fmtPct(n: number | undefined | null): string {
  if (n == null || !isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function shortAddr(addr: string | undefined, n = 4): string {
  if (!addr) return "—";
  return `${addr.slice(0, n)}…${addr.slice(-n)}`;
}

export function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
```

### OG/copycat scoring logic

The OG Finder should rank possible originals by:

- exact ticker/symbol match
- verified status
- liquidity
- market cap / FDV
- holder count
- organic score
- volume
- token age
- audit status
- top holder concentration
- whether it looks like a low-liquidity pump clone

The Direct OG is the highest trusted token for a ticker. Other matching tokens are copycats.

### Launch score logic

The Snipe Feed should score launches from 0 to 100 using:

- liquidity strength
- 5m and 1h volume
- 5m transaction count
- buy/sell ratio
- token age/recency
- number of socials
- boost amount
- organic score
- verified status
- mint authority disabled
- freeze authority disabled
- top holder concentration
- duplicate/copycat symbol penalty

Risk labels:

```ts
type RiskLevel = "clean" | "watch" | "risky" | "danger";
```

Rules:

- `Clean`: good score, no major flags.
- `Watch`: some flags or mid score.
- `Risky`: many flags or weak score.
- `Danger`: dust pool, mint authority open, freeze authority open, or severe red flags.

Risk flags should include:

- thin liquidity
- dust pool
- brand new
- low tape
- mint auth open
- freeze auth open
- holder concentration
- no socials
- copycat watch

---

## 8. Every tool and what it does

This section explains every tool that must be included in the mobile app.

### A. Community Beta Home

Purpose: greet users before they enter the tools.

Content:

- Header: “HEY COMMUNITY BETA IS OPEN”
- Explain beta is live and how to get started.
- iOS instructions:
  1. Download Expo Go: `https://apps.apple.com/us/app/expo-go/id982107779`
  2. Open beta link: `https://rork.app/?exp=p_ct333efmdotyxkemvlyk6--expo.rork.live&p=ct333efmdotyxkemvlyk6&app=false`
- Android instructions:
  1. Download Expo Go: `https://play.google.com/store/apps/details?id=host.exp.exponent`
  2. Open beta link: `https://rork.app/?exp=p_ct333efmdotyxkemvlyk6--expo.rork.live&p=ct333efmdotyxkemvlyk6&app=false`
- Note: the app is still actively being developed; expect bugs and missing features.
- Issues checklist:
  - Check internet connection
  - Restart Expo Go
  - Try opening the link in browser first
- Button: “Enter OG Scanner”
- Also show official token CA and copy button.

Mobile implementation:

- Home tab top section.
- Large launch card.
- Copy beta link action.
- Copy official CA action.
- Open store links in browser.

### B. Command / Main Dashboard

Purpose: app command center and overview.

Must include:

- official token live notice
- selected mint price/change/liquidity summary
- quick shortcuts into tools
- top summary cards:
  - selected token
  - market pulse
  - snipe feed
  - watchlist
  - risk/alerts
- tool cards for every major module

Mobile implementation:

- Home tab after beta card or behind “Enter OG Scanner”.
- Vertical cards, not desktop grid.
- Use a horizontal quick-action row: Scan, Live, Watch, Swap, Roadmap.

### C. Our Coin

Purpose: official OGScan token room.

Must include:

- token is live banner
- official CA: `EfnZmcFKMXofKA5V5ujvjqtSorvuQD2MzJPz3dxXpump`
- dev wallet: `CicbPxARTDrwQ4XcxWsn6SYeG4FMJHirS633cZUJeQDh`
- copy buttons for CA and dev wallet
- open chart button: `https://dexscreener.com/solana/EfnZmcFKMXofKA5V5ujvjqtSorvuQD2MzJPz3dxXpump`
- open Pump.fun button: `https://pump.fun/coin/EfnZmcFKMXofKA5V5ujvjqtSorvuQD2MzJPz3dxXpump`
- follow updates button
- safety notes:
  - use only this CA
  - verify links first
  - holder tech/reward mechanics can be added later

Mobile implementation:

- More tab screen.
- Big “Token is live” hero.
- Address cards with Copy.
- External links using Linking.openURL.

### D. Token Scanner

Purpose: search any Solana token by ticker, name, or mint and show token results.

Data:

- Jupiter search: `/tokens/v2/search?query={query}`

Search behavior:

- Type 2+ characters.
- Debounce 250–300ms.
- Results update as user types.
- If pasted value looks like a mint, allow direct selection.

Filters:

- minimum liquidity
- minimum market cap
- verified only
- green 24h only

Each token result should show:

- icon
- symbol
- name
- price
- 24h percent change
- liquidity
- verification badge
- select action
- copy mint action

Mobile implementation:

- Scan tab default screen.
- Search bar fixed near top.
- Results as mobile list cards.
- Token detail bottom sheet on tap.

### E. OG Finder / Direct OG Scanner

Purpose: find the original/trusted token for a ticker and identify copycats.

Data:

- Jupiter token search.

Input:

- ticker search like `OG`, `BONK`, `WIF`, `MOG`.

Logic:

- Normalize symbols by removing `$` and non-alphanumeric characters.
- Pull all matching tokens.
- Prefer exact symbol matches.
- Rank by trust score: verification, liquidity, holders, organic score, age, audit, volume.
- The top token is labeled “Direct OG”.
- Others are labeled “Copycats”.

Filters:

- minimum OG score
- minimum liquidity
- verified only
- hide high risk

Risk logic:

- low risk: verified/audited/liquid/low concentration
- medium: some weak signals
- high: open authorities, low liquidity, high top-holder concentration, unverified

Mobile implementation:

- Scan tab nested screen.
- Quick tickers row.
- Direct OG card at top.
- Copycats list underneath.
- Tap result updates selected mint.

### F. Market Pulse / Token Vitals

Purpose: show a command-center snapshot for the selected token.

Data:

- Jupiter token metadata
- Jupiter search for retargeting
- Birdeye OHLCV candles
- Helius holder/supply data can support deeper stats

Must show:

- token icon, name, symbol, mint
- price
- price change
- market cap
- liquidity
- 24h volume
- buy/sell volume
- holder count
- 24h traders
- buy/sell counts
- audit:
  - mint authority disabled
  - freeze authority disabled
  - top-holder concentration
- organic score
- social/buzz signals when available
- small sparkline or chart preview from OHLCV

Mobile implementation:

- Scan tab nested screen.
- Search bar to retarget selected token.
- Stat cards in vertical layout.
- Sticky action bar: Copy CA, Whales, Tape, Swap.

### G. Snipe Feed / Dev Wallet Radar

Purpose: track fresh Solana launches, score them, warn about risk, and infer dev wallets.

Data:

- DexScreener token profiles latest
- DexScreener token boosts latest/top
- DexScreener pairs for mints
- Jupiter metadata for those mints
- Helius parsed transactions for dev wallet inference

Core flow:

1. Fetch fresh profiles and boosts from DexScreener.
2. Filter to Solana tokens.
3. Collect mints.
4. Fetch pair data in chunks of 30 mints.
5. Dedupe best pair per mint by liquidity and volume.
6. Fetch Jupiter metadata for top pair mints.
7. Fetch Helius transactions for top new mints.
8. Infer creator/dev wallet from earliest creation-like transaction.
9. Score launch quality.
10. Build risk flags.
11. Group launches by dev wallet.
12. Build alerts for watched devs/mints, hot launches, and danger launches.

Must show summary cards:

- live launches
- hot opportunities
- risky/danger blocked
- tracked devs

Launch card must show:

- token name/symbol/icon
- age
- liquidity
- market cap/FDV
- 5m volume
- 1h volume
- 5m txns
- buys/sells
- price changes
- launch score
- heat score
- risk badge: Clean / Watch / Risky / Danger
- risk flags
- dev wallet short address
- dev confidence: high/medium/low
- copy CA
- open DexScreener
- watch token
- watch dev
- send to scanner

Mobile implementation:

- Live tab default or top screen.
- Pull-to-refresh.
- Pause/live toggle.
- Launch list with detail bottom sheet.
- Alerts panel as separate Watch tab screen.

### H. Dev Wallet Intel

Purpose: show creator wallet behavior based on fresh launches and watchlist data.

Data:

- Built from Snipe Feed launches.
- Helius transactions used to infer dev wallets.

Must show:

- wallet address
- confidence level
- number of launches
- number of wins
- number of rugs/danger launches
- average liquidity
- dev score
- last seen
- recent launches by that dev
- watch/unwatch dev action
- copy wallet action

Scoring:

- higher score for higher average launch score
- wins add points
- rugs subtract points
- better liquidity adds confidence

Mobile implementation:

- Watch tab nested screen.
- Also accessible from Snipe Feed launch card.

### I. Watchlist

Purpose: saved tokens and dev wallets that users want to monitor.

Data:

- AsyncStorage watchedMints
- AsyncStorage watchedDevs
- Snipe Feed alerts
- selected token metadata via Jupiter

Defaults:

- watchedMints includes official OGScan token.
- watchedDevs includes official OGScan dev wallet.

Must include:

- watched token list
- watched dev list
- remove action
- scan token action
- open dev intel action
- alerts generated from watched items

Mobile implementation:

- Watch tab default screen.
- Segmented control: Tokens / Devs / Alerts.

### J. Alerts Center

Purpose: clean timeline of important events.

Alert triggers:

- watched mint appears in Snipe Feed
- watched dev launches a new coin
- launch score >= 78
- risk level is danger
- whale concentration warning
- selected token has fresh high-volume tape

Alert card must show:

- type
- title
- token/dev
- time
- risk badge
- primary action

Mobile implementation:

- Watch tab screen.
- Timeline list.
- Badge unread/new events locally.

### K. New Pair Radar / Pair Tracker

Purpose: monitor tracked tickers or all fresh Solana pairs.

Data:

- Jupiter token search for tracked ticker mode.
- DexScreener profiles/boosts/pairs for fresh/all mode.

Modes:

- tracked tickers
- keyword search
- all fresh

Quality filters:

- minimum liquidity
- minimum holders
- require audit
- require verified
- max top-holder percentage
- max age days

Must show:

- token/pair
- price
- 24h change
- liquidity
- holders if available
- pair age
- quality status
- watch/copy/open chart/scan actions

Mobile implementation:

- Live tab nested screen.
- Add tracked ticker input.
- Quality preset chips: Open / Good / Strict.

### L. Migrations

Purpose: find coins that recently graduated from launchpads to stronger DEX liquidity.

Data:

- DexScreener search endpoint.

Sources:

- Pump.fun / PumpSwap
- Moonshot
- Jupiter Studio / Meteora
- All fresh Solana pairs

Source logic:

- Pump.fun: dexId/labels include pump/pumpswap.
- Moonshot: dexId/labels include moonshot.
- Jupiter Studio: dexId meteora or labels include dlmm/dynamic.
- All: any Solana pair.

Quality filters:

- minimum liquidity
- minimum volume
- maximum age hours
- minimum buys

Score:

- liquidity
- volume
- total transactions
- buy ratio
- price change
- recency boost

Must show:

- source selector
- stats: total, newest, total liquidity, total volume
- migration list sorted by score
- open chart / scan / copy actions

Mobile implementation:

- Live tab nested screen.
- Source selector as horizontal chips.
- Filter bottom sheet.

### M. Trending

Purpose: show what is moving across Solana right now.

Data:

- DexScreener boosts top/latest
- DexScreener pairs for boosted mints

Intervals:

- 5m
- 1h
- 6h
- 24h

Ranking score:

- interval volume
- interval transactions
- liquidity
- boost amount
- buy ratio
- positive price momentum
- recency

Filters:

- minimum liquidity
- minimum volume
- minimum txns
- green only

Must show:

- ranked trending tokens
- interval selector
- score/momentum
- price change
- liquidity
- volume
- txns
- open chart / scan / copy actions

Mobile implementation:

- Live tab nested screen.
- Large interval segmented control.

### N. Whales

Purpose: show concentration risk and largest holders for selected token.

Data:

- Helius RPC `getTokenLargestAccounts`
- Helius RPC `getTokenSupply`
- Jupiter metadata for token price

Must show:

- top 10 holder percentage
- concentration label:
  - LOW
  - MID
  - HIGH
  - VERY HIGH
- total supply
- FDV estimate
- top 20 largest accounts
- balance
- USD estimate
- percent of supply
- external Solscan link per account
- warning if top 10 concentration > 40%

Mobile implementation:

- Watch tab or Scan nested screen.
- Holder cards instead of desktop table.
- Tap holder opens Solscan.

### O. Transaction Tape / Tx Feed

Purpose: show recent transactions touching selected mint.

Data:

- Helius parsed transactions endpoint.

Must show:

- time ago
- side: BUY / SELL / TRADE / TRANSFER / TX
- signature short address
- fee payer/from wallet
- token amount
- external Solscan tx link
- polling status every 20s

Trade side logic:

- If type is TRANSFER, label TRANSFER.
- If type is SWAP and token transfer goes to fee payer, label BUY.
- If type is SWAP and token transfer comes from fee payer, label SELL.
- Else label TRADE/TX.

Mobile implementation:

- Live or Scan nested screen.
- Compact feed cards.
- Pull-to-refresh.

### P. Swap Quote

Purpose: quote SOL → selected token through Jupiter.

Data:

- Jupiter token metadata
- Jupiter quote endpoint
- Jupiter token search to change output token

Default:

- input mint: SOL
- output mint: selectedMint / official OGScan token
- amount: user entered SOL amount
- slippage: 1% / 100 bps
- quote refresh: every 12s

Must show:

- amount user pays in SOL
- USD estimate
- output amount
- selected token chip
- price impact
- slippage
- route labels
- button to execute externally on Jupiter:
  - `https://jup.ag/swap/SOL-{selectedMint}`

Important:

- This app only quotes and links to Jupiter.
- It does not execute wallet swaps unless wallet integration is intentionally added later.

Mobile implementation:

- More tab screen.
- Token search screen/modal.
- Big swap card similar to native swap apps.

### Q. Tech Stack / API Status

Purpose: explain and check the systems powering OGScan.

Systems:

- Jupiter: token registry, pricing, organic score, swap routes.
- Helius: parsed transactions, RPC, whale tracker, live tape.
- Birdeye: OHLCV/candles.
- DexScreener: fresh profiles, boosts, pairs, trending, migrations.
- Alchemy: backup RPC.
- QuickNode: future websocket streaming.
- TanStack Query / React Query: cache, dedupe, refetch intervals, retry/backoff.

Must show:

- API name
- role
- description
- endpoint label
- status check: OK / checking / down

Mobile implementation:

- More tab screen.
- “Run checks” button.
- Individual status cards.

### R. SolTools Roadmap

Purpose: explain the long-term project vision.

Content:

Goal:

- Build a real home for crypto communities.
- Crypto is scattered across X/Twitter, Telegram, and tools not built for crypto.

Plan:

- Start with useful crypto tools first.
- OGScan is the beginning: blockchain scanning, token history, discovery, analytics.

Next step:

- Grow early community around OGScan and SolTools.
- Target users: active traders, project owners, developers, community leaders, real users.

Long-term vision:

- Turn SolTools into the social layer for crypto.
- Projects build communities.
- Traders discover early plays.
- Users share alpha.
- Spaces/discussions happen on platform.
- Blockchain tools and social systems exist together.

Expansion:

- Start with Solana.
- Expand into Base, Ethereum, Monad, and more chains over time.

Mobile/platform growth:

- Current: beta testing, stability, community growth, improving tools, infrastructure.
- Future: Google Play Store, Apple App Store, public rollout, creator/project onboarding.

Mission:

- Build the platform crypto should have had years ago.
- A place designed for crypto communities instead of forcing crypto into platforms not built for them.

Mobile implementation:

- More tab screen.
- Roadmap cards and phases.
- Official links section.

---

## 9. Core API functions to implement

Implement the following shared functions once and use them everywhere.

```ts
async function jupSearchToken(query: string): Promise<JupTokenInfo[]>;
async function jupGetTokens(mints: string[]): Promise<JupTokenInfo[]>;
async function jupTrending(interval: JupInterval, limit: number): Promise<JupTokenInfo[]>;
async function jupTopTraded(interval: JupInterval, limit: number): Promise<JupTokenInfo[]>;
async function jupTopOrganic(interval: JupInterval, limit: number): Promise<JupTokenInfo[]>;
async function jupPrice(mints: string[]): Promise<Record<string, { usdPrice: number; priceChange24h?: number }>>;
async function jupQuote(input: string, output: string, amount: string, slippageBps: number): Promise<JupQuote>;

async function heliusTxs(address: string, limit: number): Promise<HeliusTx[]>;
async function heliusLargestAccounts(mint: string): Promise<LargestAccount[]>;
async function heliusTokenSupply(mint: string): Promise<TokenSupply | null>;
async function heliusSlot(): Promise<number | null>;

async function birdeyeOhlcv(mint: string, type: string): Promise<OhlcvCandle[]>;

async function dexLatestProfiles(): Promise<DexTokenProfile[]>;
async function dexLatestBoosts(): Promise<DexBoost[]>;
async function dexTopBoosts(): Promise<DexBoost[]>;
async function dexPairsForMints(mints: string[]): Promise<DexPair[]>;
async function dexSearchPairs(query: string): Promise<DexPair[]>;
```

Use React Query/TanStack Query for caching and refresh intervals:

- token search: stale 30s
- selected token vitals: refetch 15–20s
- OHLCV: refetch 60s
- transaction tape: refetch 20s
- whales: refetch 30–60s
- snipe feed: refetch 20s
- trending: refetch 20s
- migrations: refetch 30s
- quote: refetch 12s

---

## 10. Mobile components to build

Reusable components:

- `AppShell`
- `BottomTabs`
- `ToolHeader`
- `SearchBar`
- `TokenCard`
- `TokenRow`
- `StatCard`
- `RiskBadge`
- `ScoreBar`
- `CopyButton`
- `ExternalLinkButton`
- `FilterSheet`
- `SegmentedControl`
- `EmptyState`
- `ErrorState`
- `LoadingSkeleton`
- `LaunchCard`
- `DevWalletCard`
- `AlertCard`
- `WhaleCard`
- `TxCard`

Component requirements:

- All buttons must be finger-friendly.
- Copy buttons should show “Copied” feedback.
- External links should use `Linking.openURL`.
- Use haptics for copy, watch/unwatch, refresh, and tab switch if available.
- Every loading/error state must be user-friendly and not expose raw internals.

---

## 11. Build order

Build in this order so the app becomes usable quickly.

### Phase 1 — Foundation

- Create Expo/React Native app structure.
- Add navigation with bottom tabs.
- Add constants for official token/dev wallet/links.
- Add API clients for Jupiter, DexScreener, Helius, Birdeye.
- Add shared formatting helpers.
- Add selected mint/watchlist global state.

### Phase 2 — Core scan tools

- Token Scanner.
- Market Pulse / Token Vitals.
- OG Finder.
- Shared Token Detail bottom sheet.

### Phase 3 — Live tools

- Snipe Feed.
- Dev Wallet Intel.
- Watchlist.
- Alerts Center.

### Phase 4 — Market discovery tools

- Trending.
- New Pair Radar / Pair Tracker.
- Migrations.
- Transaction Tape.
- Whales.

### Phase 5 — More/brand tools

- Our Coin.
- Swap Quote.
- Roadmap.
- Tech Stack/API Status.
- Community links.

### Phase 6 — Polish

- Pull-to-refresh everywhere.
- Skeleton states.
- Empty states.
- Haptics.
- Copy/share actions.
- App icon/splash.
- App Store/Google Play preparation later.

---

## 12. Acceptance checklist

The mobile app is complete when:

- [ ] The app has bottom tabs and does not feel like one long website.
- [ ] Every current OGScan tool exists as a mobile screen.
- [ ] The official token and dev wallet are pinned globally.
- [ ] Token Scanner searches by ticker/name/mint.
- [ ] OG Finder identifies Direct OG and copycats.
- [ ] Market Pulse updates selected token vitals.
- [ ] Snipe Feed tracks fresh launches with launch score/risk labels.
- [ ] Dev Wallet Intel groups launches by likely creator wallet.
- [ ] Watchlist stores watched mints/devs locally.
- [ ] Alerts Center shows watched/hot/danger events.
- [ ] Pair Tracker monitors tracked tickers/all fresh pairs.
- [ ] Migrations shows Pump.fun/Moonshot/Jupiter/all fresh graduations.
- [ ] Trending ranks live boosted Solana tokens.
- [ ] Whales shows holder concentration and largest accounts.
- [ ] Transaction Tape shows recent Helius activity.
- [ ] Swap Quote quotes SOL to selected token via Jupiter and opens Jupiter externally.
- [ ] Roadmap explains SolTools clearly.
- [ ] Tech Stack explains/checks APIs.
- [ ] All data fetching is centralized in shared API files.
- [ ] All keys/config are centralized and not scattered through screens.
- [ ] All screens have loading, error, empty, and refresh states.
- [ ] Copy CA works everywhere it appears.
- [ ] Tapping a token anywhere can update the global selected mint.

---

## 13. Exact instruction to give the builder/AI

Build the OGScan/SolTools mobile app from this spec. Keep the same data sources, scoring logic, official token information, and tool behavior from the current OGScan web app, but rebuild the UX as a true iOS/Android mobile app with bottom tabs and separate full-screen tools. Centralize all APIs into reusable TypeScript clients, use React Query for caching/refetching, store selected mint/watchlists locally, and make every token/dev row actionable with copy, scan, chart, watch, and swap quote actions. Prioritize fast search, clean mobile cards, strong risk labels, and a polished crypto command-center feel.
