/**
 * Character hub — single mount point for the whole character module.
 * Tabbed overlay: Creator / Shops / Gym / Bot. Wraps its own
 * <CharacterProvider>, so the integrator just renders it once:
 *
 *     import { CharacterHub, CHARACTER_PANEL_ID } from "@/city/modules/character";
 *     {panel === CHARACTER_PANEL_ID && (
 *       <CharacterHub billing={billing} onClose={() => openPanel(null)}
 *                    onVisitStore={(s) => api.getWorld()?.teleport(s.x, s.z)} />
 *     )}
 */
import { useState } from "react";
import { CharacterProvider } from "../characterStore";
import { CharacterCreator, Wardrobe } from "./CharacterCreator";
import { BarberShop, ClothingStore, TattooShop } from "./Shops";
import { GymPanel } from "./GymPanel";
import { CompanionPanel } from "./CompanionPanel";
import { STORES } from "../data";
import type { CharacterBillingProvider, StoreLocation } from "../types";
import "../character.css";

export const CHARACTER_PANEL_ID = "character";

type MainTab = "create" | "shops" | "gym" | "bot";
type ShopTab = "clothing" | "barber" | "tattoo";

const MAIN_TABS: { id: MainTab; name: string }[] = [
  { id: "create", name: "🧑 Creator" },
  { id: "shops", name: "🛍️ Shops" },
  { id: "gym", name: "🏋️ Gym" },
  { id: "bot", name: "🤖 Bot" },
];

const SHOP_TABS: { id: ShopTab; name: string; kind: StoreLocation["kind"] }[] = [
  { id: "clothing", name: "THREADS", kind: "clothing" },
  { id: "barber", name: "FADEZ", kind: "barber" },
  { id: "tattoo", name: "INK'D", kind: "tattoo" },
];

export function CharacterHub(props: {
  billing?: CharacterBillingProvider | null;
  onClose: () => void;
  initialTab?: MainTab;
  /** Called with the store location when the player hits "Visit" (integrator teleports). */
  onVisitStore?: (store: StoreLocation) => void;
}) {
  const [tab, setTab] = useState<MainTab>(props.initialTab ?? "create");
  const [shop, setShop] = useState<ShopTab>("clothing");

  return (
    <CharacterProvider billing={props.billing}>
      <div className="ox-ch-wrap" onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
        <div className="ox-ch-panel" role="dialog" aria-label="Character">
          <div className="ox-ch-head">
            <div className="ox-ch-title">CHARACTER <span className="accent">//</span> ORBITXCITY</div>
            <button className="ox-ch-close" onClick={props.onClose} aria-label="Close">✕</button>
          </div>
          <div className="ox-ch-tabs">
            {MAIN_TABS.map((t) => (
              <button key={t.id} className={`ox-ch-tab ${tab === t.id ? "on" : ""}`} onClick={() => setTab(t.id)}>
                {t.name}
              </button>
            ))}
          </div>
          <div className="ox-ch-body">
            {tab === "create" && (
              <>
                <CharacterCreator />
                <Wardrobe />
              </>
            )}
            {tab === "shops" && (
              <>
                <div className="ox-ch-tabs" style={{ padding: "0 0 12px" }}>
                  {SHOP_TABS.map((s) => (
                    <button key={s.id} className={`ox-ch-tab ${shop === s.id ? "on" : ""}`} onClick={() => setShop(s.id)}>
                      {s.name}
                    </button>
                  ))}
                </div>
                {shop === "clothing" && <ClothingStore />}
                {shop === "barber" && <BarberShop />}
                {shop === "tattoo" && <TattooShop />}
                {props.onVisitStore && (
                  <div className="ox-ch-section" style={{ marginTop: 16 }}>
                    <div className="ox-ch-label">Walk-in locations</div>
                    <div className="ox-ch-row">
                      {STORES.map((s) => (
                        <button key={s.id} className="ox-ch-pill" onClick={() => props.onVisitStore!(s)}>
                          📍 {s.name} — visit
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            {tab === "gym" && <GymPanel />}
            {tab === "bot" && <CompanionPanel />}
          </div>
        </div>
      </div>
    </CharacterProvider>
  );
}
