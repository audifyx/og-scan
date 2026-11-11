/**
 * Bot API 10.4 HTML widget for the OrbitX Telegram scanner.
 *
 * Why a STATIC widget (data baked into the HTML at send time) instead of
 * a shared widget: the widget's HTML is fixed once created, and the only
 * per-message data a shared widget can carry is chat_data (1024 bytes) —
 * far too small for the full report (holders, clones, score breakdown,
 * risk factors). A static widget carries the whole scan in its HTML
 * (32 KB raw / 4 KB zlib-9 cap), so the widget IS the full report:
 * expandable sections, refresh, copy CA, open in OrbitX. No network
 * inside the widget, no wallet, no trading.
 *
 * SIZE — the binding constraint is the 4 KB compressed cap, and the
 * first version failed it (14.5 KB raw / 5.4 KB zlib-9). The fix:
 * sections are RENDERED ON THE SERVER (plain HTML rows) instead of
 * shipped as data + a client-side renderer. The widget's own JS is now
 * only the accordion + refresh + copy + open (~1.4 KB), and the embedded
 * JSON is just the mint (~55 bytes). Full report: ~8.5 KB raw /
 * ~3.2 KB zlib-9. buildScanWidget throws if either cap is exceeded and
 * the webhook falls back to the plain-text report.
 *
 * Production limits that shape this (docs: core.telegram.org/bots/widgets,
 * Bot API 10.4 changelog 2026-11-09):
 * - Widgets work ONLY in the private chat with the bot in production.
 *   Groups / supergroups / inline / forwards are test-server only, so the
 *   webhook keeps the plain-text report for group scans.
 * - HTML: 1-32768 bytes UTF-8, <=4096 bytes after zlib level 9, no NUL.
 * - State (chat_data / public_data): 0-1024 bytes each — not used here.
 * - Requests: TelegramWidget.request(data) with 1-64 bytes; the bot gets a
 *   widget_query update and must answer within 15s via answerWidgetQuery
 *   (answer data <=1024 bytes, 5 queries / 5s per user). One request in
 *   flight, one per tap, in the tap's handler.
 * - Height: content height 50-600 px, nothing scrolls — content past 600
 *   is clipped. A plain 10-section accordion is NOT bounded (measured
 *   677px with Market open, 987px with Score open at 390px wide), so the
 *   widget fits by design: sections sit in a 2-column grid and only the
 *   OPEN section spans full width; and the hero collapses to a compact
 *   bar (body.cx) whenever a non-Market section opens — Market open is
 *   the full hero landing view. Score-bar notes are dropped from the
 *   widget (the text report keeps them) to fund the ring within the
 *   4KB compressed cap.
 * - No network in the sandbox (fetch/XHR/WebSocket throw), no external
 *   scripts/styles/fonts/images (data: URLs or inline SVG only), no
 *   keyboard input, only <button> as a form control.
 * - Widget messages can't be forwarded (production) or copied.
 *
 * Refresh: the Refresh button re-runs scanMint() (90s cache — cheap) and
 * answerWidgetQuery returns the headline numbers + score breakdown;
 * the widget updates the score, verdict, ring arc, quick row, safety
 * line, top holder / top 10 and the score bars in place. Section bodies
 * keep the original scan's values; the as-of line says which is which.
 *
 * Data parity: buildScanWidget takes the SAME scanMint() payload as the
 * plain-text report (scanReply in _tg-webhook.js). Every field the engine
 * could not compute stays null and renders as "unknown — <reason>", never
 * 0 or an invented value. Same pool-exclusion / leaked-vault guard as the
 * text report (topHolders already filtered upstream in _tg-scan.js).
 */
import { deflateSync } from "node:zlib";

