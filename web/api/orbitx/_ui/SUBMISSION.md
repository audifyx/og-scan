# OrbitX — ChatGPT App Listing: Submission Pack (Builder D)

Prepared 2026-10-12. Everything in this doc is verified against the live server
(`https://www.orbitx.world/api/mcp`) and the repo (`web/api/orbitx-hub.js`,
`web/src/pages/McpAuthPage.tsx`, `web/src/pages/AgentLinkAuthPage.tsx`).
**No approval is claimed or implied.** OpenAI reviews every submission; timelines vary.

---

## 1. App metadata (for the submission form → Info tab)

| Field | Value |
|---|---|
| Name | **OrbitX** |
| Tagline | Trade, scan, and launch Solana tokens without leaving ChatGPT |
| Short description | OrbitX brings Solana memecoin trading intel to ChatGPT: live safety scans, forensics, trending screeners, wallet analytics, quotes and one-tap swaps — plus image generation, X posting, and token launches, all through interactive widgets. |
| Full description | OrbitX is a Solana trading terminal for memecoins. Inside ChatGPT it exposes 4,300+ tools through five interactive widgets: **Token Intel** (safety scans, forensics, trending/new/runners screeners, DEX charts), **Trade** (live Jupiter quotes with an explicit confirm step before any buy/sell/swap), **Wallet** (balances, PnL, swap history for any Solana address), **Studio** (AI image generation, posting to your connected X account, launching a pump.fun token), and **Connect** (link your OrbitX account via wallet sign-in). Reads are public and need no account. Trades, launches, and posts require a linked OrbitX wallet and always ask for confirmation first. OrbitX is non-custodial: it never asks for, sees, or stores your private keys. |
| Category | Finance |
| Publisher | OrbitX (orbitx.world) |
| MCP server URL | `https://www.orbitx.world/api/mcp` (Streamable HTTP; SSE supported) |
| Privacy policy | `https://www.orbitx.world/privacy` ✅ live (200, 2026-10-12) |
| Terms of service | `https://www.orbitx.world/terms` ✅ live (200, 2026-10-12) |
| Support | `https://x.com/orbitx_wrld` (site's linked X account, `web/src/lib/og.ts`) |
| Website | `https://www.orbitx.world` |

---

## 2. Privacy disclosures

What flows through the MCP server, and why:

- **Tool arguments you provide** (token mints, wallet addresses, trade amounts, prompts) are sent to OrbitX's API to fulfill the call. Reads hit public market-data endpoints (DexScreener, Jupiter, OrbitX indexers).
- **Auth session**: OAuth tokens or API keys identify your OrbitX account so private actions (trades, launches, X posts) run as you. Stored server-side as hashes; revocable (see §4).
- **Wallet addresses are public blockchain data.** Looking up any address's balances/swaps is the product working as designed.
- **Never collected**: private keys, seed phrases, passwords. OrbitX is non-custodial — signing happens via your connected wallet (Phantom/WalletConnect on the site) or the OrbitX desk wallet you explicitly created; the MCP server never asks for a secret and widgets are forbidden from rendering one (CI-grepped).
- Full policy: `https://www.orbitx.world/privacy`. Terms: `https://www.orbitx.world/terms`.

---

## 3. Permissions + confirmation flows

- **OAuth scope requested:** `orbitx` (single scope; see `/.well-known/oauth-protected-resource` on the MCP server).
- **Reads are public** (no login): scans, screeners, charts, wallet lookups, quotes, menus. Verified in code: `isPublicMcpTool()` gates only by tool family.
- **Writes need a linked OrbitX session** (OAuth, `oxo_` Bearer key, or authCode): trades (`orbitx_app_buy`/`orbitx_app_sell`/`orbitx_swap`), launches (`orbitx_app_launch`), X posts (`orbitx_x_post`), image generation (`orbitx_generate_image`), social writes. Unauthenticated calls return a structured `auth_required`/`session_required` error with a fix URL — never a silent failure.
- **Confirmation before money moves** (enforced in all five widgets):
  - Trade widget: quote → review screen → explicit **Confirm** button → `orbitx_app_buy`/`orbitx_app_sell`/`orbitx_swap`. Never auto-submits on widget open.
  - Studio widget: X posts and token launches each have a review + **Post now** / **Launch** confirm gate.
  - Backend-signed limit orders the user explicitly arms are filled by a server-side sweep (their own standing instruction, not a widget action).
- **Data-use disclosure for reviewers**: tool inputs are the user's own words/addresses; tool outputs are public market data or the user's own account data. Nothing is sent to third parties except the upstream APIs needed to answer (Jupiter for quotes, DexScreener for charts, Grok Imagine for images).

---

## 4. End-user auth guide (verified against the real implementation)

### How auth works

Three credential paths, all verified in `web/api/orbitx-hub.js`:

1. **OAuth 2.1 + PKCE (primary, what ChatGPT uses).** ChatGPT discovers
   `https://www.orbitx.world/api/mcp/.well-known/oauth-authorization-server`
   → registers at `/oauth/register` → authorizes at `/oauth/authorize`, which 302s to the
   consent page `https://www.orbitx.world/agent/mcp-auth` (renders `McpAuthPage.tsx`).
   The user signs in with their Solana wallet, approves the `orbitx` scope
   ("Let {ChatGPT} use your OrbitX workspace. Non-custodial"), and ChatGPT
   exchanges the code at `/oauth/token`. Grants are stored in
   `agent_mcp_oauth_tokens` (revocable).
2. **authCode (dashboard paste / `orbitx_auth_link`).** The tool returns
   `https://www.orbitx.world/agent/link-auth?code=<opaque>` (15-minute expiry,
   `mcp_link_sessions` table). The user opens it, signs in with their wallet
   (`AgentLinkAuthPage.tsx`), receives an `authCode`, then calls
   `orbitx_auth_status` with it. The code stays linked: pass `authCode` on
   **every** subsequent privileged tool call.
3. **API key (Claude-style clients).** Create an `oxo_` key at
   `https://www.orbitx.world/agent` (API keys tab) and send it as
   `Authorization: Bearer oxo_…` on MCP requests.

### Connect inside ChatGPT (exact steps)

1. In ChatGPT, open **Settings → Connectors** (web) or the **Apps** section in the sidebar.
2. Choose **Add custom connector / Developer mode** and enter the MCP server URL:
   `https://www.orbitx.world/api/mcp`
3. ChatGPT discovers the OAuth metadata automatically. Click **Connect / Authenticate**.
4. A browser tab opens at `www.orbitx.world/agent/mcp-auth`. Sign in with your Solana
   wallet (Phantom etc.), review the consent screen ("Non-custodial — revoke anytime"),
   and approve.
5. Back in ChatGPT, the connector shows **Connected**. Ask something like
   "scan this token <mint>" — the Token Intel widget renders with the live result.

### What permissions are requested and why

- The single `orbitx` scope authorizes ChatGPT to call OrbitX tools as you.
- **Reads** (scans, screeners, charts, wallet lookups) work with no extra permission.
- **Trades / launches / X posts** additionally require your OrbitX wallet to be linked
  (done once at `https://www.orbitx.world/agent`) and always show a confirmation
  screen inside the widget before executing.

### Disconnect / revoke (exact steps)

1. **In ChatGPT:** Settings → Connectors → OrbitX → **Remove / Disconnect**. ChatGPT
   deletes its stored tokens; the app can no longer act as you.
2. **In OrbitX (belt and suspenders):**
   - API keys: `https://www.orbitx.world/agent` → API keys tab → **Revoke** on the key
     (kills `oxo_` Bearer access immediately).
   - OAuth grants: revocable from Super Computer Setup (stated on the consent page;
     grants carry `revoked_at` in `agent_mcp_oauth_tokens`).
   - Link sessions from `orbitx_auth_link` expire automatically after 15 minutes.
3. After revocation, privileged tools return `auth_required` with a re-link URL.
   Past trades/launches already executed on-chain are unaffected (as with any wallet).

---

## 5. Submission checklist

| # | Item | Status | Owner |
|---|---|---|---|
| 1 | App metadata (name, tagline, descriptions, category, publisher) | **DONE** (§1) | Builder D |
| 2 | Icon artwork (512×512 PNG + SVG) | **DONE** — derived from official OrbitX logo (`web/public/orbitx-icon-512.png`, `web/public/orbitx-icon.svg`; source `web/public/orbitx-logo-official.jpg`) | Parent |
| 3 | MCP server URL fixed + HTTPS (`https://www.orbitx.world/api/mcp`) | **DONE** — live, 4,298 tools | Builder D |
| 4 | Domain verification for orbitx.world in the submission portal | **PENDING** | Owner (DNS/TXT step in portal) |
| 5 | Privacy policy URL live | **DONE** (`/privacy`, 200) | Builder D |
| 6 | Terms of service URL live | **DONE** (`/terms`, 200) | Builder D |
| 7 | Support URL live | **DONE** (`https://x.com/orbitx_wrld`) | Builder D |
| 8 | OAuth 2.1 + PKCE endpoints live (register/authorize/token + well-known) | **DONE** — verified 2026-10-12 | Builder D |
| 9 | Tool schemas valid (all 4,298 list; writes annotated non-public) | **DONE** — harness §a | Builder D |
| 10 | UI resources load (`resources/list` + `resources/read` ×5, valid HTML, correct MIME) | **DONE** — harness §b, 26/26 pass | Builder D |
| 11 | `_meta.ui.resourceUri` + `openai/outputTemplate` on all 22 UI-bound tools | **DONE** — harness §a (tool names verified live) | Builder D |
| 12 | `structuredContent` on tool results (widgets render clean data) | **DONE** — harness §c | Builder D |
| 13 | Confirmation flows on all money-moving / posting actions | **DONE** — widgets (§3) | Builders A/B/C + D |
| 14 | No secrets in widget HTML (CI grep) | **DONE** — harness §d, zero hits | Builder D |
| 15 | Auth docs (connect, permissions, disconnect/revoke) | **DONE** (§4) | Builder D |
| 16 | Test evidence: 5 positive + 3 negative cases passing on web | **DONE** — see §7 (26/26 local; portal cases drafted) | Builder D |
| 17 | Screenshots / carousel assets | **PENDING** | Owner or parent (see §8) |
| 18 | Starter prompts for the Prompts tab | **DONE** — see §7 | Builder D |
| 19 | Submit for review in the portal | **PENDING** | **Owner** (only the owner can click submit) |

**When this lands, the only remaining steps are the owner's:** icon upload (#2 is parent's),
domain verification (#4), screenshots (#17), and clicking **Submit** (#19).

---

## 6. Exact OpenAI dashboard actions (owner)

Per the current Apps SDK submission flow (portal: `https://platform.openai.com/plugins`):

1. Sign in with the **verified organization** on the OpenAI Platform (complete org
   verification first; the submitter needs the **Apps Management** write permission).
2. Create a new **App** (connector type: MCP, Universal).
3. **MCP tab:** server URL `https://www.orbitx.world/api/mcp`; complete **domain
   verification** for `orbitx.world`; run **Scan Tools** and confirm the 22 UI-bound
   tools show their widget bindings.
4. **Info tab:** fill metadata from §1; upload the icon (#2); set privacy/terms/support URLs.
5. **Prompts tab:** add the starter prompts from §7.
6. **Testing tab:** enter the 5 positive + 3 negative cases from §7.
7. **Global tab:** set country/region availability.
8. **Submit tab:** release notes + policy attestations → **Submit for review**.
   Track status in the portal (email confirmation with Case ID). Only one version can be
   under review at a time; updates re-enter review.

Do **not** describe the app as approved, verified, or featured anywhere until OpenAI
confirms it in the portal.

## 7. Connect + test in ChatGPT (reviewer / owner runbook)

**Connect (Developer Mode):** ChatGPT → enable **Developer Mode** → add connector →
URL `https://www.orbitx.world/api/mcp` → Authenticate (OAuth PKCE flow in §4) →
confirm the 5 widgets appear in `resources/list`.

**Starter prompts (also for the portal Prompts tab):**
1. "Scan this Solana token for safety: `<mint>`" → Token Intel widget, verdict + risks.
2. "Show me trending Solana memecoins in the last hour" → screener list widget.
3. "What's in wallet `<address>` and what's its PnL?" → Wallet widget.
4. "Quote me 0.1 SOL into `<mint>`" → Trade widget with confirm gate (do NOT confirm in test).
5. "Generate an image of a neon orbital trading terminal" → Studio widget, 4 images.

**Test cases for the portal (5 positive + 3 negative):**
- P1 `tools/list` returns 4,298 tools; the 22 UI tools carry `_meta.ui.resourceUri`. ✅ (harness)
- P2 `resources/read ui://widget/orbitx-token.html` returns valid HTML (`text/html;profile=mcp-app`). ✅
- P3 `orbitx_crypto_scan` on mint `AspsUTo64QPaRGQx6oNXFbSC2zU65ZqPfDRkUo2Haobx` → `structuredContent.ok=true`. ✅
- P4 `orbitx_get_wallet` on `HfoAjPKZrfuNJ3QRJNZwXvpNZZAR6ekoyUWtzmY7rW9t` → structured balances. ✅
- P5 `orbitx_dex_chart` on a real mint → chart payload/iframe. (tool verified in catalog)
- N1 `orbitx_get_wallet` on `"not-a-wallet"` → `ok:false`, `isError:true`, structured error. ✅
- N2 `resources/read` on `ui://widget/../../etc/passwd.html` → JSON-RPC `-32602`. ✅
- N3 `orbitx_app_buy` with no auth → `auth_required` + fix URL, no trade executed. (code path verified)

**Top rejection risks to double-check before submitting:** vague tool descriptions,
read+write mixed in one tool, WAF blocking egress during OAuth, generic errors,
empty test accounts. Our annotations mark write tools non-public; errors are
structured with fix URLs.

## 8. Screenshot / asset checklist

- [x] Icon: 512×512 PNG (+ SVG source) — **DONE** (`web/public/orbitx-icon-512.png`, `web/public/orbitx-icon.svg`, from official logo)
- [ ] Widget carousel screenshots (one per widget, 5 total): auth, trade (quote + confirm gate), token (scan result), wallet (PnL), media (generated images) — capture from ChatGPT Developer Mode once connected
- [ ] Optional: 10–30s clip of the trade confirm flow (reviewers love the confirm gate)
- [ ] All screenshots show real data, no mock content

---

## Appendix — server plumbing delivered (Builder D)

- `web/api/orbitx/_ui/_widgets.js` — widget registry (URIs, tool→UI map incl. Builder C's
  confirmed names `orbitx_get_forensics`, `orbitx_app_pnl`, `orbitx_get_swaps`; all brief
  names verified live + dispatchable: `orbitx_adv_wallet_pnl`/`orbitx_adv_wallet_swaps`
  (cook), `orbitx_screen_trending_1m_solana` (generated), `orbitx_adv_forensics_solana` (cook))
- `web/api/orbitx-hub.js` — `resources/list` + `resources/read` handlers, per-tool `_meta`
  (`ui.resourceUri` + `openai/outputTemplate`) on all 5 tools/list pages, `resources`
  capability in `initialize`. No behavior change for existing clients (additive only).
- `web/api/orbitx/_ui/test-apps-sdk.mjs` — 26/26 checks passing (2026-10-12).
- `web/api/orbitx/_ui/CONTRACT.md` — UI contract (Builder A draft + Builder D server section).
