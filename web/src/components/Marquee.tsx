import { useQuery } from "@tanstack/react-query";
import { jupGetTokens, fmtUsd, fmtPct } from "@/lib/og";

const TICKER_MINTS = [
  "So11111111111111111111111111111111111111112", // SOL
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // BONK
  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", // WIF
  "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4", // JLP
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", // JUP
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
];

export const Marquee = () => {
  const { data } = useQuery({
    queryKey: ["ticker", TICKER_MINTS],
    queryFn: () => jupGetTokens(TICKER_MINTS),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const items = (data ?? []).slice(0, 12);
  // Repeat to seamless loop
  const loop = items.length > 0 ? [...items, ...items] : [];

  return (
    <div className="relative overflow-hidden border-y border-white/10 bg-[#020915]/82 py-2 backdrop-blur-xl">
      <div className="flex w-max gap-3 ticker-track whitespace-nowrap px-3">
        {loop.length === 0 && (
          <span className="rounded-full border border-white/10 bg-white/[0.045] px-4 py-2 text-xs text-muted-foreground">CONNECTING TO JUPITER FEED…</span>
        )}
        {loop.map((t, i) => {
          const ch = t.stats24h?.priceChange ?? 0;
          const up = ch >= 0;
          return (
            <span key={`${t.id}-${i}`} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-xs uppercase tracking-widest">
              <span className="text-og-gold font-bold">${t.symbol}</span>
              <span className="text-foreground">{fmtUsd(t.usdPrice)}</span>
              <span className={up ? "text-og-lime" : "text-og-blood"}>
                {up ? "▲" : "▼"} {fmtPct(ch)}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
};
