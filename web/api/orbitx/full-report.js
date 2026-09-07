/**
 * orbitx_full_report — max-depth token dossier.
 * In-process ogdex handlers only (never self-HTTP /api/ogdex from this isolate).
 */
import tokenHandler from "../ogdex/_routes/token.js";
import metadataHandler from "../ogdex/_routes/metadata.js";
import athHandler from "../ogdex/_routes/ath.js";
import forensicsHandler from "../ogdex/_routes/forensics.js";
import safetyHandler from "../ogdex/_routes/safety.js";
import xrayHandler from "../ogdex/_routes/xray.js";
import chartHandler from "../ogdex/_routes/chart.js";
import researchHandler from "../ogdex/_routes/research.js";
import searchHandler from "../ogdex/_routes/search.js";
import { computePnl } from "../ogdex/_pnl.js";
import { extractMintFromText, looksLikeMint, parseIntelIntent, stripGmgnPrefix } from "./full-report-parse.js";
import {
  assertNeverCleanIfUntraced,
  classifyWalletExit,
  clusterReport,
  computeVerdict,
  DISCLAIMER,
} from "./full-report-verdict.js";
import { formatFullReportMarkdown, formatFullReportTelegramHtml } from "./full-report-markdown.js";
import { pdfFilename, renderFullReportPdf } from "./full-report-pdf.js";
import { mapPool, pickHumanHolders, withTimeout } from "./full-report-wallets.js";

const HOST = "https://www.orbitx.world";
const UNKNOWN = "UNKNOWN";
const NOT_TRACED = "NOT TRACED";
const PARTIAL = "PARTIAL";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function invokeOgdexHandler(handler, pathWithQuery) {
  return new Promise((resolve, reject) => {
    const req = { url: pathWithQuery, method: "GET", headers: {} };
    const headers = Object.create(null);
    let done = false;
    const finish = (status, body) => {
      if (done) return;
      done = true;
      let parsed = body;
      if (Buffer.isBuffer(body)) {
        try {
          parsed = JSON.parse(body.toString("utf8"));
        } catch {
          parsed = { raw: body.toString("utf8") };
        }
      } else if (typeof body === "string") {
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = { raw: body };
        }
      }
      resolve({ status, body: parsed });
    };
    const res = {
      statusCode: 200,
      setHeader(k, v) {
        headers[String(k).toLowerCase()] = v;
      },
      getHeader(k) {
        return headers[String(k).toLowerCase()];
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      send(payload) {
        finish(this.statusCode || 200, payload);
      },
      json(obj) {
        finish(this.statusCode || 200, obj);
      },
      end(payload) {
        finish(this.statusCode || 200, payload);
      },
    };
    try {
      Promise.resolve(handler(req, res))
        .then((maybe) => {
          if (!done && maybe !== undefined) finish(res.statusCode || 200, maybe);
        })
        .catch(reject);
    } catch (e) {
      reject(e);
    }
  });
}

async function retryOnce(label, fn) {
  try {
    return { ok: true, data: await fn(), partial: false, section: label };
  } catch (e1) {
    try {
      return { ok: true, data: await fn(), partial: false, retried: true, section: label };
    } catch (e2) {
      return {
        ok: false,
        data: null,
        partial: true,
        section: label,
        error: String(e2?.message || e2 || e1?.message || e1),
      };
    }
  }
}

async function callHandler(label, handler, path) {
  return retryOnce(label, async () => {
    const out = await invokeOgdexHandler(handler, path);
    const body = out?.body;
    if (out?.status >= 400) throw new Error(`${label} HTTP ${out.status}`);
    if (body && body.ok === false && body.error) throw new Error(String(body.error));
    return body;
  });
}

function ageFrom(iso) {
  if (!iso) return { label: UNKNOWN, hours: null };
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return { label: UNKNOWN, hours: null };
  const hours = (Date.now() - t) / 3600000;
  if (hours < 0) return { label: UNKNOWN, hours: null };
  if (hours < 48) return { label: `${Math.round(hours * 10) / 10}h`, hours };
  return { label: `${Math.round(hours / 24)}d`, hours };
}

