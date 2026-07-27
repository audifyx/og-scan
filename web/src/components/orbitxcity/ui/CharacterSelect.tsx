/**
 * OrbitX City — Character Selection (holographic chamber).
 * Wallet at top · operative pods · Start pinned at bottom. Mobile-first.
 */
import { useEffect, useMemo, useState } from "react";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@solana/wallet-adapter-react";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import {
  CHARACTER_CLASSES,
  appearanceFromClass,
  type CharacterClassDef,
} from "@/lib/orbitxcity/characterClasses";
import { cityAudio } from "@/lib/orbitxcity/cityAudio";
import { CosmicBackdrop } from "./CosmicBackdrop";

function HoloAvatar({ cls, selected, size = "md" }: { cls: CharacterClassDef; selected: boolean; size?: "sm" | "md" | "lg" }) {
  const outfit =
    cls.id === "trader" ? "suit" : cls.id === "gamer" ? "sport" : cls.id === "creator" ? "neon" : "street";
  return (
    <div
      className={`oxc-pod-avatar oxc-pod-${cls.id} oxc-pod-outfit-${outfit} oxc-pod-size-${size} ${selected ? "is-selected" : ""}`}
      style={{
        ["--pod-neon" as string]: cls.neon,
        ["--pod-gold" as string]: cls.gold,
        ["--pod-body" as string]: cls.bodyColor,
        ["--pod-skin" as string]: cls.skinColor,
        ["--pod-accent" as string]: cls.accentColor,
      }}
      aria-hidden
    >
      <div className="oxc-pod-beam" />
      <div className="oxc-pod-halo" />
      <div className="oxc-pod-figure">
        <div className="oxc-pod-hair" data-style={cls.id} />
        <div className="oxc-pod-head">
          <span className="oxc-pod-eye" />
          <span className="oxc-pod-eye" />
          <span className="oxc-pod-visor" />
        </div>
        <div className="oxc-pod-torso">
          <span className="oxc-pod-arm left" />
          <span className="oxc-pod-arm right" />
          <span className="oxc-pod-detail" />
        </div>
        <div className="oxc-pod-legs">
          <span />
          <span />
        </div>
        <div className="oxc-pod-shoes">
          <i />
          <i />
        </div>
      </div>
      <div className="oxc-pod-ring" />
    </div>
  );
}

export function CharacterSelect() {
  const { setGate, setEntered, setAvatar, avatar } = useCity();
  const { user, profile } = useAuth();
  const { connected, publicKey } = useWallet();
  const [selectedId, setSelectedId] = useState(avatar.classId ?? "trader");
  const [name, setName] = useState(profile?.username ?? avatar.name ?? "Traveler");
  const [visible, setVisible] = useState(false);

  const selected = useMemo(
    () => CHARACTER_CLASSES.find((c) => c.id === selectedId) ?? CHARACTER_CLASSES[0]!,
    [selectedId],
  );

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const ready = Boolean(user || connected);

  const commitAndEnter = (forceDemo = false) => {
    setAvatar(appearanceFromClass(selected, name));
    if (!forceDemo && !ready) {
      cityAudio.play("deny");
      return;
    }
    cityAudio.play("confirm");
    setGate("lobbies");
  };

  const commitAndSkipLobby = (forceDemo = false) => {
    setAvatar(appearanceFromClass(selected, name));
    if (!forceDemo && !ready) {
      cityAudio.play("deny");
      return;
    }
    cityAudio.play("enter");
    setGate("world");
    setEntered(true);
  };

  const walletLabel =
    connected && publicKey
      ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`
      : "Wallet offline";

  return (
    <div className={`oxc-chars ${visible ? "is-in" : ""}`}>
      <CosmicBackdrop variant="chamber" />

      <header className="oxc-chars-top">
        <div className="oxc-chars-top-row">
          <button type="button" className="oxc-chars-back" onClick={() => setGate("menu")}>
            ← Menu
          </button>
          <div className="oxc-chars-wallet-slot">
            <WalletConnectButton />
          </div>
        </div>
        <h1 className="oxc-chars-title">
          ORBIT<span className="oxc-chars-title-x">X</span> CITY
        </h1>
        <p className="oxc-chars-sub">Select your operative · holographic chamber</p>
        <p className={`oxc-chars-wallet-status ${connected ? "is-on" : ""}`}>{walletLabel}</p>
      </header>

      <div className="oxc-chars-body">
        <div className="oxc-pod-rail" role="listbox" aria-label="Character classes">
          {CHARACTER_CLASSES.map((cls, i) => {
            const on = cls.id === selectedId;
            return (
              <button
                key={cls.id}
                type="button"
                role="option"
                aria-selected={on}
                className={`oxc-pod ${on ? "is-on" : ""}`}
                style={{
                  animationDelay: `${80 + i * 60}ms`,
                  ["--pod-neon" as string]: cls.neon,
                  ["--pod-gold" as string]: cls.gold,
                }}
                onClick={() => {
                  cityAudio.play("ui");
                  setSelectedId(cls.id);
                }}
              >
                <HoloAvatar cls={cls} selected={on} size="md" />
                <div className="oxc-pod-card">
                  <strong>{cls.name}</strong>
                  <small>{cls.tagline}</small>
                  <ul className="oxc-pod-stats">
                    {cls.stats.slice(0, 3).map((s) => (
                      <li key={s.label}>
                        <span>{s.label}</span>
                        <div className="oxc-pod-bar">
                          <i style={{ width: `${s.value}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </button>
            );
          })}
        </div>

        <aside className="oxc-chars-preview glass">
          <div className="oxc-chars-preview-fig">
            <HoloAvatar cls={selected} selected size="lg" />
          </div>
          <div className="oxc-chars-preview-meta">
            <label>
              Callsign
              <input
                value={name}
                maxLength={24}
                onChange={(e) => setName(e.target.value)}
                placeholder="Traveler"
              />
            </label>
            <p>
              Class <b style={{ color: selected.neon }}>{selected.name}</b>
              <span className="oxc-chars-gold"> · gold-tier frame</span>
            </p>
          </div>
        </aside>
      </div>

      <footer className="oxc-chars-foot">
        <button
          type="button"
          className="oxc-btn primary oxc-chars-enter"
          onClick={() => commitAndEnter(false)}
          disabled={!ready}
        >
          {ready ? "Start · continue to lobbies" : "Connect wallet to start"}
        </button>
        <button type="button" className="oxc-btn ghost oxc-chars-demo" onClick={() => commitAndSkipLobby(true)}>
          Skip lobbies · enter demo
        </button>
      </footer>
    </div>
  );
}
