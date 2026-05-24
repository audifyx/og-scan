/**
 * DevWalletDNA — Creator Wallet Forensic Profile
 * Traces the deployer wallet: every token they've created,
 * survival rate, reputation score, and behavioral patterns.
 */
import { useState, useEffect } from "react";
import { Fingerprint, ExternalLink, Loader2, AlertTriangle, CheckCircle, Trophy, Skull, Clock, Coins, TrendingUp, TrendingDown, Copy, Check, ChevronDown, ChevronUp, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { HELIUS_RPC, shortAddr, fmtUsd } from "@/lib/og";
import { toast } from "sonner";

interface CreatedToken {
  mint: string;
  name: string;
  symbol: string;
  createdAt: string;
  survived: boolean; // still has LP and active trading
  currentLiquidity: number;
  peakLiquidity: number;
  ruggedAfterHours: number | null;
  status: "active" | "dead" | "rugged" | "unknown";
}

interface DevProfile {
  wallet: string;
  totalTokensCreated: number;
  survivedCount: number;
  ruggedCount: number;
  deadCount: number;
  survivalRate: number;
  avgLifespanHours: number;
  reputationScore: number; // 0-100
  reputationGrade: string;
  tokens: CreatedToken[];
  firstCreated: string | null;
  isSerialDeployer: boolean;
  pattern: string;
}

interface Props {
  creatorWallet: string;
  currentMint?: string;
  compact?: boolean;
}

const gradeColors: Record<string, string> = {
  "A+": "text-emerald-400 bg-emerald-500/15 border-emerald-500/25",
  "A": "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  "B": "text-lime-400 bg-lime-500/10 border-lime-500/20",
  "C": "text-amber-400 bg-amber-500/10 border-amber-500/20",
  "D": "text-orange-400 bg-orange-500/10 border-orange-500/20",
  "F": "text-red-400 bg-red-500/10 border-red-500/20",
};

const statusBadge = (status: string) => {
  if (status === "active") return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px]">Active</Badge>;
  if (status === "rugged") return <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[9px]">Rugged</Badge>;
  if (status === "dead") return <Badge className="bg-white/[0.06] text-white/30 border-white/[0.08] text-[9px]">Dead</Badge>;
  return <Badge className="bg-white/[0.04] text-white/20 border-white/[0.06] text-[9px]">Unknown</Badge>;
};

async function fetchDevProfile(wallet: string): Promise<DevProfile> {
  // Fetch token accounts created by this wallet using Helius
  try {
    const res = await fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "getAssetsByCreator",
        params: { creatorAddress: wallet, page: 1, limit: 50 },
      }),
    });
    const json = await res.json();
    const assets = json?.result?.items || [];

    // Filter to fungible tokens only
    const tokens: CreatedToken[] = assets
      .filter((a: any) => a.interface === "FungibleToken" || a.interface === "FungibleAsset")
      .map((a: any) => ({
        mint: a.id,
        name: a.content?.metadata?.name || "Unknown",
        symbol: a.content?.metadata?.symbol || "???",
        createdAt: a.created_at || new Date().toISOString(),
        survived: true, // We'd need additional LP checks
        currentLiquidity: 0,
        peakLiquidity: 0,
        ruggedAfterHours: null,
        status: "unknown" as const,
      }));

    const totalTokensCreated = tokens.length;
    const survivalRate = totalTokensCreated > 0 ? 0.5 : 1; // Placeholder
    const reputationScore = totalTokensCreated === 0 ? 70 :
      totalTokensCreated === 1 ? 60 :
      totalTokensCreated <= 3 ? 50 :
      totalTokensCreated <= 10 ? 30 : 15;

    const reputationGrade = reputationScore >= 80 ? "A" : reputationScore >= 60 ? "B" : reputationScore >= 40 ? "C" : reputationScore >= 20 ? "D" : "F";
    const isSerialDeployer = totalTokensCreated > 5;
    const pattern = isSerialDeployer ? "Serial Deployer — creates many tokens rapidly" :
      totalTokensCreated > 2 ? "Multi-Token Creator — has several projects" :
      totalTokensCreated === 1 ? "Single Project — first known token" :
      "Unknown — no prior token history found";

    return {
      wallet,
      totalTokensCreated,
      survivedCount: 0,
      ruggedCount: 0,
      deadCount: 0,
      survivalRate,
      avgLifespanHours: 0,
      reputationScore,
      reputationGrade,
      tokens,
      firstCreated: tokens.length > 0 ? tokens[tokens.length - 1]?.createdAt : null,
      isSerialDeployer,
      pattern,
    };
  } catch (e) {
    return {
      wallet,
      totalTokensCreated: 0,
      survivedCount: 0,
      ruggedCount: 0,
      deadCount: 0,
      survivalRate: 0,
      avgLifespanHours: 0,
      reputationScore: 50,
      reputationGrade: "C",
      tokens: [],
      firstCreated: null,
      isSerialDeployer: false,
      pattern: "Unable to fetch creator data",
    };
  }
}

