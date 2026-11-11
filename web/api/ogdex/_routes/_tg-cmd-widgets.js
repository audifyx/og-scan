/**
 * Bot API 10.4 HTML widgets for the OrbitX Telegram bot commands:
 * /price, /holders, /bundle, /trending.
 *
 * Same design family as the scanner widget (./_tg-widget.js) — black
 * background, white text, gold accents, silver secondary, high contrast.
 * The scanner widget itself is NOT touched; this file only adds the four
 * command widgets, and the webhook wires them in.
 *
 * Each widget is a single-focus card: a hero (the one number that
 * matters), a visual anchor (gauge / sparkline / concentration bars) and
 * the supporting rows. No accordion — the content is small enough to show
 * at once and stay inside the 600px height cap.
 *
 * Size discipline (same as _tg-widget.js): the report is RENDERED ON THE
 * SERVER (plain HTML rows) instead of shipped as data + a client-side
 * renderer. The widget's own JS is only refresh + copy + open, and the
 * embedded JSON is just the mint (plus top-5 short owners for /holders).
 * Every builder throws if either Bot API cap (32,768 B raw / 4,096 B
 * zlib-9) is exceeded — the webhook falls back to the text summary.
 *
 * Data: /price, /holders, /bundle reuse scanMint() — the same live
 * engine as the scanner, never re-derived numbers. /trending is
 * GeckoTerminal trending pools for Solana (the same source the repo's
 * /screener ?type=trending serves), ranked in GT order — genuinely
 * "trending", not most-active or latest. Unavailable fields render
 * "unknown — <reason>", never 0 or an invented value.
 *
 * Refresh: widget_query data "p:<mint>" / "h:<mint>" / "b:<mint>" /
 * "t:" (no mint). The bot answers within 15s via answerWidgetQuery
 * (data <=1024 bytes); the widget updates the hero + rows in place.
 */
import { deflateSync } from "node:zlib";

export const WIDGET_HTML_MAX = 32768; // bytes of UTF-8
export const WIDGET_HTML_COMPRESSED_MAX = 4096; // bytes after zlib level 9
export const WIDGET_ANSWER_MAX = 1024; // answerWidgetQuery data, bytes

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const GT_TRENDING_URL =
  "https://api.geckoterminal.com/api/v2/networks/solana/trending_pools?page=1&include=base_token";
const STABLES = new Set(["USDT", "USDC", "DAI", "WETH", "SOL", "WBTC", "USDS", "PYUSD"]);

// ── tiny formatters (same rules as the text report / scanner widget) ──────
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
function tstr(iso) {
  if (!iso) return "";
  return `${String(iso).slice(11, 16)} UTC`;
}
function titleOf(r) {
  return [r.symbol, r.name]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(" ");
}
function shortOf(mint) {
  return mint.slice(0, 6) + "…" + mint.slice(-4);
}
function embedJson(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c").replace(/\u0000/g, "");
}

