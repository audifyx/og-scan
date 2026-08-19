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
import { CHARACTER_FLAVOR } from "@/lib/orbitxcity/characterFlavor";
import { cityAudio } from "@/lib/orbitxcity/cityAudio";
import { CharacterPreview } from "./CharacterPreview";
import { MascotPortrait } from "./MascotPortrait";
import { GateFrame } from "./GateFrame";

export function CharacterSelect() {
  const { setGate, setEntered, setAvatar, avatar } = useCity();
  const { user, profile } = useAuth();
  const { connected, publicKey } = useWallet();
  const [selectedId, setSelectedId] = useState<CharacterClassId>(resolveClassId(avatar.classId));
  const [name, setName] = useState(profile?.username ?? avatar.name ?? "Traveler");
  const [flash, setFlash] = useState(false);

  const selected = useMemo(
    () => CHARACTER_CLASSES.find((c) => c.id === selectedId) ?? CHARACTER_CLASSES[0]!,
    [selectedId],
  );
  const flavor = CHARACTER_FLAVOR[selected.id];
  const ready = Boolean(user || connected);
  const displayName = name.trim() || selected.name;

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
      className="oxc-chars oxc-chars--mascots is-in"
      style={
        {
          ["--pod-neon" as string]: selected.neon,
          ["--pod-gold" as string]: selected.gold,
        } as CSSProperties
      }
    >
      <GateFrame
        gate="characters"
        extra={<div className={`oxc-chars-flash ${flash ? "is-on" : ""}`} aria-hidden />}
        actions={<WalletConnectButton />}
        footer={
          <>
            <div className="oxc-chars-foot-meta">
              <span className={connected ? "is-on" : ""}>{walletLabel}</span>
              <span aria-hidden>·</span>
              <span>← → switch mascot · Enter confirm</span>
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
                <button
                  type="button"
                  className="oxc-chars-cta oxc-chars-cta--ghost"
                  onClick={() => commitAndSkipLobby(true)}
                >
                  Skip lobby
                </button>
              )}
            </div>
          </>
        }
      >
        <div className="oxc-char-layout">
          <nav className="oxc-char-gallery" role="listbox" aria-label="Crypto mascots">
            {CHARACTER_CLASSES.map((cls, i) => {
              const on = cls.id === selectedId;
              const card = CHARACTER_FLAVOR[cls.id];
              return (
                <button
                  key={cls.id}
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={`oxc-char-card ${on ? "is-on" : ""}`}
                  style={{
                    animationDelay: `${70 + i * 45}ms`,
                    ["--pod-neon" as string]: cls.neon,
                    ["--pod-gold" as string]: cls.gold,
                  }}
                  onClick={() => {
                    cityAudio.play("ui");
                    setSelectedId(cls.id);
                  }}
                >
                  <span className="oxc-char-card-fig">
                    <MascotPortrait id={cls.id} />
                  </span>
                  <span className="oxc-char-card-copy">
                    <span className="oxc-char-card-name">{cls.name}</span>
                    <span className="oxc-char-card-handle">{card.handle}</span>
                    <span className="oxc-char-card-perk">{card.perk}</span>
                    <span className="oxc-char-card-kit">
                      {card.kit.map((item) => (
                        <em key={item}>{item}</em>
                      ))}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>

          <aside className="oxc-char-dossier" aria-live="polite">
            <div className="oxc-char-dossier-fig">
              <CharacterPreview key={selected.id} classId={selected.id} />
            </div>
            <div className="oxc-char-dossier-meta">
              {flavor.badge && <span className="oxc-chars-badge">{flavor.badge}</span>}
              <p className="oxc-chars-class-label" style={{ color: selected.neon }}>
                {selected.name} · {flavor.handle}
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
                      <i
                        key={`${selected.id}-${s.label}`}
                        style={{ width: `${s.value}%`, background: selected.neon }}
                      />
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
          </aside>
        </div>
      </GateFrame>
    </div>
  );
}