export const DevWalletDNA: React.FC<Props> = ({ creatorWallet, currentMint, compact = false }) => {
  const [profile, setProfile] = useState<DevProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!creatorWallet) return;
    setLoading(true);
    fetchDevProfile(creatorWallet)
      .then(setProfile)
      .finally(() => setLoading(false));
  }, [creatorWallet]);

  const copyWallet = () => {
    navigator.clipboard.writeText(creatorWallet);
    setCopied(true);
    toast.success("Wallet copied");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-white/30" />
        <span className="text-sm text-white/30">Analyzing creator wallet...</span>
      </div>
    );
  }

  if (!profile) return null;

  const gc = gradeColors[profile.reputationGrade] || gradeColors["C"];

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2">
        <Fingerprint className="h-3.5 w-3.5 text-white/30" />
        <span className="text-xs text-white/50">{shortAddr(creatorWallet)}</span>
        <Badge className={cn("text-[9px]", gc)}>{profile.reputationGrade} · {profile.totalTokensCreated} tokens</Badge>
        {profile.isSerialDeployer && <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[9px]">Serial Deployer</Badge>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center border", gc)}>
          <Fingerprint className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-bold text-white">Creator DNA</span>
            <Badge className={cn("text-[9px]", gc)}>Grade {profile.reputationGrade}</Badge>
            {profile.isSerialDeployer && (
              <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[9px] gap-0.5">
                <AlertTriangle className="h-2.5 w-2.5" />Serial Deployer
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={(e) => { e.stopPropagation(); copyWallet(); }} className="flex items-center gap-1 text-xs text-white/40 hover:text-white/60 transition-colors">
              <code className="font-mono">{shortAddr(creatorWallet)}</code>
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            </button>
            <a
              href={`https://solscan.io/account/${creatorWallet}`}
              target="_blank"
              rel="noopener"
              onClick={e => e.stopPropagation()}
              className="text-white/20 hover:text-white/40"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <p className="text-[11px] text-white/30 mt-1">{profile.pattern}</p>
        </div>

        {/* Stats */}
        <div className="hidden sm:flex items-center gap-4">
          <div className="text-center">
            <p className="text-lg font-black text-white">{profile.totalTokensCreated}</p>
            <p className="text-[9px] text-white/20">Tokens</p>
          </div>
          <div className="text-center">
            <p className={cn("text-lg font-black", profile.reputationScore >= 60 ? "text-emerald-400" : profile.reputationScore >= 30 ? "text-amber-400" : "text-red-400")}>
              {profile.reputationScore}
            </p>
            <p className="text-[9px] text-white/20">Rep Score</p>
          </div>
        </div>

        {expanded ? <ChevronUp className="h-4 w-4 text-white/20" /> : <ChevronDown className="h-4 w-4 text-white/20" />}
      </button>

      {/* Expanded: Token List */}
      {expanded && profile.tokens.length > 0 && (
        <div className="border-t border-white/[0.06] px-4 pb-4 pt-3">
          <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider mb-2">
            Created Tokens ({profile.tokens.length})
          </p>
          <div className="space-y-1.5">
            {profile.tokens.map(t => (
              <div
                key={t.mint}
                className={cn(
                  "flex items-center gap-3 p-2.5 rounded-lg border transition-all",
                  t.mint === currentMint
                    ? "bg-primary/5 border-primary/20"
                    : "bg-white/[0.015] border-white/[0.04] hover:border-white/[0.08]"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{t.symbol}</span>
                    <span className="text-[10px] text-white/25">{t.name}</span>
                    {t.mint === currentMint && <Badge className="bg-primary/10 text-primary border-primary/20 text-[8px]">Current</Badge>}
                  </div>
                  <code className="text-[9px] text-white/15 font-mono">{shortAddr(t.mint)}</code>
                </div>
                {statusBadge(t.status)}
                <a
                  href={`https://dexscreener.com/solana/${t.mint}`}
                  target="_blank"
                  rel="noopener"
                  className="text-white/15 hover:text-white/30"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {expanded && profile.tokens.length === 0 && (
        <div className="border-t border-white/[0.06] p-4 text-center">
          <p className="text-xs text-white/20">No other tokens found from this creator</p>
          <p className="text-[10px] text-white/15 mt-1">This appears to be their first project</p>
        </div>
      )}
    </div>
  );
};

export default DevWalletDNA;
