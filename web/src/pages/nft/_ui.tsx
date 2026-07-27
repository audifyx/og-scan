// OrbitX NFT Marketplace — shared UI: fast media, premium cards, grids.
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, ImageOff, Eye, Heart, Tag, AlertTriangle, Rocket } from "lucide-react";
import { PriceText } from "./currency";
import { fmtInt } from "./nftMarketData";
import type { OrbitxNftCollection } from "./nftMarketData";

/* ── Media with skeleton + fast decode ── */
export function Media({
  src,
  alt,
  className = "",
  priority = false,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  priority?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`mkt-media-fallback ${className}`}>
        <ImageOff className="h-5 w-5 opacity-35" />
      </div>
    );
  }

  return (
    <div className={`mkt-media-wrap ${className}`}>
      {!loaded && <div className="mkt-skeleton absolute inset-0" aria-hidden />}
      <img
        src={src}
        alt={alt ?? ""}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`mkt-media-img ${loaded ? "is-loaded" : ""}`}
      />
    </div>
  );
}

export function Verified({ show, className = "" }: { show?: boolean | null; className?: string }) {
  if (!show) return null;
  return <ShieldCheck className={`inline h-3.5 w-3.5 text-[#14F195] ${className}`} aria-label="Verified" />;
}

const RARITY: Record<string, string> = {
  Mythic: "mkt-rarity--mythic",
  Legendary: "mkt-rarity--legendary",
  Epic: "mkt-rarity--epic",
  Rare: "mkt-rarity--rare",
  Common: "mkt-rarity--common",
};

export function RarityBadge({ tier, rank }: { tier?: string | null; rank?: number | null }) {
  if (!tier) return null;
  return (
    <span className={`mkt-rarity ${RARITY[tier] ?? RARITY.Common}`}>
      {tier}
      {rank ? ` #${rank}` : ""}
    </span>
  );
}

export function SectionHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mkt-section-head">
      <div>
        <h2 className="mkt-section-title">{title}</h2>
        {sub && <p className="mkt-section-sub">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ label }: { label: string }) {
  return (
    <div className="mkt-empty">
      <ImageOff className="h-7 w-7 opacity-40" />
      <p>{label}</p>
    </div>
  );
}

export function NftGrid({ children, cols = 5 }: { children: ReactNode; cols?: 3 | 4 | 5 }) {
  return <div className={`mkt-grid mkt-grid--${cols}`}>{children}</div>;
}

export function CardSkeleton({ count = 5 }: { count?: number }) {
  return (
    <NftGrid>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="mkt-nft-card mkt-nft-card--skeleton">
          <div className="mkt-skeleton aspect-square w-full" />
          <div className="p-3 space-y-2">
            <div className="mkt-skeleton h-3.5 w-3/4 rounded" />
            <div className="mkt-skeleton h-3 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </NftGrid>
  );
}

/* ── Premium NFT item card ── */
export type NftCardProps = {
  to: string;
  name: string;
  image?: string | null;
  priceSol?: number | null;
  rarityTier?: string | null;
  rarityRank?: number | null;
  flagged?: boolean;
  views?: number;
  favorites?: number;
  collection?: string;
  badge?: ReactNode;
  priority?: boolean;
};

export function NftCard({
  to,
  name,
  image,
  priceSol,
  rarityTier,
  rarityRank,
  flagged,
  views,
  favorites,
  collection,
  badge,
  priority,
}: NftCardProps) {
  return (
    <Link to={to} className="mkt-nft-card group">
      <div className="mkt-nft-card__media">
        <Media src={image} className="aspect-square w-full h-full" priority={priority} />
        <div className="mkt-nft-card__shine" aria-hidden />
        {priceSol != null && (
          <div className="mkt-nft-card__price">
            <Tag className="h-3 w-3" />
            <PriceText sol={priceSol} className="mkt-mono font-bold" />
          </div>
        )}
        {badge}
        {rarityTier && (
          <div className="mkt-nft-card__rarity">
            <RarityBadge tier={rarityTier} rank={rarityRank} />
          </div>
        )}
      </div>
      <div className="mkt-nft-card__body">
        <div className="mkt-nft-card__title">
          {flagged && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#ff5c7a]" aria-label="Possible copy" />}
          <span className="truncate">{name}</span>
        </div>
        {collection && <div className="mkt-nft-card__sub truncate">{collection}</div>}
        {(views != null || favorites != null) && (
          <div className="mkt-nft-card__stats">
            {views != null && (
              <span><Eye className="h-3 w-3" />{fmtInt(views)}</span>
            )}
            {favorites != null && (
              <span><Heart className="h-3 w-3" />{fmtInt(favorites)}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

/* ── Collection card ── */
export function CollectionCard({ c, priority }: { c: OrbitxNftCollection; priority?: boolean }) {
  return (
    <Link to={`/nft/collection/${c.id}`} className="mkt-col-card group">
      <div className="mkt-col-card__banner">
        <Media src={c.banner_url ?? c.logo_url} className="h-full w-full" priority={priority} />
        <div className="mkt-col-card__grad" aria-hidden />
        <Media src={c.logo_url} className="mkt-col-card__logo" priority={priority} />
        {c.verified && (
          <span className="mkt-col-card__verified">
            <ShieldCheck className="h-3 w-3" /> Verified
          </span>
        )}
      </div>
      <div className="mkt-col-card__body">
        <div className="mkt-col-card__name">{c.name}</div>
        <div className="mkt-col-card__meta">{c.category ?? c.symbol}</div>
        <div className="mkt-col-card__stats">
          <div>
            <span className="label">Floor</span>
            <span className="value">
              {c.floor_price_sol ? <PriceText sol={c.floor_price_sol} className="mkt-mono" /> : "—"}
            </span>
          </div>
          <div>
            <span className="label">Volume</span>
            <span className="value accent">
              {c.volume_sol ? <PriceText sol={c.volume_sol} className="mkt-mono" /> : "—"}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ── Meme / coin market card ── */
export function CoinMarketCard({
  nftId,
  name,
  image,
  priceSol,
  marketCapSol,
}: {
  nftId: string;
  name: string;
  image?: string | null;
  priceSol?: number | null;
  marketCapSol?: number | null;
}) {
  return (
    <Link to={`/nft/coin/${nftId}`} className="mkt-nft-card mkt-nft-card--coin group">
      <div className="mkt-nft-card__media">
        <Media src={image} className="aspect-square w-full h-full" />
        <div className="mkt-nft-card__coin-badge">
          <Rocket className="h-3 w-3" /> Coin
        </div>
      </div>
      <div className="mkt-nft-card__body">
        <div className="mkt-nft-card__title truncate">{name}</div>
        <div className="mkt-col-card__stats" style={{ marginTop: "0.35rem" }}>
          <div>
            <span className="label">Price</span>
            <span className="value accent">{priceSol != null ? <PriceText sol={priceSol} className="mkt-mono" /> : "—"}</span>
          </div>
          <div>
            <span className="label">MC</span>
            <span className="value">{marketCapSol != null ? <PriceText sol={marketCapSol} className="mkt-mono" /> : "—"}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}