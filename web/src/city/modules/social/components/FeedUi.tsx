/**
 * FeedUi — LifeInvasion social feed.
 *
 * Player composer + NPC posts driven ONLY by real token drama
 * (feedEngine). `embedded` renders it to fit inside the phone app;
 * standalone renders a fuller two-column layout with a trending sidebar.
 */

import { useState } from "react";
import { useSocialFeed } from "../hooks/useSocialFeed";
import { trendingFromDrama } from "../engine/feedEngine";
import type { TokenDrama } from "../types";
import { NpcAvatar } from "./NpcAvatar";

export interface FeedUiProps {
  feed: ReturnType<typeof useSocialFeed>;
  drama?: TokenDrama[];
  embedded?: boolean;
}

export function FeedUi({ feed, drama = [], embedded = false }: FeedUiProps) {
  const [draft, setDraft] = useState("");
  const trending = trendingFromDrama(drama);

  const submit = () => {
    feed.post(draft);
    setDraft("");
  };

  return (
    <div className={`oxs-feed ${embedded ? "oxs-feed-embedded" : ""}`}>
      {!embedded && <h2 className="oxs-title">🌀 LifeInvasion</h2>}
      <div className="oxs-feed-cols">
        <div className="oxs-feed-main">
          <div className="oxs-composer">
            <NpcAvatar initials="YOU" hue={265} size={32} />
            <input
              className="oxs-input"
              value={draft}
              maxLength={280}
              placeholder="What's happening in the city?"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <button className="oxs-btn oxs-btn-primary" disabled={!draft.trim()} onClick={submit}>
              Post
            </button>
          </div>
          {feed.feed.map((p) => (
            <article key={p.id} className="oxs-post">
              <NpcAvatar initials={p.authorInitials} hue={p.authorHue} size={36} verified={p.verified} />
              <div className="oxs-post-body">
                <div className="oxs-post-head">
                  <strong>{p.authorName}</strong>
                  <span className="oxs-muted oxs-small">{p.authorHandle}</span>
                  {p.kind === "drama" && <span className="oxs-chip oxs-chip-drama">market</span>}
                  {p.kind === "ad" && <span className="oxs-chip">ad</span>}
                </div>
                <p className="oxs-post-text">{p.text}</p>
                <div className="oxs-post-actions">
                  <button
                    className={`oxs-btn oxs-btn-ghost oxs-small ${feed.liked.has(p.id) ? "oxs-liked" : ""}`}
                    onClick={() => feed.toggleLike(p.id)}
                    aria-label="Like"
                  >
                    ♥ {p.likes + (feed.liked.has(p.id) ? 1 : 0)}
                  </button>
                  <span className="oxs-muted oxs-small">↻ {p.reposts}</span>
                  {!p.npc && p.kind === "player" && (
                    <button className="oxs-btn oxs-btn-ghost oxs-small" onClick={() => feed.deletePost(p.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
          {feed.feed.length === 0 && (
            <p className="oxs-muted">Quiet… post something or wait for the market to move.</p>
          )}
        </div>
        {!embedded && trending.length > 0 && (
          <aside className="oxs-trending">
            <h3 className="oxs-subtitle">Trending in the city</h3>
            {trending.map((t) => (
              <div key={t.symbol} className="oxs-trend-row">
                <strong>{t.symbol}</strong>
                <span className={t.change24h >= 0 ? "oxs-pos" : "oxs-neg"}>
                  {t.change24h >= 0 ? "+" : ""}{t.change24h.toFixed(1)}%
                </span>
                <div className="oxs-heat"><div style={{ width: `${t.heat}%` }} /></div>
              </div>
            ))}
            <p className="oxs-muted oxs-small">Derived from live DexScreener quotes — never mocked.</p>
          </aside>
        )}
      </div>
    </div>
  );
}
