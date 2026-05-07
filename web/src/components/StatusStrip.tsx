import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Copy, Check, Pencil } from "lucide-react";
import {
  jupGetTokens,
  heliusSlot,
  fmtUsd,
  fmtPct,
  shortAddr,
} from "@/lib/og";

type Props = { mint: string; onChangeMint: () => void };

export const StatusStrip = ({ mint, onChangeMint }: Props) => {
  const { data } = useQuery({
    queryKey: ["status-strip", mint],
    queryFn: () => jupGetTokens([mint]),
    refetchInterval: 15_000,
    enabled: !!mint,
  });
  const t = data?.[0];

  const { data: slot } = useQuery({
    queryKey: ["slot"],
    queryFn: () => heliusSlot(),
    refetchInterval: 5_000,
  });

  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(mint).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => (n + 1) % 60), 1000);
    return () => window.clearInterval(id);
  }, []);

  const ch = t?.stats24h?.priceChange ?? 0;
  const up = ch >= 0;

  return (
    <div className="relative z-30 border-b border-og-grid bg-og-ink/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest">
        <span className="inline-flex items-center gap-1.5 text-og-lime">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-og-lime opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-og-lime" />
          </span>
          MAINNET
        </span>
        <span className="text-og-grid">|</span>
        <span className="text-muted-foreground">SLOT</span>
        <span className="text-og-cyan">{slot != null ? slot.toLocaleString() : "—"}</span>
        <span className="text-og-grid">|</span>
        <span className="text-muted-foreground">${t?.symbol ?? "—"}</span>
        <span className="text-foreground">{fmtUsd(t?.usdPrice)}</span>
        <span className={up ? "text-og-lime" : "text-og-blood"}>
          {up ? "▲" : "▼"} {fmtPct(ch)}
        </span>
        <span className="text-og-grid hidden sm:inline">|</span>
        <span className="hidden text-muted-foreground sm:inline">MCAP</span>
        <span className="hidden text-og-gold sm:inline">{fmtUsd(t?.mcap)}</span>
        <span className="text-og-grid hidden md:inline">|</span>
        <span className="hidden text-muted-foreground md:inline">LIQ</span>
        <span className="hidden text-og-cyan md:inline">{fmtUsd(t?.liquidity)}</span>

        <span className="ml-auto inline-flex items-center gap-1.5">
          <button
            onClick={onChangeMint}
            className="inline-flex items-center gap-1 border border-og-grid px-1.5 py-0.5 text-foreground/70 transition hover:border-og-lime hover:text-og-lime"
            title="Change mint"
          >
            <Pencil className="h-3 w-3" /> {shortAddr(mint, 4)}
          </button>
          <button
            onClick={copy}
            className="inline-flex items-center gap-1 border border-og-grid px-1.5 py-0.5 text-foreground/70 transition hover:border-og-gold hover:text-og-gold"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </button>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Activity className="h-3 w-3" /> {String(tick).padStart(2, "0")}
          </span>
        </span>
      </div>
    </div>
  );
};
