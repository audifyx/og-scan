# OrbitX ChatGPT Mini App — UI Contract (v1 draft)

Shared contract for the `ui://` widget set. Published from `web/api/orbitx/_ui/`.

## Resources

| Resource URI | File | Widget |
|---|---|---|
| `ui://widget/orbitx-auth.html` | `web/api/orbitx/_ui/orbitx-auth.html` | Wallet connect / sign-in (Builder A) |

Each tool that surfaces a widget links it via `_meta.ui.resourceUri` on the
tool definition.

## Host bridge — `window.OrbitX`

The ChatGPT Apps SDK host injects this into the iframe. All widgets use it;
**no widget may invent its own transport.**

```js
// Invoke an MCP tool. Resolves with the tool's parsed result object.
window.OrbitX.callTool(name: string, args: object) => Promise<object>

// Optional: ask the host to open a URL outside the iframe (new tab).
window.OrbitX.openUrl(url: string) => void
```

Result shape: the parsed JSON the tool returned. Widgets must tolerate
`{text: "..."}` wrappers (non-JSON tool output) and probe several key names
for URLs / identity fields — the server's exact field names may evolve.

## Standalone fallback

When `window.OrbitX.callTool` is absent (opened directly in a browser),
widgets POST MCP JSON-RPC to `https://www.orbitx.world/api/mcp`:

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"<tool>","arguments":{}}}
```

and unwrap `result.structuredContent` or `result.content[].text` (JSON-parsed
when possible). A small "standalone preview" note is shown in this mode.

## Auth model (server-verified)

1. `orbitx_auth_link` → returns a clickable auth URL (probe keys:
   `authUrl`, `auth_url`, `authLink`, `url`, `link`, `redirectUrl`).
2. User completes wallet sign-in in the browser → receives an `authCode`.
3. `orbitx_auth_status` with `{authCode}` activates/links it.
4. Pass `authCode` on **every** subsequent tool call.
5. `orbitx_whoami` with `{authCode}` returns the linked identity
   (probe `wallet`/`address`/`pubkey`, `handle`/`username`/`name`, `tier`/`plan`/`level`).
6. Reads work without auth; trades/launches/writes need it.

Widgets persist the authCode in `localStorage` (`orbitx.authCode`) and
re-validate with `orbitx_whoami` on boot. Disconnect = clear storage.

## Cross-widget auth events (CustomEvent on window)

- `orbitx-auth-changed` — `{connected: bool, identity?: {wallet, handle, tier}}`
- `orbitx-auth-error` — `{message}` — any widget that hits an auth failure
  must dispatch this so the auth widget can surface its re-connect state.
- `window.OrbitXAuth.showAuthError(msg)` — host/sibling entry point that
  forces the auth widget into its expired/error state.

## Error convention

Auth failures are detected client-side by matching
`/auth|unauthor|expir|invalid code|session|forbidden|not (linked|connected|signed)|sign.?in|token|credential/i`
against the error message. On a match while signed in, widgets route to the
re-connect state — never a dead error screen.

## Security rules (all widgets)

- NEVER render, log, or copy bearer tokens, private keys, or secrets.
- The authCode is user-pasted, held in memory + localStorage, passed only as
  a tool argument — never painted into the DOM, never in URLs.
- Inputs: `autocomplete="off" autocapitalize="off" spellcheck="false"`.

## Theme tokens (OrbitX dark)

```css
--bg:#07080e; --bg2:#0b0e16; --txt:#e8eaf2; --muted:#9aa0b8; --faint:#5c6178;
--neon:#34d399; --teal:#2dd4bf; --gold:#fbbf24; --danger:#f87171;
```

Headings: `Space Grotesk`; mono: `JetBrains Mono`. Mobile-first, safe-area
insets (`env(safe-area-inset-*)`), 54px+ touch targets, skeleton shimmer on
every async step, `prefers-reduced-motion` respected.

---

## Server contract (Builder D) — Apps SDK plumbing

### Resources (all five, final URIs)

| Resource URI | File | Widget | Tool→UI map |
|---|---|---|---|
| `ui://widget/orbitx-auth.html` | `orbitx-auth.html` | Connect / auth / whoami | `orbitx_auth_link`, `orbitx_auth_status`, `orbitx_whoami` |
| `ui://widget/orbitx-trade.html` | `orbitx-trade.html` | Quote → confirm → trade | `orbitx_trade_quote`, `orbitx_quote_slip10_auto`, `orbitx_app_buy`, `orbitx_app_sell`, `orbitx_swap` |
| `ui://widget/orbitx-token.html` | `orbitx-token.html` | Scan / screeners / forensics / chart | `orbitx_crypto_scan`, `orbitx_screen_tokens`, `orbitx_screen_trending_1m_solana`, `orbitx_adv_forensics_solana`, `orbitx_get_forensics`, `orbitx_dex_chart` |
| `ui://widget/orbitx-wallet.html` | `orbitx-wallet.html` | Balances / PnL / swaps | `orbitx_get_wallet`, `orbitx_adv_wallet_pnl`, `orbitx_adv_wallet_swaps`, `orbitx_app_pnl`, `orbitx_get_swaps` |
| `ui://widget/orbitx-media.html` | `orbitx-media.html` | Image gen / X post / launch | `orbitx_generate_image` ✅ schema OK, `orbitx_x_post` ✅ schema OK, `orbitx_app_launch` ✅ schema OK |

### Tool `_meta` (verified against current Apps SDK docs — set on every UI-bound tool)

```json
"_meta": {
  "ui": { "resourceUri": "ui://widget/<name>.html" },
  "openai/outputTemplate": "ui://widget/<name>.html"
}
```

`ui.resourceUri` = MCP Apps spec key; `openai/outputTemplate` = ChatGPT-specific key. Both are set — each host reads its own.

### MCP surface (all live on `https://www.orbitx.world/api/mcp`)

- `initialize` → `capabilities: { "tools": {}, "resources": {} }`
- `resources/list` → `{ resources: [{ uri, name, title, description, mimeType: "text/html;profile=mcp-app" }] }` (5 entries)
- `resources/read` with `params.uri` → `{ contents: [{ uri, name, title, mimeType, text: "<html>" }] }`; unknown URI → JSON-RPC `-32602`
- `tools/call` results are **always** wrapped as `{ content: [{type:"text", text}], structuredContent, isError? }` — widgets get clean `structuredContent` and other clients keep working unchanged. (No result-shape changes were needed; the server already wraps.)

### Widget data bootstrap (official path — use this in addition to `postMessage`)

ChatGPT injects the tool output that opened the widget at `window.openai.toolOutput`
(may arrive late → listen for the `openai:set_globals` event, `e.detail.globals.toolOutput`),
and widgets call further tools via `window.openai.callTool(name, args)` when present.
Theme: `window.openai.theme` (`"light"`/`"dark"`). External links: `window.openai.openExternal({href})`.
Keep the `postMessage` JSON-RPC fallback and the standalone `POST https://www.orbitx.world/api/mcp` mode working.
