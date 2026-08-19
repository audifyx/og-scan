/**
 * OrbitX City — pick a crypto-native mascot. Same mesh is used in the world.
 */
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@solana/wallet-adapter-react";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import {
  CHARACTER_CLASSES,
  appearanceFromClass,
  resolveClassId,
  type CharacterClassId,
} from "@/lib/orbitxcity/characterClasses";
import { cityAudio } from "@/lib/orbitxcity/cityAudio";
import { MenuBackdrop } from "./MenuBackdrop";
import { CharacterPreview } from "./CharacterPreview";
import { MascotPortrait } from "./MascotPortrait";

const CLASS_FLAVOR: Record<CharacterClassId, { lore: string; perk: string; badge?: string }> = {
  pepe: {
    lore: "The frog reads candles like a battlefield. Rarely blinks. Always early or catastrophically late.",
    perk: "Priority lane on trading-floor terminals",
    badge: "Degen",
  },
  wojak: {
    lore: "Broadcasts the feels. Turns rugs into lore and lore into markets.",
    perk: "Boosted social-feed presence aura",
  },
  chad: {
    lore: "Jawline priced in. Every candle is a ranked match and he never looks at the chart twice.",
    perk: "Highlighted games-district markers",
    badge: "Aura",
  },
  doge: {
    lore: "Much explore. Very district. Maps unknown blocks first and still has time for wow.",
    perk: "Extended teleport reveal radius",
  },
  anon: {
    lore: "Laser-eyed maxi. Ships rails, never doxxes, orange-pills the room.",
    perk: "Faster mission claim cooldown at OrbitX HQ",
  },
};

