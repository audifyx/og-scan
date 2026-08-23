# OrbitX on-chain migration — Phase 1–3 foundation

**Status:** Phase 1 (audit) + Phase 2 (design) + Phase 3 (reusable foundation) shipped in this document’s companion PR.  
**Rule:** Blockchain is the source of truth. The backend is an indexer/cache. Nothing here fakes a program ID or a burn signature.

Live site: https://www.orbitx.world  
Proof UI: `/onchain`  
Indexer API: `/api/orbitx-onchain` (top-level file — `/api/orbitx/*` is rewritten to `orbitx-hub`).

---

## 1. Architecture principle

```
User → OrbitX frontend → wallet → Solana (existing programs + Memo attestations)
     → Solscan
     → OrbitX indexer (/api/orbitx-onchain)
     → ox_onchain_events (cache)
     → UI
```

| Layer | Role |
|---|---|
| Solana | Authority. A confirmed signature proves the action. |
| Memo program `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr` | Phase 3 “OrbitX Core” attestation. Format `ox1|<kind>|<sha256-hex64>`. |
| Existing programs | Pump.fun create/claim (`6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`), Jupiter Ultra, Token-2022, betting program `Btr98movTV3jHYy1kNX8L2zYVEk7m33QTr2YtU96hLqM` (source in `programs/betting`; **no deploy proof in this repo**). |
| Backend | Index, cache, accounts, notifications, X API, UI. Never the economic authority. |
| Frontend | Wallet signing + reusable Solscan/tx components. |

**We did not deploy a new Anchor program.** A skeleton program with a placeholder ID would be fake on-chain. Memo attestations + existing economic txs are real and reconstructible.

---

## 2. Inventory (existing `main`)

### Database (Supabase) — keep / convert / replace

| Table / area | What it stores | Decision |
|---|---|---|
| `profiles`, `user_roles`, `user_wallets`, `user_follows` | Accounts, usernames, roles | **Keep (C)** |
| `ox_admin_ledger` | Owner P&L after RPC-confirmed txs | **Convert to index** of real txs |
| `orbitx_tx_intents` / `orbitx_tx_receipts` | Unsigned intents + confirmed receipts | **Keep as index** of wallet-signed txs |
| `ox_claim_jobs` | Pump creator-vault claim jobs | **Hybrid (B)** — job is UX; claim tx is authority |
| `ox_shop_orders` | Shop burns (Jupiter + memo + burn) | **Hybrid (B)** — already one on-chain tx |
| `ox_token_mints`, `orbitx_token_launches`, `orbitx_tokens` | Launch registry | **Convert to index** of mint/create signatures |
| `pump_launches`, `pump_launch_jobs` | Pump create + fee jobs | **Hybrid (B)** |
| `prediction_markets` + related | Markets, votes, escrow | **Hybrid (B)** — on-chain stake exists in betting program when deployed; UI tables stay as index |
| `posts`, `comments`, `likes`, `communities`, `community_*` | Social content | **Keep (C)** — content too large for chain. Optional `ox1\|post\|hash` attestation |
| `xp_events`, `user_xp`, `xp_daily_claims` | XP | **Keep (C)** — leaderboard calc off-chain; optional activity events on-chain |
| `referrals`, `referral_attributions` | Referral graph | **Hybrid later** — `ox1\|referral\|hash` when economically important |
| `notifications`, `messages`, `conversations` | Inbox | **Keep (C)** |
| `game_sessions`, `orbitx_game_*`, `arcade_*` | Game telemetry | **Keep (C)** except paid entry (already tx) |
| `bagwork_*` | X-API bagwork V1 | **Keep (C)** — X cannot live on-chain |
| `ox_lp_*` | Launchpad V2 (other branch) | After merge: **Hybrid (B)** — campaign hash + claim txs |

**Do not delete** these tables. Indexer writes **new** `ox_onchain_events` only.

### API / workers (economically important)

| Surface | On-chain today? | Class |
|---|---|---|
| `/api/pump-create` | Yes — Pump create tx | B |
| `/api/orbitx/claim` | Yes — `collectCreatorFee` | B |
| `/api/orbitx/desk-shop` | Yes — Jupiter + memo + burn, one tx | B |
| `/api/orbitx-tx-report` | Indexes confirmed txs | B |
| `/api/jupiter-ultra` | Yes — swaps | B |
| `/api/orbitx/token22-create` | Yes — mint txs | B |
| `/api/predictions` | Escrow/stake when program live | B |
| Social / HQ / XP / notifications | No | C |
| X / bagwork verification | X API | C |

### Cron (vercel.json)

| Cron | Class | Note |
|---|---|---|
| `/api/cron/pump-fee-buyback` | B | Detects vault ≥ $25; **does not** invent burns |
| `/api/cron/pump-fee-jobs` | B | Queue only |
| `/api/cron/sol-price` | C | Cache |
| `/api/cron/predictions-resolve` | B | Resolution + on-chain claim when program live |
| Social/game crons | C | |

### Existing Solana programs in repo

| Path | ID | Status |
|---|---|---|
| `programs/betting` | `Btr98movTV3jHYy1kNX8L2zYVEk7m33QTr2YtU96hLqM` | Source present. Escrow/stake/claim. **Extend later; do not replace.** |
| `contracts/nft_coin` | placeholder `Nftco1nMarketProgram1111…` | **Not deployed. Do not treat as live.** |

---

## 3. Feature classification (A / B / C)