// ── size caps (Bot API 10.4) ──────────────────────────────────────────────
export const WIDGET_HTML_MAX = 32768; // bytes of UTF-8
export const WIDGET_HTML_COMPRESSED_MAX = 4096; // bytes after zlib level 9
export const WIDGET_ANSWER_MAX = 1024; // answerWidgetQuery data, bytes

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// ── tiny formatters (same rules as the text report) ───────────────────────
function fmtUsd(v) {
  if (v == null || !Number.isFinite(v)) return null;
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  return "$" + v.toFixed(2);
}
function fmtPct(v, digits = 1) {
  if (v == null || !Number.isFinite(v)) return null;
  return (v >= 0 ? "+" : "") + v.toFixed(digits) + "%";
}
function fmtPrice(v) {
  if (v == null || !Number.isFinite(v)) return null;
  if (v >= 1) return "$" + v.toFixed(2);
  if (v >= 0.01) return "$" + v.toFixed(4);
  return "$" + Number(v.toPrecision(4)).toString();
}
function fmtInt(v) {
  if (v == null || !Number.isFinite(v)) return null;
  return Math.round(v).toLocaleString("en-US");
}
function fmtSupply(v) {
  if (v == null || !Number.isFinite(v)) return null;
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return String(Math.round(v));
}
function shortAddr(s) {
  if (!s || s.length < 10) return s || null;
  return s.slice(0, 6) + "…" + s.slice(-4);
}
function shortNote(s, max = 80) {
  if (s == null) return null;
  const t = String(s).trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.5 ? cut.slice(0, sp) : cut) + "…";
}
const num = (v) => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function txt(v, fb) {
  return v == null || v === "" ? fb || "unknown" : v;
}
function dstr(iso) {
  if (!iso) return null;
  const m = Number(String(iso).slice(5, 7));
  const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (!m || m < 1 || m > 12) return null;
  return `${M[m - 1]} ${Number(String(iso).slice(8, 10))}, ${String(iso).slice(0, 4)}`;
}
function tstr(iso) {
  if (!iso) return "";
  return `${String(iso).slice(11, 16)} UTC`;
}

// ── the widget shell (server-rendered sections; tiny client JS) ───────────
// QuickJS-safe JS: no optional chaining / nullish coalescing / replaceAll /
// .at(). Only basic DOM: getElementById, querySelectorAll, addEventListener,
// classList, textContent, innerHTML, style.

const WIDGET_CSS =
  "*{box-sizing:border-box}" +
  "body{margin:0;background:#0A0A0A;color:#FFF;font-family:system-ui,-apple-system,sans-serif;--S:#232323;--H:#9A9A9A;--G:#191919;--T:#FFF;--A:#D4AF37}" +
  ".br{font-size:10px;font-weight:700;letter-spacing:.2em;color:var(--A);padding:0 0 3px}" +
  ".hd{display:flex;gap:10px;align-items:center;padding:2px 0 6px}" +
  ".sc{position:relative;width:64px;height:64px;min-width:64px;display:flex;align-items:center;justify-content:center;color:var(--A);font-size:26px;font-weight:800}" +
  ".rg{position:absolute;inset:0;border-radius:50%;background:conic-gradient(var(--A) 0 var(--a),var(--G) var(--a));-webkit-mask:radial-gradient(circle closest-side,transparent 76%,#FFF 79%)}" +
  ".sc span{position:relative}" +
  ".tt{flex:1;min-width:0}" +
  ".nm{font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
  ".mt{font-size:12px;color:var(--H)}" +
  ".vd{display:inline-block;font-size:13px;font-weight:700;padding:3px 10px;border-radius:20px;border:1px solid var(--A);color:var(--A);margin-top:3px}" +
  ".ds{font-size:12px;color:var(--H);margin:3px 0 4px}" +
  ".kv{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:14px;padding:4px 0;border-top:1px solid var(--S)}" +
  ".kv b,.ds b{color:var(--T);font-weight:700}" +
  ".row{display:flex;gap:6px;margin:6px 0 3px}" +
  ".row button{flex:1}" +
  "button{font:inherit;font-size:13px;padding:7px 4px;border-radius:8px;border:1px solid #2C2C2C;background:#161616;color:#FFF;cursor:pointer}" +
  "#btn-refresh{background:var(--A);border-color:var(--A);color:#0A0A0A;font-weight:700}" +
  ".ss{display:grid;grid-template-columns:1fr 1fr;gap:0 8px}" +
  ".s{border-top:1px solid #2A2416}" +
  ".s.o{grid-column:1/-1}" +
  ".h{width:100%;text-align:left;background:none;border:0;color:var(--A);font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;padding:4px 2px;cursor:pointer}" +
  ".h::after{content:'▸';float:right;font-weight:400;color:var(--A)}" +
  ".s.o .h::after{content:'▾'}" +
  ".b{display:none;padding:0 2px 2px;font-size:13px;line-height:1.4}" +
  ".s.o .b{display:block}" +
  ".b>div{display:flex;justify-content:space-between;gap:8px;padding:0;color:var(--H)}" +
  ".b>div b{color:var(--T);text-align:right}" +
  ".x{display:block!important;margin-top:4px}" +
  ".bar{display:block!important;font-size:12px}" +
  ".t{height:5px;background:var(--G);border-radius:3px;margin:1px 0 3px}" +
  ".f{height:5px;border-radius:3px;background:var(--A)}" +
  ".ft{font-size:11px;color:var(--H);padding:4px 0 5px;border-top:1px solid var(--S)}" +
  ".st{font-size:12px;color:var(--H)}" +
  "body.cx .br,body.cx .mt,body.cx .ds{display:none}" +
  "body.cx .sc{width:36px;height:36px;min-width:36px;font-size:15px}" +
  "body.cx .kv{font-size:12px;padding:3px 0}" +
  "body.cx .row{margin:4px 0 2px}";

