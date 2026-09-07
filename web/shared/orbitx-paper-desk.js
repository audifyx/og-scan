/**
 * OrbitX paper-trading desk.
 * 10,000 mock SOL per agent. Tokens, prices, and hourly % are real catalog data.
 * Fills are deterministic from (agent, hour-bucket, live market stats) so the
 * desk ticks every hour without a cron.
 */
import { isOrbitxMint, ORBITX_MINT } from "./orbitx-chain-intel.js";
import { tokenDisplayName, tokenTicker } from "./orbitx-chain-districts.js";

export const PAPER_STAKE_SOL = 10_000;
export const PAPER_HOURS = 24;

export const PAPER_AGENTS = [
  { id: "neon-pulse", name: "NEON PULSE", style: "momentum", color: "#34d399", blurb: "Rides 1h continuation on the loudest tape." },
  { id: "warden-fade", name: "WARDEN FADE", style: "mean_reversion", color: "#fb7185", blurb: "Fades stretched 24h moves with size." },
  { id: "oracle-core", name: "ORACLE CORE", style: "orbitx", color: "#c084fc", blurb: "Overweights OrbitX and the inner majors." },
  { id: "atlas-liq", name: "ATLAS LIQ", style: "liquidity", color: "#22d3ee", blurb: "Only touches deep books." },
  { id: "raid-fresh", name: "RAID FRESH", style: "fresh", color: "#fbbf24", blurb: "Hunts new pairs with real volume." },
  { id: "pulse-kol", name: "PULSE KOL", style: "kol_shadow", color: "#e879f9", blurb: "Mirrors assigned KOL last-prints when present." },
  { id: "forge-break", name: "FORGE BREAK", style: "breakout", color: "#a3e635", blurb: "Buys 1h expansion above +8%." },
  { id: "circuit-dip", name: "CIRCUIT DIP", style: "dip", color: "#38bdf8", blurb: "Absorbs 1h air-pockets under −8%." },
  { id: "scribe-flow", name: "SCRIBE FLOW", style: "volume", color: "#67e8f9", blurb: "Highest 24h volume, ignore the narrative." },
  { id: "aegis-majors", name: "AEGIS MAJORS", style: "majors", color: "#f5d0fe", blurb: "Caps the book to large-cap Solana." },
];

function hash32(text) {
  let h = 2166136261;
  const s = String(text || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hourBucket(ts) {
  return Math.floor(Number(ts) / 3_600_000);
}

function tickerOf(token) {
  return tokenTicker(token) || tokenDisplayName(token) || "TOKEN";
}

function rankFor(style, tokens, kolMints) {
  const list = (tokens || []).filter((t) => t?.mint);
  if (!list.length) return [];
  const copy = list.slice();
  if (style === "momentum") copy.sort((a, b) => Math.abs(b.change_1h || 0) - Math.abs(a.change_1h || 0));
  else if (style === "mean_reversion") copy.sort((a, b) => Math.abs(b.change_24h || 0) - Math.abs(a.change_24h || 0));
  else if (style === "orbitx") copy.sort((a, b) => Number(isOrbitxMint(b.mint)) - Number(isOrbitxMint(a.mint)) || (b.volume_24h || 0) - (a.volume_24h || 0));
  else if (style === "liquidity") copy.sort((a, b) => (b.liquidity_usd || 0) - (a.liquidity_usd || 0));
  else if (style === "fresh") copy.sort((a, b) => (a.market_cap || 9e12) - (b.market_cap || 9e12) || (b.volume_24h || 0) - (a.volume_24h || 0));
  else if (style === "kol_shadow") copy.sort((a, b) => Number(kolMints.has(b.mint)) - Number(kolMints.has(a.mint)) || (b.volume_24h || 0) - (a.volume_24h || 0));
  else if (style === "breakout") copy.sort((a, b) => (b.change_1h || 0) - (a.change_1h || 0));
  else if (style === "dip") copy.sort((a, b) => (a.change_1h || 0) - (b.change_1h || 0));
  else if (style === "majors") copy.sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0));
  else copy.sort((a, b) => (b.volume_24h || 0) - (a.volume_24h || 0));
  return copy;
}

function pickToken(agent, ranked, hour) {
  if (!ranked.length) return null;
  if (agent.style === "orbitx") {
    const ox = ranked.find((t) => isOrbitxMint(t.mint));
    if (ox && hash32(`${agent.id}:${hour}:ox`) % 100 < 62) return ox;
  }
  if (agent.style === "breakout") {
    const hot = ranked.find((t) => (t.change_1h || 0) >= 8);
    if (hot) return hot;
  }
  if (agent.style === "dip") {
    const cold = ranked.find((t) => (t.change_1h || 0) <= -8);
    if (cold) return cold;
  }
  const span = Math.min(ranked.length, 14);
  return ranked[hash32(`${agent.id}:${hour}`) % span];
}

function slicePct(agent, hour) {
  const base = agent.style === "majors" || agent.style === "liquidity" ? 0.045 : 0.07;
  const jitter = (hash32(`${agent.id}:size:${hour}`) % 80) / 1000;
  return Math.min(0.14, Math.max(0.025, base + jitter));
}