// ── the widget shell: same visual system as the (restyled) scanner widget ─
// QuickJS-safe JS: no optional chaining / nullish coalescing / replaceAll /
// .at(). Only basic DOM: getElementById, addEventListener, classList,
// textContent, innerHTML, style.
const WIDGET_CSS =
  "*{box-sizing:border-box}" +
  "body{margin:0;background:#0A0A0A;color:#FFF;font-family:system-ui,-apple-system,sans-serif;--S:#232323;--H:#9A9A9A;--G:#191919;--T:#FFF;--A:#D4AF37;--L:#E5C07B}" +
  ".br{font-size:10px;font-weight:700;letter-spacing:.2em;color:var(--A);padding:2px 0 4px}" +
  ".hd{display:flex;gap:10px;align-items:center;padding:2px 0 6px}" +
  ".sc{font-size:34px;font-weight:800;line-height:1;text-align:center;min-width:62px;color:var(--A)}" +
  ".sc small{display:block;font-size:10px;font-weight:600;color:var(--H);margin-top:2px}" +
  ".tt{flex:1;min-width:0}" +
  ".nm{font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
  ".mt{font-size:12px;color:var(--H)}" +
  ".vd{display:inline-block;font-size:12px;font-weight:700;padding:2px 8px;border-radius:20px;border:1px solid var(--A);color:var(--L);background:#14110A;margin-top:3px}" +
  ".ds{font-size:12px;color:var(--H);margin:4px 0 6px}" +
  ".kv{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:13px;padding:6px 0;border-top:1px solid var(--S)}" +
  ".kv b,.ds b{color:var(--T);font-weight:700}" +
  ".ga{height:4px;background:var(--G);border-radius:2px;margin:0 0 6px}" +
  ".gf{height:4px;border-radius:2px;background:var(--A)}" +
  ".row{display:flex;gap:6px;margin:8px 0 4px}" +
  ".row button{flex:1}" +
  "button{font:inherit;font-size:13px;padding:7px 4px;border-radius:8px;border:1px solid #2C2C2C;background:#161616;color:#FFF;cursor:pointer}" +
  "button:disabled{opacity:.55}" +
  "#btn-refresh{background:var(--A);border-color:var(--A);color:#0A0A0A;font-weight:700}" +
  ".ft{font-size:11px;color:var(--H);padding:6px 0 8px;border-top:1px solid var(--S)}" +
  ".st{font-size:12px;color:var(--H);min-height:15px}" +
  // command-widget additions: hero, change pill, sparkline, list rows.
  ".hero{font-size:34px;font-weight:800;line-height:1;color:var(--A);padding:6px 0 2px}" +
  ".hero small{display:block;font-size:10px;font-weight:600;color:var(--H);margin-top:3px;letter-spacing:.15em}" +
  ".ch{display:inline-block;font-size:12px;font-weight:700;padding:2px 8px;border-radius:20px;border:1px solid var(--A);color:var(--L);background:#14110A}" +
  ".ch.dn{border-color:#E5484D;color:#FF9A9A;background:#1A0F0F}" +
  ".ch.fl{border-color:#2C2C2C;color:var(--H);background:#161616}" +
  ".sp{display:flex;align-items:flex-end;gap:4px;height:36px;padding:8px 0 0;border-top:1px solid var(--S)}" +
  ".sp .b{flex:1;background:var(--A);border-radius:2px 2px 0 0;min-height:3px}" +
  ".sp .b.dn{background:#E5484D}" +
  ".spl{display:flex;gap:4px;font-size:10px;color:var(--H);padding:2px 0 6px}" +
  ".spl span{flex:1;text-align:center}" +
  ".lr{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:5px 0;border-top:1px solid var(--S);font-size:13px}" +
  ".lr .k{color:var(--H);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
  ".lr b{color:#FFF;text-align:right;white-space:nowrap}" +
  ".lr .rk{color:var(--A);font-weight:800;min-width:18px}" +
  ".pc{font-weight:700}" +
  ".pc.dn{color:#FF9A9A}" +
  ".pc.up{color:var(--L)}" +
  ".mini{height:5px;background:var(--G);border-radius:3px;margin:1px 0 4px}" +
  ".mini>i{display:block;height:5px;border-radius:3px;background:var(--A)}" +
  ".nt{font-size:12px;color:var(--H);line-height:1.45;padding:4px 0 6px}";

const JS_CORE =
  "var W=window.TelegramWidget,D=window.__D;" +
  "function $(id){return document.getElementById(id)}" +
  "function set(id,t){var e=$(id);if(e)e.textContent=t}" +
  "function st(s){var e=$('status');if(e)e.textContent=s}" +
  "function usd(v){if(v===null||v===undefined||isNaN(v))return'unknown';if(v>=1e6)return '$'+(v/1e6).toFixed(2)+'M';if(v>=1e3)return '$'+(v/1e3).toFixed(1)+'K';return '$'+v.toFixed(2)}" +
  "function prc(v){if(v===null||v===undefined||isNaN(v))return'unknown';if(v>=1)return '$'+v.toFixed(2);if(v>=0.01)return '$'+v.toFixed(4);return '$'+Number(v.toPrecision(4)).toString()}" +
  "function pct(v){if(v===null||v===undefined||isNaN(v))return'—';return (v>=0?'+':'')+v.toFixed(1)+'%'}" +
  "function tstr(iso){return iso?iso.slice(11,16)+' UTC':''}" +
  "function esc(s){return String(s===null||s===undefined?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}" +
  "function clsFor(v){return v===null||v===undefined||isNaN(v)?'fl':(v>=0?'':'dn')}";

/** Client JS for a mint widget: Refresh (request "<prefix>:<mint>"),
 * Copy CA, Open in OrbitX. onData is the widget-specific field updates. */
function jsMint(prefix, onData) {
  return (
    "(function(){" +
    JS_CORE +
    "$('btn-refresh').addEventListener('click',function(){" +
    "if(!W||typeof W.request!=='function'){st('Refresh needs the Telegram app');return}" +
    "var b=$('btn-refresh');b.disabled=true;b.textContent='Refreshing…';st('');" +
    "W.request('" +
    prefix +
    ":'+D.m).then(function(a){" +
    "b.disabled=false;b.textContent='Refresh';" +
    "var d=null;try{d=JSON.parse(a.result||'null')}catch(e){d=null}" +
    "if(!d||d.e){st(d&&d.e?('Refresh failed — '+d.e):'Refresh failed — try again');return}" +
    onData +
    "set('asof','Updated '+tstr(d.ts)+' · Not financial advice.');" +
    "st('Updated just now');" +
    "},function(e){b.disabled=false;b.textContent='Refresh';st('Refresh failed ('+(e&&e.code?e.code:'try again')+')')});" +
    "});" +
    "$('btn-copy').addEventListener('click',function(){if(W&&W.copyText)W.copyText(D.m)});" +
    "$('btn-open').addEventListener('click',function(){if(W&&W.openLink)W.openLink('https://orbitx.world/scanner/'+D.m)});" +
    "if(W&&W.ready)W.ready();" +
    "})();"
  );
}