export function CharacterSelect() {
  const { setGate, setEntered, setAvatar, avatar, selectedCityId } = useCity();
  const { user, profile } = useAuth();
  const { connected, publicKey } = useWallet();
  const [selectedId, setSelectedId] = useState<CharacterClassId>(resolveClassId(avatar.classId));
  const [name, setName] = useState(profile?.username ?? avatar.name ?? "Traveler");
  const [visible, setVisible] = useState(false);
  const [flash, setFlash] = useState(false);

  const selected = useMemo(
    () => CHARACTER_CLASSES.find((c) => c.id === selectedId) ?? CHARACTER_CLASSES[0]!,
    [selectedId],
  );
  const flavor = CLASS_FLAVOR[selected.id];
  const ready = Boolean(user || connected);
  const displayName = name.trim() || selected.name;

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const idx = CHARACTER_CLASSES.findIndex((c) => c.id === selectedId);
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = CHARACTER_CLASSES[(idx + 1) % CHARACTER_CLASSES.length]!;
        cityAudio.play("ui");
        setSelectedId(next.id);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = CHARACTER_CLASSES[(idx - 1 + CHARACTER_CLASSES.length) % CHARACTER_CLASSES.length]!;
        cityAudio.play("ui");
        setSelectedId(prev.id);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (ready) commitAndEnter(false);
        else commitAndSkipLobby(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, ready, name, selected]);

  const playEnterFlash = () => {
    setFlash(true);
    window.setTimeout(() => setFlash(false), 700);
  };

  const commitAndEnter = (forceDemo = false) => {
    setAvatar(appearanceFromClass(selected, name));
    if (!forceDemo && !ready) {
      cityAudio.play("deny");
      return;
    }
    cityAudio.play("confirm");
    playEnterFlash();
    window.setTimeout(() => setGate("lobbies"), 220);
  };

  const commitAndSkipLobby = (forceDemo = false) => {
    setAvatar(appearanceFromClass(selected, name));
    if (!forceDemo && !ready) {
      cityAudio.play("deny");
      return;
    }
    cityAudio.play("enter");
    playEnterFlash();
    window.setTimeout(() => {
      setGate("world");
      setEntered(true);
    }, 220);
  };

  const walletLabel =
    connected && publicKey
      ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`
      : "Wallet offline";

  return (
    <div
      className={`oxc-chars oxc-chars--mascots ${visible ? "is-in" : ""}`}
      style={
        {
          ["--pod-neon" as string]: selected.neon,
          ["--pod-gold" as string]: selected.gold,
        } as CSSProperties
      }
    >
      <MenuBackdrop cityId={selectedCityId} intensity="chamber" />
      <div className={`oxc-chars-flash ${flash ? "is-on" : ""}`} aria-hidden />

      <header className="oxc-chars-bar">
        <button type="button" className="oxc-chars-back" onClick={() => setGate("menu")}>
          ← Menu
        </button>
        <div className="oxc-chars-bar-center">
          <p className="oxc-chars-kicker">Crypto native</p>
          <h1 className="oxc-chars-title">
            SELECT <span className="oxc-chars-title-x">OPERATIVE</span>
          </h1>
        </div>
        <div className="oxc-chars-wallet-slot">
          <WalletConnectButton />
        </div>
      </header>

      <div className="oxc-chars-stage">
        <section className="oxc-chars-hero" aria-live="polite">
          <div className="oxc-chars-hero-fig">
            <CharacterPreview key={selected.id} classId={selected.id} />
          </div>
          <div className="oxc-chars-hero-meta">
            {flavor.badge && <span className="oxc-chars-badge">{flavor.badge}</span>}
            <p className="oxc-chars-class-label" style={{ color: selected.neon }}>
              {selected.name}
            </p>
            <h2 className="oxc-chars-callsign">{displayName}</h2>
            <p className="oxc-chars-tagline">{selected.tagline}</p>
            <p className="oxc-chars-lore">{flavor.lore}</p>
            <p className="oxc-chars-perk" style={{ color: selected.neon }}>
              Perk · {flavor.perk}
            </p>
            <ul className="oxc-chars-statrow">
              {selected.stats.map((s) => (
                <li key={s.label}>
                  <span>{s.label}</span>
                  <div className="oxc-pod-bar">
                    <i key={`${selected.id}-${s.label}`} style={{ width: `${s.value}%`, background: selected.neon }} />
                  </div>
                  <em>{s.value}</em>
                </li>
              ))}
            </ul>
            <label className="oxc-chars-namefield">
              Callsign
              <input
                value={name}
                maxLength={24}
                onChange={(e) => setName(e.target.value)}
                placeholder={selected.name}
                autoComplete="nickname"
              />
            </label>
          </div>
        </section>

        <nav className="oxc-chars-strip" role="listbox" aria-label="Crypto operatives">
          {CHARACTER_CLASSES.map((cls, i) => {
            const on = cls.id === selectedId;
            return (
              <button
                key={cls.id}
                type="button"
                role="option"
                aria-selected={on}
                className={`oxc-chars-chip ${on ? "is-on" : ""}`}
                style={{
                  animationDelay: `${70 + i * 45}ms`,
                  ["--pod-neon" as string]: cls.neon,
                }}
                onClick={() => {
                  cityAudio.play("ui");
                  setSelectedId(cls.id);
                }}
              >
                <span className="oxc-chars-chip-fig">
                  <MascotPortrait id={cls.id} />
                </span>
                <span className="oxc-chars-chip-name">{cls.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <footer className="oxc-chars-foot">
        <div className="oxc-chars-foot-meta">
          <span className={connected ? "is-on" : ""}>{walletLabel}</span>
          <span aria-hidden>·</span>
          <span>← → switch operative · Enter confirm</span>
        </div>
        <div className={`oxc-chars-actions ${ready ? "has-secondary" : ""}`}>
          <button
            type="button"
            className="oxc-chars-cta oxc-chars-cta--primary"
            onClick={() => (ready ? commitAndEnter(false) : commitAndSkipLobby(true))}
          >
            {ready ? "Continue → Multiplayer" : "Enter City"}
          </button>
          {ready && (
            <button type="button" className="oxc-chars-cta oxc-chars-cta--ghost" onClick={() => commitAndSkipLobby(true)}>
              Skip lobby
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
