# OrbitX QA Swarm — 10 Elite Agents

Mission: continuous bug checks, testing, error triage, and regression prevention across the full OrbitX platform.

These agents are **trained** on `docs/ORBITX_PLATFORM.md` and team docs. Always load that map before acting.

## Swarm roster

| # | Codename | Focus | Agent file |
|---|----------|-------|------------|
| 01 | **AEGIS** | QA Lead / triage commander | `.cursor/agents/qa/01-aegis.md` |
| 02 | **FORGE** | Backend / API / RLS / workers | `.cursor/agents/qa/02-forge.md` |
| 03 | **NEON** | Frontend OS `/os` UX & routing | `.cursor/agents/qa/03-neon.md` |
| 04 | **RAID** | Gaming `/play` progression & multiplayer | `.cursor/agents/qa/04-raid.md` |
| 05 | **ORACLE** | Crypto `/intel` risk & trading | `.cursor/agents/qa/05-oracle.md` |
| 06 | **PULSE** | Social `/hq` growth & moderation | `.cursor/agents/qa/06-pulse.md` |
| 07 | **ATLAS** | City `/Orbitxcity` 3D smoke | `.cursor/agents/qa/07-atlas.md` |
| 08 | **WARDEN** | Security, secrets, abuse | `.cursor/agents/qa/08-warden.md` |
| 09 | **CIRCUIT** | CI, Vitest, build, regressions | `.cursor/agents/qa/09-circuit.md` |
| 10 | **SCRIBE** | Error intel, flaky hunt, reports | `.cursor/agents/qa/10-scribe.md` |

## How to run the swarm

1. Start with **AEGIS** — classify the issue, assign owners.
2. Spawn specialists in parallel when domains differ.
3. **CIRCUIT** always re-runs unit/smoke after fixes.
4. **SCRIBE** writes the final defect report.

### Quick smoke (local)

```bash
bash scripts/qa/run-smoke.sh
```

### Unit packs

```bash
cd web && npm test -- --run \
  src/gaming/systems/progression.test.ts \
  src/crypto/risk/composeRisk.test.ts \
  src/social/growth/growth.test.ts \
  src/qa/routeManifest.test.ts
```

## Operating doctrine (make them the smartest)

1. **Map first** — read `docs/ORBITX_PLATFORM.md` before touching code.
2. **Ownership** — never “fix” outside your domain without AEGIS approval.
3. **Evidence** — every bug needs: route/file, repro steps, expected vs actual, severity.
4. **No fake green** — do not delete failing tests to pass CI; fix or quarantine with reason.
5. **Compose, don’t rewrite** — prefer wiring existing DEX/Social/City systems over greenfield.
6. **Safety** — never invent secrets; never ship exploit PoCs; follow repo security rules.
7. **Stack truth** — Vite SPA + Supabase + Solana; do not assume Next.js App Router.

## Severity scale

- **S0** — data loss, auth bypass, funds at risk
- **S1** — primary route crash / blank screen
- **S2** — feature broken with workaround
- **S3** — visual/copy polish
- **S4** — docs/debt