/** Client JS for the trending widget: Refresh re-ranks (request "t:").
 * Rows are rebuilt from the compact answer array. */
const JS_TRENDING =
  "(function(){" +
  JS_CORE +
  "function rowHtml(x,i){" +
  "var c=x[4];" +
  "return '<div class=lr><span class=k><span class=rk>'+(i+1)+'.</span> '+esc(x[0])+'</span><span><b>'+prc(x[1])+'</b> <span class=\"pc '+clsFor(c)+'\">'+pct(c)+'</span></span></div>'+" +
  "'<div class=mt>MCAP '+(x[2]===null?'—':usd(x[2]))+' · Vol '+(x[3]===null?'—':usd(x[3]))+'</div>';" +
  "}" +
  "$('btn-refresh').addEventListener('click',function(){" +
  "if(!W||typeof W.request!=='function'){st('Refresh needs the Telegram app');return}" +
  "var b=$('btn-refresh');b.disabled=true;b.textContent='Refreshing…';st('');" +
  "W.request('t:').then(function(a){" +
  "b.disabled=false;b.textContent='Refresh';" +
  "var d=null;try{d=JSON.parse(a.result||'null')}catch(e){d=null}" +
  "if(!d||d.e){st(d&&d.e?('Refresh failed — '+d.e):'Refresh failed — try again');return}" +
  "var R=$('rows');if(R&&d.r)R.innerHTML=d.r.map(rowHtml).join('');" +
  "set('asof','Updated '+tstr(d.ts)+' · Source: GeckoTerminal · Not financial advice.');" +
  "st('Updated just now');" +
  "},function(e){b.disabled=false;b.textContent='Refresh';st('Refresh failed ('+(e&&e.code?e.code:'try again')+')')});" +
  "});" +
  "$('btn-open').addEventListener('click',function(){if(W&&W.openLink)W.openLink('https://orbitx.world/intel')});" +
  "if(W&&W.ready)W.ready();" +
  "})();";

// ── shared shell helpers ──────────────────────────────────────────────────
function checkCaps(html) {
  const clean = html.replace(/\u0000/g, "");
  const rawBytes = Buffer.byteLength(clean, "utf8");
  if (rawBytes > WIDGET_HTML_MAX) {
    throw new Error(`widget html ${rawBytes} bytes exceeds ${WIDGET_HTML_MAX}`);
  }
  const compBytes = deflateSync(clean, { level: 9 }).length;
  if (compBytes > WIDGET_HTML_COMPRESSED_MAX) {
    throw new Error(`widget html ${compBytes} bytes (zlib-9) exceeds ${WIDGET_HTML_COMPRESSED_MAX}`);
  }
  return clean;
}
function shell(result, body, js, data) {
  return (
    "<!doctype html><html><head><meta charset='utf-8'><style>" +
    WIDGET_CSS +
    "</style></head><body>" +
    "<div class=br>ORBITX</div>" +
    body +
    "<script>window.__D=" +
    embedJson(data) +
    ";" +
    js +
    "</script></body></html>"
  );
}
function buttons() {
  return (
    "<div class='row'>" +
    "<button id='btn-refresh'>Refresh</button>" +
    "<button id='btn-copy'>Copy CA</button>" +
    "<button id='btn-open'>Open in OrbitX</button>" +
    "</div><div class='st' id='status'></div>"
  );
}
function lr(k, v) {
  return `<div class=lr><span class=k>${k}</span><b>${v}</b></div>`;
}
function chgPill(v) {
  // Gold pill for up/flat, muted red for down — the only extra accent,
  // and only to say which way the number moved.
  if (v == null || !Number.isFinite(v)) return `<span class="ch fl" id=chg>—</span>`;
  return `<span class="ch${v < 0 ? " dn" : ""}" id=chg>${fmtPct(v)}</span>`;
}
function pctClass(v) {
  if (v == null || !Number.isFinite(v)) return "";
  return v < 0 ? " dn" : " up";
}

/**
 * /price — live price widget. Hero is the price; the sparkline is the
 * 5m / 1h / 6h / 24h changes (real values from the scan — there is no
 * price-history series in the scan payload, so the four change windows
 * ARE the sparkline, labeled as such).
 */
