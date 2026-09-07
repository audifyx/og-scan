import { DISCLAIMER, TRACE_INCOMPLETE } from "./full-report-verdict.js";

const UNKNOWN = "UNKNOWN";

function dash(v) {
  if (v == null || v === "") return UNKNOWN;
  return String(v);
}

function pct(v) {
  if (v == null || v === "" || Number.isNaN(Number(v))) return UNKNOWN;
  return `${Number(v)}%`;
}

function usd(v) {
  if (v == null || v === "" || Number.isNaN(Number(v))) return UNKNOWN;
  const n = Number(v);
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  if (abs >= 1) return `$${n.toFixed(4)}`.replace(/0+$/, "").replace(/\.$/, "");
  if (abs === 0) return "$0";
  return `$${n}`;
}

function ca(v) {
  return v ? `\`${v}\`` : UNKNOWN;
}

function clusterBlock(title, c) {
  if (!c) return `### ${title}\n${UNKNOWN}`;
  const line = c.display === TRACE_INCOMPLETE || c.note === TRACE_INCOMPLETE
    ? TRACE_INCOMPLETE
    : c.traced === true && c.pct === 0
      ? c.display
      : c.pct == null
        ? UNKNOWN
        : `${c.pct}% · count ${dash(c.count)} · traced ${c.traced ? "true" : "false"}`;
  return [`### ${title}`, line, `traced: ${c.traced === true ? "true" : "false"}`].join("\n");
}

