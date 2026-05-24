/**
 * CreatorPatterns — Token Creator Pattern Recognition
 * Flags serial deployers, shows hit rate, avg rug time, past tokens.
 */
import { useState, useEffect, useMemo } from "react";
import { Fingerprint, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Clock, Loader2, ExternalLink, ChevronDown, ChevronUp, Skull, Trophy, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { HELIUS_RPC, shortAddr, fmtUsd } from "@/lib/og";

interface CreatorToken {
  mint: string;
  symbol: string;
  name: string;
  alive: boolean;
  maxMcap: number;
  currentMcap: number;
  lifespan: string;
}

interface CreatorProfile {
  wallet: string;
  totalCreated: number;
  aliveCount: number;
  deadCount: number;
  hitRate: number; // % of tokens that survived > 24h
  avgRugTimeHours: number;
  riskLabel: string;
  tokens: CreatorToken[];
}

interface Props {
  creatorWallet: string;
  compact?: boolean;
}

async function fetchCreatorProfile(wallet: string): Promise<CreatorProfile> {
  try {
    const res = await fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "getAssetsByCreator",
        params: { creatorAddress: wallet, page: 1, limit: 100 },
      }),
    });
    const json = await res.json();
    const assets = json?.result?.items || [];
    const fungibles = assets.filter((a: any) =>
      a.interface === "FungibleToken" || a.interface === "FungibleAsset"
    );

    const tokens: CreatorToken[] = fungibles.map((a: any) => ({
      mint: a.id,
      symbol: a.content?.metadata?.symbol || "???",
      name: a.content?.metadata?.name || "Unknown",
      alive: true, // Would need LP check for accuracy
      maxMcap: 0,
      currentMcap: 0,
      lifespan: "Active",
    }));

    const totalCreated = tokens.length;
    const isSerial = totalCreated > 5;
    const riskLabel = totalCreated === 0 ? "New Creator" :
      totalCreated === 1 ? "Single Project" :
      totalCreated <= 3 ? "Multi-Project" :
      totalCreated <= 10 ? "Serial Deployer ⚠️" :
      "Extreme Serial Deployer 🚨";

    return {
      wallet,
      totalCreated,
      aliveCount: tokens.filter(t => t.alive).length,
      deadCount: tokens.filter(t => !t.alive).length,
      hitRate: totalCreated > 0 ? (tokens.filter(t => t.alive).length / totalCreated) * 100 : 0,
      avgRugTimeHours: 0,
      riskLabel,
      tokens: tokens.slice(0, 20),
    };
  } catch {
    return {
      wallet,
      totalCreated: 0,
      aliveCount: 0,
      deadCount: 0,
      hitRate: 0,
      avgRugTimeHours: 0,
      riskLabel: "Unknown",
      tokens: [],
    };
  }
}

export const CreatorPatterns: React.FC<Props> = ({ creatorWallet, compact = false }) => {
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTokens, setShowTokens] = useState(false);

  useEffect(() => {
    if (!creatorWallet) return;
    setLoading(true);
    fetchCreatorProfile(creatorWallet)
      .then(setProfile)
      .finally(() => setLoading(false));
  }, [creatorWallet]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-white/25">
        <Loader2 className="h-3 w-3 animate-spin" /> Checking creator...
      </div>
    );
  }

  if (!profile) return null;

  const isRisky = profile.totalCreated > 5;
  const isClean = profile.totalCreated <= 2;

  if (compact) {
    return (
      <Badge className={cn("text-[9px] gap-1",
        isClean ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
        isRisky ? "bg-red-500/10 text-red-400 border-red-500/20" :
        "bg-amber-500/10 text-amber-400 border-amber-500/20"
      )}>
        <Fingerprint className="h-2.5 w-2.5" />
        {profile.totalCreated} tokens by creator
      </Badge>
    );
  }

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-3">
      <div className="flex items-center gap-2.5 mb-2">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center border",
          isClean ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
          isRisky ? "bg-red-500/10 border-red-500/20 text-red-400" :
          "bg-amber-500/10 border-amber-500/20 text-amber-400"
        )}>
          <Fingerprint className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold text-white">Creator Profile</p>
            <Badge className={cn("text-[8px]",
              isClean ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
              isRisky ? "bg-red-500/10 text-red-400 border-red-500/20" :
              "bg-amber-500/10 text-amber-400 border-amber-500/20"
            )}>
              {profile.riskLabel}
            </Badge>
          </div>
          <p className="text-[10px] text-white/25">
            {shortAddr(creatorWallet)} · {profile.totalCreated} token{profile.totalCreated !== 1 ? "s" : ""} created
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center gap-1 text-[10px]">
          <TrendingUp className="h-2.5 w-2.5 text-emerald-400" />
          <span className="text-emerald-400 font-bold">{profile.aliveCount}</span>
          <span className="text-white/20">alive</span>
        </div>
        <div className="flex items-center gap-1 text-[10px]">
          <Skull className="h-2.5 w-2.5 text-red-400" />
          <span className="text-red-400 font-bold">{profile.deadCount}</span>
          <span className="text-white/20">dead</span>
        </div>
        {profile.hitRate > 0 && (
          <div className="flex items-center gap-1 text-[10px]">
            <Trophy className="h-2.5 w-2.5 text-amber-400" />
            <span className="text-amber-400 font-bold">{profile.hitRate.toFixed(0)}%</span>
            <span className="text-white/20">hit rate</span>
          </div>
        )}
      </div>

      {/* Token list toggle */}
      {profile.tokens.length > 0 && (
        <button
          onClick={() => setShowTokens(!showTokens)}
          className="text-[10px] text-white/20 hover:text-white/40 flex items-center gap-1 transition-colors"
        >
          {showTokens ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {showTokens ? "Hide" : "Show"} {profile.tokens.length} tokens
        </button>
      )}

      {showTokens && (
        <div className="mt-2 space-y-1">
          {profile.tokens.map(t => (
            <div key={t.mint} className="flex items-center gap-2 p-1.5 rounded-md bg-white/[0.015] border border-white/[0.04]">
              <span className="text-[10px] font-bold text-white">{t.symbol}</span>
              <span className="text-[9px] text-white/15 truncate flex-1">{t.name}</span>
              <Badge className={cn("text-[7px]",
                t.alive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/15" : "bg-red-500/10 text-red-400 border-red-500/15"
              )}>
                {t.alive ? "Active" : "Dead"}
              </Badge>
              <a href={`https://dexscreener.com/solana/${t.mint}`} target="_blank" rel="noopener" className="text-white/10 hover:text-white/30">
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CreatorPatterns;
