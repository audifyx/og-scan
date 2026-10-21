/**
 * Branded rich UI cards for MCP responses.
 * Renders beautifully in ChatGPT, Claude, Grok, and Muse.
 * Uses OrbitX X profile branding.
 */

const BRAND = {
  avatar: "https://www.orbitx.world/orbitx-x-avatar.jpg",
  banner: "https://www.orbitx.world/orbitx-x-banner.jpg",
  gold: "#e8b84a",
  bg: "#050508",
  cardBg: "#0f0f14",
};

/** Escape user-controlled values before they enter card HTML (2026-10-21).
 * Token names/symbols are attacker-controlled (anyone can launch a token
 * with an arbitrary name) — raw interpolation here was stored markup
 * injection into every MCP client that renders these cards. */
export function esc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cardStyle() {
  return `background:${BRAND.cardBg};border-radius:20px;padding:20px;margin:12px 0;border:1px solid ${BRAND.gold}22;font-family:-apple-system,system-ui,sans-serif;color:#fff;max-width:480px;`;
}

function headerHtml(title, subtitle) {
  return `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
      <img src="${BRAND.avatar}" style="width:40px;height:40px;border-radius:50%;border:2px solid ${BRAND.gold}44;" />
      <div>
        <div style="font-weight:700;font-size:16px;">${esc(title)}</div>
        ${subtitle ? `<div style="font-size:12px;color:rgba(255,255,255,0.55);">${esc(subtitle)}</div>` : ""}
      </div>
      <div style="margin-left:auto;font-size:11px;font-weight:700;color:${BRAND.gold};letter-spacing:0.1em;">ORBITX</div>
    </div>`;
}

export function launchCard(token) {
  const html = `
    <div style="${cardStyle()}">
      ${headerHtml(`🚀 ${token.name} launched!`, `$${token.symbol} on ${token.launchpad}`)}
      <div style="background:rgba(255,255,255,0.04);border-radius:14px;padding:14px;margin-bottom:12px;">
        <div style="font-size:13px;color:rgba(255,255,255,0.6);">Contract</div>
        <div style="font-family:monospace;font-size:12px;word-break:break-all;color:#fff;">${esc(token.mint)}</div>
        ${token.vanity ? `<div style="font-size:12px;color:${BRAND.gold};margin-top:6px;">✨ Vanity mint: ${esc(token.vanity)}</div>` : ""}
      </div>
      <div style="display:flex;gap:8px;">
        <a href="${esc(token.explorer)}" style="flex:1;text-align:center;background:${BRAND.gold};color:#000;font-weight:700;font-size:14px;padding:10px;border-radius:999px;text-decoration:none;">View</a>
        <a href="https://www.orbitx.world/launchpad" style="flex:1;text-align:center;background:rgba(255,255,255,0.08);color:#fff;font-weight:700;font-size:14px;padding:10px;border-radius:999px;text-decoration:none;">Open Pad</a>
      </div>
    </div>`;
  return html;
}

export function tokenCard(token) {
  const changeColor = (token.change_24h || 0) >= 0 ? "#4ade80" : "#f87171";
  const changeSign = (token.change_24h || 0) >= 0 ? "+" : "";
  const html = `
    <div style="${cardStyle()}">
      ${headerHtml(token.name, `$${token.symbol}`)}
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">
        ${token.image ? `<img src="${esc(token.image)}" style="width:48px;height:48px;border-radius:50%;" />` : ""}
        <div>
          <div style="font-size:22px;font-weight:800;">${token.price_usd != null ? "$" + token.price_usd.toFixed(6) : "—"}</div>
          <div style="font-size:13px;color:${changeColor};font-weight:600;">${changeSign}${(token.change_24h || 0).toFixed(1)}% <span style="color:rgba(255,255,255,0.45);">MCap ${token.market_cap != null ? "$" + (token.market_cap >= 1e6 ? (token.market_cap / 1e6).toFixed(2) + "M" : (token.market_cap / 1e3).toFixed(1) + "K") : "—"}</span></div>
        </div>
      </div>
      ${token.graduation_pct != null ? `
      <div style="margin-bottom:12px;">
        <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:4px;">Bonding curve ${token.graduation_pct.toFixed(0)}%</div>
        <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:999px;overflow:hidden;">
          <div style="height:100%;width:${Math.min(100, token.graduation_pct)}%;background:${BRAND.gold};border-radius:999px;"></div>
        </div>
      </div>` : ""}
      <div style="display:flex;gap:8px;">
        <a href="https://dexscreener.com/solana/${esc(token.mint)}" style="flex:1;text-align:center;background:${BRAND.gold};color:#000;font-weight:700;font-size:14px;padding:10px;border-radius:999px;text-decoration:none;">Chart</a>
        <a href="https://pump.fun/${esc(token.mint)}" style="flex:1;text-align:center;background:rgba(255,255,255,0.08);color:#fff;font-weight:700;font-size:14px;padding:10px;border-radius:999px;text-decoration:none;">Pump.fun</a>
      </div>
    </div>`;
  return html;
}

export function walletCard(wallets) {
  const html = `
    <div style="${cardStyle()}">
      ${headerHtml("💰 Your Wallets", "Same as the web pad")}
      ${wallets.solana ? `
      <div style="background:rgba(255,255,255,0.04);border-radius:14px;padding:12px;margin-bottom:8px;">
        <div style="font-size:12px;color:${BRAND.gold};font-weight:700;">◎ SOLANA</div>
        <div style="font-family:monospace;font-size:11px;word-break:break-all;color:rgba(255,255,255,0.75);margin-top:4px;">${esc(wallets.solana)}</div>
      </div>` : ""}
      ${wallets.robinhood ? `
      <div style="background:rgba(255,255,255,0.04);border-radius:14px;padding:12px;">
        <div style="font-size:12px;color:${BRAND.gold};font-weight:700;">⬡ ROBINHOOD CHAIN</div>
        <div style="font-family:monospace;font-size:11px;word-break:break-all;color:rgba(255,255,255,0.75);margin-top:4px;">${esc(wallets.robinhood)}</div>
      </div>` : ""}
    </div>`;
  return html;
}

export function pnlCard(pnl) {
  const color = pnl.total_pnl_usd >= 0 ? "#4ade80" : "#f87171";
  const sign = pnl.total_pnl_usd >= 0 ? "+" : "";
  const html = `
    <div style="${cardStyle()}">
      ${headerHtml("📊 Your PnL", "Across all launches")}
      <div style="text-align:center;padding:16px 0;">
        <div style="font-size:36px;font-weight:800;color:${color};">${sign}$${Math.abs(pnl.total_pnl_usd).toFixed(2)}</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.55);margin-top:4px;">${pnl.wins} wins · ${pnl.losses} losses</div>
      </div>
      <div style="text-align:center;font-size:11px;color:rgba(255,255,255,0.35);">Share your PnL card</div>
    </div>`;
  return html;
}
