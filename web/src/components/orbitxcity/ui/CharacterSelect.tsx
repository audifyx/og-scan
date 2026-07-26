/**
 * OrbitX City — Character Selection (AAA holographic pods).
 * Five class pods in a chamber layout: Trader · Builder · Gamer · Creator · Explorer.
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
import { CosmicBackdrop } from "./CosmicBackdrop";

function HoloAvatar({ cls, selected }: { cls: CharacterClassDef; selected: boolean }) {
  const outfit =
    cls.id === "trader" ? "suit" : cls.id === "gamer" ? "sport" : cls.id === "creator" ? "neon" : "street";
  return (
    <div
      className={`oxc-pod-avatar oxc-pod-${cls.id} oxc-pod-outfit-${outfit} ${selected ? "is-selected" : ""}`}
      style={{
        ["--pod-neon" as string]: cls.neon,
        ["--pod-gold" as string]: cls.gold,
        ["--pod-body" as string]: cls.bodyColor,
        ["--pod-skin" as string]: cls.skinColor,
        ["--pod-accent" as string]: cls.accentColor,
      }}
    >
      <div className="oxc-pod-beam" />
      <div className="oxc-pod-halo" />
      <div className="oxc-pod-figure">
        <div className="oxc-pod-head" />
        <div className="oxc-pod-hair" data-style={cls.id} />
        <div className="oxc-pod-visor" />
        <div className="oxc-pod-torso" />
        <div className="oxc-pod-detail" />
        <div className="oxc-pod-legs">
          <span />
          <span />
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
    if (!forceDemo && !ready) return;
    // Route through lobbies so voice/lobby join actually happens before world
    setGate("lobbies");
  };

  const commitAndSkipLobby = (forceDemo = false) => {
    setAvatar(appearanceFromClass(selected, name));
    if (!forceDemo && !ready) return;
    setGate("world");
    setEntered(true);
  };

  return (
    <div className={`oxc-chars ${visible ? "is-in" : ""}`}>
      <CosmicBackdrop variant="chamber" />

      <header className="oxc-chars-head">
        <button type="button" className="oxc-chars-back" onClick={() => setGate("menu")}>
          ← Menu
        </button>
        <h1 className="oxc-chars-title">
          ORBIT<span className="oxc-chars-title-x">X</span> CITY
        </h1>
        <p className="oxc-chars-sub">Select your operative · holographic chamber</p>
      </header>

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
                animationDelay: `${100 + i * 70}ms`,
                ["--pod-neon" as string]: cls.neon,
                ["--pod-gold" as string]: cls.gold,
              }}
              onClick={() => setSelectedId(cls.id)}
            >
              <span className="oxc-pod-class">{cls.name}</span>
              <HoloAvatar cls={cls} selected={on} />
              <div className="oxc-pod-card">
                <div className="oxc-pod-card-top">
                  <strong>{cls.name}</strong>
                  <small>{cls.tagline}</small>
                </div>
                <ul className="oxc-pod-stats">
                  {cls.stats.map((s) => (
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

      <aside className="oxc-chars-dock">
        <div className="oxc-chars-preview glass">
          <div className="oxc-chars-preview-fig">
            <HoloAvatar cls={selected} selected />
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
        </div>

        <div className="oxc-chars-actions">
          <WalletConnectButton />
          <button
            type="button"
            className="oxc-btn primary oxc-chars-enter"
            onClick={() => commitAndEnter(false)}
            disabled={!ready}
          >
            {ready ? "Continue to lobbies" : "Connect wallet to continue"}
          </button>
          <button type="button" className="oxc-btn ghost" onClick={() => commitAndSkipLobby(true)}>
            Skip lobbies · enter demo
          </button>
        </div>

        <div className="oxc-chars-wallet">
          {connected && publicKey
            ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`
            : "Wallet offline"}
        </div>
      </aside>
    </div>
  );
}