const WIDGET_JS =
  "(function(){" +
  "var W=window.TelegramWidget,D=window.__D;" +
  "function $(id){return document.getElementById(id)}" +
  "function set(id,t){var e=$(id);if(e)e.textContent=t}" +
  "function st(s){var e=$('status');if(e)e.textContent=s}" +
  "function usd(v){if(v==null||isNaN(v))return'unknown';if(v>=1e6)return '$'+(v/1e6).toFixed(2)+'M';if(v>=1e3)return '$'+(v/1e3).toFixed(1)+'K';return '$'+v.toFixed(2)}" +
  "function prc(v){if(v==null||isNaN(v))return'unknown';if(v>=1)return '$'+v.toFixed(2);if(v>=0.01)return '$'+v.toFixed(4);return '$'+Number(v.toPrecision(4)).toString()}" +
  "function tstr(iso){return iso?iso.slice(11,16)+' UTC':''}" +
  "function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}" +
  "function bar(c){var p=c[2]>0?Math.max(0,Math.min(100,Math.round(c[1]/c[2]*100))):0;return '<div class=bar>'+esc(c[0])+' '+c[1]+'/'+c[2]+'<div class=t><div class=f style=\"width:'+p+'%\"></div></div></div>'}" +
  "var hs=document.querySelectorAll('.h');" +
  "for(var i=0;i<hs.length;i++){hs[i].addEventListener('click',function(){var s=this.parentNode,o=s.classList.contains('o');for(var j=0;j<hs.length;j++)hs[j].parentNode.classList.remove('o');if(!o)s.classList.add('o');var B=document.body;if(B)B.classList[!o&&this!==hs[0]?'add':'remove']('cx');if(W&&W.setResizeAnchor)W.setResizeAnchor('top')})}" +
  "$('btn-refresh').addEventListener('click',function(){" +
  "if(!W||typeof W.request!=='function'){st('Refresh needs the Telegram app');return}" +
  "var b=$('btn-refresh');b.disabled=true;b.textContent='Refreshing…';st('');" +
  "W.request('r:'+D.m).then(function(a){" +
  "b.disabled=false;b.textContent='Refresh';" +
  "var d=null;try{d=JSON.parse(a.result||'null')}catch(e){d=null}" +
  "if(!d||d.e){st(d&&d.e?('Refresh failed — '+d.e):'Refresh failed — try again');return}" +
  "set('score',d.s===null?'--':d.s);" +
  "var rg=$('rg');if(rg&&rg.style&&rg.style.setProperty)rg.style.setProperty('--a',(d.s===null?0:Math.round(Math.max(0,Math.min(100,d.s))*3.6))+'deg');" +
  "set('verdict',d.v||'Unknown');" +
  "set('qp',d.p===null?'—':prc(d.p));set('qm',d.mc===null?'—':usd(d.mc));set('ql',d.l===null?'—':usd(d.l));" +
  "set('hp',d.hp||'unknown');set('lp',d.lp||'unknown');set('dv',d.dv||'unknown');" +
  "set('top',d.top===null?'unknown':Number(d.top).toFixed(1)+'%');set('t10',d.t10===null?'unknown':Number(d.t10).toFixed(1)+'%');" +
  "if(d.cat)$('scorebars').innerHTML=d.cat.map(bar).join('');" +
  "set('asof','Updated '+tstr(d.ts)+' · Not financial advice.');" +
  "st('Updated just now');" +
  "},function(e){b.disabled=false;b.textContent='Refresh';st('Refresh failed ('+(e&&e.code?e.code:'try again')+')')});" +
  "});" +
  "$('btn-copy').addEventListener('click',function(){if(W&&W.copyText)W.copyText(D.m)});" +
  "$('btn-open').addEventListener('click',function(){if(W&&W.openLink)W.openLink('https://orbitx.world/scanner/'+D.m)});" +
  "if(W&&W.ready)W.ready();" +
  "})();";