function hourMove(token, hour, nowHour) {
  const ch1 = (Number(token.change_1h) || 0) / 100;
  const ch24 = (Number(token.change_24h) || 0) / 100;
  const age = Math.max(0, nowHour - hour);
  if (age === 0) return ch1;
  const rest = (1 + ch24) / Math.max(1 + ch1, 0.05) - 1;
  const per = rest / 23;
  const wobble = ((hash32(`${token.mint}:${hour}`) % 1000) / 1000 - 0.5) * 0.018;
  return per + wobble;
}

function thesis(agent, token, sol, hourMovePct) {
  const t = tickerOf(token);
  const ch1 = token.change_1h != null ? `${token.change_1h >= 0 ? "+" : ""}${Number(token.change_1h).toFixed(1)}% 1h` : "no 1h print";
  const ch24 = token.change_24h != null ? `${token.change_24h >= 0 ? "+" : ""}${Number(token.change_24h).toFixed(1)}% 24h` : "no 24h print";
  const vol = token.volume_24h != null ? `$${Math.round(token.volume_24h).toLocaleString()} vol` : "thin tape";
  const why =
    agent.style === "momentum"
      ? "continuation — 1h heat with volume confirmation"
      : agent.style === "mean_reversion"
        ? "mean reversion — stretched 24h, fade the extension"
        : agent.style === "orbitx"
          ? "OrbitX core bias — keep the inner mint as the reserve book"
          : agent.style === "liquidity"
            ? "depth first — only size where the book can take it"
            : agent.style === "fresh"
              ? "new-pair hunt — small cap, real flow"
              : agent.style === "kol_shadow"
                ? "KOL shadow — follow assigned wallets' last mint"
                : agent.style === "breakout"
                  ? "breakout — 1h expansion, ride the next hour"
                  : agent.style === "dip"
                    ? "dip absorb — 1h air pocket, buy dislocation"
                    : agent.style === "majors"
                      ? "large-cap only — survive the long tail"
                      : "pure flow — highest 24h volume on the desk";
  const target = hourMovePct >= 0 ? "hold through the next hour if tape stays green" : "cut if the 1h reverses against the book";
  return `${agent.name} is deploying ${sol.toFixed(1)} mock SOL into $${t} (${ch1}, ${ch24}, ${vol}). Thesis: ${why}. ${target}.`;
}

export function simulatePaperDesk(tokens, opts = {}) {
  const now = Number(opts.now) || Date.now();
  const nowHour = hourBucket(now);
  const kolMints = new Set((opts.kols || []).map((k) => k.last_mint).filter(Boolean));
  const catalog = (tokens || []).filter((t) => t?.mint);
  const agents = PAPER_AGENTS.map((agent) => {
    const ranked = rankFor(agent.style, catalog, kolMints);
    let equity = PAPER_STAKE_SOL;
    const fills = [];
    let wins = 0;
    let losses = 0;
    for (let age = PAPER_HOURS - 1; age >= 0; age--) {
      const hour = nowHour - age;
      const token = pickToken(agent, ranked, hour);
      if (!token) continue;
      const pct = slicePct(agent, hour);
      const sol = equity * pct;
      const move = hourMove(token, hour, nowHour);
      const pnl = sol * move;
      equity += pnl;
      if (pnl >= 0) wins += 1;
      else losses += 1;
      fills.push({
        hour,
        at: new Date(hour * 3_600_000).toISOString(),
        mint: token.mint,
        symbol: tickerOf(token),
        name: tokenDisplayName(token),
        image: token.image || null,
        side: "buy",
        sol,
        pnl_sol: pnl,
        move_pct: move * 100,
        price_usd: token.price_usd ?? null,
        change_1h: token.change_1h ?? null,
        change_24h: token.change_24h ?? null,
        volume_24h: token.volume_24h ?? null,
        thesis: thesis(agent, token, sol, move * 100),
        current: age === 0,
      });
    }
    const live = fills[fills.length - 1] || null;
    const traded = wins + losses;
    return {
      ...agent,
      mock: true,
      stake_sol: PAPER_STAKE_SOL,
      equity_sol: equity,
      pnl_sol: equity - PAPER_STAKE_SOL,
      pnl_pct: ((equity - PAPER_STAKE_SOL) / PAPER_STAKE_SOL) * 100,
      wins,
      losses,
      trades: traded,
      win_pct: traded ? (wins / traded) * 100 : 0,
      live,
      fills: fills.slice(-12).reverse(),
    };
  }).sort((a, b) => b.equity_sol - a.equity_sol);

  const total = agents.reduce((s, a) => s + a.equity_sol, 0);
  return {
    mock: true,
    unit: "mock SOL",
    stake_sol: PAPER_STAKE_SOL,
    hours: PAPER_HOURS,
    generated_at: new Date(now).toISOString(),
    hour_bucket: nowHour,
    next_hour_at: new Date((nowHour + 1) * 3_600_000).toISOString(),
    agent_count: agents.length,
    desk_equity_sol: total,
    desk_pnl_sol: total - PAPER_STAKE_SOL * agents.length,
    orbitx_mint: ORBITX_MINT,
    agents,
  };
}
