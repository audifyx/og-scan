/**
 * TokenCompare — Side-by-side token analysis comparison tool.
 * Compare metrics, holders, liquidity, social signals for 2-4 tokens.
 */
import { useState, useEffect } from "react";
import { BarChart3, Search, Plus, X, Loader2, Trophy, ChevronDown, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { jupSearchToken, fmtUsd, fmtNum, shortAddr, type JupTokenInfo } from "@/lib/og";

interface CompareToken {
  info: JupTokenInfo;
  metrics: {
    mcap: number;
    volume24h: number;
    liquidity: number;
    holders: number;
    priceChange24h: number;
    age: string;
  };
}

interface Props {
  onSelectMint?: (mint: string) => void;
}

export const TokenCompare: React.FC<Props> = ({ onSelectMint }) => {
  const [tokens, setTokens] = useState<CompareToken[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<JupTokenInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const search = async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    try { setResults((await jupSearchToken(q)).slice(0, 6)); }
    catch { setResults([]); }
    setSearching(false);
  };

  const addToken = (info: JupTokenInfo) => {
    if (tokens.length >= 4) return;
    if (tokens.some(t => t.info.address === info.address)) return;

    setTokens(prev => [...prev, {
      info,
      metrics: {
        mcap: info.mcap || 0,
        volume24h: (info as any).volume24h || 0,
        liquidity: info.liquidity || 0,
        holders: 0,
        priceChange24h: 0,
        age: "Unknown",
      },
    }]);
    setSearchQuery("");
    setResults([]);
    setShowSearch(false);
  };

  const removeToken = (address: string) => {
    setTokens(prev => prev.filter(t => t.info.address !== address));
  };

  const metrics = [
    { key: "mcap", label: "Market Cap", format: fmtUsd, higher: true },
    { key: "liquidity", label: "Liquidity", format: fmtUsd, higher: true },
    { key: "volume24h", label: "24h Volume", format: fmtUsd, higher: true },
  ];

  const getWinner = (key: string, higher: boolean) => {
    if (tokens.length < 2) return null;
    const vals = tokens.map(t => (t.metrics as any)[key] || 0);
    const best = higher ? Math.max(...vals) : Math.min(...vals);
    const idx = vals.indexOf(best);
    return tokens[idx]?.info.address;
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
        <BarChart3 className="h-4 w-4 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-bold text-white">Token Compare</p>
          <p className="text-[10px] text-white/25">{tokens.length}/4 tokens selected</p>
        </div>
        {tokens.length < 4 && (
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-1.5 rounded-lg border border-white/[0.08] text-white/20 hover:border-primary/30"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showSearch && (
        <div className="p-3 border-b border-white/[0.06] bg-primary/5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/20" />
            <Input
              placeholder="Search token to compare..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); search(e.target.value); }}
              className="pl-8 h-8 text-xs bg-white/[0.03] border-white/[0.08]"
              autoFocus
            />
          </div>
          {results.length > 0 && (
            <div className="mt-2 space-y-0.5">
              {results.map(r => (
                <button
                  key={r.address}
                  onClick={() => addToken(r)}
                  className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white/[0.04] text-left"
                >
                  {r.logoURI && <img src={r.logoURI} className="w-5 h-5 rounded-full" alt="" />}
                  <span className="text-[11px] font-bold text-white">{r.symbol}</span>
                  <span className="text-[9px] text-white/20 flex-1 truncate">{r.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tokens.length === 0 ? (
        <div className="p-8 text-center">
          <BarChart3 className="h-8 w-8 text-white/[0.06] mx-auto mb-2" />
          <p className="text-xs text-white/20">Add tokens to compare</p>
          <p className="text-[10px] text-white/10 mt-1">Compare up to 4 tokens side by side</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="p-2 text-left text-[9px] text-white/20 w-24">Metric</th>
                {tokens.map(t => (
                  <th key={t.info.address} className="p-2 text-center min-w-[100px]">
                    <div className="flex items-center justify-center gap-1">
                      {t.info.logoURI && <img src={t.info.logoURI} className="w-4 h-4 rounded-full" alt="" />}
                      <span className="text-[10px] font-bold text-white">{t.info.symbol}</span>
                      <button onClick={() => removeToken(t.info.address)} className="text-white/10 hover:text-red-400">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {metrics.map(m => {
                const winner = getWinner(m.key, m.higher);
                return (
                  <tr key={m.key}>
                    <td className="p-2 text-[9px] text-white/30">{m.label}</td>
                    {tokens.map(t => {
                      const val = (t.metrics as any)[m.key] || 0;
                      const isWinner = t.info.address === winner;
                      return (
                        <td key={t.info.address} className="p-2 text-center">
                          <span className={cn("text-[10px] font-bold",
                            isWinner ? "text-primary" : "text-white/50"
                          )}>
                            {m.format(val)}
                          </span>
                          {isWinner && tokens.length > 1 && <Trophy className="h-2.5 w-2.5 text-primary inline ml-1" />}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TokenCompare;
