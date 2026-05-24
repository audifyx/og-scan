/**
 * ScanShare — Generate shareable links for scan results.
 * Creates a compact encoded URL with scan data that others can view.
 */
import { useState } from "react";
import { Share2, Link2, Copy, Check, Twitter, MessageCircle, ExternalLink, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { OGSCAN_SITE_URL } from "@/lib/og";
import { toast } from "sonner";

interface ScanData {
  mint: string;
  symbol: string;
  name: string;
  rugScore: number;
  liquidity: number;
  mcap: number;
  holders: number;
  grade: string;
}

interface Props {
  scanData: ScanData;
  compact?: boolean;
}

function generateShareUrl(data: ScanData): string {
  return `${OGSCAN_SITE_URL}/scan/${data.mint}`;
}

function generateShareText(data: ScanData): string {
  const gradeEmoji = data.rugScore <= 30 ? "🟢" : data.rugScore <= 60 ? "🟡" : "🔴";
  return `${gradeEmoji} OG Scan Report: $${data.symbol}\n\nRisk Score: ${data.rugScore}/100 (Grade ${data.grade})\nLiquidity: $${(data.liquidity / 1000).toFixed(1)}k\nMCap: $${(data.mcap / 1000).toFixed(1)}k\nHolders: ${data.holders.toLocaleString()}\n\nScanned on OG Scan — ${OGSCAN_SITE_URL}`;
}

export const ScanShare: React.FC<Props> = ({ scanData, compact = false }) => {
  const [copied, setCopied] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const shareUrl = generateShareUrl(scanData);
  const shareText = generateShareText(scanData);

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const copyReport = () => {
    navigator.clipboard.writeText(shareText);
    toast.success("Report copied to clipboard!");
  };

  const shareToTwitter = () => {
    const text = encodeURIComponent(`${scanData.rugScore <= 30 ? "🟢" : scanData.rugScore <= 60 ? "🟡" : "🔴"} $${scanData.symbol} Risk: ${scanData.rugScore}/100 | Grade ${scanData.grade}\n\nScanned on @ogscanfun`);
    const url = encodeURIComponent(shareUrl);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank");
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `OG Scan: $${scanData.symbol}`, text: shareText, url: shareUrl });
      } catch {}
    } else {
      copyLink();
    }
  };

  if (compact) {
    return (
      <button
        onClick={copyLink}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] text-white/30 hover:text-white/50 transition-all text-[10px]"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Share2 className="h-3 w-3" />}
        Share
      </button>
    );
  }

  return (
    <div className="relative">
      <Button
        onClick={() => setShowOptions(!showOptions)}
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] text-white/50"
      >
        <Share2 className="h-3.5 w-3.5" />
        Share Scan
      </Button>

      {showOptions && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowOptions(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-xl border border-white/[0.1] bg-[#111118] shadow-2xl overflow-hidden">
            <div className="p-3 border-b border-white/[0.06]">
              <p className="text-xs font-bold text-white mb-0.5">Share Scan Report</p>
              <p className="text-[10px] text-white/25">${scanData.symbol} · Grade {scanData.grade}</p>
            </div>
            <div className="p-1.5">
              <button
                onClick={copyLink}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Link2 className="h-3.5 w-3.5 text-white/30" />}
                <span className="text-xs text-white/60">{copied ? "Copied!" : "Copy Link"}</span>
              </button>
              <button
                onClick={copyReport}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors"
              >
                <Copy className="h-3.5 w-3.5 text-white/30" />
                <span className="text-xs text-white/60">Copy Full Report</span>
              </button>
              <button
                onClick={shareToTwitter}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors"
              >
                <Twitter className="h-3.5 w-3.5 text-white/30" />
                <span className="text-xs text-white/60">Post to X</span>
              </button>
              <button
                onClick={shareNative}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5 text-white/30" />
                <span className="text-xs text-white/60">More Options...</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ScanShare;
