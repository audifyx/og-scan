# OrbitX 30 / 60 / 90 Day Roadmap

Derived from the 20-agent audit (`FULL_SYSTEM_AUDIT.md`).  
Principle: **fix trust + consolidate before expanding surface area.**

---

## Days 0–30 — Trust & correctness

**Goal:** No S0 security holes; Intel/Trade surfaces show real data; CI exists.

| Week | Workstream | Deliverables |
|------|------------|--------------|
| 1 | Security | Remove leaked client PIN defaults; JWT admin for OGDex admin; lock `alerts-run`; rotate secrets |
| 1 | Intel DTO | Fix screener `rows` mapping; unwrap token payload in `useTokenIntel` / crypto-scan |
| 1 | Links | Fix `/community` dead links; Suspense skeletons for `/intel` `/hq` |
| 2 | Trade integrity | Connect `TradingTerminal` to `/api/ogdex/trade` or deep-link honesty in UI copy |
| 2 | OXW | Patch `oxw_record_trade`; start private RLS tightening |
| 2 | Anti-vamp | Fail closed when all sources fail; return source health |
| 3–4 | CI | GitHub Action: vitest + `scripts/qa/run-smoke.sh` + conflict scan |
| 3–4 | Tests | Contract tests: screener, token unwrap, anti-vamp outage, admin denied without JWT |
| 3–4 | Product honesty | Badge or disable TerminalHome mocks / TerminalLaunch alert path |

**Exit criteria**
- [ ] No hardcoded admin pass in repo
- [ ] `/intel` home shows live screener rows
- [ ] Token scan shows symbol/price/holders when API has data
- [ ] CI green on every PR

---

## Days 31–60 — Consolidation

**Goal:** One path per user job; less duplicate code; HQ becomes real or becomes a thin growth layer.

| Theme | Actions |
|-------|---------|
| Social | Pick canonical shell (XSocialApp or SocialHub+Community). Redirect `/hq` feed into it; keep growth/referrals as modules. Backend-wire XP/referrals or clearly mark demo. |
| Trading | Single execution component shared by City / Intel / DEX. Kill mock TerminalHome or replace with live screener. |
| DEX SDK | Extract shared client from twin `og.ts` files; ogdex + web import one package. |
| Router | Split `App.tsx` into domain route files; reduce catch-all masking. |
| RLS | Join RPCs for lobby/chat/voice/community; remove `using (true)` where private. |
| Perf | Manual chunks for City/LiveKit/Solana; cut redundant polling. |

**Exit criteria**
- [ ] ≤2 social entrypoints (1 primary + 1 legacy redirect)
- [ ] In-app swap works from Intel trade desk
- [ ] Shared DEX client in use by ≥2 surfaces
- [ ] Playwright smoke crawl of primary routes

---

## Days 61–90 — Differentiation

**Goal:** Ship the wedge that competitors don’t: **token-gated social + explainable intel + City presence.**

| Theme | Actions |
|-------|---------|
| Wedge | Holder-gated communities + voice + risk brief in one flow |
| Intel | Fold X-ray/snipers/bundles into `composeRisk` UI |
| AI | Ground `ai-analyzer` in selected mint + risk factors; hide mock AI pages |
| Play | Backend profiles; City quests ↔ `/play` inventory; **one** lightweight playable loop |
| Ops | Durable rate limits (Redis); Sentry required in prod; basic uptime checks |
| Growth | Real referral attribution + creator program tied to moderation reputation |

**Exit criteria**
- [ ] Documented “hero journey”: scan → risk → trade → join token room → voice
- [ ] Mock-as-live surfaces removed or feature-flagged
- [ ] Health score internal target ≥7.0 on re-audit checklist

---

## What not to do in 90 days

- Do not build a second Discord, second DEX, or full MMO combat
- Do not add more AI mock dashboards
- Do not expand EVM surfaces until Solana trust path is solid
- Do not rewrite OG DEX—compose it

---

## Ownership suggestion

| Stream | Primary team |
|--------|----------------|
| Security + RLS + CI | Backend + WARDEN/CIRCUIT QA agents |
| Intel DTO + risk UI | Crypto / ORACLE |
| Trade execution unify | Crypto + Web3 |
| Social consolidate | Social / PULSE |
| Play/City bridge | Gaming / ATLAS |
| Product sequencing | PM + AEGIS |
