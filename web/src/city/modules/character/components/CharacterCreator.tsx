/**
 * Character creator — face, hair, fits. Initial choices are free;
 * every new style bought later (barber / tattoo / clothing shops) burns ORBITX.
 */
import { useState } from "react";
import { useCharacter } from "../characterStore";
import { AvatarPreview } from "./AvatarPreview";
import { BillingNotice } from "./bits";
import {
  BARBER_STYLES,
  CLOTHING,
  FACIAL_HAIR,
  HAIR_COLORS,
  SKIN_TONES,
  TATTOOS,
} from "../data";
import type { Appearance, FacialHairId, HairStyleId, OutfitSlot } from "../types";

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

export function CharacterCreator() {
  const { profile, updateAppearance, setName } = useCharacter();
  const [name, setLocalName] = useState(profile.name);
  const a = profile.appearance;

  const set = (patch: Partial<Appearance>) => updateAppearance(patch);

  return (
    <div>
      <BillingNotice />
      <div className="ox-ch-grid2">
        <div>
          <div className="ox-ch-preview">
            <AvatarPreview appearance={a} outfit={profile.outfit} tattoos={profile.tattoos} />
          </div>
          <div className="ox-ch-hint">Drag to rotate · live preview</div>
          <div className="ox-ch-section" style={{ marginTop: 12 }}>
            <div className="ox-ch-label">Street name</div>
            <input
              className="ox-ch-input"
              value={name}
              maxLength={24}
              onChange={(e) => { setLocalName(e.target.value); setName(e.target.value); }}
              placeholder="Rookie"
            />
          </div>
        </div>

        <div>
          <div className="ox-ch-section">
            <div className="ox-ch-label">Skin tone</div>
            <div className="ox-ch-row">
              {SKIN_TONES.map((s) => (
                <button
                  key={s.id}
                  className={`ox-ch-swatch ${a.skinToneId === s.id ? "on" : ""}`}
                  style={{ background: hex(s.color) }}
                  title={s.name}
                  aria-label={s.name}
                  onClick={() => set({ skinToneId: s.id })}
                />
              ))}
            </div>
          </div>

          <div className="ox-ch-section">
            <div className="ox-ch-label">Haircut (new cuts from FADEZ Barber — burns ORBITX)</div>
            <div className="ox-ch-row">
              {BARBER_STYLES.map((b) => (
                <button
                  key={b.id}
                  className={`ox-ch-pill ${a.hairStyleId === b.id ? "on" : ""}`}
                  onClick={() => set({ hairStyleId: b.id as HairStyleId })}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>

          <div className="ox-ch-section">
            <div className="ox-ch-label">Hair color</div>
            <div className="ox-ch-row">
              {HAIR_COLORS.map((h) => (
                <button
                  key={h.id}
                  className={`ox-ch-swatch ${a.hairColorId === h.id ? "on" : ""}`}
                  style={{ background: hex(h.color) }}
                  title={h.name}
                  aria-label={h.name}
                  onClick={() => set({ hairColorId: h.id })}
                />
              ))}
            </div>
          </div>

          <div className="ox-ch-section">
            <div className="ox-ch-label">Facial hair</div>
            <div className="ox-ch-row">
              {FACIAL_HAIR.map((f) => (
                <button
                  key={f.id}
                  className={`ox-ch-pill ${a.facialHairId === f.id ? "on" : ""}`}
                  onClick={() => set({ facialHairId: f.id as FacialHairId })}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          <div className="ox-ch-section">
            <div className="ox-ch-label">Preview ink (buy at INK'D Parlor — burns ORBITX)</div>
            <div className="ox-ch-row">
              {TATTOOS.map((t) => (
                <span key={t.id} className="ox-ch-pill" style={{ opacity: 0.75, cursor: "default" }}>
                  {t.name}
                </span>
              ))}
            </div>
          </div>

          <div className="ox-ch-section">
            <div className="ox-ch-label">Starter fit (more at THREADS — buffs included)</div>
            <div className="ox-ch-row">
              {CLOTHING.filter((c) => c.price <= 12).map((c) => (
                <span key={c.id} className="ox-ch-pill" style={{ opacity: 0.75, cursor: "default" }}>
                  {c.name}
                </span>
              ))}
            </div>
            <p style={{ fontSize: 12, color: "#8a9aa8" }}>
              Owned gear is in your wardrobe below. Walk into THREADS, FADEZ or
              INK'D on the map to spend ORBITX — every purchase burns.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Wardrobe — everything owned, equip per slot. Exported for the hub. */
export function Wardrobe() {
  const { profile, equip } = useCharacter();
  const slots: OutfitSlot[] = ["head", "top", "bottom", "shoes", "outer"];
  return (
    <div className="ox-ch-section">
      <div className="ox-ch-label">Wardrobe ({profile.wardrobe.length} owned)</div>
      {slots.map((slot) => {
        const items = CLOTHING.filter((c) => c.slot === slot && profile.wardrobe.includes(c.id));
        if (items.length === 0) return null;
        return (
          <div key={slot} style={{ marginBottom: 10 }}>
            <div className="ox-ch-label" style={{ marginBottom: 6 }}>{slot}</div>
            <div className="ox-ch-row">
              {items.map((c) => {
                const on = profile.outfit[slot] === c.id;
                return (
                  <button key={c.id} className={`ox-ch-pill ${on ? "on" : ""}`} onClick={() => equip(slot, on ? null : c.id)}>
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
