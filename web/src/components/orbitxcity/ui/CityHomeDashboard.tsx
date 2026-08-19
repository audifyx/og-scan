/**
 * City home — Alpha dashboard for mobile + desktop.
 * Wallet, live og-scan tape, inventory, and Buy / Sell / Trade shortcuts.
 * Uses existing City rails (no second canvas, no new engine).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { Link } from "react-router-dom";
import {
  ArrowLeftRight,
  Backpack,
  Flame,
  House,
  LineChart,
  Store,
  UserRound,
  Wallet,
  Wand2,
} from "lucide-react";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { useAuth } from "@/hooks/useAuth";
import { CITY_SHOP_MINT } from "@/lib/orbitxcity/cityShop";
import { hubZonesForBlock, sortScreener } from "@/lib/orbitxcity/metaverseHub";
import {
  fetchCityMarketSnapshot,
  fmtPct,
  fmtUsd,
  shortMint,
} from "@/lib/orbitxcity/marketData";
import { fetchTokenDetail } from "@/lib/orbitxcity/tokenApi";
import { getWorldBlock } from "@/lib/orbitxcity/worlds";
import { useCity } from "@/pages/orbitxcity/CityProvider";

type TapeSort = "name" | "price" | "change";

export function CityHomeDashboard() {
  const { avatar, inventory, shards, shopPurchases, openPanel, openToken, teleport, selectedCityId } =
    useCity();
  const { profile, user } = useAuth();
  const { publicKey, connected } = useWallet();
  const [sort, setSort] = useState<TapeSort>("change");
  const block = getWorldBlock(selectedCityId);
  const zones = useMemo(() => hubZonesForBlock(block), [block]);

  const market = useQuery({
    queryKey: ["orbitxcity-market"],
    queryFn: fetchCityMarketSnapshot,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  const orbitx = useQuery({
    queryKey: ["oxc-orbitx-price"],
    queryFn: () => fetchTokenDetail(CITY_SHOP_MINT),
    refetchInterval: 20_000,
  });

  const tape = useMemo(
    () => sortScreener(market.data?.trending ?? [], sort).slice(0, 8),
    [market.data?.trending, sort],
  );
  const walletLabel = connected && publicKey ? shortMint(publicKey.toBase58(), 4) : "Not connected";

  return (
    <div className="oxc-home">
      <section className="oxc-home-hero">
        <div className="oxc-home-ident">
          <House className="h-5 w-5" />
          <div>
            <div className="oxc-kicker">City home</div>
            <h3>@{profile?.username ?? avatar.name}</h3>
            <p className="oxc-muted">
              {avatar.classId ?? "operative"} · {avatar.bodyType ?? "standard"} · {user ? "OrbitX account" : "Guest"}
            </p>
          </div>
        </div>
        <div className="oxc-home-wallet">
          <span className="oxc-muted">
            <Wallet className="h-3.5 w-3.5" /> {walletLabel}
          </span>
          <WalletConnectButton />
        </div>
      </section>

      <div className="oxc-stat-row dense oxc-home-stats">
        <div>
          <small>ORBITX</small>
          <b>{fmtUsd(orbitx.data?.priceUsd)}</b>
        </div>
        <div>
          <small>SHARDS</small>
          <b>{shards} ◈</b>
        </div>
        <div>
          <small>BAG</small>
          <b>{inventory.length}</b>
        </div>
        <div>
          <small>OWNED</small>
          <b>{shopPurchases.length}</b>
        </div>
      </div>

      <div className="oxc-home-actions" aria-label="Quick actions">
        <button type="button" className="oxc-btn primary" onClick={() => openPanel("marketplace")}>
          <Store className="h-3.5 w-3.5" /> Buy
        </button>
        <button type="button" className="oxc-btn ghost" onClick={() => openPanel("marketplace")}>
          <LineChart className="h-3.5 w-3.5" /> Sell
        </button>
        <button type="button" className="oxc-btn ghost" onClick={() => openPanel("trading")}>
          <ArrowLeftRight className="h-3.5 w-3.5" /> Trade
        </button>
        <button type="button" className="oxc-btn ghost" onClick={() => openPanel("shop")}>
          <Flame className="h-3.5 w-3.5" /> Shop
        </button>
      </div>

      <div className="oxc-home-grid">
        <section className="oxc-home-col">
          <div className="oxc-section-label">Live tape · og-scan</div>
          <div className="oxc-home-sort" role="group" aria-label="Sort assets">
            {(["name", "price", "change"] as const).map((key) => (
              <button
                key={key}
                type="button"
                className={sort === key ? "on" : ""}
                onClick={() => setSort(key)}
              >
                {key}
              </button>
            ))}
          </div>
          {market.isLoading && <p className="oxc-muted">Loading prices…</p>}
          <div className="oxc-token-list">
            {tape.map((row, i) => {
              const mint = row.mint ?? row.address;
              const ch = Number(row.change24h);
              return (
                <button
                  key={`${mint ?? row.symbol ?? i}`}
                  type="button"
                  className="oxc-token-row link"
                  onClick={() => mint && openToken(mint)}
                  disabled={!mint}
                >
                  <div>
                    <div className="oxc-tile-title">${(row.symbol ?? "???").toUpperCase()}</div>
                    <div className="oxc-muted">{row.name ?? shortMint(mint)}</div>
                  </div>
                  <div className="oxc-token-stats">
                    <span>{fmtUsd(row.priceUsd)}</span>
                    <span className={Number.isFinite(ch) && ch < 0 ? "down" : "up"}>{fmtPct(row.change24h)}</span>
                  </div>
                </button>
              );
            })}
            {!market.isLoading && tape.length === 0 && (
              <p className="oxc-muted">Tape quiet — DEX APIs are optional for City play.</p>
            )}
          </div>
        </section>

        <section className="oxc-home-col">
          <div className="oxc-section-label">Loadout</div>
          <div className="oxc-home-inv">
            {inventory.slice(0, 6).map((item) => (
              <div key={item.id} className="oxc-inv-item">
                <div className="oxc-inv-kind">{item.kind}</div>
                <div className="oxc-tile-title">{item.label}</div>
              </div>
            ))}
          </div>
          <div className="oxc-actions">
            <button type="button" className="oxc-btn ghost" onClick={() => openPanel("inventory")}>
              <Backpack className="h-3.5 w-3.5" /> Full bag
            </button>
            <button type="button" className="oxc-btn ghost" onClick={() => openPanel("character")}>
              <Wand2 className="h-3.5 w-3.5" /> Look
            </button>
            <button type="button" className="oxc-btn ghost" onClick={() => openPanel("profile")}>
              <UserRound className="h-3.5 w-3.5" /> Profile
            </button>
          </div>

          <div className="oxc-section-label">Hub fast travel</div>
          <div className="oxc-teleport-grid">
            {zones.map((z) => (
              <button
                key={z.id}
                type="button"
                className="oxc-teleport-btn"
                style={{ ["--tp" as string]: z.accent }}
                onClick={() => teleport(z.x, z.z)}
              >
                <span>{z.label}</span>
                <span className="oxc-muted" style={{ display: "block", fontSize: "0.68rem", marginTop: 2 }}>
                  {z.blurb}
                </span>
              </button>
            ))}
          </div>
          <Link className="oxc-btn ghost" to="/ORBITX_DEX">
            Open OrbitX DEX
          </Link>
        </section>
      </div>
    </div>
  );
}
