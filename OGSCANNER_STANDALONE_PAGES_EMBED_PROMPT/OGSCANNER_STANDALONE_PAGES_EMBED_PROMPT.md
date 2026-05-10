# OGScan Standalone Tool Pages Embed Prompt

Copy/paste this prompt into the mobile-app agent that is building the OGScan / SolTools app.

---

## Prompt for the mobile-app agent

Build the OGScan tool system as **separate mobile pages**, not one long scrolling website. Every tool must have its own screen/page with the tool name as the page title, and each page should be embeddable by direct link.

### Product summary

OGScan is a Solana launch-intelligence and token-safety scanner. It helps users inspect tokens, identify original / trusted tokens versus copycats, monitor new launches, track dev-wallet behavior, watch migrations, view trending Solana coins, inspect whales, watch transaction tape, quote swaps, and understand the API/data stack powering the tools.

The app should feel like a mobile-native Solana command center: black/blue/white base, sharp neon lime/cyan/gold accents, compact cards, sticky navigation, fast scanner actions, copy buttons, and one focused tool per screen.

### Core rule

Do **not** merge all tools into one giant scroll page. The user wants:

- A public beta home page first.
- A command/home dashboard after entering the scanner.
- Page 1, Page 2, Page 3, etc. as standalone pages.
- Each tool as its own route/screen with its own page title.
- Direct links that can be embedded one-by-one in the mobile app.

### Base URL

Use the deployed OGScan web URL as the base URL:

```txt
https://ogscan.fun
```

If running locally or inside another deployment, replace the base URL with that deployed web preview URL.

### Direct page link map

Use these as the canonical direct embed links. Each link should open only that page/tool.

| Page | Screen name | Canonical path | Numbered path | What it does |
|---:|---|---|---|---|
| Home | Community Beta Home | `/` | n/a | Public landing page with iOS/Android Expo Go beta instructions and button to enter OGScan. |
| 1 | Command | `/app` | `/page/1` or `/page-1` | Main OGScan command dashboard with hero, live token notice, and shortcuts into every tool. |
| 2 | Our Coin | `/our-coin` | `/page/2` or `/page-2` | Official OGScan token page with CA, dev wallet, chart links, Pump.fun link, and copy actions. |
| 3 | Roadmap | `/roadmap` | `/page/3` or `/page-3` | SolTools / OGScan roadmap, mission, expansion plans, community links, and mobile rollout vision. |
| 4 | Market Pulse | `/market-pulse` | `/page/4` or `/page-4` | Live token overview for the selected mint: price, liquidity, holders, organic score, audit flags, and market stats. |
| 5 | Snipe Feed / Dev Wallet Radar | `/snipe-feed` | `/page/5` or `/page-5` | New-launch radar that tracks fresh Solana launches, repeat dev wallets, quality score, risk levels, and quick actions. |
| 6 | Scanner | `/scanner` | `/page/6` or `/page-6` | Search/paste any Solana mint or ticker and inspect token signal, liquidity, holders, authority flags, and risk. |
| 7 | OG Finder | `/og-finder` | `/page/7` or `/page-7` | Finds the original / strongest token for a ticker and separates it from copycats and weak clones. |
| 8 | Pairs | `/pairs` | `/page/8` or `/page-8` | New pair radar for fresh Solana pairs, tracked tickers, and early liquidity discovery. |
| 9 | Migrations | `/migrations` | `/page/9` or `/page-9` | Tracks launches migrating into stronger liquidity or breakout conditions. |
| 10 | Trending | `/trending` | `/page/10` or `/page-10` | Shows what is moving now across Solana by 5m, 1h, 6h, and 24h intervals. |
| 11 | Whales | `/whales` | `/page/11` or `/page-11` | Largest holder / whale concentration view for the selected mint. |
| 12 | Tx Feed | `/tx-feed` | `/page/12` or `/page-12` | Live transaction tape for the selected mint using parsed Solana transaction data. |
| 13 | Swap | `/swap` | `/page/13` or `/page-13` | Jupiter quote/search panel for routing token swaps while keeping scanner context. |
| 14 | Tech | `/tech` | `/page/14` or `/page-14` | Explains the data pipeline: Jupiter, Helius, Birdeye, QuickNode, Alchemy, Rork, and scoring fusion. |

### Supported aliases

The web router also supports these friendly aliases:

```txt
/app
/app/:toolSlug
/tool/:toolSlug
/tools/:toolSlug
/command
/home
/market
/tape
/transactions
/transaction-feed
/og-scanner
/ogscan-scanner
/dev-wallet
/dev-wallet-radar
/migration-tool
/migration-tracker
```

Examples:

```txt
https://ogscan.fun/scanner
https://ogscan.fun/snipe-feed
https://ogscan.fun/dev-wallet-radar
https://ogscan.fun/migrations
https://ogscan.fun/page/6
https://ogscan.fun/page-6
```

### Mobile app implementation approach

Create a mobile app navigation structure like this:

