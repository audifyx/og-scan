// OrbitX NFT Marketplace — home (Magic-Eden-style). Hero featured collection,
// Trending/Top/Watchlist tabs with time-range pills, a trending table, notable
// drops, and recently-listed + latest-sales rails. All data is live from the
// registry — no fabricated numbers.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Flame, Crown, Star, ArrowRight, Tag, TrendingUp, AlertTriangle, Rocket, Eye, Heart } from "lucide-react";
import { useMarketCollections, useActiveListings, useRecentSales, fmtSol, fmtInt, timeAgo, type OrbitxNftCollection } from "./nftMarketData";
import { listCoinMarkets } from "./nftCoin";
import { useQuery } from "@tanstack/react-query";
import { Media, Verified, RarityBadge, SectionHeader, Empty } from "./_ui";
import { PriceText } from "./currency";
import { useNftWatchlist } from "./watchlist";

type TopTab = "trending" | "top" | "watchlist";
type Range = "24h" | "7d" | "30d" | "all";
const RANGE_MS: Record<Range, number | null> = { "24h": 864e5, "7d": 6048e5, "30d": 2592e6, all: null };

export default function MarketplaceHome() {
  const { data: collections, isLoading } = useMarketCollections();
  const { data: listings } = useActiveListings();
  const { data: sales } = useRecentSales(10);
  const { data: coinMarkets } = useQuery({ queryKey: ["coin-markets-home"], staleTime: 20_000, queryFn: listCoinMarkets });
  const trendingNfts = useMemo(() => {
    return [...(listings ?? [])]
      .filter((l) => l.nft)
      .sort((a, b) => ((b.nft?.favorite_count ?? 0) + (b.nft?.view_count ?? 0)) - ((a.nft?.favorite_count ?? 0) + (a.nft?.view_count ?? 0)))
      .slice(0, 10);
  }, [listings]);
  const { ids: watched, toggle: toggleWatch } = useNftWatchlist();

  const [tab, setTab] = useState<TopTab>("trending");
  const [range, setRange] = useState<Range>("7d");

  const rows = useMemo(() => {
    let list = [...(collections ?? [])];
    const win = RANGE_MS[range];
    if (win) { const cutoff = Date.now() - win; list = list.filter((c) => new Date(c.created_at).getTime() >= cutoff || (c.volume_sol ?? 0) > 0); }
    if (tab === "watchlist") list = list.filter((c) => watched.has(c.id));
    if (tab === "top") list.sort((a, b) => (b.floor_price_sol ?? 0) - (a.floor_price_sol ?? 0));
    else list.sort((a, b) => (b.volume_sol ?? 0) - (a.volume_sol ?? 0));
    return list.slice(0, 20);
  }, [collections, tab, range, watched]);

  const featured = useMemo(() => {
    const verified = (collections ?? []).filter((c) => c.verified);
    const pool = verified.length ? verified : (collections ?? []);
    return [...pool].sort((a, b) => (b.volume_sol ?? 0) - (a.volume_sol ?? 0))[0] ?? null;
  }, [collections]);

  const staffPicks = useMemo(() => {
    return (collections ?? [])
      .filter((c) => (c as unknown as { featured?: boolean }).featured)
      .sort((a, b) => (((a as unknown as { featured_rank?: number }).featured_rank ?? 999)) - (((b as unknown as { featured_rank?: number }).featured_rank ?? 999)))
      .slice(0, 8);
  }, [collections]);

  return (
    <div className="space-y-10">
      {featured && <Hero c={featured} />}

      {staffPicks.length > 0 && (
        <section>
          <SectionHeader title="Staff picks" sub="Featured by the OrbitX curation team" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {staffPicks.map((c) => <CollectionCard key={c.id} c={c} />)}
          </div>
        </section>
      )}

      {/* trending table */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <TabBtn active={tab === "trending"} onClick={() => setTab("trending")} icon={<Flame className="h-4 w-4" />}>Trending</TabBtn>
            <TabBtn active={tab === "top"} onClick={() => setTab("top")} icon={<Crown className="h-4 w-4" />}>Top</TabBtn>
            <TabBtn active={tab === "watchlist"} onClick={() => setTab("watchlist")} icon={<Star className="h-4 w-4" />}>Watchlist</TabBtn>
          </div>
          <div className="mkt-rail flex items-center gap-1 overflow-x-auto">
            {(["24h", "7d", "30d", "all"] as Range[]).map((r) => (
              <button key={r} onClick={() => setRange(r)} className={`mkt-chip px-2.5 py-1 text-[11px] font-bold uppercase ${range === r ? "active" : ""}`}>{r}</button>
            ))}
          </div>
        </div>

        <div className="mkt-panel overflow-hidden">
          <div className="grid grid-cols-[32px_1fr_repeat(3,minmax(0,90px))_40px] items-center gap-2 border-b mkt-hairline px-4 py-2.5 text-[10px] font-black uppercase tracking-widest mkt-muted sm:grid-cols-[40px_1fr_repeat(4,minmax(0,110px))_44px]">
            <span>#</span><span>Collection</span>
            <span className="text-right">Floor</span>
            <span className="text-right">Volume</span>
            <span className="hidden text-right sm:block">Items</span>
            <span className="text-right">Royalty</span>
            <span />
          </div>
          {isLoading && <div className="px-4 py-10 text-center text-sm mkt-muted">Loading collections…</div>}
          {!isLoading && rows.length === 0 && <div className="px-4 py-10 text-center text-sm mkt-muted">{tab === "watchlist" ? "No collections in your watchlist yet." : "No collections yet — be the first to mint."}</div>}
          {rows.map((c, i) => (
            <div key={c.id} className="mkt-row grid grid-cols-[32px_1fr_repeat(3,minmax(0,90px))_40px] items-center gap-2 border-b mkt-hairline px-4 py-3 text-sm last:border-0 sm:grid-cols-[40px_1fr_repeat(4,minmax(0,110px))_44px]">
              <span className="mkt-mono text-[13px] font-bold mkt-muted">{i + 1}</span>
              <Link to={`/nft/collection/${c.id}`} className="flex min-w-0 items-center gap-3">
                <Media src={c.logo_url} className="h-10 w-10 shrink-0 rounded-lg" />
                <span className="min-w-0">
                  <span className="flex items-center gap-1 truncate font-bold">{c.name} <Verified show={c.verified} /></span>
                  <span className="mkt-mono text-[10px] uppercase tracking-wide mkt-muted">{c.category ?? c.symbol}</span>
                </span>
              </Link>
              <span className="text-right mkt-mono font-semibold">{c.floor_price_sol ? <PriceText sol={c.floor_price_sol} /> : "—"}</span>
              <span className="text-right mkt-mono font-semibold text-[hsl(var(--og-lime))]">{c.volume_sol ? <PriceText sol={c.volume_sol} /> : "—"}</span>
              <span className="hidden text-right mkt-mono sm:block">{c.mint_limit ? fmtInt(c.mint_limit) : "—"}</span>
              <span className="text-right mkt-mono mkt-muted">{(c.royalty_bps / 100).toFixed(1)}%</span>
              <button onClick={() => toggleWatch(c.id)} className="justify-self-end" title="Watchlist">
                <Star className={`h-4 w-4 ${watched.has(c.id) ? "fill-[hsl(var(--og-gold))] text-[hsl(var(--og-gold))]" : "mkt-muted"}`} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* meme markets — tradeable NFT coins */}
      {(coinMarkets ?? []).length > 0 && (
        <section>
          <SectionHeader title="Meme markets" sub="NFTs you can trade like a coin — bonding curve, creator earns fees" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {(coinMarkets ?? []).map((m: any) => (
              <Link key={m.nft_id} to={`/nft/coin/${m.nft_id}`} className="mkt-card group">
                <Media src={m.nft?.image_url} className="aspect-square w-full" />
                <div className="p-3">
                  <div className="flex items-center gap-1 truncate text-[13px] font-bold"><Rocket className="h-3 w-3 shrink-0 text-[hsl(var(--og-cyan))]" />{m.nft?.name ?? "NFT"}</div>
                  <div className="mt-1.5 flex items-center justify-between text-[12px]">
                    <span><span className="mkt-muted">Price </span><PriceText sol={m.last_price_sol} className="mkt-mono font-bold text-[hsl(var(--og-lime))]" /></span>
                    <span className="mkt-muted">MC <PriceText sol={m.market_cap_sol} className="mkt-mono" /></span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* trending NFTs (individual, by engagement) */}
      {trendingNfts.length > 0 && (
        <section>
          <SectionHeader title="Trending NFTs" sub="Most-viewed listed items right now" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {trendingNfts.map((l) => (
              <Link key={l.id} to="/nft/explore" className="mkt-card group">
                <Media src={l.nft?.image_url} className="aspect-square w-full" />
                <div className="p-3">
                  <div className="flex items-center gap-1 truncate text-[13px] font-bold">{l.nft?.is_flagged_duplicate && <AlertTriangle className="h-3 w-3 shrink-0 text-[hsl(var(--og-blood))]" />}{l.nft?.name ?? "NFT"}</div>
                  <div className="mt-1.5 flex items-center justify-between text-[12px]">
                    <PriceText sol={l.price_sol} className="mkt-mono font-bold text-[hsl(var(--og-lime))]" />
                    <span className="inline-flex items-center gap-2 mkt-muted"><span className="inline-flex items-center gap-0.5"><Eye className="h-3 w-3" />{fmtInt(l.nft?.view_count ?? 0)}</span><span className="inline-flex items-center gap-0.5"><Heart className="h-3 w-3" />{fmtInt(l.nft?.favorite_count ?? 0)}</span></span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* notable collections grid */}
      <section>
        <SectionHeader title="Notable collections" sub="Verified creators on OrbitX" action={<Link to="/nft/explore" className="mkt-btn ghost text-[12px]">View all <ArrowRight className="h-3.5 w-3.5" /></Link>} />
        {(collections ?? []).length === 0 ? <Empty label="No collections yet." /> : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {(collections ?? []).slice(0, 8).map((c) => <CollectionCard key={c.id} c={c} />)}
          </div>
        )}
      </section>

      {/* recently listed */}
      <section>
        <SectionHeader title="Recently listed" sub="Live listings you can buy now" action={<Link to="/nft/explore" className="mkt-btn ghost text-[12px]">Explore <ArrowRight className="h-3.5 w-3.5" /></Link>} />
        {(listings ?? []).length === 0 ? <Empty label="No active listings right now." /> : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {(listings ?? []).slice(0, 10).map((l) => (
              <Link key={l.id} to={`/nft/explore`} className="mkt-card group">
                <Media src={l.nft?.image_url} className="aspect-square w-full" />
                <div className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 truncate text-[13px] font-bold">{l.nft?.is_flagged_duplicate && <AlertTriangle className="h-3 w-3 shrink-0 text-[hsl(var(--og-blood))]" aria-label="Possible copy" />}{l.nft?.name ?? "NFT"}</span>
                    <RarityBadge tier={l.nft?.rarity_tier} rank={l.nft?.rarity_rank} />
                  </div>
                  <div className="mt-1.5 flex items-center gap-1 text-[13px]">
                    <Tag className="h-3.5 w-3.5 text-[hsl(var(--og-lime))]" />
                    <PriceText sol={l.price_sol} className="mkt-mono font-bold text-[hsl(var(--og-lime))]" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* latest sales */}
      <section>
        <SectionHeader title="Latest sales" sub="Settled on-chain via OrbitX escrow-free flow" />
        {(sales ?? []).length === 0 ? <Empty label="No sales yet." /> : (
          <div className="mkt-panel divide-y divide-[hsl(var(--mkt-line))]">
            {(sales ?? []).map((s) => (
              <div key={s.id} className="mkt-row flex items-center gap-3 px-4 py-3">
                <Media src={s.nft?.image_url} className="h-11 w-11 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold">{s.nft?.name ?? "NFT"}</div>
                  <div className="mkt-mono text-[11px] mkt-muted">{timeAgo(s.created_at)} ago</div>
                </div>
                <div className="mkt-mono text-sm font-bold text-[hsl(var(--og-lime))]">{fmtSol(s.amount_sol)}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Hero({ c }: { c: OrbitxNftCollection }) {
  return (
    <section className="mkt-panel relative overflow-hidden">
      <div className="absolute inset-0">
        <Media src={c.banner_url ?? c.logo_url} className="h-full w-full opacity-30" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, hsl(var(--mkt-bg)) 8%, transparent 70%), linear-gradient(0deg, hsl(var(--mkt-bg)) 4%, transparent 60%)" }} />
      </div>
      <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-end sm:p-8">
        <Media src={c.logo_url} className="h-24 w-24 rounded-2xl border-2 border-[hsl(var(--mkt-line))] sm:h-28 sm:w-28" />
        <div className="min-w-0 flex-1">
          <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border mkt-hairline bg-[hsl(var(--mkt-panel-2))] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[hsl(var(--og-gold))]">
            <Flame className="h-3 w-3" /> Featured collection
          </div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight sm:text-3xl">{c.name} <Verified show={c.verified} className="h-5 w-5" /></h1>
          {c.description && <p className="mt-1 max-w-xl text-[13px] mkt-muted line-clamp-2">{c.description}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-6">
            <Stat label="Floor" value={c.floor_price_sol ? fmtSol(c.floor_price_sol) : "—"} />
            <Stat label="Volume" value={c.volume_sol ? fmtSol(c.volume_sol) : "—"} />
            <Stat label="Royalty" value={`${(c.royalty_bps / 100).toFixed(1)}%`} />
            {c.category && <Stat label="Category" value={c.category} />}
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/nft/collection/${c.id}`} className="mkt-btn"><TrendingUp className="h-4 w-4" /> View collection</Link>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mkt-mono text-[10px] uppercase tracking-widest mkt-muted">{label}</div>
      <div className="text-lg font-black">{value}</div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition ${active ? "bg-[hsl(var(--mkt-panel-2))] text-[hsl(var(--mkt-ink))] shadow-[inset_0_-2px_0_0_hsl(var(--og-cyan))]" : "mkt-muted hover:text-[hsl(var(--mkt-ink))]"}`}>
      {icon} {children}
    </button>
  );
}

function CollectionCard({ c }: { c: OrbitxNftCollection }) {
  return (
    <Link to={`/nft/collection/${c.id}`} className="mkt-card group">
      <div className="relative">
        <Media src={c.banner_url ?? c.logo_url} className="aspect-[16/9] w-full" />
        <Media src={c.logo_url} className="absolute -bottom-5 left-3 h-12 w-12 rounded-xl border-2 border-[hsl(var(--mkt-panel))]" />
      </div>
      <div className="px-3 pb-3 pt-7">
        <div className="flex items-center gap-1 truncate font-bold">{c.name} <Verified show={c.verified} /></div>
        <div className="mt-2 flex items-center justify-between text-[12px]">
          <span><span className="mkt-muted">Floor </span>{c.floor_price_sol ? <PriceText sol={c.floor_price_sol} className="mkt-mono font-semibold" /> : <span className="mkt-mono font-semibold">—</span>}</span>
          <span><span className="mkt-muted">Vol </span>{c.volume_sol ? <PriceText sol={c.volume_sol} className="mkt-mono font-semibold text-[hsl(var(--og-lime))]" /> : <span className="mkt-mono font-semibold">—</span>}</span>
        </div>
      </div>
    </Link>
  );
}
