/**
 * NewsUi — Channel 6 in-game news.
 * Items derive from REAL market events via newsEngine; quiet markets get
 * an honest recap, never invented drama.
 */

import { useState } from "react";
import { useNews } from "../hooks/useNews";
import type { NewsItem } from "../types";

export interface NewsUiProps {
  news: ReturnType<typeof useNews>;
  embedded?: boolean;
}

export function NewsUi({ news, embedded = false }: NewsUiProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = news.items.find((i) => i.id === openId) ?? null;

  const openItem = (i: NewsItem) => {
    setOpenId(i.id);
    news.markRead(i.id);
  };

  if (open) {
    return (
      <div className="oxs-news">
        <button className="oxs-btn oxs-btn-ghost" onClick={() => setOpenId(null)}>‹ Channel 6</button>
        <p className={`oxs-sev oxs-sev-${open.severity}`}>{open.severity.toUpperCase()}</p>
        <h3 className="oxs-title">{open.headline}</h3>
        <p className="oxs-muted oxs-small">Anchor: {open.anchor} · {rel(open.ts)}</p>
        {open.body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {open.tokens.length > 0 && (
          <p className="oxs-small">
            Tokens: {open.tokens.map((t) => <span key={t} className="oxs-chip">{t}</span>)}
          </p>
        )}
        <p className="oxs-muted oxs-small">Channel 6 reports. This is news, not financial advice.</p>
      </div>
    );
  }

  return (
    <div className={`oxs-news ${embedded ? "oxs-news-embedded" : ""}`}>
      {!embedded && (
        <div className="oxs-news-head">
          <h2 className="oxs-title">📺 Channel 6 News</h2>
          {news.breaking > 0 && <span className="oxs-live-dot" />}
        </div>
      )}
      {news.items.map((i) => (
        <button
          key={i.id}
          className={`oxs-news-card oxs-sev-border-${i.severity} ${news.read.has(i.id) ? "oxs-read" : ""}`}
          onClick={() => openItem(i)}
        >
          <span className={`oxs-sev oxs-sev-${i.severity}`}>{i.severity.toUpperCase()}</span>
          <strong>{i.headline}</strong>
          <p className="oxs-muted oxs-small">{i.summary}</p>
          <span className="oxs-muted oxs-small">{rel(i.ts)}</span>
        </button>
      ))}
      {news.items.length === 0 && (
        <p className="oxs-muted">
          No market data yet — Channel 6 goes live once the integrator feeds live prices
          (see MODULE.md § live data).
        </p>
      )}
    </div>
  );
}

function rel(ts: number): string {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}
