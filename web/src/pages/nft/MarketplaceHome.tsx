// OrbitX NFT Marketplace — home with premium cards + skeleton loading.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Flame, Crown, Star, ArrowRight, TrendingUp } from "lucide-react";
import {
  useMarketCollections,
  useActiveListings,
  useRecentSales,
  fmtSol,
  fmtInt,
  timeAgo,
  type OrbitxNftCollection,
} from "./nftMarketData";
import { listCoinMarkets } from "./nftCoin";
import { useQuery } from "@tanstack/react-query";
import {
  Media,
  Verified,
  SectionHeader,
  Empty,
  NftGrid,
  NftCard,
  CollectionCard,
  CoinMarketCard,
  CardSkeleton,
} from "./_ui";
import { PriceText } from "./currency";
import { useNftWatchlist } from "./watchlist";

type TopTab = "trending" | "top" | "watchlist";
type Range = "24h" | "7d" | "30d" | "all";
const RANGE_MS: Record<Range, number | null> = { "24h": 864e5, "7d": 6048e5, "30d": 2592e6, all: null };

export default function MarketplaceHome() {
  const { data: collections, isLoading } = useMarketCollections();
  const { data: listings, isLoading: listingsLoading } = useActiveListings();
  const { data: sales } = useRecentSales(10);
  const { data: coinMarkets } = useQuery({ queryKey: ["coin-markets-home"], staleTime: 20_000, queryFn: listCoinMarkets });
  const trendingNfts = useMemo(() => {
    return [...(listings ?? [])]
      .filter((l) => l.nft)
      .sort(
        (a, b) =>
          (b.nft?.favorite_count ?? 0) +
          (b.nft?.view_count ?? 0) -
          ((a.nft?.favorite_count ?? 0) + (a.nft?.view_count ?? 0)),
      )
      .slice(0, 10);
  }, [listings]);
  const { ids: watched, toggle: toggleWatch } = useNftWatchlist();

  const [tab, setTab] = useState<TopTab>("trending");
  const [range, setRange] = useState<Range>("7d");

  const rows = useMemo(() => {
    let list = [...(collections ?? [])];
    const win = RANGE_MS[range];
    if (win) {
      const cutoff = Date.now() - win;
      list = list.filter((c) => new Date(c.created_at).getTime() >= cutoff || (c.volume_sol ?? 0) > 0);
    }
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
      .sort(
        (a, b) =>
          ((a as unknown as { featured_rank?: number }).featured_rank ?? 999) -
          ((b as unknown as { featured_rank?: number }).featured_rank ?? 999),
      )
      .slice(0, 8);
  }, [collections]);

  return (
    <div className="space-y-10">
      {featured ? <Hero c={featured} /> : <EmptyHero />}

      {staffPicks.length > 0 && (
        <section>
          <SectionHeader title="Staff picks" sub="Curated by the OrbitX team" />
          <NftGrid cols={4}>
            {staffPicks.map((c, i) => (
              <CollectionCard key={c.id} c={c} priority={i < 2} />
            ))}
          </NftGrid>
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <TabBtn active={tab === "trending"} onClick={() => setTab("trending")} icon={<Flame className="h-4 w-4" />}>
              Trending
            </TabBtn>
            <TabBtn active={tab === "top"} onClick={() => setTab("top")} icon={<Crown className="h-4 w-4" />}>
              Top
            </TabBtn>
            <TabBtn active={tab === "watchlist"} onClick={() => setTab("watchlist")} icon={<Star className="h-4 w-4" />}>
              Watchlist
            </TabBtn>
          </div>
          <div className="mkt-rail flex items-center gap-1 overflow-x-auto">
            {(["24h", "7d", "30d", "all"] as Range[]).map((r) => (
              <button key={r} onClick={() => setRange(r)} className={`mkt-chip px-2.5 py-1 text-[11px] font-bold uppercase ${range === r ? "active" : ""}`}>
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="mkt-panel overflow-hidden">
          <div className="grid grid-cols-[32px_1fr_repeat(3,minmax(0,90px))_40px] items-center gap-2 border-b mkt-hairline px-4 py-2.5 text-[10px] font-black uppercase tracking-widest mkt-muted sm:grid-cols-[40px_1fr_repeat(4,minmax(0,110px))_44px]">
            <span>#</span>
            <span>Collection</span>
            <span className="text-right">Floor</span>
            <span className="text-right">Volume</span>
            <span className="hidden text-right sm:block">Items</span>
            <span className="text-right">Royalty</span>
            <span />
          </div>
          {isLoading && <div className="px-4 py-10 text-center text-sm mkt-muted">Loading collections…</div>}
          {!isLoading && rows.length === 0 && (
            <div className="px-4 py-10 text-center text-sm mkt-muted">
              {tab === "watchlist" ? "No collections in your watchlist yet." : "No collections yet — be the first to mint."}
            </div>
          )}
          {rows.map((c, i) => (
            <div
              key={c.id}
              className="mkt-row grid grid-cols-[32px_1fr_repeat(3,minmax(0,90px))_40px] items-center gap-2 border-b mkt-hairline px-4 py-3 text-sm last:border-0 sm:grid-cols-[40px_1fr_repeat(4,minmax(0,110px))_44px]"
            >
              <span className="mkt-mono text-[13px] font-bold mkt-muted">{i + 1}</span>
              <Link to={`/nft/collection/${c.id}`} className="flex min-w-0 items-center gap-3">
                <Media src={c.logo_url} className="h-10 w-10 shrink-0 rounded-lg" />
                <span className="min-w-0">
                  <span className="flex items-center gap-1 truncate font-bold">
                    {c.name} <Verified show={c.verified} />
                  </span>
                  <span className="mkt-mono text-[10px] uppercase tracking-wide mkt-muted">{c.category ?? c.symbol}</span>
                </span>
              </Link>
              <span className="text-right mkt-mono font-semibold">
                {c.floor_price_sol ? <PriceText sol={c.floor_price_sol} /> : "—"}
              </span>
              <span className="text-right mkt-mono font-semibold mkt-vol">
                {c.volume_sol ? <PriceText sol={c.volume_sol} /> : "—"}
              </span>
              <span className="hidden text-right mkt-mono sm:block">{c.mint_limit ? fmtInt(c.mint_limit) : "—"}</span>
              <span className="text-right mkt-mono mkt-muted">{(c.royalty_bps / 100).toFixed(1)}%</span>
              <button onClick={() => toggleWatch(c.id)} className="justify-self-end" title="Watchlist" type="button">
                <Star className={`h-4 w-4 ${watched.has(c.id) ? "fill-[var(--mkt-gold-hi)] text-[var(--mkt-gold-hi)]" : "mkt-muted"}`} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {(coinMarkets ?? []).length > 0 && (
        <section>
          <SectionHeader title="Meme markets" sub="Trade NFTs like coins — bonding curve + creator fees" />
          <NftGrid cols={5}>
            {(coinMarkets ?? []).map((m: { nft_id: string; nft?: { name?: string; image_url?: string }; last_price_sol?: number; market_cap_sol?: number }) => (
              <CoinMarketCard
                key={m.nft_id}
                nftId={m.nft_id}
                name={m.nft?.name ?? "NFT"}
                image={m.nft?.image_url}
                priceSol={m.last_price_sol}
                marketCapSol={m.market_cap_sol}
              />
            ))}
          </NftGrid>
        </section>
      )}

      <section>
        <SectionHeader title="Trending NFTs" sub="Most-viewed listings right now" />
        {listingsLoading ? (
          <CardSkeleton count={5} />
        ) : trendingNfts.length === 0 ? (
          <Empty label="No trending listings yet." />
        ) : (
          <NftGrid cols={5}>
            {trendingNfts.map((l, i) => (
              <NftCard
                key={l.id}
                to="/nft/explore"
                name={l.nft?.name ?? "NFT"}
                image={l.nft?.image_url}
                priceSol={l.price_sol}
                rarityTier={l.nft?.rarity_tier}
                rarityRank={l.nft?.rarity_rank}
                flagged={l.nft?.is_flagged_duplicate}
                views={l.nft?.view_count}
                favorites={l.nft?.favorite_count}
                priority={i < 3}
              />
            ))}
          </NftGrid>
        )}
      </section>

      <section>
        <SectionHeader
          title="Notable collections"
          sub="Verified creators on OrbitX"
          action={
            <Link to="/nft/explore" className="mkt-btn ghost text-[12px]">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        {isLoading ? (
          <NftGrid cols={4}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="mkt-col-card">
                <div className="mkt-skeleton aspect-[16/9] w-full" />
                <div className="p-3"><div className="mkt-skeleton h-4 w-2/3 rounded mt-4" /></div>
              </div>
            ))}
          </NftGrid>
        ) : (collections ?? []).length === 0 ? (
          <Empty label="No collections yet." />
        ) : (
          <NftGrid cols={4}>
            {(collections ?? []).slice(0, 8).map((c) => (
              <CollectionCard key={c.id} c={c} />
            ))}
          </NftGrid>
        )}
      </section>

      <section>
        <SectionHeader
          title="Recently listed"
          sub="Live listings — buy now"
          action={
            <Link to="/nft/explore" className="mkt-btn ghost text-[12px]">
              Explore <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        {listingsLoading ? (
          <CardSkeleton count={5} />
        ) : (listings ?? []).length === 0 ? (
          <Empty label="No active listings right now." />
        ) : (
          <NftGrid cols={5}>
            {(listings ?? []).slice(0, 10).map((l) => (
              <NftCard
                key={l.id}
                to="/nft/explore"
                name={l.nft?.name ?? "NFT"}
                image={l.nft?.image_url}
                priceSol={l.price_sol}
                rarityTier={l.nft?.rarity_tier}
                rarityRank={l.nft?.rarity_rank}
                flagged={l.nft?.is_flagged_duplicate}
              />
            ))}
          </NftGrid>
        )}
      </section>

      <section>
        <SectionHeader title="Latest sales" sub="Settled on-chain via OrbitX" />
        {(sales ?? []).length === 0 ? (
          <Empty label="No sales yet." />
        ) : (
          <div className="mkt-panel divide-y divide-[hsl(var(--mkt-line))]">
            {(sales ?? []).map((s) => (
              <div key={s.id} className="mkt-row flex items-center gap-3 px-4 py-3">
                <Media src={s.nft?.image_url} className="h-11 w-11 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold">{s.nft?.name ?? "NFT"}</div>
                  <div className="mkt-mono text-[11px] mkt-muted">{timeAgo(s.created_at)} ago</div>
                </div>
                <div className="mkt-mono text-sm font-bold mkt-vol">{fmtSol(s.amount_sol)}</div>
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
    <section className="mkt-hero">
      <div className="mkt-hero-media" aria-hidden>
        <Media src={c.banner_url ?? c.logo_url} className="h-full w-full" priority />
        <div className="mkt-hero-scrim" />
      </div>
      <div className="mkt-hero-content">
        <Media src={c.logo_url} className="mkt-hero-logo" priority />
        <div className="min-w-0 flex-1">
          <div className="mkt-hero-badge">
            <Flame className="h-3 w-3" /> Featured
          </div>
          <h1 className="mkt-hero-title flex items-center gap-2">
            {c.name} <Verified show={c.verified} className="h-6 w-6" />
          </h1>
          {c.description && <p className="mkt-hero-desc line-clamp-2">{c.description}</p>}
          <div className="mkt-hero-stats">
            <Stat label="Floor" value={c.floor_price_sol ? fmtSol(c.floor_price_sol) : "—"} />
            <Stat label="Volume" value={c.volume_sol ? fmtSol(c.volume_sol) : "—"} />
            <Stat label="Royalty" value={`${(c.royalty_bps / 100).toFixed(1)}%`} />
            {c.category && <Stat label="Category" value={c.category} />}
          </div>
        </div>
        <Link to={`/nft/collection/${c.id}`} className="mkt-btn shrink-0">
          <TrendingUp className="h-4 w-4" /> View collection
        </Link>
      </div>
    </section>
  );
}

function EmptyHero() {
  return (
    <section className="mkt-hero-empty">
      <div className="mkt-hero-badge">
        <Flame className="h-3 w-3" /> OrbitX NFT
      </div>
      <h1 className="mkt-hero-title">Trade culture on Solana.</h1>
      <p className="mkt-hero-desc">
        Mint, list, and collect on the OrbitX metal desk — same chrome as DEX and Launchpad.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link to="/nft/explore" className="mkt-btn">
          Explore market
        </Link>
        <Link to="/nft/create" className="mkt-btn ghost">
          Create NFT
        </Link>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mkt-hero-stat-label">{label}</div>
      <div className="mkt-hero-stat-value">{value}</div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className={`mkt-tabbtn ${active ? "active" : ""}`}>
      {icon} {children}
    </button>
  );
}
