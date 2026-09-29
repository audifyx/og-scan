/**
 * The three shops: THREADS (clothing, buffs), FADEZ (barber), INK'D (tattoos).
 * Every purchase is an ORBITX burn via the injected billing provider.
 */
import { useState } from "react";
import { useCharacter } from "../characterStore";
import { BillingNotice, BuffLine, BurnButton, ShopLook } from "./bits";
import {
  BARBER_STYLES,
  CLOTHING,
  FACIAL_HAIR,
  STORES,
} from "../data";
import type { FacialHairId, HairStyleId, OutfitSlot, TattooZone } from "../types";
import { TATTOOS } from "../data";

function Msg({ text }: { text: string }) {
  if (!text) return null;
  return <div className="ox-ch-toast" style={{ position: "static", transform: "none", margin: "10px auto 0", display: "table" }}>{text}</div>;
}

/* ---------------- THREADS — clothing ---------------- */

const SLOTS: { id: OutfitSlot | "all"; name: string }[] = [
  { id: "all", name: "All" },
  { id: "head", name: "Head" },
  { id: "top", name: "Top" },
  { id: "bottom", name: "Bottom" },
  { id: "shoes", name: "Shoes" },
  { id: "outer", name: "Outer" },
];

export function ClothingStore() {
  const { profile, buyClothing, equip, orbitxBalance } = useCharacter();
  const [slot, setSlot] = useState<OutfitSlot | "all">("all");
  const [msg, setMsg] = useState("");
  const items = CLOTHING.filter((c) => slot === "all" || c.slot === slot);
  const store = STORES.find((s) => s.kind === "clothing");

  return (
    <div className="ox-ch-grid2">
      <div><ShopLook /></div>
      <div>
        <BillingNotice />
        <div className="ox-ch-shophead">
          <h3>🧥 {store?.name ?? "THREADS"}</h3>
          {orbitxBalance != null && <span className="ox-ch-balance">{orbitxBalance.toFixed(0)} ORBITX</span>}
        </div>
        <p style={{ fontSize: 12, color: "#8a9aa8", margin: "0 0 10px" }}>
          Every piece burns ORBITX — and every piece is gear: outfits grant real stat buffs.
        </p>
        <div className="ox-ch-row" style={{ marginBottom: 12 }}>
          {SLOTS.map((s) => (
            <button key={s.id} className={`ox-ch-pill ${slot === s.id ? "on" : ""}`} onClick={() => setSlot(s.id)}>
              {s.name}
            </button>
          ))}
        </div>
        <div className="ox-ch-cards">
          {items.map((c) => {
            const owned = profile.wardrobe.includes(c.id);
            const equipped = profile.outfit[c.slot] === c.id;
            return (
              <div key={c.id} className={`ox-ch-card ${equipped ? "equipped" : owned ? "owned" : ""}`}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 18, height: 18, borderRadius: 6, background: `#${c.color.toString(16).padStart(6, "0")}`, border: "1px solid #2a3a48" }} />
                  <h4>{c.name}</h4>
                </div>
                <p>{c.blurb}</p>
                <BuffLine buffs={c.buffs} />
                {owned ? (
                  <button className={`ox-ch-btn ${equipped ? "ghost" : ""}`} onClick={() => equip(c.slot, equipped ? null : c.id)}>
                    {equipped ? "Unequip" : "Equip"}
                  </button>
                ) : (
                  <BurnButton amount={c.price} label="Buy" onBurn={() => buyClothing(c.id)} onResult={setMsg} />
                )}
              </div>
            );
          })}
        </div>
        <Msg text={msg} />
      </div>
    </div>
  );
}

/* ---------------- FADEZ — barber ---------------- */

