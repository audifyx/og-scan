import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ExternalLink, Flame, Rocket, Search, Sparkles, Store } from "lucide-react";
import {
  fetchPumpLaunches,
  fetchScreener,
  fmtPct,
  fmtUsd,
  searchAllTokens,
  shortMint,
  type ScreenerRow,
} from "@/lib/orbitxcity/marketData";
import { listTokens, type OrbitxToken } from "@/lib/orbitx/registry";
import { useCity } from "@/pages/orbitxcity/CityProvider";

type StoreTab = "trending" | "pump" | "new" | "orbitx" | "search";

const TABS: Array<{ id: StoreTab; label: string; icon: typeof Flame }> = [
  { id: "trending", label: "Hot", icon: Flame },
  { id: "pump", label: "Pump.fun", icon: Rocket },
  { id: "new", label: "New", icon: Sparkles },
  { id: "orbitx", label: "OrbitX", icon: Store },
  { id: "search", label: "Search", icon: Search },
];

function TokenStoreRow({ row, onOpen }: { row: ScreenerRow; onOpen: () => void }) {
  const mint = row.mint ?? row.address;
  const ch = Number(row.change24h);
  return (
    <button type="button" className="oxc-token-row link" onClick={onOpen} disabled={!mint}>
      <div className="oxc-store-id">
        {row.imageUrl ? (
          <img src={row.imageUrl} alt="" loading="lazy" />
        ) : (
          <span className="oxc-store-fallback">{(row.symbol ?? "?").slice(0, 1)}</span>
        )}
        <div>
          <div className="oxc-tile-title">${(row.symbol ?? "???").toUpperCase()}</div>
          <div className="oxc-muted">{row.name ?? shortMint(mint)}</div>
        </div>
      </div>
      <div className="oxc-token-stats">
        <span>{fmtUsd(row.priceUsd)}</span>
        <span className={Number.isFinite(ch) && ch < 0 ? "down" : "up"}>{fmtPct(row.change24h)}</span>
      </div>
    </button>
  );
}

/**
 * Meme Market store — every Solana coin, buyable in-world.
 * Hot = live screener · Pump.fun = launches feed + bonding tokens ·
 * New = fresh pairs · OrbitX = launchpad registry · Search = all of Solana.
 */
export function MemeStorePanel() {
  const { openToken } = useCity();
  const [tab, setTab] = useState<StoreTab>("trending");
  const [query, setQuery] = useState("");

  const trending = useQuery({
    queryKey: ["oxc-store", "trending"],
    queryFn: () => fetchScreener(20, "trending"),
    refetchInterval: 30_000,
    enabled: tab === "trending",
  });

  const pump = useQuery({
    queryKey: ["oxc-store", "pump"],
    queryFn: async () => {
      // Pump.fun launches feed first; bonding-curve screener as backfill
      const [launches, unbonded] = await Promise.all([
        fetchPumpLaunches(16),
        fetchScreener(16, "unbonded"),
      ]);
      const seen = new Set<string>();
      const merged: ScreenerRow[] = [];
      for (const r of [...launches, ...unbonded]) {
        const key = r.mint ?? r.address ?? r.symbol ?? "";
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push(r);
      }
      return merged.slice(0, 24);
    },
    refetchInterval: 30_000,
    enabled: tab === "pump",
  });

  const fresh = useQuery({
    queryKey: ["oxc-store", "newpairs"],
    queryFn: () => fetchScreener(20, "newpairs"),
    refetchInterval: 30_000,
    enabled: tab === "new",
  });

  const orbitx = useQuery({
    queryKey: ["oxc-store", "orbitx"],
    queryFn: () => listTokens("all", 30),
    refetchInterval: 60_000,
    enabled: tab === "orbitx",
  });

  const search = useQuery({
    queryKey: ["oxc-store", "search", query],
    queryFn: () => searchAllTokens(query),
    enabled: tab === "search" && query.trim().length >= 2,
    staleTime: 30_000,
  });

  const activeQuery =
    tab === "trending" ? trending : tab === "pump" ? pump : tab === "new" ? fresh : tab === "search" ? search : null;

  return (
    <div className="oxc-stack">
      <p className="oxc-muted">
        Real coins, real wallet — every Solana token buyable in-world via Jupiter. Tap a coin to open the buy panel.
      </p>

      <div className="oxc-store-tabs">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              className={`oxc-store-tab ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "search" && (
        <input
          className="oxc-store-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search any Solana token · name, ticker, or mint"
          autoFocus
        />
      )}

      <div className="oxc-token-list">
        {tab === "orbitx" ? (
          <>
            {(orbitx.data ?? []).map((t: OrbitxToken) => (
              <button key={t.id} type="button" className="oxc-token-row link" onClick={() => openToken(t.mint_address)}>
                <div className="oxc-store-id">
                  {t.logo_url ? <img src={t.logo_url} alt="" loading="lazy" /> : <span className="oxc-store-fallback">{t.ticker.slice(0, 1)}</span>}
                  <div>
                    <div className="oxc-tile-title">${t.ticker.toUpperCase()}</div>
                    <div className="oxc-muted">{t.name} · {t.launch_type}</div>
                  </div>
                </div>
                <ExternalLink className="h-3.5 w-3.5 opacity-50" />
              </button>
            ))}
            {orbitx.isLoading && <div className="oxc-muted">Loading OrbitX launches…</div>}
            {!orbitx.isLoading && (orbitx.data?.length ?? 0) === 0 && (
              <div className="oxc-muted">No OrbitX launches indexed yet.</div>
            )}
          </>
        ) : (
          <>
            {(activeQuery?.data ?? []).map((row, i) => {
              const mint = row.mint ?? row.address;
              return (
                <TokenStoreRow
                  key={`${mint ?? row.symbol ?? i}`}
                  row={row}
                  onOpen={() => mint && openToken(mint)}
                />
              );
            })}
            {activeQuery?.isLoading && <div className="oxc-muted">Loading live market…</div>}
            {tab === "search" && query.trim().length < 2 && (
              <div className="oxc-muted">Type at least 2 characters — searches all of Solana.</div>
            )}
            {activeQuery && !activeQuery.isLoading && (activeQuery.data?.length ?? 0) === 0 && query.trim().length >= 2 && (
              <div className="oxc-muted">Nothing found — try the exact mint address.</div>
            )}
            {activeQuery && !activeQuery.isLoading && (activeQuery.data?.length ?? 0) === 0 && tab !== "search" && (
              <div className="oxc-muted">Feed quiet — retry shortly.</div>
            )}
          </>
        )}
      </div>

      <div className="oxc-actions">
        <Link className="oxc-btn ghost" to="/ORBITX_DEX">Open full DEX <ExternalLink className="h-3.5 w-3.5" /></Link>
        <Link className="oxc-btn ghost" to="/orbitxlaunch">Launchpad</Link>
      </div>
    </div>
  );
}
