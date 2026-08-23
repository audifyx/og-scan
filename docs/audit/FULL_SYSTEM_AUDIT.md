# OrbitX Full System Audit — 20-Agent Engineering Review

**Date:** 2026-07-25  
**Branch audited:** `main` @ merge of teams 1–5 + QA swarm  
**Smoke baseline:** `bash scripts/qa/run-smoke.sh` → **PASS** (16 unit tests)  
**Method:** Evidence-based code inspection + specialist agent reviews. No speculative features invented.

---

## Executive summary (CTO)

OrbitX is an **ambitious multi-surface Web3 product** (City, OS, Play, Intel, Social HQ, DEX, Launchpad) with real production depth in places—especially **OG DEX APIs**, **LiveKit/Supabase social**, and an **explainable risk composer**.  

The core problem is not “missing ideas.” It is **fragmentation + trust gaps**:

1. **Multiple overlapping products** for the same jobs (social ×4+, trading ×3+, intel DTO mismatches).
2. **Critical security debt** (hardcoded leaked client admin PIN).
3. **New HQ/Play/Intel shells often demo/local**, while older systems already do the hard work.
4. **Almost no automated test/CI coverage** relative to surface area.

**Overall system health: 5.1 / 10**  
Ready for continued build—but **not** ready to market as a unified “millions of users” platform until S0/S1 items below are fixed and surfaces are consolidated.

---

## Scorecard (Agents 1–19 → CTO)

| # | Agent | Score | Verdict |
|---|-------|------:|---------|
| 1 | Chief Architect | 4.5 | Domain folders exist; god-router + duplicates dominate |
| 2 | Frontend Quality | 5.0 | Routes work; empty-data + dead links + mocks hurt |
| 3 | UI/UX | 4.5 | Premium ambition; blank Suspense, demo-as-live trust gap |
| 4 | Backend | 5.5 | OXW solid start; OGDex admin/alerts weak |
| 5 | Database | 6.0 | OXW schema good; RLS private-space holes |
| 6 | Security | 3.5 | **S0 admin pass**; open alerts-run; RLS gaps |
| 7 | Performance | 5.0 | Heavy deps + god components + polling |
| 8 | Test Automation | 2.5 | ~11 first-party tests; no CI/E2E |
| 9 | Bug Hunter | — | 12 high-impact breakables listed below |
| 10 | Web3 | 6.5 | Real wallet/Jupiter/Helius; terminal not in-app exec |
| 11 | Trading | 5.0 | OG DEX strong; OrbitX terminal = Phantom deep-link |
| 12 | Token Scanner | 6.0 | Risk engine good; **DTO mismatches break UI** |
| 13 | Gaming | 4.0 | Studio shell only—no real play loop |
| 14 | Social | 6.5 overall / **4.0 for `/hq`** | Production social exists; HQ is localStorage demo |
| 15 | Product | — | Consolidate > expand |
| 16 | Competitor | — | Win on token-gated social + intel, not breadth |
| 17 | Code Quality | 4.0 | 1.7k–6.5k LOC gods; duplicated `og.ts` |
| 18 | DevOps | 4.0 | Vercel ok; no GitHub Actions CI |
| 19 | AI Strategy | — | Ground existing AI stubs; kill mock-as-live |
| 20 | **CTO composite** | **5.1** | Fix trust + consolidate first |

---

## 1. Architecture report (Agent 1)

### Strengths
- Clear ownership map: `docs/ORBITX_PLATFORM.md`
- Domain modules: `web/src/{os,gaming,crypto,social}`
- Production DEX isolated under `web/ogdex/`

### Critical architecture issues
| Sev | Issue | Evidence |
|-----|-------|----------|
| H | God router | `web/src/App.tsx` (~538 lines) |
| H | Social systems compete | `/hq` + XSocialApp + SocialHub + Communities + CommunityRooms |
| H | Trading surfaces overlap | `/terminal`, `/intel/trade`, `/ORBITX_DEX` |
| H | Duplicated DEX libs | `web/src/lib/og.ts` ≈ `web/ogdex/src/lib/og.ts` (~4k LOC each) |
| M | Demo persistence as product | `localSocialStore`, `GameProfileStore` |
| M | Nested DEX SPA + hard redirects | `window.location.replace` to `/ORBITX_DEX` |

### Recommended future architecture
1. **One canonical surface per job** (redirect the rest):
   - Social → production X/community shell; `/hq` = growth modules only or merge in
   - Trade → OG DEX (or one shared terminal SDK)
   - Intel → `/intel` consuming OG DEX APIs with correct DTOs
   - Play → `/play` as profile/lobby companion to City
