---
name: orbitx-dex-intelligence
description: Build or use OrbitX token intelligence, wallet analytics, discovery, risk, and crypto-agent features. Use for OG DEX APIs, MCP tools, token pages, chain forensics, scores, alerts, AI analysis, or claims about current market data.
---

# OrbitX DEX Intelligence

The core rule is evidence before verdict. Historical knowledge helps interpret patterns; it must never masquerade as current chain, market, wallet, or news data.

## Choose the minimum useful data path

- Discovery: `/api/ogdex/screener` and `/signals`.
- Token overview: `/token?mint=...`.
- Risk: `/xray?mint=...`.
- Dev and origin: `/forensics?mint=...`.
- Tradeability: `/safety?mint=...`.
- Price history: `/chart` and `/ath`.
- Wallet behavior: `/wallet`, `/swaps`, and `/balance`.
- Smart money: `/kols` and `/leaderboard`.
- Grounded analysis: `POST /chat`.

Read `web/api/ogdex/_routes/llms.js`, the route implementation, and the OpenAPI generator before changing a public contract.

## Analysis workflow

1. Normalize and validate chain plus mint/address. Never infer an address from a similar ticker.
2. Fetch independent live sources in parallel where practical.
3. Record source freshness, failures, and coverage gaps.
4. Separate observations from inference.
5. Compare:
   - liquidity and LP controls,
   - holder concentration,
   - creator/dev provenance and selling,
   - sniper and same-block bundle behavior,
   - volume authenticity and price impact,
   - metadata authorities,
   - social claims versus on-chain flows.
6. State the verdict, strongest evidence, uncertainty, and what new evidence would change it.

Never invent prices, holder counts, wallet movements, source citations, or risk flags. If fresh tools fail, say which facts are unavailable and limit the conclusion.

## Risk semantics

- Treat a score as a summary of evidence, not proof.
- Keep unknown distinct from safe.
- Explain which raw facts produce each red or green flag.
- Avoid duplicate weighting when several flags derive from one event.
- Include chain and time window with metrics.
- Do not label a wallet as owned by a person without verifiable attribution.
- Alerts notify only; they do not imply execution.
- Trading responses must remain non-custodial and require the user's wallet signature.

## API and MCP changes

When adding or changing a public capability, update all applicable surfaces:

1. route implementation,
2. route dispatch,
3. OpenAPI document,
4. `llms.txt`,
5. MCP manifest and execution mapping,
6. API docs UI,
7. focused tests.

MCP input schemas must set bounds and required fields. URL-encode every user-controlled value. Validate on the server even if the schema validates in a client.

## Recommended response shape for analysis

Use progressive disclosure:

1. quick verdict,
2. metrics snapshot with timestamp,
3. evidence and forensics,
4. red and green flags,
5. uncertainty/source gaps,
6. protective next checks.

Tone may be direct, but accuracy and user safety outrank persona. Do not manufacture certainty or pressure a trade.

## Source patterns

- `web/api/ogdex/_routes/llms.js`
- `web/api/ogdex/_routes/mcp.js`
- `web/api/ogdex/_routes/openapi.js`
- `supabase/functions/_shared/grim_base.ts`
- `supabase/functions/enhanced-intelligence/index.ts`
- `web/src/lib/intelligence.ts`
- `web/src/lib/classification.ts`
