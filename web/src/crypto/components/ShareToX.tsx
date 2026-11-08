/**
 * ShareToX — one-tap share of a scan result to X (Team E, fifth batch).
 *
 * Composes a tweet from REAL scan data only (token, OG score, risk, top
 * flags — never invented figures) + a link to the scanner route, and
 * opens the X share intent (https://x.com/intent/tweet) in a new tab.
 * NO auto-posting, NO fake posting: the user reviews and posts it
 * themself on X. The tweet text is built by the pure `buildScanTweet`
 * helper so it can be unit-tested; the component only opens the intent.
 *
 * Team B usage:
 *   <ShareToX mint={intel.mint} symbol={token.symbol} ogScore={intel.ogScore?.score}
 *     riskScore={intel.risk?.score} riskLabel={intel.risk?.label}
 *     flags={topFlags} verdict={topVerdict} />
 */
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { scanUrl } from "../hooks/useScanSocial";

export const MAX_TWEET_CHARS = 280;

export interface ShareToXProps {
  mint: string;
  symbol?: string | null;
  name?: string | null;
  /** OG score 0–100, higher = safer. Null = unknown (shown as unknown). */
  ogScore?: number | null;
  ogBand?: string | null;
  /** Composed risk 0–100, higher = riskier. Null = unknown. */
  riskScore?: number | null;
  riskLabel?: string | null;
  /** Top flags from the real scan, e.g. ["High bundle risk — 34.2% bundled"]. */
  flags?: string[];
  /** Top-line verdict from the real scan, if any. */
  verdict?: string | null;
}

export interface ScanTweet {
  /** Full tweet text (without the URL — X appends the link). */
  text: string;
  /** Scanner URL appended to the tweet. */
  url: string;
  /** Full intent URL to open. */
  intentUrl: string;
  /** Length of text + URL as X counts it (URL counts as 23 chars). */
  length: number;
  /** True when the composed tweet exceeds 280 chars. */
  tooLong: boolean;
}

/**
 * Build the tweet text from real scan data. Unknowns are written as
 * unknown — never filled in. Flags are included only if supplied and
 * trimmed to fit; when the text would overflow, flags are dropped
 * shortest-first until it fits (score line + link always survive).
 */
export function buildScanTweet(input: ShareToXProps): ScanTweet {
  const url = scanUrl(input.mint);
  const who = input.symbol ? `$${input.symbol}` : input.name || "this token";
  const og = input.ogScore == null ? "OG score unknown" : `OG score ${input.ogScore}/100`;
  const risk =
    input.riskScore == null
      ? "Risk unknown"
      : `Risk ${input.riskScore}/100${input.riskLabel ? ` (${input.riskLabel})` : ""}`;
  const band = input.ogBand ? ` — ${input.ogBand}` : "";
  const head = `Scanned ${who} on OrbitX — ${og}${band}, ${risk}.`;
  // X counts any URL as 23 chars.
  const baseLen = head.length + 1 + 23;
  const flags = (input.flags ?? []).map((f) => f.trim()).filter(Boolean);
  const picked: string[] = [];
  for (const f of flags) {
    const candidate = [...picked, f].join(" ");
    if (head.length + 1 + candidate.length + 1 + 23 <= MAX_TWEET_CHARS) picked.push(f);
  }
  const flagText = picked.length > 0 ? ` ${picked.join(" ")}` : "";
  const verdict =
    !input.verdict || picked.length > 0
      ? ""
      : input.verdict.length + head.length + 1 + 23 <= MAX_TWEET_CHARS
        ? ` ${input.verdict}`
        : "";
  const text = `${head}${flagText}${verdict}`;
  const length = text.length + 1 + 23;
  return {
    text,
    url,
    intentUrl: `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    length,
    tooLong: length > MAX_TWEET_CHARS,
  };
}

const GOLD = "#e8b84a";
const PANEL_BTN: CSSProperties = {
  background: GOLD,
  color: "#000000",
  border: "none",
  borderRadius: 999,
  padding: "0.5rem 1rem",
  fontWeight: 800,
  fontSize: "0.9rem",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "0.45rem",
};
const MUTED: CSSProperties = { color: "#b8b8b8", fontSize: "0.8rem" };

function XIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/**
 * One-tap share to X. Shows the exact tweet text first (with char count)
 * so the user sees what will open; tapping opens the X intent in a new
 * tab — the user reviews and posts it themself on X.
 */
export function ShareToX(props: ShareToXProps) {
  const tweet = useMemo(() => buildScanTweet(props), [props]);
  const [opened, setOpened] = useState(false);
  const remaining = MAX_TWEET_CHARS - tweet.length;

  function share() {
    window.open(tweet.intentUrl, "_blank", "noopener,noreferrer");
    setOpened(true);
    window.setTimeout(() => setOpened(false), 3000);
  }

  return (
    <div
      data-testid="share-to-x"
      style={{
        background: "#000000",
        border: "1px solid rgba(232, 184, 74, 0.28)",
        borderRadius: "12px",
        padding: "1rem",
        color: "#ffffff",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap" }}>
        <span style={{ fontWeight: 800, fontSize: "1rem", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
          <XIcon /> Share scan to X
        </span>
        <span style={{ ...MUTED, marginLeft: "auto" }}>
          {remaining >= 0 ? `${remaining} chars left` : `${-remaining} chars over`}
        </span>
      </div>
      <p style={{ margin: "0.75rem 0", fontSize: "0.9rem", color: "#ffffff", overflowWrap: "anywhere" }}>
        {tweet.text}
      </p>
      <p style={{ ...MUTED, margin: "0 0 0.75rem", overflowWrap: "anywhere" }}>{tweet.url}</p>
      <button type="button" onClick={share} disabled={tweet.tooLong} style={{ ...PANEL_BTN, opacity: tweet.tooLong ? 0.5 : 1 }}>
        <XIcon size={13} /> {opened ? "Opened in X" : "Post on X"}
      </button>
      <p style={{ ...MUTED, margin: "0.6rem 0 0" }}>
        Opens the X share sheet — you review and post it yourself. Nothing is posted automatically.
      </p>
    </div>
  );
}
