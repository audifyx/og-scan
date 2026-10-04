/**
 * OrbitX City — Real Estate HUD panel.
 *
 * Portfolio (owned buildings + total value), buy / sell / list UI, and the
 * paper-CITY rent claim (1 CITY/hour per owned building, claimable).
 *
 * Real transactions only: primary buys burn the price from the in-app (desk)
 * wallet via the backend-signed orbitx_app_burn — no popups. When the wallet
 * is not linked the panel shows "Link in-app wallet" — never a fake deed.
 * Player resales + listing/delisting are honestly disabled until the desk
 * wallet can sign transfers/messages.
 *
 * Mount inside the city HUD wherever <CityHud> renders its panels:
 *   import { PropertyPanel } from "@/city/realestate";
 *   <PropertyPanel />
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useCityWallet } from "@/city/economy/useCityWallet";
import { getBillingAuthCode } from "@/tokenomics/auth";
import { getCityPoints, addCityPoints } from "@/city/cityState";
import {
  shortWallet,
  fetchProperties,
  buyProperty,
  listForSale,
  unlistProperty,
  RENT_CITY_PER_HOUR,
  type PropertyRow,
} from "./RealEstate";
import { setPropertyOwnerLabel } from "./PropertySign";
import { ReceiptModal, type ReceiptLine } from "./ReceiptModal";

const RENT_KEY = "oxc-rent-claim";

function readRentClaims(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(RENT_KEY) || "{}") as Record<string, number>;
  } catch {
    return {} as Record<string, number>;
  }
}

function writeRentClaims(m: Record<string, number>): void {
  try {
    localStorage.setItem(RENT_KEY, JSON.stringify(m));
  } catch {
    /* noop */
  }
}

function accruedHours(owned: PropertyRow[], claims: Record<string, number>, now: number): number {
  let h = 0;
  for (const p of owned) {
    const last = claims[p.building_key] || (p.bought_at ? Date.parse(p.bought_at) : now);
    h += Math.max(0, Math.floor((now - last) / 3_600_000));
  }
  return h;
}

const panel: React.CSSProperties = {
  width: "min(460px, 94vw)",
  maxHeight: "82vh",
  overflowY: "auto",
  borderRadius: 14,
  padding: 16,
  background: "linear-gradient(180deg, #101826 0%, #0a0f1a 100%)",
  border: "1px solid rgba(0,255,200,0.35)",
  boxShadow: "0 0 32px rgba(0,255,200,0.12)",
  color: "#e8f4ff",
  fontFamily: "system-ui, sans-serif",
  fontSize: 13,
};

const btn: React.CSSProperties = {
  border: "1px solid rgba(0,255,200,0.5)",
  background: "rgba(0,255,200,0.10)",
  color: "#00ffc8",
  borderRadius: 8,
  padding: "7px 12px",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 12,
};

const btnDanger: React.CSSProperties = {
  ...btn,
  border: "1px solid rgba(255,120,120,0.5)",
  background: "rgba(255,120,120,0.08)",
  color: "#ff9a9a",
};

const btnDisabled: React.CSSProperties = {
  ...btn,
  opacity: 0.45,
  cursor: "not-allowed",
};

const card: React.CSSProperties = {
  border: "1px solid #223349",
  borderRadius: 10,
  padding: 10,
  marginBottom: 8,
  background: "rgba(255,255,255,0.02)",
};

const NOT_YET =
  "Not supported from the in-app wallet yet — the desk wallet can't sign transfers or messages. Coming soon.";

