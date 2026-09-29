/**
 * Real estate module — NFT deeds panel.
 * Buy properties (ORBITX, burned), upgrade tiers (ORBITX, burned),
 * collect foot-traffic rent (paper CITY), list deeds on the market
 * (flag only — settlement via the platform's existing /nft market).
 * Every deed carries an NFT metadata payload (`deedToNftMetadata`) ready
 * for the existing Metaplex infra — read-only reuse, never rebuilt here.
 */
import { useEffect, useMemo, useState } from "react";
import type { Deed } from "../types";
import {
  DISTRICTS,
  PROPERTIES,
  districtById,
  tierByLevel,
} from "../data/catalog";
import { deedStore, deedToNftMetadata, deedRentRate, pendingRent, useDeeds } from "../store/deeds";
import { fmt } from "./ctx";
import type { RealEstateCtx } from "./ctx";

function DeedCard({ deed, ctx }: { deed: Deed; ctx: RealEstateCtx }) {
  const [showMeta, setShowMeta] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [listPrice, setListPrice] = useState("");
  const tier = tierByLevel(deed.tier);
  const next = deed.tier < 5 ? tierByLevel(deed.tier + 1) : null;
  const rate = deedRentRate(deed);
  const pending = pendingRent(deed.deedId);
  const district = districtById(deed.districtId);
  const busy = ctx.billing.busy;

  const act = async (fn: () => Promise<unknown> | unknown) => {
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  return (
    <div className="ox-re-card">
      <div className="ox-re-row">
        <h3 className="grow">{deed.propertyName}</h3>
        <span className="ox-re-chip gold">Tier {deed.tier} · {tier.label}</span>
      </div>
      <p>
        {district.name} · {district.tagline}
      </p>
      <div className="ox-re-meta">
        <span className="ox-re-chip">Rent {fmt(rate)} CITY/h</span>
        <span className="ox-re-chip green">Pending {fmt(pending)} CITY</span>
        {next && <span className="ox-re-chip">→ {next.label} ×{next.multiplier}</span>}
        {deed.listed && <span className="ox-re-chip hot">Listed {fmt(deed.listed.priceOrbitx)} ORBITX</span>}
      </div>
      <div className="ox-re-row">
        <button className="ox-re-btn small primary" disabled={busy} onClick={() => act(() => deedStore.collectRent(deed.deedId, ctx.ledger))}>
          Collect {fmt(pending)} CITY
        </button>
        {next && (
          <button
            className="ox-re-btn small burn"
            disabled={busy || !ctx.billing.ready}
            title={ctx.billing.ready ? "Burn ORBITX to upgrade" : "Wallet auth required"}
            onClick={() => act(() => deedStore.upgradeDeed(deed.deedId, ctx.billing))}
          >
            Upgrade · {fmt(next.upgradeCostOrbitx)} ORBITX 🔥
          </button>
        )}
        <button className="ox-re-btn small ghost" onClick={() => setShowMeta((v) => !v)}>
          {showMeta ? "Hide" : "NFT deed"}
        </button>
      </div>
      {deed.listed ? (
        <div className="ox-re-row" style={{ marginTop: 8 }}>
          <span className="ox-re-chip">On the market</span>
          <button className="ox-re-btn small ghost" onClick={() => act(() => deedStore.unlistDeed(deed.deedId))}>
            Unlist
          </button>
        </div>
      ) : (
        <div className="ox-re-row" style={{ marginTop: 8 }}>
          <input
            className="ox-re-input"
            style={{ maxWidth: 140 }}
            inputMode="numeric"
            placeholder="List price ORBITX"
            value={listPrice}
            onChange={(e) => setListPrice(e.target.value)}
          />
          <button className="ox-re-btn small" onClick={() => act(() => { deedStore.listDeed(deed.deedId, Number(listPrice)); setListPrice(""); })}>
            List for sale
          </button>
        </div>
      )}
      {showMeta && (
        <pre className="ox-re-notice" style={{ whiteSpace: "pre-wrap", fontSize: 11, marginTop: 8 }}>
          {JSON.stringify(deedToNftMetadata(deed), null, 2)}
        </pre>
      )}
      {err && <div className="ox-re-err" style={{ marginTop: 8 }}>{err}</div>}
    </div>
  );
}

export function DeedsPanel({ ctx }: { ctx: RealEstateCtx }) {
  const book = useDeeds();
  const [districtFilter, setDistrictFilter] = useState<string>("all");
  const [err, setErr] = useState<string | null>(null);

  // Rent accrual ticks every 30s while the panel is open.
  useEffect(() => {
    deedStore.tick(Date.now());
    const id = setInterval(() => deedStore.tick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const myDeeds = useMemo(
    () => book.deeds.filter((d) => d.ownerId === ctx.playerId),
    [book.deeds, ctx.playerId]
  );
  const totalRate = useMemo(
    () => myDeeds.reduce((sum, d) => sum + deedRentRate(d), 0),
    [myDeeds]
  );
  const totalPending = useMemo(
    () => myDeeds.reduce((sum, d) => sum + pendingRent(d.deedId), 0),
    [myDeeds]
  );
  const catalog = useMemo(
    () => PROPERTIES.filter((p) => districtFilter === "all" || p.districtId === districtFilter),
    [districtFilter]
  );

  const buy = async (propertyId: string) => {
    setErr(null);
    try {
      await deedStore.buyDeed(propertyId, ctx.playerId, ctx.billing);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Purchase failed");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {!ctx.billing.providerConnected && (
        <div className="ox-re-notice">
          <strong>Paper mode.</strong> Rent, hotels and safehouses work in paper CITY.
          Deed purchases need the tokenomics billing primitive — until then they're shown as coming soon.
        </div>
      )}
      {ctx.billing.providerConnected && !ctx.billing.ready && (
        <div className="ox-re-auth">
          <strong>Wallet auth required.</strong> Premium purchases burn real ORBITX (backend-signed, no popups).{" "}
          <button className="ox-re-btn small primary" onClick={ctx.billing.beginAuth}>Connect wallet</button>
        </div>
      )}

      {myDeeds.length > 0 && (
        <div className="ox-re-card">
          <h3>📜 My portfolio</h3>
          <div className="ox-re-meta">
            <span className="ox-re-chip gold">{myDeeds.length} deed{myDeeds.length === 1 ? "" : "s"}</span>
            <span className="ox-re-chip">Earning {fmt(totalRate)} CITY/h</span>
            <span className="ox-re-chip green">{fmt(totalPending)} CITY ready</span>
          </div>
          <button
            className="ox-re-btn primary"
            disabled={ctx.billing.busy}
            onClick={() => {
              setErr(null);
              for (const d of myDeeds) {
                try { deedStore.collectRent(d.deedId, ctx.ledger); } catch { /* nothing pending — skip */ }
              }
            }}
          >
            Collect all rent
          </button>
        </div>
      )}

      {myDeeds.map((d) => <DeedCard key={d.deedId} deed={d} ctx={ctx} />)}

      <h3 style={{ margin: "8px 0 0" }}>🏙️ Buy deeds <span className="ox-re-chip red">🔥 ORBITX — burned</span></h3>
      <div className="ox-re-row">
        <select
          className="ox-re-input"
          style={{ maxWidth: 220 }}
          value={districtFilter}
          onChange={(e) => setDistrictFilter(e.target.value)}
        >
          <option value="all">All districts</option>
          {DISTRICTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div className="ox-re-grid">
        {catalog.map((p) => {
          const d = districtById(p.districtId);
          const owned = myDeeds.some((x) => x.propertyId === p.id);
          return (
            <div className="ox-re-card" key={p.id}>
              <div className="ox-re-row">
                <h3 className="grow">{p.name}</h3>
                <span className="ox-re-chip" style={{ borderColor: d.color }}>{d.name}</span>
              </div>
              <p>{p.description}</p>
              <div className="ox-re-meta">
                <span className="ox-re-chip">{p.kind}</span>
                <span className="ox-re-chip green">~{fmt(p.baseRentCityPerHour * d.rentMultiplier)} CITY/h @ tier 0</span>
              </div>
              <button
                className="ox-re-btn burn"
                disabled={ctx.billing.busy || owned || !ctx.billing.ready}
                title={ctx.billing.ready ? "Burns ORBITX — deed is yours as an NFT" : "Wallet auth required"}
                onClick={() => buy(p.id)}
              >
                {owned ? "Owned ✓" : `Buy deed · ${fmt(p.basePriceOrbitx)} ORBITX 🔥`}
              </button>
            </div>
          );
        })}
      </div>
      {err && <div className="ox-re-err">{err}</div>}
    </div>
  );
}