| Feature | Class | Why |
|---|---|---|
| Token launches (Pump / Token-22 / custom) | **B** | Create/mint tx is authority. Registry is index. |
| Burns / buybacks / shop | **B** | Burn tx + optional memo. Jupiter for real swaps only. |
| Creator fee claim | **B** | Pump `collectCreatorFee` signed by creator. |
| Swaps / trading | **B** | Jupiter / DEX tx. |
| Predictions / votes | **B** | Betting program when deployed; until then index stake txs. |
| Rewards (USD ledger / XP) | **C → B later** | Do not put a fake claimable PDA on-chain this phase. Attest claims with `ox1\|reward\|hash` when a real payout tx exists. |
| Bagworking (X posts) | **C + attest** | X API off-chain. On-chain: campaign/reward hash + claim tx only. |
| Social posts / communities | **C + optional A-lite** | Content off-chain. Optional memo hash. |
| XP / leaderboards | **C** | Indexer aggregates verified events. Do not store ranks on-chain. |
| Referrals | **C + attest** | `ox1\|referral\|hash` when reward pays. |
| Notifications / search / auth | **C** | Cannot reasonably live on-chain. |
| Games | **C** except paid entry | Telemetry off-chain. |
| Accounts / usernames / profiles | **C** | Backend-only. |

**A (fully on-chain this phase):** Memo attestations themselves (`ox1|…`). That is the only new on-chain surface we added — and it is a real Solana program (Memo).

---

## 4. Program design (Phase 2 — do not deploy yet)

Modular **future** programs (one concern each). Deploy only when a module has real economic state that Memo cannot express (PDAs, escrows, claims).

| Module | On-chain (minimum) | Off-chain |
|---|---|---|
| **Core** | Config, pause, authority. Today: Memo kinds + this doc. | — |
| **Social** | post_id, wallet, content_hash, uri_hash, slot | Body, images |
| **Rewards** | allocation, claimable, claimed_sig | USD display cache |
| **Launch** | mint, creator, kind, config_hash, create_sig | UI metadata |
| **Burn** | mint, amount, burn_sig | Narrative |
| **Games** | paid entry / prize claim | Scores |
| **Predictions** | **Extend `programs/betting`** — question, token, vote, resolution | UI copy |

**Cost honesty:** a new PDA (~0.002 SOL rent) **cannot** meet the 0.00001 SOL target. Memo-only txs typically **5,000 lamports (0.000005 SOL)** and **do** meet the target. Swaps/creates/burns pay Jupiter + Pump + token accounts and will **not** meet 0.00001 SOL. The cost desk reports `meta.fee` as returned by RPC. We never pad or invent fees.

---

## 5. Content hashing

`web/shared/orbitx-onchain.js`:

- Canonical JSON → SHA-256 hex (64 chars)
- Memo: `ox1|<kind>|<hash>`
- Kinds: `launch`, `burn`, `claim`, `bagwork`, `post`, `vote`, `referral`, `reward`, `campaign`, `game`, `swap`

Large content stays in existing storage. The chain stores the hash.

---

## 6. Indexer + rebuild

`ox_onchain_events` is a **cache**. Unique key = `tx_signature`.

Rebuild (`action=rebuild&wallet=`):

1. `getSignaturesForAddress` (last 40)
2. `getTransaction` each
3. Keep txs that contain `ox1|` memos
4. Upsert index rows

If the table is wiped, those memo-backed rows come back from chain history. Economic txs without memos can be re-indexed by signature (`action=index` + `kind`) after RPC confirm.

---

## 7. Jupiter

Used only for **real** token movement (shop buy+burn, fee buybacks after a signed claim). Not an abstraction for posts or votes.

Shop already does the preferred atomic pattern: **swap + memo + burn in one transaction**.

---

## 8. Security

- No private keys or API secrets on-chain
- Users sign their own txs (`sendWalletTransaction`)
- Operator bot key stays scoped to existing execution functions — not expanded
- Indexer never marks a row without RPC `getTransaction`
- Owner-only cost dashboard (`audifyx@gmail.com`)
- RLS on `ox_onchain_events`; writes via service role only

---

## 9. Before / after (this phase)

| | Before | After |
|---|---|---|
| Database | Economic events often **only** in app tables | Same tables **plus** `ox_onchain_events` keyed by real signatures |
| Backend | Often the record of “it happened” | Indexer + cache; RPC is authority |
| Blockchain | Launches/swaps/burns/claims already real; no shared attestation/index | Memo attestations + index + rebuild + Solscan UI |
| Fake programs | NFT-coin placeholder unused | Still unused. Not treated as live. |

---

## 10. Phases remaining

4. Attach Launchpad V2 (other PR) campaign hashes + claim txs  
5. Optional social `ox1|post|hash` from HQ composer  
6. Game paid-entry attestations  
7. Deeper indexer (program logs when programs deploy)  
8. Cost optimization (ALTs, batching) measured on the desk  
9. Flip remaining “DB says X” UIs to “sig says X”  
10. Independent Solscan verification of every indexed row  

---

## 11. Definition of done (this PR)

- [x] Architecture audited and classified  
- [x] No fake program deploy  
- [x] Memo + hash foundation  
- [x] Indexer + rebuild from chain  
- [x] Shared Solscan / tx status / badge / proof / button  
- [x] Cost desk from real `meta.fee`  
- [x] Launch/burn/claim UIs use shared Solscan links  
- [x] Non-custodial signing unchanged  
- [x] Target &lt; 0.00001 SOL documented honestly (memo yes; PDA/swap/create no)
