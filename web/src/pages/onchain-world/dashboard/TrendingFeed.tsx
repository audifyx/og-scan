import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Radio, Search } from "lucide-react";
import { EmptyState } from "@/pages/onchain-world/dashboard/EmptyState";
import { Button } from "@/pages/onchain-world/dashboard/ui/button";
import { formatPct, formatUsd } from "@/pages/onchain-world/lib/orbitx/format";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";
import { matchTokenQuery, tokenLabel, tokenTicker } from "../../../../shared/orbitx-chain-districts.js";
import { cn } from "@/lib/utils";

export function TrendingFeed() {
  const nav = useNavigate();
  const tokens = useOrbitxStore((s) => s.city.districts.tokens || []);
  const query = useOrbitxStore((s) => s.searchQuery);
  const setSearchQuery = useOrbitxStore((s) => s.setSearchQuery);
  const feedLimit = useOrbitxStore((s) => s.feedLimit);
  const expandFeed = useOrbitxStore((s) => s.expandFeed);
  const collapseFeed = useOrbitxStore((s) => s.collapseFeed);
  const selected = useOrbitxStore((s) => s.selectedToken);
  const selectToken = useOrbitxStore((s) => s.selectToken);
  const setCamCommand = useOrbitxStore((s) => s.setCamCommand);

  const matched = useMemo(
    () => tokens.filter((t) => matchTokenQuery(t, query)),
    [tokens, query],
  );
  const visible = matched.slice(0, feedLimit);

  function open(mint: string) {
    selectToken(mint);
    setCamCommand({ kind: "token", mint });
    nav(`/on-chain/token/${mint}`);
  }

  return (
    <section className="ox-panel flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="border-b border-line px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="ox-kicker text-fg">Trending · 24h</h2>
          <span className="text-2xs text-dim">{tokens.length}/250</span>
        </div>
        <label className="mt-2 flex items-center gap-1.5 rounded-md border border-line bg-bg-sunken px-2">
          <Search className="size-3.5 text-dim" />
          <input
            value={query}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name or ticker"
            className="h-8 min-w-0 flex-1 bg-transparent text-xs text-fg outline-none placeholder:text-dim"
          />
        </label>
      </header>

      <div className="ox-scroll min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <EmptyState
            icon={<Radio className="size-5" />}
            title="No trending coins yet"
            body="The desk only lists high-volume coins trending across Jupiter, DexScreener, GeckoTerminal, and Pump.fun."
          />
        ) : (
          <ol className="divide-y divide-line">
            {visible.map((t, i) => {
              const name = tokenLabel(t);
              const ticker = tokenTicker(t);
              const on = selected === t.mint;
              return (
                <li key={t.mint}>
                  <button
                    type="button"
                    onClick={() => open(t.mint)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-bg-hover",
                      on && "bg-accent-2/15",
                    )}
                  >
                    <span className="w-5 shrink-0 text-2xs text-dim">{i + 1}</span>
                    {t.image ? (
                      <img src={t.image} alt="" className="size-7 rounded-full object-cover" />
                    ) : (
                      <span className="size-7 rounded-full bg-bg-hover" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-fg">{name}</span>
                      <span className="block truncate text-2xs text-muted">
                        {ticker ? `$${ticker}` : "Solana"}
                        {t.source ? ` · ${t.source}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="ox-stat block text-xs text-fg">{formatUsd(t.volume_24h ?? null)}</span>
                      <span className={cn("block text-2xs", (t.change_24h ?? 0) >= 0 ? "text-live" : "text-sell")}>
                        {formatPct(t.change_24h ?? null)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-line px-3 py-2">
        <span className="text-2xs text-dim">
          Showing {visible.length} of {matched.length}
        </span>
        {matched.length > feedLimit ? (
          <Button variant="ghost" size="xs" onClick={expandFeed}>
            Show more
          </Button>
        ) : feedLimit > 12 ? (
          <Button variant="ghost" size="xs" onClick={collapseFeed}>
            Show less
          </Button>
        ) : null}
      </footer>
    </section>
  );
}