2. Split `App.tsx` into domain route modules.
3. Extract shared Solana/DEX client package (kill `og.ts` twin).
4. Feature-flag demos; never present localStorage as live network.

---

## 2. Security report (Agent 6) — CRITICAL

### S0 — Fix immediately
**Hardcoded OGDex admin PIN (leaked client default)**
- `web/api/ogdex/_lib.js` (`ADMIN_PASS` fallback)
- `web/src/components/AdminPassGate.tsx`
- Related: `MaintenanceLock.tsx` same code
- Admin API uses service-role helpers without JWT admin role

### S1
- Public `alerts-run` can fire all webhooks (`web/api/ogdex/_routes/alerts-run.js`, in `NO_LIMIT`)
- `oxw_record_trade` security-definer can return another user’s trade by signature before ownership check

### S2
- OXW RLS: private community posts / memberships too open (`using (true)`, self-insert)
- Broad CORS `*` on APIs
- `/hq/admin` not behind `AdminRoute` (local demo—but branding implies real mod)

### Required security sprint (week 1)
1. Remove hardcoded pass; require Supabase admin role JWT for `/api/ogdex/admin`
2. Auth-lock `alerts-run` (cron secret)
3. Patch `oxw_record_trade` ownership check
4. Tighten private community/lobby/voice RLS + join RPCs
5. Rotate any secrets that may have shipped with defaults

---

## 3. Bug report (Agent 9 + verified)

| # | Severity | Bug | Evidence | Impact |
|---|----------|-----|----------|--------|
| 1 | **S1** | Intel screener reads `tokens`/`data`, API returns `rows` | `crypto/api/client.ts`, `IntelHome/Trending/Sentiment`; `ogdex/_routes/screener.js` | Empty intel pulse forever |
| 2 | **S1** | Token scan DTO not unwrapped | `crypto-scan` / `useTokenIntel` expects flat token; API returns `{ token, meta, intel, … }` | Scanner market/holders empty |
| 3 | **S0** | Admin passcode hardcoded | AdminPassGate / ogdex `_lib` | Anyone can unlock admin UI/API path |
| 4 | **S2** | `/community` links 404 | SocialLayout & others; App has `/community-classic` only | Dead CTAs |
| 5 | **S2** | TradingTerminal = Phantom deep-link only | `TradingTerminal.tsx` ~226–443 | No in-app swap despite marketing copy |
| 6 | **S2** | TerminalHome mock markets | `TerminalHome.tsx` `mockTokens` | Fake product trust |
| 7 | **S2** | TerminalLaunch `alert("Launching…")` | `TerminalLaunch.tsx` | Non-functional launch |
| 8 | **S3** | Lazy routes `fallback={null}` | App.tsx intel/hq | Blank flash |
| 9 | **S2** | Anti-vamp per-source fail-open | `anti-vamp-check.ts` catch → `[]` | Clones may pass if sources down |
| 10 | **S3** | Trade sim can fail-open | `ogdex/_routes/trade.js` | Unverified tx possible |
| 11 | **S3** | OGDex path `.pop()` routing risk | `ogdex.js` | Nested paths mis-dispatch |
| 12 | **S3** | Catch-all `/:toolSlug` masks 404s | App.tsx | Broken links look “ok” |

---

## 4. Performance report (Agent 7)

| Risk | Detail |
|------|--------|
| Bundle | 82 prod deps including Three.js, LiveKit, Solana, Metaplex, Raydium, charts |
| Gods | SocialHub ~1805, XSocialApp ~1700, Communities ~6516, TradingTerminal ~1189 |
| Polling | Terminal 8s/15s; City panels 20–60s multi-fanout |
| Build | No manual chunk strategy in `vite.config.ts`; Node polyfills global |
| DX | pnpm install vs npm build in `vercel.json` mismatch |

**Priorities:** route-based code splitting, shared DEX SDK, reduce City poll fanout, lazy heavier panels.

---

## 5. UX report (Agent 3)

### What blocks “AAA premium”
1. Demo/mock presented as live (HQ, TerminalHome, some AI pages)
2. Blank Suspense fallbacks
3. Fragmented navigation (OS deep-links improved, but social still multi-home)
4. Inconsistent loading/error empty states on Intel
5. Icon-only controls without labels (a11y)
6. Onboarding tour not oriented to OS/Intel/HQ/Play journeys

### Redesign suggestions (no rewrite)
- Single **OrbitX Hub** chrome: City / Trade / Intel / Social / Play
- Explicit **“Demo” badges** on localStorage surfaces until backend-wired
- Skeleton loaders for all lazy routes
- Trust strip on scanner: data sources + last refresh time

