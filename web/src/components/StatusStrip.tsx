import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Copy, Check, Pencil } from "lucide-react";
import {
  jupGetTokens,
  heliusSlot,
  fmtUsd,
  fmtPct,
  shortAddr,
  copyTextToClipboard,
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
    void copyTextToClipboard(mint).then((didCopy: boolean) => {
      if (!didCopy) {
        window.prompt("Copy this contract address:", mint);
        return;
      }
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
    <div className="relative z-30 border-b border-white/10 bg-[#020915]/88 backdrop-blur-xl">
      <div className="ios-scroll mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-2 font-mono text-[10px] uppercase tracking-widest sm:px-6">
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-og-lime/35 bg-og-lime/10 px-2.5 py-1 text-og-lime">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-og-lime opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-og-lime" />
          </span>
          MAINNET
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-muted-foreground">
          SLOT <span className="text-og-cyan">{slot != null ? slot.toLocaleString() : "—"}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-muted-foreground">
          ${t?.symbol ?? "—"} <span className="text-foreground">{fmtUsd(t?.usdPrice)}</span>
          <span className={up ? "text-og-lime" : "text-og-blood"}>{up ? "▲" : "▼"} {fmtPct(ch)}</span>
        </span>
        <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-muted-foreground sm:inline-flex">
          MCAP <span className="text-og-gold">{fmtUsd(t?.mcap)}</span>
        </span>
        <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-muted-foreground md:inline-flex">
          LIQ <span className="text-og-cyan">{fmtUsd(t?.liquidity)}</span>
        </span>

        <span className="ml-auto inline-flex shrink-0 items-center gap-1.5">
          <button
            onClick={onChangeMint}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-foreground/70 transition hover:border-og-lime hover:text-og-lime"
            title="Change mint"
          >
            <Pencil className="h-3 w-3" /> {shortAddr(mint, 4)}
          </button>
          <button
            onClick={copy}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-foreground/70 transition hover:border-og-gold hover:text-og-gold"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </button>
          <span className="hidden items-center gap-1 text-muted-foreground sm:inline-flex">
            <Activity className="h-3 w-3" /> {String(tick).padStart(2, "0")}
          </span>
        </span>
      </div>
    </div>
  );
};