export function buildPriceWidget(result) {
  const title = titleOf(result);
  const short = shortOf(result.mint);
  const chgs = [result.change5m, result.change1h, result.change6h, result.change24h];
  const maxAbs = Math.max(0, ...chgs.map((v) => (v == null ? 0 : Math.abs(v))));
  const spark =
    chgs.every((v) => v == null)
      ? `<div class=nt>Price history — unknown — no change windows returned</div>`
      : `<div class=sp id=spb>${chgs
          .map(
            (v) =>
              `<div class="b${v != null && v < 0 ? " dn" : ""}" style="height:${maxAbs > 0 ? Math.round(3 + (Math.abs(v || 0) / maxAbs) * 25) : 4}px"></div>`,
          )
          .join("")}</div><div class=spl><span>5m</span><span>1h</span><span>6h</span><span>24h</span></div>`;
  const pair0 = Array.isArray(result.pairs) && result.pairs[0] ? result.pairs[0] : null;
  const body =
    `<div class=nm>${escHtml(title || "Token")} (${escHtml(short)})</div>` +
    `<div class=hero><span id=hero>${txt(fmtPrice(result.price), "—")}</span><small>PRICE${result.symbol ? " · " + escHtml(result.symbol.toUpperCase()) : ""}</small></div>` +
    `<div class=ds>24h change ${chgPill(result.change24h)}</div>` +
    spark +
    `<div class='kv'><span>MCAP <b id=qm>${txt(fmtUsd(result.marketCap), "—")}</b></span><span>Liq <b id=ql>${txt(fmtUsd(result.liquidity), "—")}</b></span><span>Vol 24h <b id=qv>${txt(fmtUsd(result.volume24h), "—")}</b></span></div>` +
    lr("Buys 24h", `<span id=qb>${txt(fmtInt(result.numBuys24h), "—")}</span>`) +
    lr("Sells 24h", `<span id=qs>${txt(fmtInt(result.numSells24h), "—")}</span>`) +
    lr("Traders 24h", `<span id=qt>${txt(fmtInt(result.numTraders24h), "unknown")}</span>`) +
    lr(
      "Net buyers",
      `<span id=qn>${result.netBuyers24h == null ? "unknown" : (result.netBuyers24h >= 0 ? "+" : "") + fmtInt(result.netBuyers24h)}</span>`,
    ) +
    (pair0
      ? lr(
          "Top pair",
          `${escHtml(pair0.dex || "unknown")} — ${escHtml(pair0.quote || "?")}${
            pair0.liquidity != null ? ` · ${fmtUsd(pair0.liquidity)}` : ""
          }`,
        )
      : lr("Top pair", "unknown — no DEX pairs found")) +
    buttons() +
    `<div class='ft' id='asof'>Scanned ${tstr(result.scannedAt)} · Not financial advice.</div>`;
  const onData =
    "set('hero',d.p===null?'—':prc(d.p));" +
    "var ch=$('chg');if(ch){ch.textContent=d.c24===null?'—':pct(d.c24);ch.className='ch '+clsFor(d.c24);}" +
    "set('qm',d.mc===null?'—':usd(d.mc));set('ql',d.l===null?'—':usd(d.l));set('qv',d.v===null?'—':usd(d.v));" +
    "set('qb',d.b===null?'—':Number(d.b).toLocaleString('en-US'));set('qs',d.s===null?'—':Number(d.s).toLocaleString('en-US'));" +
    "set('qt',d.tr===null?'unknown':Number(d.tr).toLocaleString('en-US'));" +
    "set('qn',d.nb===null?'unknown':(d.nb>=0?'+':'')+Number(d.nb).toLocaleString('en-US'));" +
    "var sp=$('spb');if(sp&&d.sp){var mx=0;for(var i=0;i<d.sp.length;i++)mx=Math.max(mx,Math.abs(d.sp[i]||0));var h='';for(var j=0;j<d.sp.length;j++){var v=d.sp[j]||0;h+='<div class=\"b'+(v<0?' dn':'')+'\" style=\"height:'+(mx>0?Math.round(3+Math.abs(v)/mx*25):4)+'px\"></div>'}sp.innerHTML=h;}";
  return { html: checkCaps(shell(result, body, jsMint("p", onData), { m: result.mint })), caption: buildPriceCaption(result) };
}