export function formatFullReportMarkdown(d) {
  const cover = d.cover || {};
  const snap = d.snapshot || {};
  const price = d.priceHistory || {};
  const contract = d.contract || {};
  const bundles = d.bundles || {};
  const snipers = d.snipers || {};
  const insiders = d.insiders || {};
  const dev = d.dev || {};
  const holders = d.holders || {};
  const exits = d.exitDesk || {};
  const social = d.social || {};
  const timeline = Array.isArray(d.timeline) ? d.timeline : [];
  const know = Array.isArray(d.whatYouShouldKnow) ? d.whatYouShouldKnow : [];
  const sources = Array.isArray(d.sources) ? d.sources : [];
  const gaps = Array.isArray(d.gaps) ? d.gaps : [];
  const links = cover.links || {};

  const topWith = Array.isArray(holders.top10WithLp) ? holders.top10WithLp : [];
  const topWithout = Array.isArray(holders.top10WithoutLp) ? holders.top10WithoutLp : [];
  const wins = Array.isArray(exits.biggestRealizedWins) ? exits.biggestRealizedWins : [];
  const losses = Array.isArray(exits.biggestRealizedLosses) ? exits.biggestRealizedLosses : [];
  const fully = Array.isArray(exits.fullyExited) ? exits.fullyExited : [];

  const holderRow = (h) =>
    `- ${ca(h.owner || h.wallet)} · ${pct(h.pct)} · ${dash(h.label || h.status || "")}`;

  return [
    `# ${dash(cover.name)} ($${dash(cover.ticker)}) — OrbitX Full Intel`,
    "",
    `**Verdict:** ${dash(cover.verdict)} · **Confidence:** ${dash(cover.confidence)} · **Age:** ${dash(cover.age)}`,
    `**CA:** ${ca(cover.ca)}`,
    `**Chain:** ${dash(cover.chain || "solana")}`,
    links.dex || links.orbitx || links.solscan
      ? `**Links:** ${[links.orbitx, links.dex, links.solscan, links.gmgn].filter(Boolean).join(" · ")}`
      : "",
    "",
    "## B · Snapshot",
    `- Price ${usd(snap.price)} · MC ${usd(snap.mcap)} · FDV ${usd(snap.fdv)}`,
    `- Supply ${dash(snap.supply)} · Program ${dash(snap.program)}`,
    `- Liquidity ${usd(snap.liquidity)} · Holders ${dash(snap.holders)} · Volume 24h ${usd(snap.volume24h)}`,
    `- Organic ${dash(snap.organicScore)}`,
    `- 5m ${pct(snap.change5m)} · 1h ${pct(snap.change1h)} · 6h ${pct(snap.change6h)} · 24h ${pct(snap.change24h)}`,
    "",
    "## C · Price history",
    `- ATH ${usd(price.ath)} (${dash(price.athAt)}) · ATL ${usd(price.atl)} (${dash(price.atlAt)})`,
    `- % from ATH ${pct(price.pctFromAth)} · source ${dash(price.source)}`,
    "",
    "## D · Contract",
    `- Mint auth ${dash(contract.mintAuthority)} · Freeze ${dash(contract.freezeAuthority)} · Update ${dash(contract.updateAuthority)}`,
    `- LP lock ${dash(contract.lpLock)} · DEX paid ${dash(contract.dexPaid)} · Launchpad ${dash(contract.launchpad)}`,
    `- Serial deployer ${dash(contract.serialDeployer)} · canBuy ${dash(contract.canBuy)} · canSell ${dash(contract.canSell)}`,
    `- Round-trip ${pct(contract.roundTripPct)}`,
    "",
    "## E · Bundles vs snipers vs insiders",
    clusterBlock("Bundles", bundles),
    "",
    clusterBlock("Snipers", snipers),
    "",
    clusterBlock("Insiders", insiders),
    "",
    "## F · Dev",
    `- Wallet ${ca(dev.wallet)} · % now ${pct(dev.pctNow)} · sold ${dash(dev.sold)}`,
    `- Other tokens ${dash(dev.otherTokens)} · funding ${dash(dev.funding)}`,
    `- Social age vs launch ${dash(dev.socialAgeVsLaunch)}`,
    "",
    "## G · Holder map",
    `- Whale count ${dash(holders.whaleCount)} · top10 with LP ${pct(holders.top10PctWithLp)} · top10 ex-LP ${pct(holders.top10PctWithoutLp)}`,
    "### Top 10 with LP",
    topWith.length ? topWith.map(holderRow).join("\n") : UNKNOWN,
    "### Top 10 without LP",
    topWithout.length ? topWithout.map(holderRow).join("\n") : UNKNOWN,
    "",
    "## H · Exit desk",
    "### Biggest realized wins",
    wins.length ? wins.map((w) => `- ${ca(w.wallet)} · ${usd(w.realizedUsd)} · ${dash(w.status)}`).join("\n") : UNKNOWN,
    "### Biggest realized losses",
    losses.length ? losses.map((w) => `- ${ca(w.wallet)} · ${usd(w.realizedUsd)} · ${dash(w.status)}`).join("\n") : UNKNOWN,
    "### Fully exited",
    fully.length ? fully.map((w) => `- ${ca(w.wallet)} · ${dash(w.status)} · ${usd(w.realizedUsd)}`).join("\n") : UNKNOWN,
    "",
    "## I · X history",
    `- Created ${dash(social.createdAt)} · Followers ${dash(social.followers)}`,
    `- CA post vs token create ${dash(social.caPostVsCreate)}`,
    `- First 5: ${(social.first5 || []).join(" | ") || UNKNOWN}`,
    `- Last 5: ${(social.last5 || []).join(" | ") || UNKNOWN}`,
    `- Copycat CAs: ${(social.copycatCas || []).join(", ") || UNKNOWN}`,
    "",
    "## J · Timeline",
    timeline.length ? timeline.map((e) => `- ${dash(e.at)} · ${dash(e.event)}`).join("\n") : UNKNOWN,
    "",
    "## K · What you should know",
    know.length ? know.map((b) => `- ${b}`).join("\n") : `- ${UNKNOWN}`,
    "",
    "## L · Sources + gaps",
    sources.length ? sources.map((s) => `- ${s}`).join("\n") : `- ${UNKNOWN}`,
    gaps.length ? gaps.map((g) => `- GAP: ${g}`).join("\n") : "- No extra gaps listed.",
    "",
    DISCLAIMER,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function formatFullReportTelegramHtml(d) {
  const cover = d.cover || {};
  const snap = d.snapshot || {};
  const bundles = d.bundles || {};
  const snipers = d.snipers || {};
  const insiders = d.insiders || {};
  const know = Array.isArray(d.whatYouShouldKnow) ? d.whatYouShouldKnow.slice(0, 10) : [];
  const caEsc = String(cover.ca || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const name = String(cover.name || cover.ticker || "Token").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const tick = String(cover.ticker || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const cluster = (c) => {
    if (!c) return UNKNOWN;
    if (c.display === TRACE_INCOMPLETE || c.note === TRACE_INCOMPLETE) return TRACE_INCOMPLETE;
    if (c.traced === true && c.pct === 0) return c.display;
    if (c.pct == null) return UNKNOWN;
    return `${c.pct}% (traced ${c.traced ? "true" : "false"})`;
  };
  const lines = [
    `🧠 <b>OrbitX Full Intel</b> · ${name}${tick ? ` · $${tick}` : ""}`,
    `<b>${String(cover.verdict || UNKNOWN)}</b> · conf ${String(cover.confidence || UNKNOWN)} · ${String(cover.age || UNKNOWN)}`,
    `Price ${usd(snap.price)} · MC ${usd(snap.mcap)} · LP ${usd(snap.liquidity)}`,
    `Bundles ${cluster(bundles)}`,
    `Snipers ${cluster(snipers)}`,
    `Insiders ${cluster(insiders)}`,
    "",
    ...know.map((b) => `• ${String(b).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").slice(0, 220)}`),
    "",
    `<code>${caEsc}</code>`,
    `<i>${DISCLAIMER}</i>`,
  ];
  return lines.join("\n").slice(0, 3500);
}