function athAtlFromCandles(candles) {
  const list = Array.isArray(candles) ? candles : [];
  let ath = null;
  let atl = null;
  let athAt = null;
  let atlAt = null;
  for (const c of list) {
    const h = num(c.high);
    const l = num(c.low);
    const t = c.time != null ? c.time : null;
    if (h != null && (ath == null || h > ath)) {
      ath = h;
      athAt = t;
    }
    if (l != null && l > 0 && (atl == null || l < atl)) {
      atl = l;
      atlAt = t;
    }
  }
  return { ath, atl, athAt, atlAt };
}

function ts(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    const ms = v < 1e12 ? v * 1000 : v;
    const d = new Date(ms);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toISOString() : String(v);
}

function programOf(meta, token) {
  const prog = String(meta?.tokenProgram || token?.tokenProgram || token?.programId || "");
  if (meta?.isToken2022 || /tokenz/i.test(prog) || prog === "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb") {
    return "Token-2022";
  }
  if (prog || token) return "SPL";
  return UNKNOWN;
}

function boolLabel(v, yes, no) {
  if (v === true) return yes;
  if (v === false) return no;
  return UNKNOWN;
}

export function buildWhatYouShouldKnow(d) {
  const cover = d.cover || {};
  const snap = d.snapshot || {};
  const contract = d.contract || {};
  const bundles = d.bundles || {};
  const snipers = d.snipers || {};
  const insiders = d.insiders || {};
  const dev = d.dev || {};
  const holders = d.holders || {};
  const price = d.priceHistory || {};
  const out = [];
  out.push(`Desk verdict is ${cover.verdict || UNKNOWN} (confidence ${cover.confidence || UNKNOWN}).`);
  out.push(`Token age on this tape: ${cover.age || UNKNOWN}.`);
  out.push(
    contract.canSell === true
      ? "A sell route was found."
      : contract.canSell === false
        ? "No sell route was found."
        : "Sell route is UNKNOWN.",
  );
  out.push(`Mint authority: ${contract.mintAuthority || UNKNOWN}. Freeze: ${contract.freezeAuthority || UNKNOWN}.`);
  out.push(`LP lock: ${contract.lpLock || UNKNOWN}.`);
  out.push(`Bundles: ${bundles.display || UNKNOWN}.`);
  out.push(`Snipers: ${snipers.display || UNKNOWN}. Insiders: ${insiders.display || UNKNOWN}.`);
  out.push(
    `Dev wallet ${dev.wallet || UNKNOWN} · holding now ${dev.pctNow == null ? UNKNOWN : `${dev.pctNow}%`} · sold ${dev.sold == null ? UNKNOWN : String(dev.sold)}.`,
  );
  out.push(`Top 10 ex-LP concentration: ${holders.top10PctWithoutLp == null ? UNKNOWN : `${holders.top10PctWithoutLp}%`}.`);
  out.push(`ATH ${price.ath == null ? UNKNOWN : price.ath} · % from ATH ${price.pctFromAth == null ? UNKNOWN : `${price.pctFromAth}%`}.`);
  out.push(`Liquidity ${snap.liquidity == null ? UNKNOWN : snap.liquidity} · holders ${snap.holders == null ? UNKNOWN : snap.holders}.`);
  if (Array.isArray(d.gaps) && d.gaps[0]) out.push(`Gap: ${d.gaps[0]}.`);
  return out.slice(0, 12);
}

function sourcesFrom(sections) {
  return sections
    .filter(Boolean)
    .map((s) => (s.ok ? `${s.section}: ok${s.retried ? " (retry)" : ""}` : `${s.section}: ${PARTIAL} — ${s.error || "failed"}`));
}

export async function resolveMintInput(raw, { search } = {}) {
  const text = String(raw || "").trim();
  let mint = extractMintFromText(text) || stripGmgnPrefix(text);
  if (!looksLikeMint(mint) && text && search) {
    const found = await search(text);
    mint = found || "";
  }
  if (!looksLikeMint(mint)) mint = looksLikeMint(text) ? text : "";
  return mint;
}