// ── server-side section rendering ─────────────────────────────────────────
function row(k, v) {
  return `<div>${k}<b>${v}</b></div>`;
}
function barHtml(label, points, max) {
  const pc = max > 0 ? Math.max(0, Math.min(100, Math.round((points / max) * 100))) : 0;
  return (
    `<div class=bar>${escHtml(label)} ${points}/${max}` +
    `<div class=t><div class=f style="width:${pc}%"></div></div>` +
    `</div>`
  );
}
function secHtml(label, body, open) {
  // No id on the section body: the accordion finds sections by class, so
  // ids would only cost bytes. (#scorebars keeps its id — refresh rebuilds it.)
  return `<div class="s${open ? " o" : ""}"><button class=h>${label}</button><div class=b>${body}</div></div>`;
}

/** The 10 report sections, rendered to HTML on the server. Same content as the text report. */
function buildSections(r) {
  let h = "";
  // Market
  h = "";
  h += row("Price", txt(fmtPrice(r.price), "unknown") + (r.change24h != null ? ` (${fmtPct(r.change24h)} 24h)` : ""));
  h += row("MCAP", txt(fmtUsd(r.marketCap), "unknown"));
  h += row("Liquidity", txt(fmtUsd(r.liquidity), "unknown"));
  h += row("Volume 24h", txt(fmtUsd(r.volume24h), "unknown"));
  h += row("Age", r.ageDays == null ? "unknown" : r.ageDays < 1 ? "<1 day" : `${Math.floor(r.ageDays)} days`);
  h += row("Momentum", r.momentumLabel ? escHtml(r.momentumLabel) + (r.momentum != null ? ` (${Math.round(r.momentum)}/100)` : "") : "unknown");
  let out = secHtml("Market", h, true);
  // Token
  h = "";
  h += row("Supply", txt(fmtSupply(r.totalSupply), "unknown"));
  h += row("Decimals", r.decimals == null ? "unknown" : String(r.decimals));
  h += row("FDV", txt(fmtUsd(r.fdv), "unknown"));
  h += row("Program", txt(r.tokenProgram, "unknown"));
  h += row("Launchpad", txt(r.launchpad, "unknown"));
  h += row("Jupiter verified", r.isVerified === true ? "Yes" : r.isVerified === false ? "No" : "unknown");
  h += row("Bonding curve", r.bondingComplete === true ? "Migrated" : "Not migrated / n/a");
  out += secHtml("Token", h, false);
  // Chart & history
  h = "";
  h += row("5m", txt(fmtPct(r.change5m), "—"));
  h += row("1h", txt(fmtPct(r.change1h), "—"));
  h += row("6h", txt(fmtPct(r.change6h), "—"));
  h += row("24h", txt(fmtPct(r.change24h), "—"));
  h += row("ATH", txt(fmtPrice(r.athPrice), "unknown") + (r.athMcap != null ? ` (${fmtUsd(r.athMcap)} MCAP)` : ""));
  h += row("From ATH", r.downFromAthPct == null ? "unknown" : `-${Number(r.downFromAthPct).toFixed(1)}%`);
  h += row("Created", r.createdAt ? txt(dstr(r.createdAt), "unknown") : "unknown");
  out += secHtml("Chart", h, false);
  // Pairs
  h = "";
  if (Array.isArray(r.pairs) && r.pairs.length) {
    for (const p of r.pairs.slice(0, 2)) {
      h += row(
        `${p.dex || "unknown"} — ${p.quote || "?"}`,
        (p.liquidity != null ? `Liq ${fmtUsd(p.liquidity)}` : "") +
          (p.volume24h != null ? ` · Vol ${fmtUsd(p.volume24h)}` : "") +
          (p.buys24h != null ? ` · ${fmtInt(p.buys24h)} buys / ${fmtInt(p.sells24h)} sells` : ""),
      );
    }
  } else {
    h += `<div class=x>Pairs: unknown — no DEX pairs found</div>`;
  }
  out += secHtml("Pairs", h, false);
  // Holders
  h = "";
  h += row("Holders", r.holders == null ? "unknown" : fmtInt(r.holders) + (r.holderChange24h != null ? ` (${fmtPct(r.holderChange24h)} 24h)` : ""));
  h += row("Top holder", `<span id=top>${r.topHolderPct == null ? "unknown" : Number(r.topHolderPct).toFixed(1) + "%"}</span>`);
  h += row("Top 10", `<span id=t10>${r.top10Pct == null ? "unknown" : Number(r.top10Pct).toFixed(1) + "%"}</span>`);
  h += row("Whales", r.whaleCount == null ? "unknown" : String(r.whaleCount));
  if (r.kolHolderCount) h += row("KOL holders", String(r.kolHolderCount));
  if (Array.isArray(r.topHolders) && r.topHolders.length) {
    h += `<div class=x>Top holders:</div>`;
    for (const t of r.topHolders.slice(0, 4)) {
      h += row(`· ${escHtml(shortAddr(t.owner) || t.label || "?")}`, `${Number(t.pct).toFixed(1)}%${t.usdValue != null ? ` · ${fmtUsd(t.usdValue)}` : ""}`);
    }
  }
  out += secHtml("Holders", h, false);
  // Activity
  h = "";
  h += row("24h buys / sells", `${r.numBuys24h != null ? fmtInt(r.numBuys24h) : "—"} / ${r.numSells24h != null ? fmtInt(r.numSells24h) : "—"}`);
  h += row("Traders 24h", r.numTraders24h == null ? "unknown" : fmtInt(r.numTraders24h));
  h += row("Net buyers", r.netBuyers24h == null ? "unknown" : (r.netBuyers24h >= 0 ? "+" : "") + fmtInt(r.netBuyers24h));
  h += row("Buy / sell vol", `${r.buyVolume24h != null ? fmtUsd(r.buyVolume24h) : "—"} / ${r.sellVolume24h != null ? fmtUsd(r.sellVolume24h) : "—"}`);
  h += row("Organic score", r.organicScore == null ? "unknown" : `${Math.round(r.organicScore)}/100${r.organicScoreLabel ? ` (${escHtml(r.organicScoreLabel)})` : ""}`);
  out += secHtml("Activity", h, false);
  // Dev & safety
  h = "";
  h += row("Dev", txt(shortAddr(r.devWallet), "unknown"));
  h += row("Dev position", r.devExited === true ? "Dev has exited" : r.devExited === false ? "Dev still holds" : "unknown");
  if (r.devTokensCreated != null) h += row("Tokens created", String(r.devTokensCreated));
  if (r.devSerial) h += row("Serial deployer", "Yes");
  if (r.sourceTrace && r.sourceTrace.available) {
    h += row("Source", txt(shortAddr(r.sourceTrace.sourceWallet), "unknown"));
    if (r.sourceTrace.sourceTokensCreated != null) h += row("Source launches", String(r.sourceTrace.sourceTokensCreated));
    if (r.sourceTrace.note) h += row("Trace", escHtml(shortNote(r.sourceTrace.note, 40)));
  }
  h += row("Honeypot", r.honeypot === true ? "Honeypot — no sell route" : r.honeypot === false ? "No honeypot — sell route open" : "unknown");
  h += row("Mint authority", r.mintAuthority === "revoked" ? "Revoked" : r.mintAuthority === "live" ? "Still live" : "unknown");
  h += row("Freeze authority", r.freezeAuthority === "revoked" ? "Revoked" : r.freezeAuthority === "live" ? "Still live" : "unknown");
  h += row("LP locked", r.lpLockedPct == null ? "unknown" : r.lpLockedPct === 100 ? "100% locked" : `${r.lpLockedPct}% locked`);
  h += row("LP burned", r.lpBurned === true ? "Yes" : r.lpBurned === false ? "No" : "unknown");
  {
    const rt = Array.isArray(r.honeypotChecks) ? r.honeypotChecks.find((x) => x.id === "round-trip") : null;
    if (rt) h += row("Round-trip", escHtml(shortNote(rt.label, 50)));
  }
  if (r.tradeability && r.tradeability.verdict) {
    h += row("Tradeability", escHtml(r.tradeability.verdict) + (r.tradeability.note ? ` — ${escHtml(shortNote(r.tradeability.note, 50))}` : ""));
  }
  out += secHtml("Dev & safety", h, false);
  // Bundle & clones
  h = "";
  if (r.bundle && r.bundle.available) {
    h += row("Bundle", escHtml(r.bundle.verdict || "—") + (r.bundle.bundledSupplyPct != null ? ` (${Number(r.bundle.bundledSupplyPct).toFixed(1)}% bundled)` : ""));
    if (r.bundle.clusterCount) h += row("Clusters", String(r.bundle.clusterCount));
    if (r.bundle.note) h += row("Note", escHtml(shortNote(r.bundle.note, 40)));
  } else {
    h += `<div class=x>Bundle: unknown — bundle check unavailable</div>`;
  }
  if (r.clones && r.clones.state !== "unknown") {
    h += row("Originality", r.clones.biggerClone === true ? "VAMP — a bigger same-name token exists" : r.clones.count > 0 ? "OG — biggest same-name token" : "OG — no same-name clones");
    if (r.clones.count > 0) {
      h += row("Same-name clones", String(r.clones.count));
      if (Array.isArray(r.clones.list)) {
        for (const c of r.clones.list.slice(0, 2)) {
          h += row(
            `· ${escHtml(c.symbol || c.name || "—")}`,
            (c.mcap != null ? `MCAP ${fmtUsd(c.mcap)}` : "") + (c.liquidity != null ? ` · Liq ${fmtUsd(c.liquidity)}` : "") + (c.mint ? ` · ${shortAddr(c.mint)}` : ""),
          );
        }
      }
    }
  } else {
    h += `<div class=x>Clones: unknown — clone check unavailable</div>`;
  }
  out += secHtml("Bundle & clones", h, false);
  // Social
  h = "";
  if (r.x && r.x.handle) h += row("X", `@${escHtml(r.x.handle)}`);
  if (r.xMentions != null) h += row("X posts found", fmtInt(r.xMentions));
  if (r.redditMentions != null) h += row("Reddit posts found", fmtInt(r.redditMentions));
  if (r.socials && r.socials.telegram) h += row("Telegram", escHtml(r.socials.telegram));
  if (r.socials && r.socials.discord) h += row("Discord", escHtml(r.socials.discord));
  if (r.socials && r.socials.website) h += row("Website", escHtml(r.socials.website));
  if (!h) h = `<div class=x>No social links found</div>`;
  out += secHtml("Social", h, false);
  // Score breakdown
  h = "";
  if (Array.isArray(r.categories) && r.categories.length) {
    h += `<div class=x id=scorebars>`;
    for (const c of r.categories) {
      h += barHtml(c.label || "?", c.points ?? 0, c.max ?? 0);
    }
    h += `</div>`;
  }
  if (Array.isArray(r.caps)) {
    const caps = r.caps.filter(Boolean);
    for (const c of caps.slice(0, 3)) h += row("· Cap", escHtml(shortNote(c, 40)));
    if (caps.length > 3) h += row("· Caps", `+${caps.length - 3} more`);
  }
  {
    const checks = (Array.isArray(r.honeypotChecks) ? r.honeypotChecks : []).filter(
      (x) => x.state === "fail" || x.state === "warn",
    );
    for (const c of checks.slice(0, 3)) {
      h += row(`· ${escHtml(c.label)}`, c.detail ? escHtml(shortNote(c.detail, 30)) : "");
    }
    if (checks.length > 3) h += row("· Checks", `+${checks.length - 3} more`);
  }
  if (Array.isArray(r.unknowns) && r.unknowns.length) {
    h += `<div class=x>Not checked yet: ${escHtml(r.unknowns.join(", "))} — treated as unknown.</div>`;
  }
  if (!h) h = "Score details unavailable";
  out += secHtml("Score", h, false);
  return out;
}

