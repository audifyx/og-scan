import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, Loader2, Search, ShieldCheck, Zap } from "lucide-react";
import { CopyMintButton } from "@/components/CopyMintButton";
import {
  jupQuote,
  jupGetTokens,
  jupSearchToken,
  SOL_MINT,
  fmtUsd,
  fmtPct,
  fmtNum,
  shortAddr,
  type JupTokenInfo,
} from "@/lib/og";

type Props = {
  ogMint: string;
  onSelectMint: (mint: string) => void;
};

type SwapTab = "quote" | "search";

export const SwapPanel = ({ ogMint, onSelectMint }: Props) => {
  const [solAmount, setSolAmount] = useState<string>("1");
  const [activeTab, setActiveTab] = useState<SwapTab>("quote");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const lamports = useMemo(() => {
    const n = Number(solAmount);
    if (!isFinite(n) || n <= 0) return "0";
    return Math.floor(n * 1e9).toString();
  }, [solAmount]);

  useEffect(() => {
    const timeoutId: number = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  const { data: tokens } = useQuery({
    queryKey: ["swap-meta", ogMint],
    queryFn: () => jupGetTokens([SOL_MINT, ogMint]),
    enabled: !!ogMint,
    staleTime: 30_000,
  });
  const sol = tokens?.find((t) => t.id === SOL_MINT);
  const og = tokens?.find((t) => t.id === ogMint);

  const { data: quote, isFetching, error } = useQuery({
    queryKey: ["quote", ogMint, lamports],
    queryFn: () => jupQuote(SOL_MINT, ogMint, lamports, 100),
    enabled: !!ogMint && lamports !== "0",
    refetchInterval: 12_000,
    retry: 1,
  });

  const { data: searchResults, isFetching: isSearching } = useQuery({
    queryKey: ["swap-token-search", debouncedSearch],
    queryFn: () => jupSearchToken(debouncedSearch),
    enabled: debouncedSearch.length >= 2,
    staleTime: 30_000,
  });

  const outAmount = useMemo(() => {
    if (!quote || !og) return "";
    const out = Number(quote.outAmount) / 10 ** og.decimals;
    return out.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }, [quote, og]);

  const impact = quote ? Number(quote.priceImpactPct) * 100 : null;
  const route = quote?.routePlan?.map((r) => r.swapInfo.label).join(" → ") ?? "";
  const hits: JupTokenInfo[] = searchResults ?? [];

  const selectSearchMint = (mint: string): void => {
    onSelectMint(mint);
    setActiveTab("quote");
  };

  return (
    <section id="swap" className="relative scroll-mt-36">
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-og-lime">
            <span className="h-px w-10 bg-og-lime" /> JUPITER ROUTER
          </div>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
            <span className="text-foreground">COP THE</span>{" "}
            <span className="text-og-lime text-glow">${og?.symbol ?? "OG"}</span>
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Live quote routed through Jupiter's aggregator — the same engine that powers jup.ag.
            Connect a wallet on Jupiter to execute.
          </p>
          <ul className="mt-6 space-y-2 text-xs text-muted-foreground">
            <li className="flex items-center gap-2"><span className="h-1 w-4 bg-og-lime" /> Best execution across Solana DEXs</li>
            <li className="flex items-center gap-2"><span className="h-1 w-4 bg-og-gold" /> 1% slippage default</li>
            <li className="flex items-center gap-2"><span className="h-1 w-4 bg-og-cyan" /> Refreshes every 12s</li>
          </ul>
        </div>

        <div className="lg:col-span-3">
          <div className="relative border border-og-lime/40 bg-og-ink shadow-og">
            <div className="flex items-center justify-between border-b border-og-grid px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-og-lime">
              <span>{activeTab === "quote" ? "QUOTE.SH" : "COIN_SEARCH.SH"}</span>
              <span className="flex items-center gap-2">
                {(isFetching || isSearching) && <Loader2 className="h-3 w-3 animate-spin" />}
                {isFetching ? "ROUTING" : isSearching ? "SEARCHING" : "READY"}
              </span>
            </div>

            <div className="grid grid-cols-2 border-b border-og-grid p-2">
              <button
                onClick={() => setActiveTab("quote")}
                className={`border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.25em] transition ${
                  activeTab === "quote"
                    ? "border-og-lime bg-og-lime text-og-ink"
                    : "border-og-grid text-foreground/60 hover:border-og-lime hover:text-og-lime"
                }`}
              >
                Swap Quote
              </button>
              <button
                onClick={() => setActiveTab("search")}
                className={`border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.25em] transition ${
                  activeTab === "search"
                    ? "border-og-gold bg-og-gold text-og-ink"
                    : "border-og-grid text-foreground/60 hover:border-og-gold hover:text-og-gold"
                }`}
              >
                Search Coins
              </button>
            </div>

            {activeTab === "quote" && (
            <div className="space-y-3 p-4">
              {/* Pay */}
              <div className="border border-og-grid bg-og-ink/70 p-4">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">YOU PAY</div>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    value={solAmount}
                    onChange={(e) => setSolAmount(e.target.value.replace(/[^\d.]/g, ""))}
                    className="og-plain-input w-full font-display text-3xl font-bold text-white"
                    placeholder="0.0"
                    inputMode="decimal"
                  />
                  <TokenChip icon={sol?.icon} symbol="SOL" />
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  ≈ {fmtUsd(Number(solAmount) * (sol?.usdPrice ?? 0))}
                </div>
              </div>

              <div className="flex justify-center">
                <div className="grid h-8 w-8 place-items-center border border-og-grid bg-og-ink text-og-lime">
                  <ArrowDown className="h-4 w-4" />
                </div>
              </div>

              {/* Receive */}
              <div className="border border-og-gold/40 bg-og-ink/70 p-4">
                <div className="text-[10px] uppercase tracking-widest text-og-gold">YOU RECEIVE</div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="w-full font-display text-3xl font-bold text-og-gold text-glow-gold">
                    {error ? "—" : outAmount || "0.0"}
                  </div>
                  <TokenChip icon={og?.icon} symbol={og?.symbol ?? "OG"} />
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  ≈ {fmtUsd(Number(outAmount.replace(/,/g, "")) * (og?.usdPrice ?? 0))}
                </div>
              </div>

              {/* Quote details */}
              <div className="grid grid-cols-3 gap-3 border border-og-grid bg-og-ink/50 p-3 text-[10px] uppercase tracking-widest">
                <div>
                  <div className="text-muted-foreground">PRICE IMPACT</div>
                  <div className={`mt-1 ${impact != null && impact > 1 ? "text-og-blood" : "text-og-lime"}`}>
                    {impact != null ? fmtPct(impact) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">SLIPPAGE</div>
                  <div className="mt-1 text-foreground">1.00%</div>
                </div>
                <div>
                  <div className="text-muted-foreground">ROUTE</div>
                  <div className="mt-1 truncate text-og-cyan" title={route}>{route || "—"}</div>
                </div>
              </div>

              <a
                href={`https://jup.ag/swap/SOL-${ogMint}`}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center justify-center gap-2 border border-og-lime bg-og-lime py-4 text-sm font-bold uppercase tracking-[0.3em] text-og-ink transition hover:bg-og-lime/90 pulse-glow"
              >
                <Zap className="h-4 w-4" />
                EXECUTE ON JUPITER
              </a>
              {error && <div className="text-center text-[10px] uppercase tracking-widest text-og-blood">{(error as Error).message}</div>}
            </div>
            )}

            {activeTab === "search" && (
              <div className="space-y-3 p-4">
                <div className="border border-og-gold/40 bg-og-ink/70 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-og-gold">SELECT TOKEN TO RECEIVE</div>
                      <p className="mt-1 text-xs text-muted-foreground">Search ticker, name, or paste mint. Selecting keeps you inside swap.</p>
                    </div>
                    <TokenChip icon={og?.icon} symbol={og?.symbol ?? "OG"} />
                  </div>
                  <div className="og-search-box px-3">
                    <Search className="h-4 w-4 text-og-gold" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="WIF · BONK · POPCAT · mint address"
                      className="og-search-input px-1 font-mono text-sm tracking-wide"
                    />
                    {isSearching && <Loader2 className="mr-3 h-4 w-4 animate-spin text-og-gold" />}
                  </div>
                </div>

                <div className="grid max-h-[460px] gap-2 overflow-y-auto pr-1">
                  {hits.slice(0, 14).map((token) => (
                    <SwapSearchRow
                      key={token.id}
                      token={token}
                      selected={token.id === ogMint}
                      onSelect={() => selectSearchMint(token.id)}
                    />
                  ))}
                  {debouncedSearch.length >= 2 && !isSearching && hits.length === 0 && (
                    <div className="border border-dashed border-og-grid p-6 text-center text-xs uppercase tracking-widest text-muted-foreground">
                      NO SWAPPABLE TOKENS FOUND
                    </div>
                  )}
                  {debouncedSearch.length < 2 && (
                    <div className="border border-dashed border-og-grid p-6 text-center text-xs uppercase tracking-widest text-muted-foreground">
                      › type 2+ chars to search swap coins
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

const TokenChip = ({ icon, symbol }: { icon?: string; symbol: string }) => (
  <div className="flex shrink-0 items-center gap-2 border border-og-grid bg-og-ink px-2 py-1.5">
    <div className="h-6 w-6 overflow-hidden border border-og-grid bg-og-ink">
      {icon ? <img src={icon} alt={symbol} className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-[10px] text-og-lime">{symbol[0]}</div>}
    </div>
    <span className="font-display text-sm font-bold">{symbol}</span>
  </div>
);

const SwapSearchRow = ({
  token,
  selected,
  onSelect,
}: {
  token: JupTokenInfo;
  selected: boolean;
  onSelect: () => void;
}) => {
  const ch: number = token.stats24h?.priceChange ?? 0;
  const isUp: boolean = ch >= 0;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onSelect();
      }}
      className={`group flex cursor-pointer items-center gap-3 border p-3 text-left transition ${
        selected
          ? "border-og-lime bg-og-lime/10"
          : "border-og-grid bg-og-ink/70 hover:border-og-gold hover:bg-og-gold/5"
      }`}
    >
      <div className="h-11 w-11 shrink-0 overflow-hidden border border-og-grid bg-og-ink">
        {token.icon ? (
          <img src={token.icon} alt={token.symbol} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="grid h-full w-full place-items-center text-xs text-og-gold">{token.symbol?.[0] ?? "?"}</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-sm font-bold text-og-gold">${token.symbol}</span>
          {token.isVerified && <ShieldCheck className="h-3 w-3 shrink-0 text-og-lime" />}
          {selected && <span className="ml-auto text-[10px] uppercase tracking-widest text-og-lime">selected</span>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="max-w-[170px] truncate">{token.name}</span>
          <span className={isUp ? "text-og-lime" : "text-og-blood"}>{fmtPct(ch)}</span>
          <span>LQ {fmtUsd(token.liquidity)}</span>
          <span>MC {fmtUsd(token.mcap ?? token.fdv)}</span>
          <span>H {fmtNum(token.holderCount)}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-foreground/40">
          <span>CA {shortAddr(token.id, 5)}</span>
          <CopyMintButton mint={token.id} label="copy" copiedLabel="copied" className="px-2 py-1" iconClassName="h-3 w-3" />
        </div>
      </div>
    </article>
  );
};
