/**
 * In-game news engine — "Channel 6" breaking news from REAL market events.
 * Every item is derived from live TokenDrama; no prices are ever invented.
 * When there is no significant market movement, the channel runs a calm
 * recap instead of manufacturing drama.
 */

import type { NewsItem, TokenDrama } from "../types";

const BREAKING_PCT = 10; // |24h%| that earns a BREAKING banner
const DEVELOPING_PCT = 5;
const WHALE_VOLUME_USD = 20_000_000;

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}
function fmtUsd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${(n / 1_000).toFixed(0)}K`;
}
function fmtPrice(p: number): string {
  if (p >= 1000) return `$${p.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (p >= 1) return `$${p.toFixed(2)}`;
  return `$${p.toFixed(6)}`;
}

export function buildNews(drama: TokenDrama[]): NewsItem[] {
  const items: NewsItem[] = [];
  const now = Date.now();
  const live = drama.filter((d) => d.symbol && d.price > 0);
  let n = 0;

  for (const d of live) {
    const chg = d.change24h;
    if (Math.abs(chg) >= BREAKING_PCT) {
      const up = chg > 0;
      items.push({
        id: `news-${d.symbol}-breaking-${n++}`,
        headline: up
          ? `BREAKING: ${d.symbol} surges ${fmtPct(chg)} — city traders scramble`
          : `BREAKING: ${d.symbol} plunges ${fmtPct(chg)} — holders on edge`,
        summary: `${d.symbol} is trading at ${fmtPrice(d.price)} after a ${fmtPct(chg)} move in 24 hours on ${fmtUsd(d.volume24h)} volume.`,
        body: [
          `Channel 6 has confirmed ${d.symbol} moved ${fmtPct(chg)} over the last 24 hours, last trading at ${fmtPrice(d.price)}.`,
          `24-hour volume reached ${fmtUsd(d.volume24h)}${d.marketCap > 0 ? ` with a market cap of ${fmtUsd(d.marketCap)}` : ""}.`,
          up
            ? "Street reaction is euphoric — LifeInvasion is flooded with rocket emojis and paper-handed confessions."
            : "Street reaction is tense — our phones are ringing with traders asking if this is the dip or the cliff.",
          "Channel 6 reminds viewers: this is news, not financial advice. Stay liquid.",
        ],
        severity: "breaking",
        tokens: [d.symbol],
        anchor: "Nia Kade",
        ts: now - n * 91_000,
      });
    } else if (Math.abs(chg) >= DEVELOPING_PCT) {
      items.push({
        id: `news-${d.symbol}-dev-${n++}`,
        headline: `${d.symbol} ${chg > 0 ? "climbs" : "slides"} ${fmtPct(chg)} — developing story`,
        summary: `${d.symbol} at ${fmtPrice(d.price)} (${fmtPct(chg)} / 24h). Analysts divided, group chats unhinged.`,
        body: [
          `${d.symbol} is ${chg > 0 ? "up" : "down"} ${fmtPct(Math.abs(chg))} on the day at ${fmtPrice(d.price)}.`,
          `Volume sits at ${fmtUsd(d.volume24h)}. Our desk is watching for follow-through.`,
        ],
        severity: "developing",
        tokens: [d.symbol],
        anchor: "Nia Kade",
        ts: now - n * 91_000,
      });
    } else if (d.volume24h >= WHALE_VOLUME_USD) {
      items.push({
        id: `news-${d.symbol}-vol-${n++}`,
        headline: `Whale watch: ${d.symbol} prints ${fmtUsd(d.volume24h)} in volume`,
        summary: `Heavy hands are moving ${d.symbol} — ${fmtUsd(d.volume24h)} changed hands in 24h at ${fmtPrice(d.price)}.`,
        body: [
          `Unusually heavy flow in ${d.symbol}: ${fmtUsd(d.volume24h)} in 24-hour volume.`,
          `Price held at ${fmtPrice(d.price)} (${fmtPct(chg)}). The desk suspects somebody knows something — or somebody is exit-liquidity hunting.`,
        ],
        severity: "developing",
        tokens: [d.symbol],
        anchor: "Nia Kade",
        ts: now - n * 91_000,
      });
    }
  }

  // calm recap when the market is quiet — never invent drama
  if (items.length === 0 && live.length > 0) {
    const movers = [...live].sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h)).slice(0, 3);
    items.push({
      id: `news-recap-${now}`,
      headline: "Markets steady — Channel 6 evening recap",
      summary: "A quiet day on the boards. Biggest mover: " + movers.map((m) => `${m.symbol} ${fmtPct(m.change24h)}`).join(", ") + ".",
      body: [
        "A calm session across the tokens Channel 6 tracks.",
        "Biggest moves: " + movers.map((m) => `${m.symbol} ${fmtPct(m.change24h)} at ${fmtPrice(m.price)}`).join("; ") + ".",
        "In local news: the East Docks car meet is Saturday, open mic at The Gutter is Tuesday, and Club Eclipse remains — as ever — for sale.",
      ],
      severity: "recap",
      tokens: movers.map((m) => m.symbol),
      anchor: "Nia Kade",
      ts: now,
    });
  }

  return items.sort((a, b) => b.ts - a.ts);
}