export function buildPriceCaption(result) {
  const title = titleOf(result);
  const short = shortOf(result.mint);
  const bits = [];
  bits.push(title ? `${title} (${short})` : `Token ${short}`);
  bits.push(
    `Price ${fmtPrice(result.price) ?? "—"} · 24h ${fmtPct(result.change24h) ?? "—"}`,
  );
  const mkt = [];
  if (result.marketCap != null) mkt.push(`MCAP ${fmtUsd(result.marketCap)}`);
  if (result.liquidity != null) mkt.push(`Liq ${fmtUsd(result.liquidity)}`);
  if (result.volume24h != null) mkt.push(`Vol 24h ${fmtUsd(result.volume24h)}`);
  if (mkt.length) bits.push(mkt.join(" · "));
  if (result.numBuys24h != null || result.numSells24h != null) {
    bits.push(
      `Buys ${fmtInt(result.numBuys24h) ?? "—"} · Sells ${fmtInt(result.numSells24h) ?? "—"}`,
    );
  }
  bits.push("Full price view in the widget above — Refresh to re-quote.");
  let text = bits.join("\n");
  if (text.length > 1000) text = text.slice(0, 997) + "…";
  return text;
}

/**
 * /holders — holders widget. Hero is the concentration picture: Top 10
 * share of supply as the big number + a gold bar showing it. Top-5
 * holders get mini bars (width relative to the biggest holder in the
 * list) so the distribution reads at a glance.
 */
export function buildHoldersWidget(result) {
  const title = titleOf(result);
  const short = shortOf(result.mint);
  const t10 = result.top10Pct == null ? 0 : Math.max(0, Math.min(100, result.top10Pct));
  const dv = result.devExited === true ? "Exited" : result.devExited === false ? "Holds" : null;
  const th = Array.isArray(result.topHolders) ? result.topHolders.slice(0, 5) : [];
  const maxTh = Math.max(0, ...th.map((t) => t.pct || 0));
  const thHtml =
    th.length === 0
      ? `<div class=nt>Top holders — unknown — no holder list returned</div>`
      : th
          .map(
            (t) =>
              `<div class=lr><span class=k>· ${escHtml(shortAddr(t.owner) || t.label || "?")}</span><b>${Number(t.pct).toFixed(1)}%${t.usdValue != null ? ` · ${fmtUsd(t.usdValue)}` : ""}</b></div>` +
              `<div class=mini><i style="width:${maxTh > 0 ? Math.round(((t.pct || 0) / maxTh) * 100) : 0}%"></i></div>`,
          )
          .join("");
  const body =
    `<div class=nm>${escHtml(title || "Token")} (${escHtml(short)})</div>` +
    `<div class=hero><span id=hero>${result.top10Pct == null ? "—" : Number(result.top10Pct).toFixed(1) + "%"}</span><small>TOP 10 — SHARE OF SUPPLY</small></div>` +
    `<div class=ga><div class=gf id=cbar style="width:${t10}%"></div></div>` +
    lr("Top holder", `<span id=top>${result.topHolderPct == null ? "unknown" : Number(result.topHolderPct).toFixed(1) + "%"}</span>`) +
    lr(
      "Holders",
      `<span id=h>${result.holders == null ? "unknown" : fmtInt(result.holders) + (result.holderChange24h != null ? ` (${fmtPct(result.holderChange24h)} 24h)` : "")}</span>`,
    ) +
    lr("Whales", `<span id=w>${result.whaleCount == null ? "unknown" : String(result.whaleCount)}</span>`) +
    lr("KOL holders", `<span id=k>${result.kolHolderCount == null ? "0" : String(result.kolHolderCount)}</span>`) +
    lr("Dev position", `<span id=dv>${txt(dv, "unknown")}</span>`) +
    `<div class=ds>Top 5 holders</div><div id=thlist>${thHtml}</div>` +
    buttons() +
    `<div class='ft' id='asof'>Scanned ${tstr(result.scannedAt)} · Not financial advice.</div>`;
  const onData =
    "set('hero',d.t10===null?'—':Number(d.t10).toFixed(1)+'%');" +
    "var cb=$('cbar');if(cb&&cb.style)cb.style.width=(d.t10===null?0:Math.max(0,Math.min(100,d.t10)))+'%';" +
    "set('top',d.top===null?'unknown':Number(d.top).toFixed(1)+'%');" +
    "set('h',d.h===null?'unknown':Number(d.h).toLocaleString('en-US')+(d.hc===null?'':' ('+pct(d.hc)+' 24h)'));" +
    "set('w',d.w===null?'unknown':String(d.w));" +
    "set('k',d.k===null?'0':String(d.k));" +
    "set('dv',d.dv||'unknown');" +
    "if(d.th){var L=$('thlist');if(L){var mx2=0;for(var i2=0;i2<d.th.length;i2++)mx2=Math.max(mx2,d.th[i2][0]||0);L.innerHTML=d.th.map(function(r,i){var o=(D.tho&&D.tho[i])||'?';var w2=mx2>0?Math.round((r[0]||0)/mx2*100):0;return '<div class=lr><span class=k>· '+esc(o)+'</span><b>'+Number(r[0]).toFixed(1)+'%'+(r[1]!==null?' · '+usd(r[1]):'')+'</b></div><div class=mini><i style=\"width:'+w2+'%\"></i></div>'}).join('')}}";
  const tho = th.map((t) => shortAddr(t.owner) || t.label || "?");
  return { html: checkCaps(shell(result, body, jsMint("h", onData), { m: result.mint, tho })), caption: buildHoldersCaption(result) };
}