/** Escape a JSON blob for embedding inside <script> (kills </script> etc.). */
function embedJson(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c").replace(/\u0000/g, "");
}

/**
 * Build the widget for one scan result.
 * Returns { html, caption } — html is the full widget document. The caller
 * (webhook) sends it with sendWidget + allow_queries:true. Throws if the
 * document would break either Bot API size cap (caller falls back to text).
 */
export function buildScanWidget(result) {
  const title = [result.symbol, result.name]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(" ");
  const short = result.mint.slice(0, 6) + "…" + result.mint.slice(-4);
  const hp = result.honeypot === true ? "Yes" : result.honeypot === false ? "No" : null;
  const lp =
    result.lpLockedPct == null
      ? null
      : `${result.lpLockedPct}% locked${result.lpBurned ? " + burned" : ""}`;
  const dv = result.devExited === true ? "Exited" : result.devExited === false ? "Holds" : null;
  const spc = result.score == null ? 0 : Math.max(0, Math.min(100, Math.round(result.score)));
  const html =
    "<!doctype html><html><head><meta charset='utf-8'><style>" +
    WIDGET_CSS +
    "</style></head><body>" +
    "<div class=br>ORBITX SCANNER</div>" +
    "<div class='hd'><div class='sc'><div class=rg id=rg style=\"--a:" +
    Math.round(spc * 3.6) +
    "deg\"></div><span id='score'>" +
    (result.score ?? "--") +
    "</span></div>" +
    "<div class='tt'><div class='nm'>" +
    escHtml(title || "Token") +
    " (" +
    escHtml(short) +
    ")</div><div class='mt'>" +
    (result.description ? escHtml(shortNote(result.description, 40)) : "OrbitX scanner") +
    "</div><span class='vd' id='verdict'>" +
    escHtml(result.verdict || "Unknown") +
    "</span></div></div>" +
    "<div class='kv'><span>Price <b id=qp>" +
    txt(fmtPrice(result.price), "—") +
    "</b></span><span>MCAP <b id=qm>" +
    txt(fmtUsd(result.marketCap), "—") +
    "</b></span><span>Liq <b id=ql>" +
    txt(fmtUsd(result.liquidity), "—") +
    "</b></span></div>" +
    "<div class='ds'>Honeypot <b id=hp>" +
    txt(hp, "unknown") +
    "</b> · LP <b id=lp>" +
    txt(lp, "unknown") +
    "</b> · Dev <b id=dv>" +
    txt(dv, "unknown") +
    "</b></div>" +
    "<div class='row'>" +
    "<button id='btn-refresh'>Refresh</button>" +
    "<button id='btn-copy'>Copy CA</button>" +
    "<button id='btn-open'>Open in OrbitX</button>" +
    "</div>" +
    "<div class='st' id='status'></div>" +
    "<div class=ss>" +
    buildSections(result) +
    "</div>" +
    "<div class='ft' id='asof'>Scanned " +
    tstr(result.scannedAt) +
    " · Not financial advice.</div>" +
    "<script>window.__D=" +
    embedJson({ m: result.mint }) +
    ";" +
    WIDGET_JS +
    "</script></body></html>";
  const clean = html.replace(/\u0000/g, "");
  const rawBytes = Buffer.byteLength(clean, "utf8");
  if (rawBytes > WIDGET_HTML_MAX) {
    throw new Error(`widget html ${rawBytes} bytes exceeds ${WIDGET_HTML_MAX}`);
  }
  const compBytes = deflateSync(clean, { level: 9 }).length;
  if (compBytes > WIDGET_HTML_COMPRESSED_MAX) {
    throw new Error(`widget html ${compBytes} bytes (zlib-9) exceeds ${WIDGET_HTML_COMPRESSED_MAX}`);
  }
  return { html: clean, caption: buildScanCaption(result) };
}

