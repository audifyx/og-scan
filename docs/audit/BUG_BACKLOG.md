# OrbitX Bug Backlog (from 20-agent audit)

Prioritized for engineering pickup. Severity: S0 (critical) → S4 (polish).

| ID | Sev | Area | Title | Files / evidence | Suggested fix |
|----|-----|------|-------|------------------|---------------|
| BUG-001 | S0 | Security | Hardcoded leaked client admin PIN | `web/api/ogdex/_lib.js`, `AdminPassGate.tsx`, `MaintenanceLock.tsx` | Env-only `ADMIN_AUTH` + Supabase admin JWT; remove fallback |
| BUG-002 | S1 | Security | Public `alerts-run` fires webhooks | `ogdex/_routes/alerts-run.js`, `ogdex.js` NO_LIMIT | Require cron/worker secret |
| BUG-003 | S1 | Intel | Screener UI expects `tokens`/`data`, API returns `rows` | `crypto/api/client.ts`, IntelHome/Trending/Sentiment, `screener.js` | Map `rows` in client |
| BUG-004 | S1 | Intel | Token payload not unwrapped | `useTokenIntel.ts`, `crypto-scan.ts`, `token.js` response shape | Normalize to flat TokenPayload |
| BUG-005 | S1 | DB | `oxw_record_trade` may leak by signature | `20260725190100_oxw_rls_and_rpcs.sql` | Ownership check before return |
| BUG-006 | S2 | Social | `/community` links 404 | SocialLayout, CommunitiesHub, SocialHome, ModerationAdmin | Point to `/community-classic` or add route |
| BUG-007 | S2 | Trading | Terminal is Phantom deep-link only | `TradingTerminal.tsx` | Use `/api/ogdex/trade` builder |
| BUG-008 | S2 | Trading | TerminalHome mock data | `TerminalHome.tsx` | Live screener or demo badge |
| BUG-009 | S2 | Launch | TerminalLaunch alert stub | `TerminalLaunch.tsx` | Wire launchpad or disable CTA |
| BUG-010 | S2 | Launch | Anti-vamp fail-open on source errors | `anti-vamp-check.ts` | Fail closed if all sources fail |
| BUG-011 | S2 | DB | Private community/lobby RLS too open | oxw RLS policies | Membership-scoped policies + join RPCs |
| BUG-012 | S2 | Social | `/hq` localStorage presented as live | `localSocialStore.ts` | Backend wire or Demo badge |
| BUG-013 | S3 | UX | Lazy `fallback={null}` blank screens | `App.tsx` | Shared skeleton |
| BUG-014 | S3 | API | OGDex nested path `.pop()` risk | `ogdex.js` | First-segment dispatch |
| BUG-015 | S3 | Trade | Sim fail-open returns unverified tx | `ogdex/_routes/trade.js` | Fail closed if sim unknown |
| BUG-016 | S3 | API | HTTP 200 with `{ok:false}` | many ogdex routes | Proper 4xx/5xx |
| BUG-017 | S3 | Router | Catch-all masks broken links | `App.tsx` `/:toolSlug` | Narrow catch-all |
| BUG-018 | S3 | A11y | Icon buttons missing labels | TradingTerminal controls | aria-label |
| BUG-019 | S3 | DevOps | No CI workflows | `.github` missing | Add Actions |
| BUG-020 | S3 | DevOps | pnpm install / npm build mismatch | `vercel.json` | Standardize pnpm |
| BUG-021 | S4 | Perf | Heavy god components | SocialHub, Communities, XSocialApp | Split modules over time |
| BUG-022 | S4 | Dup | Twin `og.ts` libs | `web/src/lib/og.ts`, `ogdex/src/lib/og.ts` | Shared package |

## Verification commands

```bash
bash scripts/qa/run-smoke.sh
cd web && npm test -- --run src/crypto/risk/composeRisk.test.ts
# After DTO fixes, add:
# npm test -- --run src/crypto/api/client.contract.test.ts
```
