# OrbitXCity — Economy Module (MODULE.md)

**Team:** Economy module · **Area:** `web/src/city/modules/economy/**` (exclusive)

GTA-style open-world economy: paper CITY coins for gameplay + real ORBITX
bank with buy-and-burn premium spends. No staking anywhere. Game never
custodies keys or funds.

## What was built

| # | Idea | Status | Notes |
|---|------|--------|-------|
| 1 | ORBITX bank UI — real on-chain ORBITX balances, spend on in-game features/upgrades, every tx auto-burns | **BUILT (defensive)** | `components/OrbitxBankPanel.tsx` + `data/catalog.ts` (8 premium items, 25–500 ORBITX). Renders fully, but spends need the tokenomics primitive (see Integration). |
| 2 | Paper CITY coin wallet + ledger (earnings, spends, history) | **BUILT** | `store/paperWallet.ts` — external store + `usePaperWallet()` hook, localStorage-persisted (`orbitxcity:paper-wallet:v1`), 100 CITY welcome bonus, full tx history. `components/PaperWalletPanel.tsx`. |
| 3 | Candle predictor minigame — guess next candle direction on REAL price data, win paper | **BUILT** | `components/CandlePredictor.tsx` — 20s candles on live ORBITX/USD (DexScreener via `useLivePrices`), stake 1–500 CITY, pays ×1.9. Refuses to run without live data; void+refund safety net if the feed stalls. **2026-09-29 fix:** the stall timer was able to double-refund after a normal settle — now guarded by `settledRef` (settle clears the timer, timer no-ops once settled). |
| 4 | Arcade — chart-guessing + paper-trading speedrun | **BUILT** | `components/Arcade.tsx` — (a) chart guesser: identify ORBITX/SOL/USDC from a normalized mystery chart, +50 CITY; (b) 60s speedrun: long/short/flat live ORBITX, virtual 1,000 CITY bankroll, PnL settles to paper wallet at the buzzer. |

All games pay paper CITY only. All premium spends burn real ORBITX. Real
price data only — no mock prices anywhere (games wait for the feed instead of
fabricating).

## Public API (`index.ts`)

- `EconomyHub({ billing?, onClose, initialTab? })` — single mount point, tabbed overlay (Bank / Wallet / Predict / Arcade). `ECONOMY_PANEL_ID = "economy"`.
- `paperWallet` / `usePaperWallet()` — shared paper-CITY store: `earn/spend/placeWager/win/lose/adjust`.
- `useCityBilling(provider?)` — defensive billing adapter (`billing.ts`).
- `OrbitxBankPanel`, `PaperWalletPanel`, `CandlePredictor`, `Arcade` — standalone panels (re-mountable separately if the integrator prefers).
- Data: `BANK_CATALOG`, `CANDLE_PREDICTOR`, `FEED_TOKENS`, `ORBITX_MINT`.

Only external deps: `react` and `@/hooks/useLivePrices`. Self-contained styles
in `economy.css` (`ox-eco-*` namespace). Mobile-friendly (responsive, touch-size
buttons).

## Integration points — exact needs from core

1. **Mount:** when the core HUD panel `"economy"` opens, render
   `<EconomyHub billing={billing} onClose={closePanel} />`.
   Suggested wiring in the page shell / `GtaHud`:
   ```tsx
   import { EconomyHub, ECONOMY_PANEL_ID } from "@/city/modules/economy";
   // add ECONOMY_PANEL_ID to the HudPanel set; when active:
   {panel === ECONOMY_PANEL_ID && <EconomyHub billing={billing} onClose={() => openPanel(null)} />}
   ```
2. **World triggers (optional, not required):** walking into a bank/arcade
   building could call `openPanel("economy")` with `initialTab="bank"` /
   `"arcade"`. The module needs no scene/3D hooks — pure HUD overlay.
3. **Paper-CITY earnings from gameplay:** other module teams can credit the
   shared wallet directly:
   ```ts
   import { paperWallet } from "@/city/modules/economy";
   paperWallet.earn(25, "Heist payout — downtown job", "missions:heist");
   ```
   (Imports flow from other modules *into* economy, never the reverse.)

## Assumptions about not-yet-existing shared code (marked per instructions)

- **`@/tokenomics/useOrbitxBilling` DOES NOT EXIST YET — HARD RULE honored:**
  nothing in this module imports `@/tokenomics/*` (it would break the
  production build). Verified: `web/src/tokenomics/` is empty.
- **Expected interface** (mirrors `web/src/city/BILLING_CONTRACT.md` exactly),
  documented as `OrbitxBillingProvider` in `types.ts`:
  ```ts
  interface OrbitxBillingProvider {
    ready: boolean;
    balance: number | null;
    spend: (opts: { amount: number; reason: string; ref?: string }) =>
      Promise<{ signature: string }>;
    beginAuth: () => void;
  }
  ```
- **Integrator wiring once tokenomics lands** (one line, in the page shell):
  ```tsx
  import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";
  const billing = useOrbitxBilling(); // matches OrbitxBillingProvider
  <EconomyHub billing={billing} onClose={...} />
  ```
- Until then: `useCityBilling()` with no provider returns `ready: false`,
  `balance: null`, `providerConnected: false`; the bank tab shows the
  "coming soon / auth required" state. All paper-CITY features work regardless.
- Billing rules honored: auth once up front → seamless backend-signed spends;
  every premium purchase = `createBurnInstruction` burn, no wallet popups;
  game never custodies keys; no staking anywhere.

## Assumptions / caveats

- Price feed: `useLivePrices` polls DexScreener every 10s (5s in speedrun).
  Candle predictor uses 20s candles so each candle sees ~2 polls. ORBITX is a
  low-liquidity token — if DexScreener has no pair, games show "waiting for
  live prices" rather than mock data.
- Paper wallet and burn history live in localStorage (per-device). Server-side
  persistence is out of scope for this module.
- `paperWallet.adjust(0, …)` is used for zero-amount premium-purchase records
  linked to burn signatures — balance unchanged, history kept.
- Speedrun equity model: full-position flips only; realized PnL rebased into a
  virtual bankroll on every flip/flat; net PnL settled to the paper wallet at
  the buzzer via `adjust`.
- `SpeedrunResult` type is exported for future leaderboard use (not yet wired).

## Files

- `index.ts` — public API
- `types.ts` — `OrbitxBillingProvider`, `BankItem`, `CityLedgerEntry`, `BurnRecord`, …
- `billing.ts` — `useCityBilling(provider?)` defensive adapter + burn log
  (2026-09-29: duplicate `react` import removed, formatting tidied — no
  behavior change).
- `store/paperWallet.ts` — paper-CITY store, `usePaperWallet`, formatters
- `data/catalog.ts` — bank catalog (8 items), predictor/speedrun config
- `data/mints.ts` — `ORBITX_MINT` (`13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9`), SOL, USDC
- `hooks/usePriceCandles.ts` — live-price → OHLC sampler + `CandlestickChart`
- `components/EconomyHub.tsx`, `PaperWalletPanel.tsx`, `OrbitxBankPanel.tsx`,
  `CandlePredictor.tsx`, `Arcade.tsx`
- `economy.css` — scoped styles