export function buildHoldersCaption(result) {
  const title = titleOf(result);
  const short = shortOf(result.mint);
  const bits = [];
  bits.push(title ? `${title} (${short})` : `Token ${short}`);
  const conc = [];
  if (result.holders != null) conc.push(`Holders ${fmtInt(result.holders)}`);
  if (result.topHolderPct != null) conc.push(`Top ${Number(result.topHolderPct).toFixed(1)}%`);
  if (result.top10Pct != null) conc.push(`Top 10 ${Number(result.top10Pct).toFixed(1)}%`);
  if (result.whaleCount != null) conc.push(`Whales ${result.whaleCount}`);
  bits.push(conc.length ? conc.join(" · ") : "Holder data unknown");
  bits.push(
    result.devExited === true ? "Dev exited" : result.devExited === false ? "Dev holds" : "Dev position unknown",
  );
  bits.push("Top holders in the widget above — Refresh to re-check.");
  let text = bits.join("\n");
  if (text.length > 1000) text = text.slice(0, 997) + "…";
  return text;
}

/**
 * /bundle — bundle check widget. Hero is the verdict: bundled supply %
 * as the big number + the verdict pill + a gauge. The engine does not
 * expose per-wallet bundle membership, so the widget shows what exists
 * (verdict, %, clusters, risk, note) plus dev position and top holder
 * as context — never a fabricated wallet list.
 */
export function buildBundleWidget(result) {
  const title = titleOf(result);
  const short = shortOf(result.mint);
  const b = result.bundle || {};
  const bp = b.bundledSupplyPct == null ? 0 : Math.max(0, Math.min(100, b.bundledSupplyPct));
  const dv = result.devExited === true ? "Exited" : result.devExited === false ? "Holds" : null;
  const body =
    `<div class=nm>${escHtml(title || "Token")} (${escHtml(short)})</div>` +
    `<div class=hero><span id=hero>${b.bundledSupplyPct == null ? "—" : Number(b.bundledSupplyPct).toFixed(1) + "%"}</span><small>BUNDLED SUPPLY</small></div>` +
    `<span class=vd id=vd>${escHtml(b.available === false ? "Bundle check unavailable" : b.verdict || "Unknown")}</span>` +
    `<div class=ga style="margin-top:6px"><div class=gf id=gbar style="width:${bp}%"></div></div>` +
    lr("Clusters", `<span id=cc>${b.clusterCount == null ? "unknown" : String(b.clusterCount)}</span>`) +
    lr("Bundle risk", `<span id=br>${txt(b.bundleRisk, "unknown")}</span>`) +
    lr("Dev position", `<span id=dv>${txt(dv, "unknown")}</span>`) +
    lr("Top holder", `<span id=top>${result.topHolderPct == null ? "unknown" : Number(result.topHolderPct).toFixed(1) + "%"}</span>`) +
    `<div class=nt id=nt>${escHtml(b.available === false ? "Bundle check unavailable — treated as unknown, not as safe." : shortNote(b.note, 140) || "No bundle note.")}</div>` +
    buttons() +
    `<div class='ft' id='asof'>Scanned ${tstr(result.scannedAt)} · Not financial advice.</div>`;
  const onData =
    "set('hero',d.bp===null?'—':Number(d.bp).toFixed(1)+'%');" +
    "var gb=$('gbar');if(gb&&gb.style)gb.style.width=(d.bp===null?0:Math.max(0,Math.min(100,d.bp)))+'%';" +
    "set('vd',d.v||'Unknown');set('cc',d.cc===null?'unknown':String(d.cc));set('br',d.br||'unknown');set('dv',d.dv||'unknown');set('top',d.top===null?'unknown':Number(d.top).toFixed(1)+'%');" +
    "if(d.nt!==undefined)set('nt',d.nt||'No bundle note.');";
  return { html: checkCaps(shell(result, body, jsMint("b", onData), { m: result.mint })), caption: buildBundleCaption(result) };
}

