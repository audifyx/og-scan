/** Viral scan card + X / Telegram / copy share actions (spec section D & 9). */
import { useState } from "react";
import { Share2, Send, Copy, Check, ImageDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { OgClassification } from "@/lib/classification";
import { buildTweet, buildXShareUrl, buildScanCard, buildTelegramAlert, normalizeHandle } from "@/lib/social";
import { logShare } from "@/lib/scanLog";
import { downloadScanCardImage } from "@/lib/scanCardImage";

interface Props {
  mint: string;
  symbol?: string | null;
  name?: string | null;
  result: OgClassification;
  scanId?: string | null;
  className?: string;
}

export function ShareScanCard({ mint, symbol, name, result, scanId, className }: Props) {
  const [handle, setHandle] = useState("");
  const [copied, setCopied] = useState(false);

  const input = { mint, symbol, name, handle: normalizeHandle(handle), result };
  const card = buildScanCard(input);

  async function copyTweet() {
    try {
      await navigator.clipboard.writeText(buildTweet(input));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      void logShare(mint, "card", input.handle, scanId);
    } catch { /* ignore */ }
  }

  function shareX() {
    void logShare(mint, "x", input.handle, scanId);
    window.open(buildXShareUrl(input), "_blank", "noopener,noreferrer");
  }

  function downloadImage() {
    void logShare(mint, "card", input.handle, scanId);
    downloadScanCardImage(card);
  }

  function shareTelegram() {
    void logShare(mint, "telegram", input.handle, scanId);
    const text = buildTelegramAlert("og_identified", input);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(card.footer)}&text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className={cn("glass-card border border-white/10 p-4", className)}>
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Share2 className="h-4 w-4" /> Share this scan
      </div>

      <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold tracking-widest text-muted-foreground">{card.title}</span>
          <span className="text-xs text-muted-foreground">{card.date}</span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-xl font-bold">{card.ticker}</span>
          <span className="text-sm font-semibold text-og-cyan">{card.tierLabel}</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Confidence {card.confidence}% · Risk {card.risk}/100 · by {card.attribution}
        </div>
        <ul className="mt-2 space-y-0.5">
          {card.topSignals.map((s, i) => (
            <li key={i} className="truncate text-xs text-muted-foreground">• {s.label}</li>
          ))}
        </ul>
      </div>

      <Input
        value={handle}
        onChange={(e) => setHandle(e.target.value)}
        placeholder="Your X handle (for attribution)"
        className="mb-3"
      />
      <div className="flex flex-wrap gap-2">
        <Button onClick={shareX} size="sm"><Share2 className="mr-1.5 h-4 w-4" /> Share on X</Button>
        <Button onClick={shareTelegram} size="sm" variant="secondary"><Send className="mr-1.5 h-4 w-4" /> Telegram</Button>
        <Button onClick={copyTweet} size="sm" variant="outline">
          {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
          {copied ? "Copied" : "Copy tweet"}
        </Button>
        <Button onClick={downloadImage} size="sm" variant="outline">
          <ImageDown className="mr-1.5 h-4 w-4" /> Download image
        </Button>
      </div>
    </div>
  );
}

export default ShareScanCard;
