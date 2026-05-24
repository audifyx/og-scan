/**
 * ComparativeScan — Side-by-Side Token Comparison
 * Scan 2-3 tokens simultaneously and compare forensics in columns.
 * Shows which token is safer, more liquid, better distributed, etc.
 */
import { useState, useCallback } from "react";
import { Plus, X, Search, Loader2, Trophy, Shield, Droplets, Users, Clock, TrendingUp, BarChart3, AlertTriangle, CheckCircle, Minus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { jupSearchToken, type JupTokenInfo, fmtUsd, fmtNum, shortAddr, tokenEffectiveLiquidityUsd } from "@/lib/og";

interface CompareToken {
  mint: string;
  symbol: string;
  name: string;
  logoURI?: string;
  liquidity: number;
  mcap: number;
  holders: number;
  volume24h: number;
  priceChange24h: number;
  riskScore: number;
  age: number; // days
  hasMintAuth: boolean;
  hasFreezeAuth: boolean;
  isWinner: Record<string, boolean>;
}

interface CompareMetric {
  id: string;
  label: string;
  icon: React.ReactNode;
  format: (val: any) => string;
  higherIsBetter: boolean;
  key: keyof CompareToken;
}

const METRICS: CompareMetric[] = [
  { id: "liquidity", label: "Liquidity", icon: <Droplets className="h-3.5 w-3.5" />, format: (v: number) => fmtUsd(v), higherIsBetter: true, key: "liquidity" },
  { id: "mcap", label: "Market Cap", icon: <BarChart3 className="h-3.5 w-3.5" />, format: (v: number) => fmtUsd(v), higherIsBetter: true, key: "mcap" },
  { id: "holders", label: "Holders", icon: <Users className="h-3.5 w-3.5" />, format: (v: number) => v.toLocaleString(), higherIsBetter: true, key: "holders" },
  { id: "volume24h", label: "24h Volume", icon: <TrendingUp className="h-3.5 w-3.5" />, format: (v: number) => fmtUsd(v), higherIsBetter: true, key: "volume24h" },
  { id: "priceChange24h", label: "24h Change", icon: <TrendingUp className="h-3.5 w-3.5" />, format: (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`, higherIsBetter: true, key: "priceChange24h" },
  { id: "riskScore", label: "Risk Score", icon: <Shield className="h-3.5 w-3.5" />, format: (v: number) => `${v}/100`, higherIsBetter: false, key: "riskScore" },
  { id: "age", label: "Token Age", icon: <Clock className="h-3.5 w-3.5" />, format: (v: number) => v >= 1 ? `${Math.floor(v)}d` : `${Math.floor(v * 24)}h`, higherIsBetter: true, key: "age" },
];

const MAX_COMPARE = 3;

export const ComparativeScan: React.FC<{ onSelect?: (mint: string) => void }> = ({ onSelect }) => {
  const [tokens, setTokens] = useState<CompareToken[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<JupTokenInfo[]>([]);
  const [addingSlot, setAddingSlot] = useState(false);

  const searchToken = useCallback(async (query: string) => {
    if (!query || query.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const results = await jupSearchToken(query);
      setSearchResults(results.slice(0, 8));
    } catch { setSearchResults([]); }
    setSearching(false);
  }, []);

  const addToken = (token: JupTokenInfo) => {
    if (tokens.length >= MAX_COMPARE) return;
    if (tokens.some(t => t.mint === token.address)) return;

    const liq = tokenEffectiveLiquidityUsd(token);
    const newToken: CompareToken = {
      mint: token.address,
      symbol: token.symbol || "???",
      name: token.name || "Unknown",
      logoURI: token.logoURI,
      liquidity: liq,
      mcap: token.mcap || 0,
      holders: 0,
      volume24h: (token as any).volume24h || 0,
      priceChange24h: (token as any).priceChange24h || 0,
      riskScore: 50,
      age: token.createdAt ? (Date.now() - new Date(token.createdAt).getTime()) / (1000 * 60 * 60 * 24) : 0,
      hasMintAuth: !!token.audit?.mintAuthority,
      hasFreezeAuth: !!token.audit?.freezeAuthority,
      isWinner: {},
    };

    setTokens(prev => [...prev, newToken]);
    setSearchQuery("");
    setSearchResults([]);
    setAddingSlot(false);
  };

  const removeToken = (mint: string) => {
    setTokens(prev => prev.filter(t => t.mint !== mint));
  };

  // Determine winners for each metric
  const tokensWithWinners = tokens.map(t => {
    const winners: Record<string, boolean> = {};
    METRICS.forEach(m => {
      const vals = tokens.map(tk => tk[m.key] as number);
      const best = m.higherIsBetter ? Math.max(...vals) : Math.min(...vals);
      winners[m.id] = (t[m.key] as number) === best && tokens.length > 1;
    });
    return { ...t, isWinner: winners };
  });

  // Overall winner
  const overallWins = tokensWithWinners.map(t =>
    Object.values(t.isWinner).filter(Boolean).length
  );
  const maxWins = Math.max(...overallWins, 0);

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-white">Compare Tokens</span>
          <span className="text-[10px] text-white/20">Side-by-side forensics</span>
        </div>

        {/* Token slots */}
        <div className="flex gap-2 mb-4">
          {tokens.map((t, i) => (
            <div key={t.mint} className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5">
              <div className="flex items-center gap-2">
                {t.logoURI ? (
                  <img src={t.logoURI} className="w-6 h-6 rounded-full" alt="" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center text-[9px] font-bold text-white/30">
                    {t.symbol.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{t.symbol}</p>
                  <p className="text-[9px] text-white/20 truncate">{t.name}</p>
                </div>
                <button onClick={() => removeToken(t.mint)} className="text-white/15 hover:text-red-400 transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </div>
              {overallWins[i] === maxWins && maxWins > 0 && tokens.length > 1 && (
                <Badge className="mt-1.5 bg-primary/10 text-primary border-primary/20 text-[8px] gap-0.5">
                  <Trophy className="h-2 w-2" /> Best Overall
                </Badge>
              )}
            </div>
          ))}

          {tokens.length < MAX_COMPARE && (
            <div className="flex-1">
              {addingSlot ? (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-white/20" />
                    <Input
                      placeholder="Search token..."
                      value={searchQuery}
                      onChange={e => { setSearchQuery(e.target.value); searchToken(e.target.value); }}
                      className="pl-7 h-7 text-xs bg-white/[0.03] border-white/[0.06]"
                      autoFocus
                    />
                    {searching && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-white/20" />}
                  </div>
                  {searchResults.length > 0 && (
                    <div className="mt-1.5 max-h-[200px] overflow-y-auto space-y-0.5">
                      {searchResults.map(r => (
                        <button
                          key={r.address}
                          onClick={() => addToken(r)}
                          className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
                        >
                          {r.logoURI ? (
                            <img src={r.logoURI} className="w-5 h-5 rounded-full" alt="" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-white/[0.06]" />
                          )}
                          <span className="text-[11px] font-bold text-white">{r.symbol}</span>
                          <span className="text-[9px] text-white/20 truncate flex-1">{r.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <button onClick={() => { setAddingSlot(false); setSearchQuery(""); setSearchResults([]); }} className="mt-1 text-[9px] text-white/20 hover:text-white/40">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingSlot(true)}
                  className="w-full h-full min-h-[60px] rounded-lg border border-dashed border-white/[0.08] hover:border-primary/30 flex flex-col items-center justify-center gap-1 transition-colors"
                >
                  <Plus className="h-4 w-4 text-white/15" />
                  <span className="text-[10px] text-white/15">Add Token</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Comparison table */}
        {tokensWithWinners.length >= 2 && (
          <div className="space-y-1">
            {METRICS.map(metric => (
              <div key={metric.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.015] border border-white/[0.04]">
                <div className="w-24 flex items-center gap-1.5 shrink-0">
                  <span className="text-white/30">{metric.icon}</span>
                  <span className="text-[10px] font-medium text-white/40">{metric.label}</span>
                </div>
                {tokensWithWinners.map(t => (
                  <div key={t.mint} className={cn(
                    "flex-1 text-center py-1 rounded-md transition-all",
                    t.isWinner[metric.id]
                      ? "bg-primary/10 border border-primary/20"
                      : "bg-transparent"
                  )}>
                    <span className={cn(
                      "text-xs font-bold",
                      t.isWinner[metric.id] ? "text-primary" : "text-white/50"
                    )}>
                      {metric.format(t[metric.key])}
                    </span>
                    {t.isWinner[metric.id] && <Trophy className="h-2.5 w-2.5 text-primary inline ml-1" />}
                  </div>
                ))}
              </div>
            ))}

            {/* Authority check row */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.015] border border-white/[0.04]">
              <div className="w-24 flex items-center gap-1.5 shrink-0">
                <Shield className="h-3.5 w-3.5 text-white/30" />
                <span className="text-[10px] font-medium text-white/40">Authority</span>
              </div>
              {tokensWithWinners.map(t => (
                <div key={t.mint} className="flex-1 text-center">
                  <div className="flex items-center justify-center gap-1">
                    {!t.hasMintAuth && !t.hasFreezeAuth ? (
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[8px]">
                        <CheckCircle className="h-2 w-2 mr-0.5" />Revoked
                      </Badge>
                    ) : (
                      <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[8px]">
                        <AlertTriangle className="h-2 w-2 mr-0.5" />Active
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tokens.length < 2 && (
          <div className="text-center py-6">
            <BarChart3 className="h-8 w-8 text-white/[0.06] mx-auto mb-2" />
            <p className="text-xs text-white/20">Add at least 2 tokens to compare</p>
            <p className="text-[10px] text-white/10 mt-1">Compare forensics side by side</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComparativeScan;
