import { useState } from "react";
import { Copy, Check } from "lucide-react";

// One-tap share of a wallet's PnL to X with a rich unfurl card
// (/sharew/<address> serves the OG/Twitter meta -> summary_large_image).
export default function WalletShareButton({ address, pnl, win, trades }: { address: string; pnl?: number | null; win?: number | null; trades?: number | null }) {
  const [copied, setCopied] = useState(false);
  const qs = new URLSearchParams({ app: "ogdex" });
  if (pnl != null) qs.set("pnl", String(Math.round(pnl)));
  if (win != null) qs.set("win", String(win));
  if (trades != null) qs.set("trades", String(trades));
  const shareUrl = `https://ogscan.fun/sharew/${address}?${qs.toString()}`;
  const pnlStr = pnl != null ? (pnl >= 0 ? "+$" : "-$") + Math.abs(pnl).toLocaleString(undefined, { maximumFractionDigits: 0 }) : null;
  const lines = ["💰 My wallet PnL on OrbitX DEX"];
  if (pnlStr) lines.push(`${pnlStr}${win != null ? ` · ${win}% win rate` : ""}${trades != null ? ` · ${trades} trades` : ""}`);
  lines.push("Tracked with the tools most platforms hide 👇");
  const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(lines.join("\n"))}&url=${encodeURIComponent(shareUrl)}`;
  const copy = () => { navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1200); };
  const native = async () => { try { if (navigator.share) { await navigator.share({ title: "My PnL — OrbitX DEX", text: lines.join(" "), url: shareUrl }); return true; } } catch {} return false; };
  return (
    <span className="inline-flex items-center gap-1.5">
      <a href={intent} target="_blank" rel="noreferrer" onClick={(e) => { if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) { e.preventDefault(); native(); } }}
        className="btn bg-white text-black font-semibold inline-flex items-center gap-1.5 hover:opacity-90">
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
        Share PnL
      </a>
      <button onClick={copy} title="Copy share link" className="btn bg-panel2 text-muted hover:text-white inline-flex items-center gap-1">{copied ? <Check className="w-3.5 h-3.5 text-up" /> : <Copy className="w-3.5 h-3.5" />}</button>
    </span>
  );
}
