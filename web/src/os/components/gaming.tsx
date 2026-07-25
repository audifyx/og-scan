import { useMemo, useState, type CSSProperties } from "react";
import { OxButton, OxField, OxPanel, OxTabs, OxXpBar } from "../components/primitives";

const BODY = ["#1a2438", "#2a1f3d", "#1e4436", "#3d2a1e", "#1a3040", "#3a1f28"];
const SKIN = ["#e8d5c0", "#c9a07a", "#8d5524", "#f0d5b8", "#5c3a21", "#ffdbac"];
const ACCENT = ["#17ff4d", "#3de7ff", "#f5c542", "#ff4d9a", "#ff6b35"];
const HAIR = ["#101014", "#3a2318", "#f5c542", "#d9d0c3", "#17ff4d"];
const HAIR_STYLES = ["short", "long", "buzz", "bun", "mohawk"] as const;
const OUTFITS = ["street", "suit", "sport", "neon"] as const;

export interface CharacterDraft {
  name: string;
  body: string;
  skin: string;
  accent: string;
  hair: string;
  hairStyle: (typeof HAIR_STYLES)[number];
  outfit: (typeof OUTFITS)[number];
}

const STORAGE_KEY = "ox_os_character";

export function loadCharacter(): CharacterDraft {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultDraft(), ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return defaultDraft();
}

function defaultDraft(): CharacterDraft {
  return {
    name: "Traveler",
    body: BODY[0],
    skin: SKIN[0],
    accent: ACCENT[0],
    hair: HAIR[0],
    hairStyle: "short",
    outfit: "street",
  };
}

export function saveCharacter(draft: CharacterDraft) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function CharacterCreatorPanel({ onSaved }: { onSaved?: (d: CharacterDraft) => void }) {
  const [draft, setDraft] = useState<CharacterDraft>(() => loadCharacter());
  const [tab, setTab] = useState("look");

  const style = useMemo(
    () =>
      ({
        ["--skin" as string]: draft.skin,
        ["--body" as string]: draft.body,
        ["--accent" as string]: draft.accent,
        ["--hair" as string]: draft.hair,
      }) as CSSProperties,
    [draft],
  );

  return (
    <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0,1fr)", alignItems: "start" }} className="ox-char-grid">
      <style>{`@media(min-width:800px){.ox-char-grid{grid-template-columns:280px minmax(0,1fr)!important}}`}</style>
      <div className="ox-avatar-stage" style={style}>
        <div className="ox-scanline" aria-hidden />
        <div className="ox-doll" aria-hidden>
          <div className="ox-doll__hair" data-style={draft.hairStyle} />
          <div className="ox-doll__head" />
          <div className="ox-doll__body" />
          <div className="ox-doll__legs" />
        </div>
        <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, textAlign: "center", fontFamily: "var(--ox-font-display)", letterSpacing: "0.08em", fontSize: "0.85rem" }}>
          @{draft.name || "traveler"}
        </div>
      </div>

      <OxPanel>
        <OxTabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "look", label: "Look" },
            { id: "gear", label: "Outfit" },
            { id: "id", label: "Identity" },
          ]}
        />
        <div style={{ marginTop: "1rem" }}>
          {tab === "id" && (
            <OxField label="Callsign">
              <input className="ox-input" maxLength={24} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </OxField>
          )}
          {tab === "look" && (
            <>
              <OxField label="Skin">
                <div className="ox-swatches">
                  {SKIN.map((c) => (
                    <button key={c} type="button" className="ox-swatch" style={{ background: c }} data-on={draft.skin === c} onClick={() => setDraft({ ...draft, skin: c })} aria-label={c} />
                  ))}
                </div>
              </OxField>
              <OxField label="Hair color">
                <div className="ox-swatches">
                  {HAIR.map((c) => (
                    <button key={c} type="button" className="ox-swatch" style={{ background: c }} data-on={draft.hair === c} onClick={() => setDraft({ ...draft, hair: c })} aria-label={c} />
                  ))}
                </div>
              </OxField>
              <OxField label="Hair style">
                <div className="ox-tabs">
                  {HAIR_STYLES.map((h) => (
                    <button key={h} type="button" className="ox-tab" data-active={draft.hairStyle === h} onClick={() => setDraft({ ...draft, hairStyle: h })}>
                      {h}
                    </button>
                  ))}
                </div>
              </OxField>
            </>
          )}
          {tab === "gear" && (
            <>
              <OxField label="Body">
                <div className="ox-swatches">
                  {BODY.map((c) => (
                    <button key={c} type="button" className="ox-swatch" style={{ background: c }} data-on={draft.body === c} onClick={() => setDraft({ ...draft, body: c })} aria-label={c} />
                  ))}
                </div>
              </OxField>
              <OxField label="Neon accent">
                <div className="ox-swatches">
                  {ACCENT.map((c) => (
                    <button key={c} type="button" className="ox-swatch" style={{ background: c }} data-on={draft.accent === c} onClick={() => setDraft({ ...draft, accent: c })} aria-label={c} />
                  ))}
                </div>
              </OxField>
              <OxField label="Outfit">
                <div className="ox-tabs">
                  {OUTFITS.map((o) => (
                    <button key={o} type="button" className="ox-tab" data-active={draft.outfit === o} onClick={() => setDraft({ ...draft, outfit: o })}>
                      {o}
                    </button>
                  ))}
                </div>
              </OxField>
            </>
          )}
          <OxButton
            type="button"
            variant="primary"
            block
            onClick={() => {
              saveCharacter(draft);
              onSaved?.(draft);
            }}
          >
            Save loadout
          </OxButton>
        </div>
      </OxPanel>
    </div>
  );
}

