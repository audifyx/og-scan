# OrbitX Social + Community Growth

Discord × X × Twitch × Steam energy for traders, gamers, and communities.

## Surface: `/hq`

| Route | Purpose |
|-------|---------|
| `/hq` | Social HQ home |
| `/hq/feed` | Posts, comments, likes, following |
| `/hq/communities` | Communities & groups |
| `/hq/trading` | Token / holder / alpha trading rooms + trader rankings |
| `/hq/voice` | Live voice spaces (trading, gaming, creator) |
| `/hq/growth` | Referrals, XP, daily check-in |
| `/hq/leaderboards` | XP / followers / reputation |
| `/hq/creators` | Creator program |
| `/hq/notifications` | Alerts |
| `/hq/profile/:userId?` | User profiles |
| `/hq/admin` | Moderation dashboard |
| `/hq/invite?ref=` | Referral landing |

Aliases: `/social`, `/orbitx-social`, `/social-hub` → `/hq`.

## Architecture

- **UI:** `web/src/social/**`
- **Growth engine:** `growth/xp.ts`, `referrals.ts`, `leaderboard.ts` (+ vitest)
- **Client graph store:** `store/localSocialStore.ts` (seeded demo + localStorage; anti-spam on compose)
- **Existing production apps** remain linked: `/community` (XSocialApp), `/community-classic`, `/voice-rooms`, `/spaces`, admin Community Management

## Ownership

Social + Growth Team owns HQ, social graph UX, growth loops, voice/community orchestration, and moderation surfaces.
Does **not** own crypto trading terminal, City meshes, or gaming combat systems.