---

## 6. Backend & database (Agents 4–5)

### OXW strengths
- Coherent `oxw_*` schema, RLS enabled, service-only XP award, useful indexes
- Typed Vercel router + workers (`oxw-award-xp`, lobby, trade, notify, token-scan)

### Gaps
- Private space RLS too permissive
- Missing indexes: onchain by mint, member tables by user_id, posts by author
- Lobby `friends` visibility unused; password hash accepted client-side
- Memory-only rate limits on Vercel

---

## 7. Web3 / Trading / Scanner (Agents 10–12)

### Keep
- OG DEX token/screener/safety/forensics/xray depth
- `composeRisk` explainability + unit tests
- Real Phantom sign/send in City `TokenBuyPanel` and OG DEX `TradePanel`

### Fix first
1. Normalize screener + token DTOs in crypto client
2. Wire OrbitX terminal to `/api/ogdex/trade` (don’t rebuild)
3. Fold X-ray into risk score UI
4. Fail-closed anti-vamp on total source outage

### Vs Photon/Axiom/Birdeye
OrbitX should not chase every orderflow widget first. Differentiator = **explainable risk + social/alpha context + launch integrity**.

---

## 8. Gaming & Social (Agents 13–14)

### Gaming (4/10)
Studio shell is real; **no combat/game loop**. Treat `/play` as Steam-like profile/lobby/inventory for City until one lightweight playable loop exists.

### Social (6.5/10 platform, 4/10 `/hq`)
**Do not rebuild Discord.** Production SocialHub / XSocialApp / Communities / VoiceLobbies already exist.  
`/hq` should **compose** them + growth (XP/referrals), then delete localStorage as source of truth.

---

## 9. Product & competition (Agents 15–16)

### Ship / cut
| Do | Don’t |
|----|-------|
| Consolidate social entry | Keep 5 social homes |
| Fix Intel DTOs + security | Add more AI mock pages |
| One trading execution path | Third terminal UI |
| Token-gated communities wedge | Generic social clone |
| Play as profile/lobby | Full MMO combat now |

### Competitor wedge
**Discord + X + trading intel for Solana communities**—holder gates, voice, risk briefs, creator reputation—not “another screener.”

---

## 10. Testing & DevOps (Agents 8, 18)

| Gap | Action |
|-----|--------|
| ~11 first-party tests | Contract tests for screener/token/anti-vamp |
| No GitHub Actions | CI: lint + vitest + smoke on PR |
| No E2E | Playwright crawl `/os /play /intel /hq /Orbitxcity` |
| Mixed pkg managers | Standardize pnpm in Vercel build |
| Sentry optional | Require DSN in prod; alert on S0 routes |

---

## 11. AI opportunities (Agent 19)

Ground existing pieces—don’t ship more mocks:
1. Risk brief from `composeRisk` + intelligence.ts explanations
2. Token-grounded `ai-analyzer` chat
3. Replace AISpaceAssistant / AIHostCopilot mocks with live pipelines or hide routes
4. Clone/narrative alerts from anti-vamp + intelligence
5. Personalized “what to check next” on Intel home

---

## 12. Missing features vs broken features

### Missing (real gaps)
- In-app swap UX on OrbitX terminal (exists on OG DEX)
- Backend-backed HQ social graph
- Authoritative game profiles
- Durable rate limits / CI
- Unified moderation across rooms/voice/posts

### Broken / misleading (higher priority than new features)
- Intel empty screener/token panels
- Admin pass default
- Dead `/community` links
- Mock terminal home/launch
- Marketing “Jupiter buy/sell” where only deep-link exists

---

## Final priorities (impact order)

### P0 — this week
1. Remove hardcoded admin/maintenance pass; JWT admin role
2. Fix crypto screener `rows` + token unwrap DTOs
3. Auth-lock `alerts-run`
4. Fix `/community` → `/community-classic` or add route
5. Patch `oxw_record_trade` ownership

### P1 — next 2–3 weeks
6. Wire TradingTerminal to OG DEX trade builder
7. Fail-closed anti-vamp + source health
8. Label or backend-wire `/hq` (stop demo-as-live)
9. Add CI workflow + contract tests
10. Tighten OXW private RLS

### P2 — 30–60 days
11. Consolidate social shells
12. Extract shared DEX SDK; reduce `og.ts` duplication
13. Split App router; Suspense skeletons
14. Play profile ↔ City bridge; one mini game loop
15. Monitoring + rate-limit durability

---

See also: `docs/audit/ROADMAP_30_60_90.md` · `docs/audit/BUG_BACKLOG.md`
