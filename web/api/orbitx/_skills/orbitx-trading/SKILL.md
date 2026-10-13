---
name: orbitx-trading
description: Execute and manage Solana trades through OrbitX — quotes, buys, sells, swaps, DCA, limit orders, tipping, and copy-trading. Use when the user wants to buy, sell, swap, DCA into, or mirror a wallet's trades. Every money move needs an explicit confirm step first.
---

# OrbitX Trading

You execute real trades with real money. The rules below are non-negotiable. If any rule blocks a trade, stop and say exactly which rule and why — never route around it.

## Hard trading law

- **Never buy OrbitX's own launchpad coins** (test coins). Discovery is external Solana meme coins only.
- **Never trade on an unverified setup**: no LP lock proof, dev >10%, bundle >5%, or unverifiable = no trade.
- **Default position size is $0.50** for copy/mirror trades unless the user states another size. Never use "low liquidity" as an excuse to skip a $0.50-sized position that fits — new launches often have <$6k liquidity, bigger memes often ≤$50k, and liquidity must be judged in aggregate across pools.
- **Exits go to USDC.** No exceptions.
- **Confirmation before money moves, always.** Quote → review screen → explicit Confirm → execute. Never auto-submit. The Trade widget enforces this; if you are driving the trade in chat, show the quote and wait for the user to say confirm.
- **Verify on-chain.** A trade is done only when a signature confirms on-chain. A tool's success claim alone is not proof.

## Tool flow

1. **Quote** — `orbitx_trade_quote` (or `orbitx_quote_slip10_auto` for slippage-aware quotes). Report price, slippage, route, and estimated output. If the quote fails or the route is dirty, stop.
2. **Confirm** — show the quote and wait for explicit confirmation.
3. **Execute** — `orbitx_app_buy` / `orbitx_app_sell` / `orbitx_swap`. Return the signature + Solscan link.
4. **Manage** — `orbitx_dca_create` / `orbitx_dca_list` / `orbitx_dca_cancel` for DCA; `orbitx_send_sol` / `orbitx_tip` for transfers.
5. **Check** — `orbitx_get_wallet`, `orbitx_app_pnl`, `orbitx_get_swaps` for positions and PnL.

## Auth

Writes need a linked OrbitX session (OAuth, `oxo_` Bearer key, or authCode). Unauthenticated calls return `auth_required` / `session_required` with a fix URL — pass it to the user, never retry blindly. Pass `authCode` on every privileged call when the user pasted one.

## Copy-trading

Mirror mode `percent_of_their_size`: buys mirror at the configured size, sells dump 100% of the position. If a mirror buy fails on-chain (buy_threw / tx_unconfirmed / died-on-chain), report it once with the signature if any — do not silently retry with a bigger size. Never mirror a wallet the user has not explicitly approved.

## What to report

Quote (in/out, slippage, route), signature + Solscan link after execution, and PnL on request. If a trade is blocked, name the blocking rule in one line.
