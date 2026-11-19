/**
 * OG DEX Embeddable Token Widget
 * Usage: <script src="https://ogscan.fun/widget.js" data-mint="<ADDRESS>" data-chain="solana"></script>
 *
 * Optional attributes:
 *   data-mint        — token mint / contract address (required)
 *   data-chain       — chain slug (default: solana)
 *   data-theme       — "dark" (default) | "light"
 *   data-size        — "sm" | "md" (default) | "lg"
 *   data-show-chart  — "true" | "false" (default: false)
 *   data-link        — "true" (default) | "false" — wrap in a link to OG DEX token page
 */

(function () {
  "use strict";

  const BASE = "https://ogscan.fun";
  const API  = "https://orbitx-platform-api.onrender.com/api/ogdex/token"; // Render API (Pages is static-only; BASE stays the site for links)

  const SIZES = {
    sm: { width: "260px", fontSize: "12px", padding: "10px 12px" },
    md: { width: "320px", fontSize: "13px", padding: "12px 16px" },
    lg: { width: "400px", fontSize: "14px", padding: "14px 18px" },
  };

  const THEMES = {
    dark: {
      bg: "#0e0f14",
      border: "rgba(255,255,255,0.06)",
      text: "#e8e9ef",
      muted: "#8b8fa8",
      green: "#16c784",
      red: "#ea3943",
      accent: "#7c5cfc",
      card: "#14151c",
    },
    light: {
      bg: "#ffffff",
      border: "rgba(0,0,0,0.08)",
      text: "#111216",
      muted: "#5a5c72",
      green: "#0d9f6e",
      red: "#c0392b",
      accent: "#5c3fcc",
      card: "#f4f5f7",
    },
  };

  function fmtNum(n) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return "$" + (n / 1e3).toFixed(1) + "K";
    if (n >= 1) return "$" + n.toFixed(4);
    return "$" + n.toPrecision(4);
  }

  function fmtPct(n) {
    if (n === null || n === undefined || isNaN(n)) return "";
    const sign = n >= 0 ? "+" : "";
    return sign + n.toFixed(2) + "%";
  }

  function shortAddr(addr) {
    if (!addr) return "";
    return addr.slice(0, 4) + "…" + addr.slice(-4);
  }

  function createWidget(script) {
    const mint       = script.getAttribute("data-mint");
    const chain      = script.getAttribute("data-chain") || "solana";
    const themeKey   = script.getAttribute("data-theme") || "dark";
    const sizeKey    = script.getAttribute("data-size") || "md";
    const showChart  = script.getAttribute("data-show-chart") === "true";
    const addLink    = script.getAttribute("data-link") !== "false";

    if (!mint) return;

    const theme = THEMES[themeKey] || THEMES.dark;
    const size  = SIZES[sizeKey] || SIZES.md;

    // Build container
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-og-widget", "1");
    Object.assign(wrapper.style, {
      display: "inline-block",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      width: size.width,
      maxWidth: "100%",
    });

    const card = document.createElement("div");
    Object.assign(card.style, {
      background: theme.bg,
      border: `1px solid ${theme.border}`,
      borderRadius: "12px",
      padding: size.padding,
      fontSize: size.fontSize,
      color: theme.text,
      lineHeight: "1.4",
      boxSizing: "border-box",
    });

    // Loading state
    card.innerHTML = `<div style="text-align:center;padding:16px;color:${theme.muted}">Loading…</div>`;
    wrapper.appendChild(card);

    // Insert after script tag
    script.parentNode.insertBefore(wrapper, script.nextSibling);

    // Fetch data
    fetch(`${API}?mint=${mint}&chain=${chain}`)
      .then((r) => r.json())
      .then((d) => {
        const t    = d.token || d;
        const name = t.name || t.symbol || shortAddr(mint);
        const sym  = t.symbol || "";
        const price = t.price || t.priceUsd || 0;
        const mc    = t.marketCap || t.fdv || null;
        const vol   = t.volume24h || null;
        const chg1h = t.priceChange1h || t.change1h || null;
        const chg24 = t.priceChange24h || t.change24h || null;
        const score = t.ogScore || null;
        const trust = t.verdict || null;

        const chg24Color = chg24 === null ? theme.muted : chg24 >= 0 ? theme.green : theme.red;
        const chg1hColor = chg1h === null ? theme.muted : chg1h >= 0 ? theme.green : theme.red;

        const trustColor = trust === "SAFE" ? theme.green : trust === "RISKY" ? theme.accent : trust === "DANGEROUS" ? theme.red : theme.muted;

        const logoHtml = t.image || t.logo
          ? `<img src="${t.image || t.logo}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none'" />`
          : `<div style="width:28px;height:28px;border-radius:50%;background:${theme.accent}22;border:1px solid ${theme.accent}55;display:flex;align-items:center;justify-content:center;font-size:10px;color:${theme.accent};font-weight:700;">${sym.slice(0,2)||"?"}</div>`;

        const rows = [];
        if (price) rows.push(`<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:8px;border-top:1px solid ${theme.border}">
          <span style="color:${theme.muted}">Price</span>
          <span style="font-weight:700;color:${theme.text}">${fmtNum(price)}</span>
        </div>`);
        if (chg24 !== null) rows.push(`<div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
          <span style="color:${theme.muted}">24h</span>
          <span style="font-weight:600;color:${chg24Color}">${fmtPct(chg24)}</span>
        </div>`);
        if (chg1h !== null) rows.push(`<div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
          <span style="color:${theme.muted}">1h</span>
          <span style="font-weight:600;color:${chg1hColor}">${fmtPct(chg1h)}</span>
        </div>`);
        if (mc !== null) rows.push(`<div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
          <span style="color:${theme.muted}">Mkt Cap</span>
          <span style="color:${theme.text}">${fmtNum(mc)}</span>
        </div>`);
        if (vol !== null) rows.push(`<div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
          <span style="color:${theme.muted}">Vol 24h</span>
          <span style="color:${theme.text}">${fmtNum(vol)}</span>
        </div>`);
        if (score !== null) rows.push(`<div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
          <span style="color:${theme.muted}">OG Score</span>
          <span style="font-weight:700;color:${theme.accent}">${Math.round(score)}/100</span>
        </div>`);

        const trustBadge = trust
          ? `<span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:99px;background:${trustColor}22;color:${trustColor};border:1px solid ${trustColor}55;letter-spacing:.5px">${trust}</span>`
          : "";

        const poweredBy = `<div style="margin-top:10px;padding-top:8px;border-top:1px solid ${theme.border};text-align:right">
          <a href="${BASE}/token/${mint}" target="_blank" rel="noreferrer"
            style="font-size:9px;color:${theme.muted};text-decoration:none;letter-spacing:.3px">
            Powered by <span style="color:${theme.accent};font-weight:700">OG DEX</span>
          </a>
        </div>`;

        const inner = `
          <div style="display:flex;align-items:center;gap:8px">
            ${logoHtml}
            <div style="flex:1;min-width:0">
              <div style="font-weight:800;font-size:${sizeKey === "sm" ? "13px" : "15px"};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</div>
              <div style="color:${theme.muted};font-size:10px">${sym}${trustBadge ? " · " + trustBadge : ""}</div>
            </div>
          </div>
          ${rows.join("")}
          ${poweredBy}
        `;

        if (addLink) {
          const a = document.createElement("a");
          a.href = `${BASE}/ORBITX_DEX/token/${mint}`;
          a.target = "_blank";
          a.rel = "noreferrer";
          a.style.textDecoration = "none";
          card.innerHTML = inner;
          // Don't wrap the entire card in an <a> — just the token name area
          // (already handled by the "Powered by" link above)
        }

        card.innerHTML = inner;
      })
      .catch(() => {
        card.innerHTML = `<div style="text-align:center;padding:12px;color:${theme.red};font-size:11px">Could not load token data</div>`;
      });
  }

  // Self-initializing: find all <script data-mint> tags
  function init() {
    const scripts = document.querySelectorAll("script[data-mint]");
    scripts.forEach(createWidget);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