1. `BetaHomeScreen`
   - Web embed: `https://ogscan.fun/`
   - Native title: `Community Beta`
   - Purpose: beta onboarding and enter button.

2. `CommandScreen`
   - Web embed: `https://ogscan.fun/app`
   - Native title: `Command`
   - Purpose: dashboard and tool launcher.

3. `OurCoinScreen`
   - Web embed: `https://ogscan.fun/our-coin`
   - Native title: `Our Coin`
   - Purpose: official token CA/dev wallet/copy links.

4. `RoadmapScreen`
   - Web embed: `https://ogscan.fun/roadmap`
   - Native title: `Roadmap`
   - Purpose: vision and community links.

5. `MarketPulseScreen`
   - Web embed: `https://ogscan.fun/market-pulse`
   - Native title: `Market Pulse`
   - Purpose: live token stats.

6. `SnipeFeedScreen`
   - Web embed: `https://ogscan.fun/snipe-feed`
   - Native title: `Snipe Feed`
   - Purpose: new launches, dev-wallet history, alerts, quality/risk scoring.

7. `ScannerScreen`
   - Web embed: `https://ogscan.fun/scanner`
   - Native title: `Scanner`
   - Purpose: token search and mint scanner.

8. `OGFinderScreen`
   - Web embed: `https://ogscan.fun/og-finder`
   - Native title: `OG Finder`
   - Purpose: original-token and copycat detection.

9. `PairsScreen`
   - Web embed: `https://ogscan.fun/pairs`
   - Native title: `Pairs`
   - Purpose: fresh pair discovery.

10. `MigrationsScreen`
    - Web embed: `https://ogscan.fun/migrations`
    - Native title: `Migrations`
    - Purpose: migration/breakout watch.

11. `TrendingScreen`
    - Web embed: `https://ogscan.fun/trending`
    - Native title: `Trending`
    - Purpose: top moving Solana tokens.

12. `WhalesScreen`
    - Web embed: `https://ogscan.fun/whales`
    - Native title: `Whales`
    - Purpose: holder concentration and largest token accounts.

13. `TxFeedScreen`
    - Web embed: `https://ogscan.fun/tx-feed`
    - Native title: `Tx Feed`
    - Purpose: parsed transaction tape.

14. `SwapScreen`
    - Web embed: `https://ogscan.fun/swap`
    - Native title: `Swap`
    - Purpose: Jupiter quotes and token route search.

15. `TechScreen`
    - Web embed: `https://ogscan.fun/tech`
    - Native title: `Tech`
    - Purpose: data/API explanation.

### Recommended mobile navigation

Use a simple mobile-native layout:

- Bottom tabs:
  - Home
  - Scanner
  - Snipe Feed
  - Tools
  - Coin

- `Tools` opens a grid/list of all standalone tools:
  - Market Pulse
  - OG Finder
  - Pairs
  - Migrations
  - Trending
  - Whales
  - Tx Feed
  - Swap
  - Tech
  - Roadmap

Each tool row/card should deep-link to its own screen, and each screen should load the matching direct URL above.

### Data/API behavior

All pages connect to the same OGScan data surfaces already used by the web tool:

- Jupiter token search, trending, organic score, swap quotes, price data.
- Helius parsed transactions, largest token accounts, token supply, Solana RPC.
- Birdeye OHLCV/candles.
- QuickNode websocket/live infrastructure.
- Alchemy RPC failover.
- OGScan fusion logic for OG/copycat scoring, launch quality, rug flags, holder risk, and dev-wallet intelligence.

The mobile app does not need to duplicate these API integrations if embedding the direct web pages. If building native versions later, port the same data calls and scoring logic page-by-page.

### UX requirements

- Every tool page must have a clear page title at the top.
- Every page should feel self-contained.
- Do not force users to scroll through unrelated tools.
- Preserve search/copy actions inside the relevant tools.
- Keep compact mobile spacing.
- Add sticky quick navigation back to the tool grid/command page.
- Use strong labels: `Clean`, `Watch`, `Risky`, `Danger`.
- Make contract address copy actions obvious.
- For Snipe Feed rows, include copy CA, chart, scanner, and dev-wallet context actions.

### Official token details

Use these verified OGScan token values anywhere the app shows official coin data:

```txt
Official OGScan token mint / CA:
EfnZmcFKMXofKA5V5ujvjqtSorvuQD2MzJPz3dxXpump

Dev wallet:
CicbPxARTDrwQ4XcxWsn6SYeG4FMJHirS633cZUJeQDh
```

### Final expected result

The mobile app should have a clean screen-per-tool structure. A user should be able to open or embed any individual page directly, for example:

```txt
Scanner only: https://ogscan.fun/scanner
Snipe Feed only: https://ogscan.fun/snipe-feed
Migrations only: https://ogscan.fun/migrations
Dev Wallet Radar alias: https://ogscan.fun/dev-wallet-radar
Numbered Scanner page: https://ogscan.fun/page/6
```

Do not rebuild the old giant long-page UI. Build / embed a true multi-page mobile tool system.