/** Headline caption — what users on clients without widget support see. */
export function buildScanCaption(result) {
  const short = result.mint.slice(0, 6) + "…" + result.mint.slice(-4);
  const title = [result.symbol, result.name]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(" ");
  const bits = [];
  bits.push(`${title ? `${title} (${short})` : `Token ${short}`}`);
  bits.push(`OG Score: ${result.score ?? "—"}/100 — ${result.verdict}`);
  const mkt = [];
  if (result.price != null) mkt.push(`Price ${fmtPrice(result.price)}`);
  if (result.marketCap != null) mkt.push(`MCAP ${fmtUsd(result.marketCap)}`);
  if (result.liquidity != null) mkt.push(`Liq ${fmtUsd(result.liquidity)}`);
  if (mkt.length) bits.push(mkt.join(" · "));
  const safety = [];
  safety.push(
    result.honeypot === false ? "No honeypot" : result.honeypot === true ? "Honeypot" : "Honeypot unknown",
  );
  if (result.lpLockedPct === 100) safety.push("LP 100% locked");
  safety.push(result.devExited === true ? "Dev exited" : result.devExited === false ? "Dev holds" : "Dev unknown");
  bits.push(safety.join(" · "));
  bits.push("Full report in the widget above — tap a section to expand, Refresh to re-scan.");
  let text = bits.join("\n");
  if (text.length > 1000) text = text.slice(0, 997) + "…";
  return text;
}

