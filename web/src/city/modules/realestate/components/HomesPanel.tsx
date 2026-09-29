/**
 * Real estate module — apartments & safehouses panel.
 * Own your spot: apartments (ORBITX, burned), safehouses (paper CITY).
 * Decorate with furniture (CITY basics / ORBITX premium, burned), invite
 * friends by player-id, and set a home as your spawn point.
 */
import { useState } from "react";
import type { Home } from "../types";
import { FURNITURE, HOMES, districtById, furnitureById, homeTemplateById } from "../data/catalog";
import { homeStore, useHomes } from "../store/homes";
import { fmt, type RealEstateCtx } from "./ctx";

function HomeCard({ home, ctx }: { home: Home; ctx: RealEstateCtx }) {
  const [guestInput, setGuestInput] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const tpl = homeTemplateById(home.homeId);
  const district = districtById(home.districtId);
  const freeSlots = home.decoSlots - home.furniture.length;
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
        <h3 className="grow">{home.kind === "apartment" ? "🏢" : "🕳️"} {home.name}</h3>
        {home.isSpawnPoint && <span className="ox-re-chip green">📍 spawn point</span>}
        <span className="ox-re-chip">{district.name}</span>
      </div>
      {tpl && <p>{tpl.blurb}</p>}
      <div className="ox-re-meta">
        <span className="ox-re-chip">{home.furniture.length}/{home.decoSlots} deco slots</span>
        <span className="ox-re-chip">{home.guests.length} guest{home.guests.length === 1 ? "" : "s"}</span>
      </div>

      <div className="ox-re-furniture">
        {home.furniture.map((f) => {
          const item = furnitureById(f.itemId);
          return (
            <button
              key={f.instanceId}
              className="ox-re-furn"
              title={`${item?.name ?? f.itemId} — tap to remove`}
              onClick={() => act(() => homeStore.removeFurniture(home.homeId, f.instanceId))}
            >
              {item?.icon ?? "📦"}
            </button>
          );
        })}
        {home.furniture.length === 0 && <span style={{ fontSize: 12, color: "#64748b" }}>Empty — buy furniture below.</span>}
      </div>

      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: "pointer", fontSize: 13, color: "#aab6d3" }}>🛋️ Buy furniture ({freeSlots} slots free)</summary>
        <div className="ox-re-grid" style={{ marginTop: 8 }}>
          {FURNITURE.map((item) => (
            <div className="ox-re-card" key={item.id} style={{ padding: 10 }}>
              <div className="ox-re-row">
                <span style={{ fontSize: 24 }}>{item.icon}</span>
                <div className="grow">
                  <strong style={{ fontSize: 13 }}>{item.name}</strong>
                  <p style={{ margin: 0 }}>{item.blurb}</p>
                </div>
              </div>
              <button
                className={`ox-re-btn small ${item.costOrbitx ? "burn" : "primary"}`}
                style={{ marginTop: 6, width: "100%" }}
                disabled={busy || freeSlots <= 0 || (item.costOrbitx ? !ctx.billing.ready : false)}
                onClick={() => act(() => homeStore.placeFurniture(home.homeId, item.id, ctx.billing, ctx.ledger))}
              >
                {item.costOrbitx ? `${fmt(item.costOrbitx)} ORBITX 🔥` : `${fmt(item.costCity ?? 0)} CITY`}
              </button>
            </div>
          ))}
        </div>
      </details>

      <div style={{ marginTop: 10 }}>
        <strong style={{ fontSize: 13 }}>👥 Guests</strong>
        <div className="ox-re-meta">
          {home.guests.length === 0 && <span style={{ fontSize: 12, color: "#64748b" }}>No guests yet.</span>}
          {home.guests.map((g) => (
            <span className="ox-re-chip" key={g}>
              {g}{" "}
              <button
                className="ox-re-btn small ghost"
                style={{ minHeight: 24, padding: "0 8px", border: "none" }}
                onClick={() => act(() => homeStore.revokeGuest(home.homeId, g))}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        <div className="ox-re-row">
          <input
            className="ox-re-input"
            style={{ maxWidth: 220 }}
            placeholder="Friend's player id"
            value={guestInput}
            onChange={(e) => setGuestInput(e.target.value)}
          />
          <button className="ox-re-btn small" onClick={() => act(() => { homeStore.inviteGuest(home.homeId, guestInput); setGuestInput(""); })}>
            Invite
          </button>
        </div>
      </div>

      {!home.isSpawnPoint && (
        <button className="ox-re-btn small ghost" style={{ marginTop: 8 }} onClick={() => act(() => homeStore.setSpawn(home.homeId))}>
          📍 Make spawn point
        </button>
      )}
      {err && <div className="ox-re-err" style={{ marginTop: 8 }}>{err}</div>}
    </div>
  );
}

export function HomesPanel({ ctx }: { ctx: RealEstateCtx }) {
  const homes = useHomes();
  const [err, setErr] = useState<string | null>(null);

  const buy = async (templateId: string) => {
    setErr(null);
    try {
      await homeStore.buyHome(templateId, ctx.playerId, ctx.billing, ctx.ledger);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Purchase failed");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {!ctx.billing.providerConnected && (
        <div className="ox-re-notice">
          <strong>Paper mode.</strong> Safehouses work in paper CITY. Apartment purchases need
          the tokenomics billing primitive — coming soon.
        </div>
      )}
      {homes.length > 0 && homes.map((h) => <HomeCard key={h.homeId} home={h} ctx={ctx} />)}

      <h3 style={{ margin: "8px 0 0" }}>🏠 Buy a home</h3>
      <div className="ox-re-grid">
        {HOMES.map((tpl) => {
          const owned = homes.some((h) => h.homeId === tpl.id && h.ownerId === ctx.playerId);
          const d = districtById(tpl.districtId);
          const premium = tpl.kind === "apartment";
          return (
            <div className="ox-re-card" key={tpl.id}>
              <div className="ox-re-row">
                <h3 className="grow">{premium ? "🏢" : "🕳️"} {tpl.name}</h3>
                <span className="ox-re-chip" style={{ borderColor: d.color }}>{d.name}</span>
              </div>
              <p>{tpl.blurb}</p>
              <div className="ox-re-meta">
                <span className="ox-re-chip">{tpl.kind}</span>
                <span className="ox-re-chip">{tpl.decoSlots} deco slots</span>
              </div>
              <button
                className={`ox-re-btn ${premium ? "burn" : "primary"}`}
                disabled={ctx.billing.busy || owned || (premium && !ctx.billing.ready)}
                title={premium ? (ctx.billing.ready ? "Burns ORBITX" : "Wallet auth required") : "Paper CITY purchase"}
                onClick={() => buy(tpl.id)}
              >
                {owned ? "Owned ✓" : premium ? `Buy · ${fmt(tpl.costOrbitx ?? 0)} ORBITX 🔥` : `Buy · ${fmt(tpl.costCity ?? 0)} CITY`}
              </button>
            </div>
          );
        })}
      </div>
      {err && <div className="ox-re-err">{err}</div>}
      <div className="ox-re-notice">
        Your player id: <strong>{ctx.playerId}</strong> — friends invite each other with it.
        Setting a spawn point tells the world where you wake up (wired to core teleport by the integrator).
      </div>
    </div>
  );
}