export function BarberShop() {
  const { profile, buyCut, updateAppearance, orbitxBalance } = useCharacter();
  const [msg, setMsg] = useState("");
  const store = STORES.find((s) => s.kind === "barber");
  const a = profile.appearance;

  return (
    <div className="ox-ch-grid2">
      <div><ShopLook /></div>
      <div>
        <BillingNotice />
        <div className="ox-ch-shophead">
          <h3>💈 {store?.name ?? "FADEZ Barber"}</h3>
          {orbitxBalance != null && <span className="ox-ch-balance">{orbitxBalance.toFixed(0)} ORBITX</span>}
        </div>
        <div className="ox-ch-label">Haircuts (each visit burns)</div>
        <div className="ox-ch-cards" style={{ marginBottom: 16 }}>
          {BARBER_STYLES.map((b) => {
            const active = a.hairStyleId === b.id;
            return (
              <div key={b.id} className={`ox-ch-card ${active ? "equipped" : ""}`}>
                <h4>{b.name}</h4>
                <p>{b.blurb}</p>
                {active ? (
                  <span className="ox-ch-buff">Current cut</span>
                ) : (
                  <BurnButton amount={b.price} label="Cut" onBurn={() => buyCut(b.id)} onResult={setMsg} />
                )}
              </div>
            );
          })}
        </div>
        <div className="ox-ch-label">Facial hair</div>
        <div className="ox-ch-row">
          {FACIAL_HAIR.map((f) => {
            const active = a.facialHairId === f.id;
            if (f.price === 0) {
              return (
                <button key={f.id} className={`ox-ch-pill ${active ? "on" : ""}`}
                  onClick={() => { updateAppearance({ facialHairId: f.id as FacialHairId }); setMsg("Shaved clean — free."); }}>
                  {f.name} (free)
                </button>
              );
            }
            return (
              <button
                key={f.id}
                className={`ox-ch-pill ${active ? "on" : ""}`}
                onClick={async () => {
                  const res = await buyCut(f.id);
                  setMsg(res.message ?? (res.ok ? "Burned + applied." : "Failed."));
                }}
              >
                {active ? `✓ ${f.name}` : `🔥 ${f.price} · ${f.name}`}
              </button>
            );
          })}
        </div>
        <p className="ox-ch-cool" style={{ marginTop: 10 }}>
          Tip: "Clean shave" is always free — the chair is for the art.
        </p>
        <Msg text={msg} />
      </div>
    </div>
  );
}

/* ---------------- INK'D — tattoo parlor ---------------- */

const ZONE_NAMES: Record<TattooZone, string> = {
  armL: "Left arm", armR: "Right arm", chest: "Chest", back: "Back", neck: "Neck",
};

export function TattooShop() {
  const { profile, buyTattoo, removeTattoo, orbitxBalance } = useCharacter();
  const [msg, setMsg] = useState("");
  const store = STORES.find((s) => s.kind === "tattoo");
  const zones = Object.keys(ZONE_NAMES) as TattooZone[];

  return (
    <div className="ox-ch-grid2">
      <div><ShopLook /></div>
      <div>
        <BillingNotice />
        <div className="ox-ch-shophead">
          <h3>🖋️ {store?.name ?? "INK'D Parlor"}</h3>
          {orbitxBalance != null && <span className="ox-ch-balance">{orbitxBalance.toFixed(0)} ORBITX</span>}
        </div>
        <p style={{ fontSize: 12, color: "#8a9aa8", margin: "0 0 10px" }}>
          Permanent ink, permanent burn. Laser removal is free — the burn isn't refundable.
        </p>
        {zones.map((zone) => {
          const designs = TATTOOS.filter((t) => t.zone === zone);
          if (designs.length === 0) return null;
          return (
            <div key={zone} style={{ marginBottom: 14 }}>
              <div className="ox-ch-label">{ZONE_NAMES[zone]}</div>
              <div className="ox-ch-cards">
                {designs.map((t) => {
                  const owned = profile.tattoos.includes(t.id);
                  return (
                    <div key={t.id} className={`ox-ch-card ${owned ? "equipped" : ""}`}>
                      <h4>{t.name}</h4>
                      <p>{t.blurb}</p>
                      {owned ? (
                        <button className="ox-ch-btn danger" onClick={() => { removeTattoo(t.id); setMsg(`${t.name} lasered off.`); }}>
                          Laser off (free)
                        </button>
                      ) : (
                        <BurnButton amount={t.price} label="Ink it" onBurn={() => buyTattoo(t.id)} onResult={setMsg} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        <Msg text={msg} />
      </div>
    </div>
  );
}

