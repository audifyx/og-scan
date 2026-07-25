import { PLAYER_CLASSES, getItem } from "../../catalogs/classesItems";
import { applyClass, patchCosmetics, renameCharacter } from "../../systems/character";
import { equipItem } from "../../systems/economy";
import { useGameProfile } from "../../state/useGameProfile";
import { bumpMission } from "../../state/GameProfileStore";
import type { PlayerClassId } from "../../types";
import type { CSSProperties } from "react";

const SKINS = ["#e8d5c0", "#c9a07a", "#8d5524", "#f0d5b8", "#5c3a21"];
const HAIRS = ["#101014", "#3a2318", "#f5c542", "#17ff4d", "#3de7ff"];
const BODIES = ["#1a2438", "#2a1f3d", "#1e4436", "#3d2a1e", "#1a3040"];
const HAIR_STYLES = ["short", "long", "buzz", "bun", "mohawk"];

export function PlayCharacterPage() {
  const { profile, stats, updateProfile } = useGameProfile();
  const c = profile.character;

  const customize = (fn: () => void) => {
    fn();
    updateProfile((p) => bumpMission(p, "daily_customize", "customize", 1));
  };

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div>
        <div className="gx-kicker">Character system</div>
        <h1 className="gx-title" style={{ fontSize: "1.7rem" }}>
          Operator forge
        </h1>
        <p className="gx-lead">Classes, stats, cosmetics, skins, and equipment loadouts.</p>
      </div>

      <div className="gx-grid gx-split">
        <div className="gx-panel" style={{ textAlign: "center" }}>
          <div
            className="gx-doll"
            style={
              {
                ["--skin" as string]: c.skinColor,
                ["--hair" as string]: c.hairColor,
                ["--body" as string]: c.bodyColor,
                ["--accent" as string]: c.accentColor,
              } as CSSProperties
            }
          >
            <div className="gx-doll-hair" />
            <div className="gx-doll-head" />
            <div className="gx-doll-body" />
            <div className="gx-doll-legs" />
          </div>
          <div className="gx-title" style={{ fontSize: "1rem", marginTop: "0.75rem" }}>
            @{c.name}
          </div>
          <div className="gx-badge">{c.classId}</div>
        </div>

        <div style={{ display: "grid", gap: "0.85rem" }}>
          <div className="gx-panel">
            <label className="gx-kicker">Callsign</label>
            <input
              className="gx-input"
              style={{ marginTop: "0.45rem" }}
              value={c.name}
              maxLength={24}
              onChange={(e) => updateProfile((p) => renameCharacter(p, e.target.value))}
            />
          </div>

          <div className="gx-panel">
            <div className="gx-kicker">Class</div>
            <div className="gx-grid" style={{ marginTop: "0.65rem" }}>
              {PLAYER_CLASSES.map((cls) => (
                <button
                  key={cls.id}
                  type="button"
                  className="gx-card"
                  data-on={c.classId === cls.id}
                  style={{ ["--accent" as string]: cls.accent }}
                  onClick={() => updateProfile((p) => applyClass(p, cls.id as PlayerClassId))}
                >
                  <strong>{cls.name}</strong>
                  <span>{cls.tagline}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="gx-panel">
            <div className="gx-kicker">Live stats</div>
            <div className="gx-grid gx-grid-3" style={{ marginTop: "0.55rem" }}>
              {Object.entries(stats).map(([k, v]) => (
                <div key={k} className="gx-card" style={{ cursor: "default" }}>
                  <strong>{k}</strong>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="gx-panel">
            <div className="gx-kicker">Cosmetics</div>
            <div style={{ marginTop: "0.55rem", display: "grid", gap: "0.65rem" }}>
              <div>
                <div className="gx-stat"><span>Skin</span></div>
                <div className="gx-swatches">
                  {SKINS.map((col) => (
                    <button key={col} type="button" className="gx-swatch" style={{ background: col }} data-on={c.skinColor === col}
                      onClick={() => customize(() => updateProfile((p) => patchCosmetics(p, { skinColor: col })))} />
                  ))}
                </div>
              </div>
              <div>
                <div className="gx-stat"><span>Hair</span></div>
                <div className="gx-swatches">
                  {HAIRS.map((col) => (
                    <button key={col} type="button" className="gx-swatch" style={{ background: col }} data-on={c.hairColor === col}
                      onClick={() => customize(() => updateProfile((p) => patchCosmetics(p, { hairColor: col })))} />
                  ))}
                </div>
              </div>
              <div>
                <div className="gx-stat"><span>Body / outfit color</span></div>
                <div className="gx-swatches">
                  {BODIES.map((col) => (
                    <button key={col} type="button" className="gx-swatch" style={{ background: col }} data-on={c.bodyColor === col}
                      onClick={() => customize(() => updateProfile((p) => patchCosmetics(p, { bodyColor: col })))} />
                  ))}
                </div>
              </div>
              <div className="gx-nav">
                {HAIR_STYLES.map((h) => (
                  <button key={h} type="button" className="gx-btn" style={{ padding: "0.35rem 0.7rem" }}
                    onClick={() => customize(() => updateProfile((p) => patchCosmetics(p, { hairStyle: h })))}>
                    {h}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="gx-panel">
            <div className="gx-kicker">Equipment</div>
            <div className="gx-list" style={{ marginTop: "0.55rem" }}>
              {profile.inventory
                .map((s) => ({ stack: s, def: getItem(s.itemId) }))
                .filter((x) => x.def?.slot)
                .map(({ stack, def }) => (
                  <div key={stack.itemId} className="gx-row">
                    <div>
                      <strong style={{ fontFamily: "var(--gx-display)", fontSize: "0.8rem" }}>{def!.name}</strong>
                      <div style={{ color: "var(--gx-muted)", fontSize: "0.75rem" }}>{def!.slot} · {def!.rarity}</div>
                    </div>
                    <button type="button" className="gx-btn gx-btn-primary" style={{ padding: "0.35rem 0.7rem" }}
                      onClick={() => customize(() => updateProfile((p) => equipItem(p, stack.itemId)))}>
                      {c.equipment[def!.slot!] === stack.itemId ? "Equipped" : "Equip"}
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