export function PlayerProfileCard({
  name,
  level = 12,
  xp = 1840,
  nextXp = 2500,
  title = "City Pioneer",
}: {
  name: string;
  level?: number;
  xp?: number;
  nextXp?: number;
  title?: string;
}) {
  const draft = loadCharacter();
  return (
    <OxPanel>
      <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: `radial-gradient(circle at 30% 30%, ${draft.accent}55, ${draft.body})`,
            border: `1px solid ${draft.accent}66`,
            boxShadow: `0 0 20px ${draft.accent}44`,
          }}
        />
        <div style={{ flex: 1 }}>
          <div className="ox-kicker">{title}</div>
          <div className="ox-title" style={{ fontSize: "1.15rem" }}>
            @{name || draft.name}
          </div>
          <OxXpBar level={level} xp={xp} nextXp={nextXp} />
        </div>
      </div>
    </OxPanel>
  );
}

export function InventoryGrid() {
  const items = [
    { id: "badge-pioneer", name: "City Pioneer", kind: "badge", rarity: "rare" },
    { id: "key-nyc", name: "NYC Block Key", kind: "key", rarity: "uncommon" },
    { id: "ad-slot", name: "Billboard Slot", kind: "ad_slot", rarity: "epic" },
    { id: "emote-dance", name: "Dance Emote", kind: "emote", rarity: "common" },
    { id: "cosmetic-neon", name: "Neon Trim", kind: "cosmetic", rarity: "uncommon" },
    { id: "shard-pack", name: "OBX Shards x25", kind: "consumable", rarity: "common" },
  ];
  return (
    <div className="ox-grid-apps">
      {items.map((item) => (
        <div key={item.id} className="ox-app-tile" style={{ ["--tile" as string]: item.rarity === "epic" ? "#a78bfa" : item.rarity === "rare" ? "#3de7ff" : "#17ff4d", minHeight: 110 }}>
          <div className="ox-badge">{item.rarity}</div>
          <strong>{item.name}</strong>
          <span>{item.kind.replace("_", " ")}</span>
        </div>
      ))}
    </div>
  );
}

export function AchievementsBoard() {
  const rows = [
    { id: "first_steps", name: "First Steps", desc: "Enter OrbitX City", xp: 50, unlocked: true },
    { id: "social_butterfly", name: "Social Butterfly", desc: "Send 10 world chats", xp: 100, unlocked: true },
    { id: "trader_initiate", name: "Trader Initiate", desc: "Complete a Jupiter swap", xp: 150, unlocked: false },
    { id: "shard_hunter", name: "Shard Hunter", desc: "Collect 25 shards", xp: 120, unlocked: false },
    { id: "lobby_host", name: "Lobby Host", desc: "Create a lobby", xp: 80, unlocked: false },
  ];
  return (
    <div className="ox-list">
      {rows.map((r) => (
        <div key={r.id} className="ox-list-item" style={{ opacity: r.unlocked ? 1 : 0.55 }}>
          <div>
            <strong style={{ fontFamily: "var(--ox-font-display)", letterSpacing: "0.04em" }}>{r.name}</strong>
            <div style={{ color: "var(--ox-muted)", fontSize: "0.8rem" }}>{r.desc}</div>
          </div>
          <span className="ox-badge">{r.unlocked ? `+${r.xp} XP` : "LOCKED"}</span>
        </div>
      ))}
    </div>
  );
}

export function LobbyBrowserUi() {
  const lobbies = [
    { id: "main", label: "Main Lobby · NYC", players: 128, max: 256, kind: "public" },
    { id: "miami", label: "Miami Coast Social", players: 42, max: 64, kind: "public" },
    { id: "trade", label: "After-Hours Traders", players: 18, max: 32, kind: "public" },
    { id: "priv", label: "Private · Friends Only", players: 4, max: 12, kind: "private" },
  ];
  return (
    <div className="ox-list">
      {lobbies.map((l) => (
        <div key={l.id} className="ox-list-item">
          <div>
            <strong style={{ fontFamily: "var(--ox-font-display)", fontSize: "0.85rem" }}>{l.label}</strong>
            <div style={{ color: "var(--ox-muted)", fontSize: "0.78rem" }}>
              {l.players}/{l.max} · {l.kind}
            </div>
          </div>
          <OxButton
            type="button"
            size="sm"
            variant="primary"
            onClick={() => {
              window.location.href = "/Orbitxcity";
            }}
          >
            Join
          </OxButton>
        </div>
      ))}
    </div>
  );
}

export function MatchmakingPanel() {
  const [searching, setSearching] = useState(false);
  return (
    <OxPanel>
      <div className="ox-kicker">Matchmaking</div>
      <h2 className="ox-title" style={{ fontSize: "1.25rem" }}>
        Find a lobby
      </h2>
      <p className="ox-lead">Queue for public Main Lobby, ranked rooms, or create a private password lobby with friends.</p>
      <div className="ox-cta-row">
        <OxButton type="button" variant="primary" onClick={() => setSearching((s) => !s)}>
          {searching ? "Cancel search" : "Quick match"}
        </OxButton>
        <OxButton type="button" variant="ghost" onClick={() => (window.location.href = "/Orbitxcity")}>
          Enter City directly
        </OxButton>
      </div>
      {searching && (
        <div style={{ marginTop: "1rem" }}>
          <div className="ox-loader" style={{ minHeight: 80 }}>
            <div className="ox-loader__ring" />
            <span>Scanning open rooms…</span>
          </div>
        </div>
      )}
    </OxPanel>
  );
}

export function MiniHud() {
  return (
    <div className="ox-hud" aria-hidden>
      <div className="ox-hud__chip ox-hud__chip--tl">SYS · ONLINE</div>
      <div className="ox-hud__chip ox-hud__chip--tr">FPS TARGET 60</div>
    </div>
  );
}
