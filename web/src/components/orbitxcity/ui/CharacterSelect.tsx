/**
 * OrbitX City — operative select.
 *
 * Console-style roster: 6 mascots in a card grid, live 3D preview, rarity
 * framing, animated stat bars and a deploy bar. Same mesh renders in-world.
 */
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@solana/wallet-adapter-react";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import {
  CHARACTER_CLASSES,
  appearanceFromClass,
  classPowerIndex,
  getRarityMeta,
  resolveClassId,
  type CharacterClassId,
} from "@/lib/orbitxcity/characterClasses";
import { cityAudio } from "@/lib/orbitxcity/cityAudio";
import { CosmicBackdrop } from "./CosmicBackdrop";
import { CharacterPreview } from "./CharacterPreview";
import { MascotPortrait } from "./MascotPortrait";

const CLASS_FLAVOR: Record<
  CharacterClassId,
  { lore: string; perk: string; role: string }
> = {
  pepe: {
    lore: "Reads candles like a battlefield. Rarely blinks. Always early, or catastrophically late.",
    perk: "Priority lane on trading-floor terminals",
    role: "Trader",
  },
  wojak: {
    lore: "Broadcasts the feels. Turns rugs into lore and lore into markets.",
    perk: "Boosted social-feed presence aura",
    role: "Culture",
  },
  chad: {
    lore: "Jawline priced in. Every candle is a ranked match and he never looks twice.",
    perk: "Highlighted games-district markers",
    role: "Bruiser",
  },
  doge: {
    lore: "Maps unknown blocks first and still has time to stop and stare at the skyline.",
    perk: "Extended teleport reveal radius",
    role: "Scout",
  },
  anon: {
    lore: "Ships rails at 4am, never doxxes, orange-pills the room on the way out.",
    perk: "Faster mission claim cooldown at OrbitX HQ",
    role: "Operator",
  },
  vitalik: {
    lore: "Thinks in state trees. Reads a contract the way everyone else reads a chart.",
    perk: "Free contract inspect at any terminal",
    role: "Architect",
  },
};