export function PropertyPanel() {
  const w = useCityWallet();
  const [rows, setRows] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ title: string; lines: ReceiptLine[]; signature?: string | null; note?: string } | null>(null);
  const [points, setPoints] = useState(getCityPoints());
  const [tick, setTick] = useState(Date.now());

  const walletAddr = w.address;
  const connected = w.connected;

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchProperties();
      setRows(data);
      // Push owner labels so in-world door plaques update while the panel is open.
      for (const r of data) {
        if (r.owner_wallet) setPropertyOwnerLabel(r.building_key, shortWallet(r.owner_wallet));
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Property feed unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Re-render hourly accrual display once a minute.
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const owned = useMemo(
    () => (walletAddr ? rows.filter((r) => r.owner_wallet === walletAddr) : []),
    [rows, walletAddr]
  );
  const listings = useMemo(() => rows.filter((r) => r.for_sale), [rows]);
  const totalValue = useMemo(
    () => owned.reduce((s, r) => s + Number(r.price_orbitx || 0), 0),
    [owned]
  );
  const claims = useMemo(readRentClaims, [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const pendingRent = useMemo(() => accruedHours(owned, claims, tick) * RENT_CITY_PER_HOUR, [owned, claims, tick]);

  async function onBuy(row: PropertyRow) {
    const authCode = getBillingAuthCode();
    if (!walletAddr || !authCode) return;
    setError(null);
    setBusyKey(row.building_key);
    try {
      const res = await buyProperty({
        wallet: { address: walletAddr, authCode },
        buildingKey: row.building_key,
      });
      setPropertyOwnerLabel(row.building_key, shortWallet(walletAddr));
      // Seed the rent clock at purchase time so accrual starts now.
      const c = readRentClaims();
      c[row.building_key] = Date.now();
      writeRentClaims(c);
      setTick(Date.now());
      setReceipt({
        title: `Deed — ${row.label}`,
        lines: [
          { label: "Property", value: row.label, highlight: true },
          { label: "Price", value: `${res.priceOrbitx.toLocaleString()} ORBITX` },
          { label: "Sale", value: "City deed (full burn)" },
          { label: "Burned", value: `${res.burnedOrbitx.toLocaleString()} ORBITX 🔥` },
          { label: "Owner", value: shortWallet(walletAddr) },
        ],
        signature: res.signature,
        note: "Deed recorded on-chain. The building's door plaque now shows your address.",
      });
      await w.refresh();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Purchase failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function onList(row: PropertyRow) {
    if (!walletAddr) return;
    setError(null);
    try {
      await listForSale({
        wallet: { address: walletAddr, authCode: getBillingAuthCode() ?? "" },
        buildingKey: row.building_key,
        priceOrbitx: Math.floor(Number(row.price_orbitx)),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Listing failed.");
    }
  }

  async function onUnlist(row: PropertyRow) {
    if (!walletAddr) return;
    setError(null);
    try {
      await unlistProperty({
        wallet: { address: walletAddr, authCode: getBillingAuthCode() ?? "" },
        buildingKey: row.building_key,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delist failed.");
    }
  }

  function onClaimRent() {
    if (!walletAddr || pendingRent <= 0) return;
    const c = readRentClaims();
    const now = Date.now();
    for (const p of owned) c[p.building_key] = now;
    writeRentClaims(c);
    const total = addCityPoints(pendingRent);
    setPoints(total);
    setTick(now);
    setReceipt({
      title: "Rent collected",
      lines: [
        { label: "Properties", value: String(owned.length) },
        { label: "Claimed", value: `+${pendingRent} CITY`, highlight: true },
        { label: "Balance", value: `${total.toLocaleString()} CITY` },
      ],
      note: "Owned buildings accrue 1 CITY per hour each.",
    });
  }

  if (!connected) {
    return (
      <div style={panel}>
        <div style={{ fontWeight: 800, fontSize: 15, color: "#00ffc8", marginBottom: 8 }}>🏙️ Real Estate</div>
        <div style={{ color: "#9fb3c8", marginBottom: 12 }}>
          Own a piece of OrbitX City. Deeds are bought with real ORBITX — primary sales burn the
          full price, straight from your in-app wallet. No popups, no Phantom.
        </div>
        {w.error && (
          <div style={{ ...card, borderColor: "rgba(255,120,120,0.5)", color: "#ff9a9a", marginBottom: 10 }}>
            {w.error}
          </div>
        )}
        <button style={btn} onClick={() => void w.connect()}>
          Link in-app wallet
        </button>
      </div>
    );
  }

  return (
    <div style={panel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: "#00ffc8" }}>🏙️ Real Estate</div>
        <button style={{ ...btn, padding: "4px 10px" }} onClick={() => void refresh()} disabled={loading}>
          {loading ? "…" : "↻"}
        </button>
      </div>

      {loadError && <div style={{ ...card, borderColor: "rgba(255,120,120,0.5)", color: "#ff9a9a" }}>{loadError}</div>}
      {error && <div style={{ ...card, borderColor: "rgba(255,120,120,0.5)", color: "#ff9a9a" }}>{error}</div>}

      {/* Portfolio */}
      <div style={{ fontWeight: 700, marginBottom: 6, color: "#ffd76a" }}>
        📁 Portfolio — {owned.length} owned · {totalValue.toLocaleString()} ORBITX value
      </div>
      {owned.length === 0 && (
        <div style={{ color: "#8fa3b8", marginBottom: 10 }}>You don't own any buildings yet.</div>
      )}
      {owned.map((r) => (
        <div key={r.building_key} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700 }}>{r.label}</div>
              <div style={{ color: "#8fa3b8", fontSize: 12 }}>
                {Number(r.price_orbitx).toLocaleString()} ORBITX · {r.for_sale ? "listed for sale" : "not listed"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {r.for_sale ? (
                <button style={btnDisabled} title={NOT_YET} onClick={() => void onUnlist(r)}>
                  Unlist
                </button>
              ) : (
                <button style={btnDisabled} title={NOT_YET} onClick={() => void onList(r)}>
                  Sell
                </button>
              )}
            </div>
          </div>
          <div style={{ color: "#5f7285", fontSize: 11, marginTop: 6 }}>
            Listing from the in-app wallet coming soon.
          </div>
        </div>
      ))}
      {owned.length > 0 && (
        <button style={{ ...btn, width: "100%", marginBottom: 12 }} disabled={pendingRent <= 0} onClick={onClaimRent}>
          💰 Claim rent: +{pendingRent} CITY {pendingRent <= 0 ? "(nothing accrued yet)" : ""}
        </button>
      )}

      {/* Marketplace */}
      <div style={{ fontWeight: 700, marginBottom: 6, color: "#ffd76a" }}>🏷️ For sale</div>
      {loading && <div style={{ color: "#8fa3b8" }}>Loading listings…</div>}
      {!loading && listings.length === 0 && <div style={{ color: "#8fa3b8" }}>Nothing on the market right now.</div>}
      {listings.map((r) => {
        const mine = walletAddr === r.owner_wallet;
        const playerOwned = !!r.owner_wallet && !mine;
        return (
          <div key={r.building_key} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{r.label}</div>
                <div style={{ color: "#8fa3b8", fontSize: 12 }}>
                  {Number(r.price_orbitx).toLocaleString()} ORBITX · owner {r.owner_wallet ? shortWallet(r.owner_wallet) : "City 🏛️"}
                </div>
              </div>
              {!mine && !playerOwned && (
                <button style={btn} disabled={busyKey === r.building_key} onClick={() => void onBuy(r)}>
                  {busyKey === r.building_key ? "Burning…" : `Buy — ${Number(r.price_orbitx).toLocaleString()}`}
                </button>
              )}
              {!mine && playerOwned && (
                <button style={btnDisabled} title="Player resales aren't supported from the in-app wallet yet.">
                  Buy — soon
                </button>
              )}
              {mine && <span style={{ color: "#8fa3b8", fontSize: 12 }}>your listing</span>}
            </div>
          </div>
        );
      })}

      <div style={{ color: "#5f7285", fontSize: 11, marginTop: 10, lineHeight: 1.5 }}>
        Primary deeds burn the full price from your in-app wallet — backend-signed, no popup.
        Player resales + listing from the in-app wallet are coming soon. CITY balance: {points.toLocaleString()}
      </div>

      <ReceiptModal
        open={receipt !== null}
        onClose={() => setReceipt(null)}
        title={receipt?.title ?? ""}
        lines={receipt?.lines ?? []}
        signature={receipt?.signature}
        note={receipt?.note}
      />
    </div>
  );
}

export default PropertyPanel;