/**
 * Parse a widget request's data (1-64 bytes). Only 'r:<mint>' (refresh) is
 * supported — expansion is client-side and needs no round-trip.
 * Returns { kind: 'refresh', mint } or null.
 */
export function parseWidgetRequest(data) {
  if (typeof data !== "string") return null;
  const m = data.match(/^r:([1-9A-HJ-NP-Za-km-z]{32,44})$/);
  if (!m) return null;
  return { kind: "refresh", mint: m[1] };
}

/**
 * Compact answer for a refresh (answerWidgetQuery data, <=1024 bytes).
 * Headline numbers + score breakdown — the widget updates them in place.
 * Returns a JSON string; on any failure the caller should answer with an
 * error object instead ({ e: "…" }).
 */
export function buildRefreshData(result) {
  const d = {
    s: result.score ?? null,
    v: result.verdict || null,
    p: num(result.price),
    mc: num(result.marketCap),
    l: num(result.liquidity),
    hp: result.honeypot === true ? "Yes" : result.honeypot === false ? "No" : null,
    lp:
      result.lpLockedPct == null
        ? null
        : `${result.lpLockedPct}% locked${result.lpBurned ? " + burned" : ""}`,
    dv: result.devExited === true ? "Exited" : result.devExited === false ? "Holds" : null,
    top: num(result.topHolderPct),
    t10: num(result.top10Pct),
    cat: Array.isArray(result.categories)
      ? result.categories.map((c) => [c.label || "?", c.points ?? 0, c.max ?? 0])
      : null,
    ts: result.scannedAt || new Date().toISOString(),
  };
  const s = JSON.stringify(d);
  if (Buffer.byteLength(s, "utf8") > WIDGET_ANSWER_MAX) {
    throw new Error(`refresh answer ${Buffer.byteLength(s, "utf8")} bytes exceeds ${WIDGET_ANSWER_MAX}`);
  }
  return s;
}
