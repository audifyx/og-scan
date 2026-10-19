/**
 * LaunchpadShareButton — one-tap share-to-X + copy-link for a launchpad token.
 * Designed for the token detail page header.
 */
import { useState } from "react";

interface ShareToken {
  name: string;
  symbol: string;
  price_usd: number | null;
  market_cap_usd: number | null;
  mint: string;
}

interface Props {
  token: ShareToken;
}

function fmtUsd(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export default function LaunchpadShareButton({ token }: Props) {
  const [copied, setCopied] = useState(false);

  const detailUrl = `https://www.orbitx.world/launchpad/token/${token.mint}`;
  const shareText = `Just found $${token.symbol} on the OrbitX Launchpad 🚀 MCap: ${fmtUsd(token.market_cap_usd)} — trade it through your AI: ${detailUrl}`;
  const xIntentUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(detailUrl);
    } catch {
      // Fallback for non-secure contexts
      const ta = document.createElement("textarea");
      ta.value = detailUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2">
      <a
        href={xIntentUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-black transition-transform hover:scale-[1.02] active:scale-95"
        aria-label={`Share $${token.symbol} on X`}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        Share
      </a>
      <button
        onClick={copyLink}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        aria-label="Copy token link"
        title="Copy token link"
      >
        {copied ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
          </svg>
        )}
      </button>
    </div>
  );
}
