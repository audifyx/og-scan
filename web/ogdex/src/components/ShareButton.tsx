import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { compact } from "../lib/api";

// Share a token scan to X with a rich unfurl card (/share/<mint> serves the
// OG/Twitter meta -> summary_large_image; clicking lands on the OrbitX Terminal page).
export default function ShareButton({ mint, symbol, score, mcap, verdict }: { mint: string; symbol?: string; score?: number | null; mcap?: number | null; verdict?: string | null }) {
  const [copied, setCopied] = useState(false);
  const shareUrl = `https://ogscan.fun/share/${mint}?app=ogdex`;
  const sym = (symbol || "").replace(/^\$/, "");
  const mc = mcap != null ? "$" + compact(mcap) : null;
  const lines = [`🔍 ${sym ? "$" + sym : "Token"} scanned on OrbitX Terminal`];
  if (score != null) lines.push(`OrbitX Score ${Math.round(score)}/100${mc ? ` · MC ${mc}` : ""}`);
  else if (mc) lines.push(`MC ${mc}`);
  if (verdict) lines.push(String(verdict).replace(/[^\w\s.+-]/g, "").trim());
  lines.push("Live on-chain report 👇");
  const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(lines.join("\n"))}&url=${encodeURIComponent(shareUrl)}`;
  const copy = () => { navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1200); };
  const native = async () => { try { if (navigator.share) { await navigator.share({ title: `${sym || "Token"} — OrbitX Terminal`, text: lines.join(" "), url: shareUrl }); return true; } } catch {} return false; };
  return (
    <span className="inline-flex items-center gap-1.5">
      <a href={intent} target="_blank" rel="noreferrer" onClick={(e) => { /* prefer native sheet on mobile */ if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) { e.preventDefault(); native(); } }}
        className="btn inline-flex items-center gap-1.5 font-semibold text-white hover:opacity-90"
        style={{ background: "linear-gradient(135deg, #3b82f6, #5aa2ff)", boxShadow: "0 4px 14px rgba(59,130,246,0.35)" }}>
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
        Share on X
      </a>
      <button onClick={copy} title="Copy share link" className="btn bg-panel2 text-muted hover:text-white inline-flex items-center gap-1" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>{copied ? <Check className="w-3.5 h-3.5 text-up" /> : <Copy className="w-3.5 h-3.5" />}</button>
    </span>
  );
}
