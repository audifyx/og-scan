# ORBITXCITY — billing integration contract

The tokenomics team is providing shared burn/billing primitives under
`web/src/tokenomics/**` (e.g. a `useOrbitxBilling` hook). The game MUST NOT
build a parallel burn path. This file is the contract the game will code
against.

## Expected primitive (tokenomics team)

```ts
// web/src/tokenomics/useOrbitxBilling.ts (to be provided)
export function useOrbitxBilling(): {
  ready: boolean;            // auth-once complete, backend spendable
  balance: number | null;    // on-chain ORBITX in the in-app wallet
  spend: (opts: {
    amount: number;          // whole ORBITX tokens
    reason: string;          // e.g. "city-bank:character-tattoo", "city:billboard-bid"
    ref?: string;            // idempotency / ledger ref
  }) => Promise<{ signature: string }>;  // backend-signed burn tx signature
  beginAuth: () => void;     // kicks the dashboard auth-code flow if not authed
};
```

## Rules (locked by the user)

- Auth ONCE up front via the existing dashboard auth-code flow
  (`approveMcpLinkAuth` / `mintMcpChatAuth` in `web/src/lib/orbitxMcp.ts`
  → `AGENT_API/link/approve`, `/link/create` → authCode).
- After auth, every spend is seamless: game calls `spend()` → supercomputer
  backend signs with the sealed per-user desk key
  (`web/api/orbitx/_handlers/_user-trading-wallet.js` → `signAndSendUserTx`),
  executing `createBurnInstruction` on the user's ORBITX ATA
  (same instruction as `buildMcpAccessBurnTransaction` in
  `web/src/lib/mcpBurnAccess.ts`, but backend-signed — no wallet popup, ever).
- #20: EVERY in-game purchase burns. The city is a constant burn engine.
- Currency split: **paper CITY** for gameplay earnings/loot/wagers (local
  ledger, no chain) · **real ORBITX** for premium (bank, upgrades, real
  estate, mods, entry fees, bribes, cosmetics, premium track, auctions —
  losing auction bids burned per #18).
- Game never custodies keys or holds funds. No per-transaction signing popups.

## Game-side integration point

`web/src/city/economy.ts` (to be written when primitives land):

```ts
import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";
export function useCityBilling() {
  const billing = useOrbitxBilling();
  return {
    ready: billing.ready,
    balance: billing.balance,
    buyPremium: (itemId: string, amount: number) =>
      billing.spend({ amount, reason: `city-bank:${itemId}`, ref: crypto.randomUUID() }),
  };
}
```

Until the primitives land, premium UI renders in "coming soon / auth required"
state and the world runs on paper CITY only. Do NOT import `@/tokenomics/*`
until the directory exists — it would break the build.