export function buildBundleCaption(result) {
  const title = titleOf(result);
  const short = shortOf(result.mint);
  const b = result.bundle || {};
  const bits = [];
  bits.push(title ? `${title} (${short})` : `Token ${short}`);
  if (b.available === false) {
    bits.push("Bundle: check unavailable — unknown, not safe");
  } else {
    bits.push(
      `Bundle: ${b.verdict || "—"}${b.bundledSupplyPct != null ? ` (${Number(b.bundledSupplyPct).toFixed(1)}% bundled)` : ""}${b.clusterCount != null ? ` · ${b.clusterCount} clusters` : ""}`,
    );
    if (b.bundleRisk) bits.push(`Risk: ${b.bundleRisk}`);
    if (b.note) bits.push(shortNote(b.note, 120));
  }
  bits.push("Full bundle check in the widget above — Refresh to re-check.");
  let text = bits.join("\n");
  if (text.length > 1000) text = text.slice(0, 997) + "…";
  return text;
}

/**
 * /trending — ranked trending tokens. Rows are [symbol, price, mcap,
 * volume24h, change24h] from fetchTrending() (GeckoTerminal trending
 * pools, Solana, GT order). No mint, no copy button — Refresh re-ranks.
 */
export function buildTrendingWidget(rows, scannedAt) {
  const list = Array.isArray(rows) ? rows.slice(0, 8) : [];
  const rowsHtml =
    list.length === 0
      ? `<div class=nt>Trending — unknown — the trending feed didn't answer</div>`
      : list
          .map(
            (x, i) =>
              `<div class=lr><span class=k><span class=rk>${i + 1}.</span> <b>${escHtml(x.symbol || "?")}</b></span><span><b>${txt(fmtPrice(x.price), "—")}</b> <span class="pc${pctClass(x.change24h)}">${txt(fmtPct(x.change24h), "—")}</span></span></div>` +
              `<div class=mt>MCAP ${txt(fmtUsd(x.mcap), "—")} · Vol ${txt(fmtUsd(x.volume24h), "—")}</div>`,
          )
          .join("");
  const body =
    `<div class=nm>Trending on Solana</div>` +
    `<div class=mt>GeckoTerminal trending pools · ranked by GT</div>` +
    `<div id=rows>${rowsHtml}</div>` +
    "<div class='row'><button id='btn-refresh'>Refresh</button><button id='btn-open'>Open in OrbitX</button></div><div class='st' id='status'></div>" +
    `<div class='ft' id='asof'>Updated ${tstr(scannedAt || new Date().toISOString())} · Source: GeckoTerminal · Not financial advice.</div>`;
  return { html: checkCaps(shell(null, body, JS_TRENDING, { k: "t" })), caption: buildTrendingCaption(list) };
}

export function buildTrendingCaption(rows) {
  const list = Array.isArray(rows) ? rows.slice(0, 5) : [];
  const bits = ["Trending on Solana — GeckoTerminal"];
  for (let i = 0; i < list.length; i++) {
    const x = list[i];
    bits.push(
      `#${i + 1} ${x.symbol || "?"} ${fmtPrice(x.price) ?? "—"} (${fmtPct(x.change24h) ?? "—"} 24h)`,
    );
  }
  if (!list.length) bits.push("Trending feed didn't answer — try again.");
  bits.push("Full top 8 in the widget — Refresh to re-rank.");
  let text = bits.join("\n");
  if (text.length > 1000) text = text.slice(0, 997) + "…";
  return text;
}

/**
 * Parse a widget request's data (1-64 bytes).
 * "p:<mint>" price refresh, "h:<mint>" holders refresh, "b:<mint>"
 * bundle refresh, "t:" trending refresh (no mint).
 * Returns { kind, mint } (mint null for trending) or null.
 */
export function parseCmdWidgetRequest(data) {
  if (typeof data !== "string") return null;
  if (data === "t:") return { kind: "trending", mint: null };
  const m = data.match(/^([phb]):([1-9A-HJ-NP-Za-km-z]{32,44})$/);
  if (!m) return null;
  return { kind: m[1] === "p" ? "price" : m[1] === "h" ? "holders" : "bundle", mint: m[2] };
}

function refreshAnswer(d) {
  const s = JSON.stringify(d);
  if (Buffer.byteLength(s, "utf8") > WIDGET_ANSWER_MAX) {
    throw new Error(`refresh answer ${Buffer.byteLength(s, "utf8")} bytes exceeds ${WIDGET_ANSWER_MAX}`);
  }
  return s;
}
const tsNow = (r) => r.scannedAt || new Date().toISOString();

/** Compact answer for a /price refresh. */
export function buildPriceRefreshData(result) {
  return refreshAnswer({
    p: num(result.price),
    mc: num(result.marketCap),
    l: num(result.liquidity),
    v: num(result.volume24h),
    c24: num(result.change24h),
    sp: [num(result.change5m), num(result.change1h), num(result.change6h), num(result.change24h)],
    b: num(result.numBuys24h),
    s: num(result.numSells24h),
    tr: num(result.numTraders24h),
    nb: num(result.netBuyers24h),
    ts: tsNow(result),
  });
}

