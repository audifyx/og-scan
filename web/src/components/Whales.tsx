import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Crown, Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import {
  heliusLargestAccounts,
  heliusTokenSupply,
  jupGetTokens,
  fmtNum,
  fmtUsd,
  shortAddr,
} from "@/lib/og";

type Props = { mint: string; onSelectWallet?: (w: string) => void };

export const Whales = ({ mint, onSelectWallet }: Props) => {
  const { data: holders, isLoading } = useQuery({
    queryKey: ["whales", mint],
    queryFn: () => heliusLargestAccounts(mint),
    refetchInterval: 30_000,
    enabled: !!mint,
    retry: 1,
  });

  const { data: supply } = useQuery({
    queryKey: ["supply", mint],
    queryFn: () => heliusTokenSupply(mint),
    refetchInterval: 60_000,
    enabled: !!mint,
  });

  const { data: meta } = useQuery({
    queryKey: ["whales-meta", mint],
    queryFn: () => jupGetTokens([mint]),
    enabled: !!mint,
    staleTime: 30_000,
  });
  const t = meta?.[0];
  const price = t?.usdPrice ?? 0;

  const totalSupply = supply?.uiAmount ?? 0;
  const top10Pct = useMemo(() => {
    if (!holders?.length || !totalSupply) return null;
    const sum = holders.slice(0, 10).reduce((a, h) => a + (h.uiAmount ?? 0), 0);
    return (sum / totalSupply) * 100;
  }, [holders, totalSupply]);

  const concentration =
    top10Pct == null ? "—" : top10Pct > 60 ? "VERY HIGH" : top10Pct > 40 ? "HIGH" : top10Pct > 25 ? "MID" : "LOW";
  const concentrationColor =
    top10Pct == null
      ? "text-muted-foreground"
      : top10Pct > 40
        ? "text-og-blood"
        : top10Pct > 25
          ? "text-og-gold"
          : "text-og-lime";

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <div className="border border-og-grid bg-og-ink/70 p-4 lg:col-span-1">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-og-gold">
          <Crown className="h-3 w-3" /> CONCENTRATION
        </div>
        <div className="mt-3 font-display text-4xl font-bold text-og-gold text-glow-gold">
          {top10Pct != null ? `${top10Pct.toFixed(1)}%` : "—"}
        </div>
        <div className={`mt-1 text-[10px] uppercase tracking-widest ${concentrationColor}`}>
          TOP 10 / SUPPLY · {concentration}
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden border border-og-grid bg-og-ink">
          <div
            className={
              top10Pct != null && top10Pct > 40
                ? "h-full bg-og-blood"
                : top10Pct != null && top10Pct > 25
                  ? "h-full bg-og-gold"
                  : "h-full bg-og-lime"
            }
            style={{ width: `${Math.min(100, top10Pct ?? 0)}%` }}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-[10px] uppercase tracking-widest">
          <div>
            <div className="text-foreground/40">SUPPLY</div>
            <div className="text-foreground">{fmtNum(totalSupply)}</div>
          </div>
          <div>
            <div className="text-foreground/40">FDV</div>
            <div className="text-og-cyan">{fmtUsd(totalSupply * price)}</div>
          </div>
        </div>
        {top10Pct != null && top10Pct > 40 && (
          <div className="mt-3 flex items-start gap-2 border border-og-blood/40 bg-og-blood/5 p-2 text-[10px] uppercase tracking-widest text-og-blood">
            <AlertTriangle className="h-3 w-3 shrink-0 mt-px" />
            HEAVY WHALE CONCENTRATION · DUMP RISK
          </div>
        )}
      </div>

      <div className="border border-og-grid bg-og-ink/70 lg:col-span-2">
        <div className="flex items-center justify-between border-b border-og-grid px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-og-cyan">
          <span>TOP 20 WHALES · HELIUS RPC</span>
          {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>
        <div className="hidden grid-cols-12 border-b border-og-grid bg-og-ink/40 px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground md:grid">
          <div className="col-span-1">#</div>
          <div className="col-span-5">WALLET</div>
          <div className="col-span-3 text-right">BALANCE</div>
          <div className="col-span-2 text-right">USD</div>
          <div className="col-span-1 text-right">%</div>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {(holders ?? []).slice(0, 20).map((h, i) => {
            const pct = totalSupply ? (h.uiAmount / totalSupply) * 100 : 0;
            const usd = h.uiAmount * price;
            const isWhale = pct >= 1;
            return (
              <div
                key={h.address}
                onClick={() => onSelectWallet?.(h.address)}
                className="group cursor-pointer border-b border-og-grid/50 p-3 text-xs transition hover:bg-og-cyan/5 md:grid md:grid-cols-12 md:items-center md:gap-2 md:px-3 md:py-2"
              >
                <div className="flex min-w-0 items-center justify-between gap-3 md:contents">
                  <div className="font-mono text-og-gold md:col-span-1">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="flex min-w-0 items-center gap-2 font-mono text-foreground/80 md:col-span-5">
                    {isWhale && <Crown className="h-3 w-3 shrink-0 text-og-gold" />}
                    <span className="truncate group-hover:text-og-cyan transition-colors">{shortAddr(h.address, 6)}</span>
                    <a
                      href={`https://solscan.io/account/${h.address}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="hover:text-white transition-colors"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                    </a>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 md:contents">
                  <div className="border border-og-grid/60 bg-og-ink/55 p-2 text-right md:col-span-3 md:border-0 md:bg-transparent md:p-0">
                    <div className="mb-1 text-left font-mono text-[8px] uppercase tracking-[0.22em] text-muted-foreground md:hidden">Balance</div>
                    <div className="truncate font-mono text-foreground">{fmtNum(h.uiAmount)}</div>
                  </div>
                  <div className="border border-og-grid/60 bg-og-ink/55 p-2 text-right md:col-span-2 md:border-0 md:bg-transparent md:p-0">
                    <div className="mb-1 text-left font-mono text-[8px] uppercase tracking-[0.22em] text-muted-foreground md:hidden">USD</div>
                    <div className="truncate font-mono text-og-cyan">{fmtUsd(usd)}</div>
                  </div>
                  <div className="border border-og-grid/60 bg-og-ink/55 p-2 text-right md:col-span-1 md:border-0 md:bg-transparent md:p-0">
                    <div className="mb-1 text-left font-mono text-[8px] uppercase tracking-[0.22em] text-muted-foreground md:hidden">%</div>
                    <div
                      className={`font-mono ${
                        pct > 5 ? "text-og-blood" : pct > 1 ? "text-og-gold" : "text-og-lime"
                      }`}
                    >
                      {pct.toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {!isLoading && (holders?.length ?? 0) === 0 && (
            <div className="p-6 text-center text-xs uppercase tracking-widest text-muted-foreground">
              NO HOLDERS RETURNED · CHECK MINT
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