export function CharacterSelect() {
  const { setGate, setEntered, setAvatar, avatar } = useCity();
  const { user, profile } = useAuth();
  const { connected } = useWallet();

  const [selectedId, setSelectedId] = useState<CharacterClassId>(
    resolveClassId(avatar.classId),
  );
  const [name, setName] = useState(profile?.username ?? avatar.name ?? "Traveler");
  const [visible, setVisible] = useState(false);
  const [flash, setFlash] = useState(false);

  const selected = useMemo(
    () => CHARACTER_CLASSES.find((c) => c.id === selectedId) ?? CHARACTER_CLASSES[0]!,
    [selectedId],
  );
  const flavor = CLASS_FLAVOR[selected.id];
  const rarity = getRarityMeta(selected.id);
  const power = classPowerIndex(selected.id);
  const ready = Boolean(user || connected);
  const displayName = name.trim() || selected.name;

  const cssVars = useMemo(
    () =>
      ({
        "--oxc-cs-neon": selected.neon,
        "--oxc-cs-gold": selected.gold,
        "--oxc-cs-rarity": rarity.color,
        "--oxc-cs-glow": rarity.glow,
      }) as CSSProperties,
    [selected, rarity],
  );

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      const idx = CHARACTER_CLASSES.findIndex((c) => c.id === selectedId);
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        cityAudio.play("ui");
        setSelectedId(CHARACTER_CLASSES[(idx + 1) % CHARACTER_CLASSES.length]!.id);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        cityAudio.play("ui");
        setSelectedId(
          CHARACTER_CLASSES[
            (idx - 1 + CHARACTER_CLASSES.length) % CHARACTER_CLASSES.length
          ]!.id,
        );
      } else if (e.key === "Escape") {
        setGate("menu");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, setGate]);

  const pulse = () => {
    setFlash(true);
    window.setTimeout(() => setFlash(false), 520);
  };

  const deploy = () => {
    void cityAudio.unlock();
    cityAudio.play("enter");
    setAvatar(appearanceFromClass(selected, name));
    pulse();
    window.setTimeout(() => {
      setGate("world");
      setEntered(true);
    }, 260);
  };

  const toLobbies = () => {
    cityAudio.play("confirm");
    setAvatar(appearanceFromClass(selected, name));
    window.setTimeout(() => setGate("lobbies"), 200);
  };

  return (
    <div className={`oxc-chars oxc-chars--v2 ${visible ? "is-in" : ""}`} style={cssVars}>
      <CosmicBackdrop />
      <div className={`oxc-chars-flash ${flash ? "is-on" : ""}`} aria-hidden />

      <header className="oxc-chars-top">
        <button type="button" className="oxc-chars-back" onClick={() => setGate("menu")}>
          ← Back
        </button>
        <h1 className="oxc-chars-title">Select Operative</h1>
        <span className="oxc-chars-count">
          {CHARACTER_CLASSES.length} available
        </span>
      </header>

      <div className="oxc-chars-stage">
        {/* ── Preview column ──────────────────────────────── */}
        <section className="oxc-chars-preview" aria-label="Operative preview">
          <div className="oxc-chars-podium" data-rarity={selected.rarity}>
            <CharacterPreview key={selected.id} classId={selected.id} />
            <span className="oxc-chars-ring" aria-hidden />
          </div>

          <div className="oxc-chars-nameplate">
            <span className="oxc-chars-rarity" data-rarity={selected.rarity}>
              {rarity.label}
            </span>
            <h2>{selected.name}</h2>
            <p className="oxc-chars-handle">{selected.handle}</p>
            <p className="oxc-chars-tagline">{selected.tagline}</p>
          </div>
        </section>

        {/* ── Roster grid ─────────────────────────────────── */}
        <section className="oxc-chars-roster" aria-label="Roster">
          <div className="oxc-chars-grid" role="radiogroup" aria-label="Operatives">
            {CHARACTER_CLASSES.map((cls) => {
              const r = getRarityMeta(cls.id);
              const on = cls.id === selectedId;
              return (
                <button
                  key={cls.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={`oxc-chars-card ${on ? "is-active" : ""}`}
                  data-rarity={cls.rarity}
                  style={
                    {
                      "--card-neon": cls.neon,
                      "--card-rarity": r.color,
                    } as CSSProperties
                  }
                  onClick={() => {
                    cityAudio.play("ui");
                    setSelectedId(cls.id);
                  }}
                  onDoubleClick={deploy}
                >
                  <span className="oxc-chars-portrait">
                    <MascotPortrait id={cls.id} />
                  </span>
                  <span className="oxc-chars-cardname">{cls.name}</span>
                  <span className="oxc-chars-cardrole">
                    {CLASS_FLAVOR[cls.id].role}
                  </span>
                  <span className="oxc-chars-cardrarity" data-rarity={cls.rarity}>
                    {r.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Detail panel ──────────────────────────────── */}
          <div className="oxc-chars-detail">
            <p className="oxc-chars-lore">{flavor.lore}</p>

            <ul className="oxc-chars-stats">
              {selected.stats.map((s) => (
                <li key={s.label}>
                  <span className="oxc-chars-statlabel">{s.label}</span>
                  <span className="oxc-chars-statbar">
                    <i style={{ width: `${s.value}%` }} />
                  </span>
                  <span className="oxc-chars-statval">{s.value}</span>
                </li>
              ))}
            </ul>

            <div className="oxc-chars-power">
              <span>Power index</span>
              <strong>{power}</strong>
            </div>

            <p className="oxc-chars-perk">
              <span>Perk</span>
              {flavor.perk}
            </p>
          </div>
        </section>
      </div>

      {/* ── Deploy bar ────────────────────────────────────── */}
      <footer className="oxc-chars-deploy">
        <label className="oxc-chars-namefield">
          <span>Callsign</span>
          <input
            type="text"
            value={name}
            maxLength={20}
            placeholder={selected.name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <div className="oxc-chars-actions">
          {!ready && <WalletConnectButton />}
          <button type="button" className="oxc-chars-lobby" onClick={toLobbies}>
            Browse Lobbies
          </button>
          <button type="button" className="oxc-chars-go" onClick={deploy}>
            Deploy as {displayName}
          </button>
        </div>

        <p className="oxc-chars-hint">← → to cycle · Enter to deploy · Esc to go back</p>
      </footer>
    </div>
  );
}