/** Compact answer for a /holders refresh. Top-5 as [pct, usd] pairs —
 * owners are already embedded in the widget (D.tho), so the answer
 * stays small. */
export function buildHoldersRefreshData(result) {
  const th = Array.isArray(result.topHolders) ? result.topHolders.slice(0, 5) : [];
  return refreshAnswer({
    h: num(result.holders),
    hc: num(result.holderChange24h),
    top: num(result.topHolderPct),
    t10: num(result.top10Pct),
    w: num(result.whaleCount),
    k: num(result.kolHolderCount),
    th: th.map((t) => [num(t.pct), num(t.usdValue)]),
    dv: result.devExited === true ? "Exited" : result.devExited === false ? "Holds" : null,
    ts: tsNow(result),
  });
}

/** Compact answer for a /bundle refresh. */
export function buildBundleRefreshData(result) {
  const b = result.bundle || {};
  return refreshAnswer({
    bp: num(b.bundledSupplyPct),
    cc: num(b.clusterCount),
    br: b.bundleRisk || null,
    v: b.available === false ? "Bundle check unavailable" : b.verdict || null,
    nt: b.available === false
      ? "Bundle check unavailable — treated as unknown, not as safe."
      : shortNote(b.note, 140),
    dv: result.devExited === true ? "Exited" : result.devExited === false ? "Holds" : null,
    top: num(result.topHolderPct),
    ts: tsNow(result),
  });
}

/** Compact answer for a /trending refresh — rows as [sym, price, mcap,
 * volume24h, change24h], symbol truncated to 12 chars. An empty feed
 * answers as an error so the widget keeps its old rows instead of
 * blanking the list. */
export function buildTrendingRefreshData(rows) {
  const list = Array.isArray(rows) ? rows.slice(0, 8) : [];
  if (!list.length) return refreshAnswer({ e: "trending feed didn't answer" });
  return refreshAnswer({
    r: list.map((x) => [
      String(x.symbol || "?").slice(0, 12),
      num(x.price),
      num(x.mcap),
      num(x.volume24h),
      num(x.change24h),
    ]),
    ts: new Date().toISOString(),
  });
}

// ── /trending data: GeckoTerminal trending pools (Solana) ─────────────────
// Same source the repo's /screener ?type=trending serves (fetchGecko-
// Trending in ./_screener.js) — a genuine trending feed, ranked by
// GeckoTerminal. Not imported from _screener.js: its helpers aren't
// exported and its default export is the route handler.

// The GT pool id looks like "solana_<mint>" (base token) / pool address.
function mintFromGtId(id) {
  if (!id) return null;
  const parts = String(id).split("_");
  const last = parts[parts.length - 1];
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(last) ? last : null;
}

/**
 * Fetch the current trending tokens on Solana from GeckoTerminal.
 * Returns normalized rows [{ symbol, name, mint, price, mcap,
 * volume24h, change24h }] in GT rank order, stables filtered out.
 * Returns [] on any failure (caller falls back to a text reply).
 */
export async function fetchTrending(limit = 8) {
  let gt = null;
  // One retry after 500ms (same as _screener's gtGet) — GT's free tier
  // 429s / hiccups on single calls; a blank refresh is the failure mode.
  for (let attempt = 0; attempt < 2 && !gt; attempt++) {
    try {
      const r = await fetch(GT_TRENDING_URL, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) gt = await r.json();
    } catch {
      gt = null;
    }
    if (!gt && attempt === 0) await new Promise((res) => setTimeout(res, 500));
  }
  if (!gt) return [];
  const tokenMap = {};
  for (const inc of gt.included || []) {
    if (inc.type === "token") tokenMap[inc.id] = inc.attributes;
  }
  const seen = new Set();
  const out = [];
  for (const item of gt.data || []) {
    const a = item.attributes || {};
    const rel = item.relationships || {};
    const baseTokenId = rel.base_token?.data?.id;
    const bt = tokenMap[baseTokenId] || {};
    const mint = bt.address || mintFromGtId(baseTokenId);
    if (!mint || seen.has(mint)) continue;
    const sym = bt.symbol || (a.name || "").split(" / ")[0].trim() || null;
    if (!sym || STABLES.has(String(sym).toUpperCase())) continue;
    seen.add(mint);
    out.push({
      mint,
      symbol: sym,
      name: bt.name || sym,
      price: num(a.base_token_price_usd),
      mcap: num(a.market_cap_usd ?? a.fdv_usd),
      volume24h: num(a.volume_usd?.h24),
      change24h: num(a.price_change_percentage?.h24),
    });
    if (out.length >= limit) break;
  }
  return out;
}