export async function runFullReport(args = {}, opts = {}) {
  const rawMint = args.mint || args.ca || args.q || args.query || "";
  const chain = String(args.chain || "solana").trim() || "solana";
  const intent = parseIntelIntent(`${rawMint} ${args.depth || ""} ${args.format || ""} ${args.pdf ? "pdf" : ""}`);
  let depth = String(args.depth || intent.depth || "max").toLowerCase();
  if (!["quick", "standard", "max"].includes(depth)) depth = "max";
  const includeSocial = args.includeSocial !== false && args.includeSocial !== 0 && !intent.bundleOnly;
  const includeWallets = args.includeWallets !== false && args.includeWallets !== 0 && depth !== "quick" && !intent.socialOnly;
  const walletLimit = Math.min(15, Math.max(0, Number(args.walletLimit) || (depth === "max" ? 12 : 8)));
  const format = String(args.format || "json").toLowerCase();
  const wantPdf = format === "pdf" || args.pdf === true || intent.pdf;

  const invoke = opts.invoke || invokeOgdexHandler;
  const call = (label, handler, path) =>
    retryOnce(label, async () => {
      const out = await invoke(handler, path);
      const body = out?.body ?? out;
      if (out?.status >= 400) throw new Error(`${label} HTTP ${out.status}`);
      if (body && body.ok === false && body.error) throw new Error(String(body.error));
      return body;
    });

  const mint = await resolveMintInput(rawMint, {
    search: async (q) => {
      const s = await call("search", searchHandler, `/search?q=${encodeURIComponent(q)}`);
      const row = s.ok ? s.data?.rows?.[0] : null;
      return row?.mint || row?.address || "";
    },
  });

  if (!mint) {
    const empty = {
      ok: false,
      error: "mint required",
      cover: {
        name: UNKNOWN,
        ticker: UNKNOWN,
        ca: "",
        verdict: "INSUFFICIENT DATA",
        confidence: "low",
        age: UNKNOWN,
        chain,
        links: {},
      },
      gaps: ["No mint could be parsed from the input."],
      disclaimer: DISCLAIMER,
    };
    empty.markdown = formatFullReportMarkdown(empty);
    empty.telegramHtml = formatFullReportTelegramHtml(empty);
    if (format === "markdown") empty.__mcpFormat = "markdown";
    return empty;
  }

  const q = (path) => `${path}${path.includes("?") ? "&" : "?"}mint=${encodeURIComponent(mint)}`;

  const [tokenSec, metaSec, athSec] = await Promise.all([
    call("token", tokenHandler, q(`/token?chain=${encodeURIComponent(chain)}`)),
    call("metadata", metadataHandler, q("/metadata")),
    call("ath", athHandler, q("/ath")),
  ]);

  const tokenBody = tokenSec.ok ? tokenSec.data : null;
  const token = tokenBody?.token || null;
  const meta = tokenBody?.meta || {};
  const onchainMeta = metaSec.ok ? metaSec.data : null;
  const athBody = athSec.ok ? athSec.data : null;

  const [xraySec, forensicsSec, safetySec] = await Promise.all([
    call("xray", xrayHandler, q("/xray")),
    call("forensics", forensicsHandler, depth === "quick" ? q("/forensics?first=0") : q("/forensics")),
    call("safety", safetyHandler, q("/safety")),
  ]);

  const createdAt = token?.createdAt || meta.createdAt || null;
  const age = ageFrom(createdAt);
  const young = age.hours != null && age.hours < 48;

  let chart1hSec = { ok: false, section: "chart_1h", partial: true, error: "skipped" };
  let chart5mSec = { ok: false, section: "chart_5m", partial: true, error: "skipped" };
  if (depth !== "quick") {
    chart1hSec = await call("chart_1h", chartHandler, q(`/chart?interval=1h&limit=200&chain=${encodeURIComponent(chain)}`));
    if (young) {
      chart5mSec = await call("chart_5m", chartHandler, q(`/chart?interval=5m&limit=200&chain=${encodeURIComponent(chain)}`));
    }
  }

  let researchSec = { ok: false, section: "research", partial: true, error: "skipped" };
  if (includeSocial && depth !== "quick" && !intent.bundleOnly) {
    researchSec = await call("research", researchHandler, q("/research"));
  }

  const xray = xraySec.ok ? xraySec.data : null;
  const forensics = forensicsSec.ok ? forensicsSec.data : null;
  const safety = safetySec.ok ? safetySec.data : null;
  const research = researchSec.ok ? researchSec.data : null;
  const traced = xray?.traced === true;

  const bundles = clusterReport({
    pct: xray?.bundles?.pct,
    count: xray?.bundles?.count,
    clusters: xray?.bundles?.clusters,
    traced,
    kind: "bundled",
  });
  const snipers = clusterReport({
    pct: xray?.snipers?.pct,
    count: xray?.snipers?.count,
    wallets: xray?.snipers?.wallets,
    traced,
    kind: "snipers",
  });
  const insiders = clusterReport({
    pct: xray?.insiders?.pct,
    count: xray?.insiders?.count,
    clusters: xray?.insiders?.clusters,
    traced,
    kind: "insiders",
  });

  const holdersRaw = [
    ...(Array.isArray(xray?.holders) ? xray.holders : []),
    ...(Array.isArray(tokenBody?.intel?.holders) ? tokenBody.intel.holders : []),
    ...(Array.isArray(research?.holders) ? research.holders.map((h) => ({
      owner: h.address || h.owner,
      pct: num(h.percent),
      uiAmount: num(h.amount),
      label: h.label,
    })) : []),
  ];
  const seen = new Set();
  const holdersAll = [];
  for (const h of holdersRaw) {
    const owner = String(h.owner || h.address || h.wallet || "").trim();
    if (!owner || seen.has(owner)) continue;
    seen.add(owner);
    holdersAll.push({ ...h, owner });
  }
  const humans = pickHumanHolders(holdersAll, 40);
  const top10WithLp = holdersAll.slice(0, 10);
  const top10WithoutLp = humans.slice(0, 10);
  const top10PctWithLp = top10WithLp.length
    ? top10WithLp.reduce((s, h) => s + (num(h.pct) || 0), 0)
    : xray?.concentration?.top10Pct ?? null;
  const top10PctWithoutLp = xray?.concentration?.top10Pct ?? (top10WithoutLp.length
    ? top10WithoutLp.reduce((s, h) => s + (num(h.pct) || 0), 0)
    : null);

  const pnlFn = opts.computePnl || computePnl;
  let walletRows = [];
  let walletPartial = false;
  if (includeWallets && humans.length) {
    const picked = humans.slice(0, walletLimit);
    const rows = await mapPool(picked, depth === "max" ? 3 : 2, async (h) => {
      const pnl = await withTimeout(pnlFn(h.owner, { sigLimit: depth === "max" ? 60 : 40 }), 8000, null);
      if (!pnl) {
        walletPartial = true;
        return {
          wallet: h.owner,
          pct: h.pct ?? null,
          remaining: h.uiAmount ?? null,
          realizedUsd: null,
          status: NOT_TRACED,
          label: h.label || null,
        };
      }
      const tok = (pnl.perToken || []).find((p) => p.mint === mint) || null;
      const remaining = num(h.uiAmount) ?? num(tok?.tokens) ?? 0;
      const status = classifyWalletExit({
        remaining,
        soldSol: tok?.soldSol,
        boughtSol: tok?.boughtSol,
        realizedUsd: tok?.realizedUsd,
        sells: tok?.sells,
      });
      return {
        wallet: h.owner,
        pct: h.pct ?? null,
        remaining,
        realizedUsd: tok?.realizedUsd ?? null,
        boughtUsd: tok?.boughtUsd ?? null,
        soldUsd: tok?.soldUsd ?? null,
        status,
        label: h.label || null,
      };
    });
    walletRows = rows.filter(Boolean);
  }

  const classified = walletRows.filter((w) => w.status && w.status !== NOT_TRACED);
  const wins = classified
    .filter((w) => num(w.realizedUsd) != null && w.realizedUsd > 0)
    .sort((a, b) => b.realizedUsd - a.realizedUsd)
    .slice(0, 8);
  const losses = classified
    .filter((w) => num(w.realizedUsd) != null && w.realizedUsd < 0)
    .sort((a, b) => a.realizedUsd - b.realizedUsd)
    .slice(0, 8);
  const fullyExited = classified.filter((w) => String(w.status).startsWith("EXITED")).slice(0, 12);

  const candles = [
    ...(chart1hSec.ok && Array.isArray(chart1hSec.data?.candles) ? chart1hSec.data.candles : []),
    ...(chart5mSec.ok && Array.isArray(chart5mSec.data?.candles) ? chart5mSec.data.candles : []),
  ];
  const fromCandles = athAtlFromCandles(candles);
  const athPrice = num(athBody?.athPrice) ?? num(tokenBody?.athPrice) ?? fromCandles.ath;
  const atlPrice = fromCandles.atl;
  const priceNow = num(token?.priceUsd) ?? num(token?.price);
  let pctFromAth = null;
  if (priceNow != null && athPrice != null && athPrice > 0) {
    pctFromAth = Math.round(((priceNow - athPrice) / athPrice) * 1000) / 10;
  }

  const mintRenounced =
    xray?.safety?.mintRenounced ?? forensics?.safetyFlags?.mintRenounced ?? token?.audit?.mintAuthorityDisabled ?? null;
  const freezeRenounced =
    xray?.safety?.freezeRenounced ?? forensics?.safetyFlags?.freezeRenounced ?? token?.audit?.freezeAuthorityDisabled ?? null;
  const lpLockedPct = num(xray?.safety?.lpLockedPct ?? forensics?.safetyFlags?.lpLockedPct);
  const canBuy = safety?.canBuy;
  const canSell = safety?.canSell;
  const liq = num(token?.liquidity) ?? num(research?.meta?.liquidity);
  const thinLiq = liq != null && liq < 5000;
  const socials = {
    ...(meta.socials || {}),
    ...(research?.meta?.links || {}),
  };
  const hasSocial = Boolean(socials.twitter || socials.website || socials.telegram || research?.social?.twitter);
  const devWallet = forensics?.dev?.wallet || xray?.dev?.wallet || research?.launch?.deployer || null;
  const devPct = num(xray?.dev?.pct ?? forensics?.dev?.holding?.pct);
  const devSold = xray?.dev?.sold ?? forensics?.dev?.sold ?? null;
  const silentDev = !hasSocial && !devWallet;
  const authoritiesOff = mintRenounced === true && freezeRenounced === true;
  const lpLocked = lpLockedPct != null && lpLockedPct >= 90;
  const lpUnlocked = lpLockedPct == null ? true : lpLockedPct < 90;

  const gaps = [];
  const sections = [
    tokenSec,
    metaSec,
    athSec,
    xraySec,
    forensicsSec,
    safetySec,
    chart1hSec,
    chart5mSec,
    researchSec,
  ];
  for (const s of sections) {
    if (s.partial && !s.ok) gaps.push(`${s.section}: ${PARTIAL}${s.error ? ` (${s.error})` : ""}`);
  }
  if (!traced) gaps.push("Early-buyer xray not traced.");
  if (!includeWallets) gaps.push("Wallet PnL skipped (depth/quick or includeWallets=false).");
  else if (walletPartial) gaps.push("Some wallet PnL traces timed out — PARTIAL.");
  if (!token) gaps.push("Token snapshot missing.");
  if (!includeSocial || !researchSec.ok) gaps.push("Social / X tape PARTIAL or skipped.");

  const tokenOk = Boolean(token && (token.symbol || token.name || priceNow != null || token.mcap != null));
  const verdictRaw = computeVerdict({
    tokenOk,
    traced,
    canSell,
    canBuy,
    mintOpen: mintRenounced === false,
    freezeOpen: freezeRenounced === false,
    authoritiesOff,
    silentDev,
    lpUnlocked,
    lpLocked,
    bundlePct: bundles.traced ? bundles.pct : null,
    insiderPct: insiders.traced ? insiders.pct : null,
    top10ExLp: top10PctWithoutLp,
    ageHours: age.hours,
    devKnown: Boolean(devWallet),
    devDumped: devSold === true,
    thinLiq,
    safetyOk: Boolean(safety && safety.ok !== false),
    gaps,
    walletPartial,
  });
  const verdict = assertNeverCleanIfUntraced(verdictRaw.verdict, traced);
  const confidence = verdictRaw.confidence;

  const tweets = Array.isArray(research?.social?.twitter?.posts)
    ? research.social.twitter.posts
    : Array.isArray(research?.twitter)
      ? research.twitter
      : [];
  const tweetText = (p) => String(p?.text || p?.title || p || "").replace(/\s+/g, " ").slice(0, 140);
  const first5 = tweets.slice(0, 5).map(tweetText).filter(Boolean);
  const last5 = tweets.slice(-5).map(tweetText).filter(Boolean);
  const copycats = Array.isArray(research?.clones)
    ? research.clones.map((c) => c.mint || c.address || c.ca).filter(Boolean).slice(0, 8)
    : [];

  const name = token?.name || onchainMeta?.name || research?.meta?.name || UNKNOWN;
  const ticker = token?.symbol || onchainMeta?.symbol || research?.meta?.symbol || UNKNOWN;
  const pairs = Array.isArray(tokenBody?.pairs) ? tokenBody.pairs : [];

  const timeline = [];
  if (research?.social?.twitter?.createdAt) timeline.push({ at: ts(research.social.twitter.createdAt), event: "social birth" });
  if (createdAt) timeline.push({ at: ts(createdAt), event: "token / pool create" });
  if (athBody?.athDate || fromCandles.athAt) timeline.push({ at: ts(athBody?.athDate || fromCandles.athAt), event: "ATH" });
  if (devSold === true) timeline.push({ at: UNKNOWN, event: "dev sold (timestamp UNKNOWN)" });
  timeline.push({ at: new Date().toISOString(), event: "now" });

  let github = null;
  const site = String(socials.website || "");
  const gh = site.match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/i);
  if (gh && depth === "max") {
    github = await withTimeout(
      fetch(`https://api.github.com/repos/${gh[1]}/${gh[2]}`, {
        headers: { Accept: "application/vnd.github+json", "User-Agent": "OrbitX-FullIntel" },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => (j?.created_at ? { repo: `${gh[1]}/${gh[2]}`, createdAt: j.created_at, firstCommit: PARTIAL } : null)),
      4000,
      null,
    );
  }

  const dossier = {
    ok: true,
    tool: "orbitx_full_report",
    depth,
    chain,
    cover: {
      name,
      ticker,
      ca: mint,
      verdict,
      confidence,
      reasons: verdictRaw.reasons || [],
      age: age.label,
      chain,
      links: {
        orbitx: `${HOST}/ORBITX_DEX/token/${mint}`,
        dex: `https://dexscreener.com/solana/${mint}`,
        solscan: `https://solscan.io/token/${mint}`,
        gmgn: `https://gmgn.ai/sol/token/${mint}`,
        twitter: socials.twitter || "",
        website: socials.website || "",
        telegram: socials.telegram || "",
      },
    },
    snapshot: {
      price: priceNow,
      mcap: num(token?.mcap) ?? num(research?.meta?.mcap),
      fdv: num(token?.fdv) ?? num(research?.meta?.fdv),
      supply: num(token?.circSupply) ?? num(token?.totalSupply) ?? null,
      program: programOf(onchainMeta, token),
      liquidity: liq,
      liqByPair: pairs.map((p) => ({ dex: p.dex, address: p.address, liquidity: p.liquidity })),
      holders: num(token?.holderCount) ?? num(xray?.concentration?.totalHolders) ?? null,
      volume24h: num(token?.volume) ?? num(research?.meta?.volume24h),
      organicScore: token?.organicScore ?? tokenBody?.score?.organic ?? tokenBody?.intelScore?.organic ?? UNKNOWN,
      change5m: num(token?.change5m),
      change1h: num(token?.change1h),
      change6h: num(token?.change6h),
      change24h: num(token?.change24h),
    },
    priceHistory: {
      ath: athPrice,
      atl: atlPrice,
      athAt: ts(athBody?.athDate || fromCandles.athAt),
      atlAt: ts(fromCandles.atlAt),
      pctFromAth,
      source: athBody?.source || (fromCandles.ath != null ? "ohlcv" : UNKNOWN),
    },
    contract: {
      mintAuthority: boolLabel(mintRenounced, "renounced", "OPEN"),
      freezeAuthority: boolLabel(freezeRenounced, "renounced", "OPEN"),
      updateAuthority: onchainMeta?.updateAuthority || UNKNOWN,
      lpLock: lpLockedPct == null ? UNKNOWN : `${lpLockedPct}%`,
      dexPaid: forensics?.dexPaid?.paid ?? UNKNOWN,
      launchpad: forensics?.launchpad || UNKNOWN,
      serialDeployer: xray?.dev?.serial ?? forensics?.dev?.serial ?? UNKNOWN,
      canBuy: canBuy ?? UNKNOWN,
      canSell: canSell ?? UNKNOWN,
      roundTripPct: num(safety?.roundTripLossPct),
    },
    bundles,
    snipers,
    insiders,
    traced,
    dev: {
      wallet: devWallet || UNKNOWN,
      pctNow: devPct,
      sold: devSold,
      otherTokens: xray?.dev?.tokensCreated ?? forensics?.dev?.tokensCreated ?? UNKNOWN,
      funding: UNKNOWN,
      socialAgeVsLaunch: github?.createdAt && createdAt
        ? `github ${github.createdAt} vs token ${createdAt}`
        : hasSocial
          ? PARTIAL
          : UNKNOWN,
      firstBuyer: forensics?.firstBuyer || UNKNOWN,
    },
    holders: {
      whaleCount: xray?.concentration?.whales ?? UNKNOWN,
      top10PctWithLp: top10PctWithLp,
      top10PctWithoutLp: top10PctWithoutLp,
      top10WithLp: top10WithLp.map((h) => ({ owner: h.owner, pct: h.pct ?? null, label: h.label || h.type || null })),
      top10WithoutLp: top10WithoutLp.map((h) => ({ owner: h.owner, pct: h.pct ?? null, label: h.label || h.type || null })),
    },
    exitDesk: {
      wallets: walletRows,
      biggestRealizedWins: wins,
      biggestRealizedLosses: losses,
      fullyExited,
      status: includeWallets ? (walletPartial ? PARTIAL : "ok") : NOT_TRACED,
    },
    social: {
      createdAt: research?.social?.twitter?.createdAt || UNKNOWN,
      followers: research?.social?.twitter?.followers ?? UNKNOWN,
      first5: first5.length ? first5 : [UNKNOWN],
      last5: last5.length ? last5 : [UNKNOWN],
      caPostVsCreate: UNKNOWN,
      copycatCas: copycats,
      github,
    },
    timeline: timeline.filter((e) => e.event),
    gaps,
    sources: [
      ...sourcesFrom(sections),
      "crypto_scan composed in-process from token + xray + forensics + safety (no self-HTTP)",
    ],
    disclaimer: DISCLAIMER,
  };
  dossier.whatYouShouldKnow = buildWhatYouShouldKnow(dossier);
  dossier.markdown = formatFullReportMarkdown(dossier);
  dossier.telegramHtml = formatFullReportTelegramHtml(dossier);

  if (wantPdf) {
    try {
      const pdf = await renderFullReportPdf(dossier);
      dossier.pdfFilename = pdf.filename;
      dossier.pdfBase64 = pdf.pdfBase64;
    } catch (e) {
      dossier.gaps = [...dossier.gaps, `PDF: ${PARTIAL} (${String(e?.message || e)})`];
      dossier.pdfFilename = pdfFilename(ticker);
      dossier.reportUrl = `${HOST}/api/ogdex/report?mint=${encodeURIComponent(mint)}`;
    }
  }

  if (format === "markdown") {
    return { __mcpFormat: "markdown", markdown: dossier.markdown, ...dossier };
  }
  return dossier;
}

export { callHandler };
