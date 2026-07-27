/**
 * OrbitX City — Character Selection (holographic recruitment chamber).
 * Wallet at top · operative pods · live dossier preview · Start at bottom.
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
  type CharacterClassId,
} from "@/lib/orbitxcity/characterClasses";
import { cityAudio } from "@/lib/orbitxcity/cityAudio";
import { CosmicBackdrop } from "./CosmicBackdrop";
import { CharactersSystemExtras } from "./CitySystemPanels";
import { FEATURES_PER_SYSTEM } from "@/lib/orbitxcity/cityFeatureCatalog";

const CLASS_FLAVOR: Record<
  CharacterClassId,
  { lore: string; perk: string; synergy: string; badge?: string }
> = {
  trader: {
    lore: "Reads tape like a battlefield. Prefers clean entries, hard exits, and no mercy for late bags.",
    perk: "Perk · Priority lane on trading-floor terminals",
    synergy: "Class Synergy · DEX desks + live screener walls amplify Instinct.",
  },
  builder: {
    lore: "Architect of rails and rituals. Turns Midtown infrastructure into leverage.",
    perk: "Perk · Faster mission claim cooldown at OrbitX HQ",
    synergy: "Class Synergy · HQ command floor + builder pods stack Focus.",
  },
  gamer: {
    lore: "Born for heat checks. Treats every candle and every round as a ranked match.",
    perk: "Perk · Highlighted games-district markers",
    synergy: "Class Synergy · Arenas + launch stages spike Reflex under pressure.",
    badge: "Recommended for degens",
  },
  creator: {
    lore: "Broadcasts the culture layer. Memes become markets when Creators walk the boulevard.",
    perk: "Perk · Boosted social-feed presence aura",
    synergy: "Class Synergy · Community lounges + neon clubs feed Reach.",
  },
  explorer: {
    lore: "Maps the unknown districts first. Always two blocks ahead of the crowd.",
    perk: "Perk · Extended teleport reveal radius",
    synergy: "Class Synergy · Frontier routes pair with launchpad discovery.",
    badge: "Wallet compatible",
  },
};

function outfitFor(cls: CharacterClassDef) {
  return cls.id === "trader" ? "suit" : cls.id === "gamer" ? "sport" : cls.id === "creator" ? "neon" : "street";
}

function HoloAvatar({
  cls,
  selected,
  size = "md",
}: {
  cls: CharacterClassDef;
  selected: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const outfit = outfitFor(cls);
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
      <div className="oxc-pod-energy" />
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

function StatRadar({ cls }: { cls: CharacterClassDef }) {
  const cx = 74;
  const cy = 74;
  const r = 52;
  const pts = cls.stats.map((s, i) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / cls.stats.length;
    const rr = r * (s.value / 100);
    return `${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`;
  });
  const grids = [0.35, 0.65, 1].map((t) =>
    cls.stats
      .map((_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / cls.stats.length;
        return `${cx + Math.cos(a) * r * t},${cy + Math.sin(a) * r * t}`;
      })
      .join(" "),
  );

  return (
    <svg className="oxc-chars-radar" viewBox="0 0 148 148" aria-hidden>
      {grids.map((ring) => (
        <polygon key={ring} points={ring} fill="none" stroke="rgba(255,255,255,0.08)" />
      ))}
      {cls.stats.map((s, i) => {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / cls.stats.length;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        const lx = cx + Math.cos(a) * (r + 14);
        const ly = cy + Math.sin(a) * (r + 14);
        return (
          <g key={s.label}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.08)" />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fill="rgba(210,220,215,0.55)" fontSize="8">
              {s.label}
            </text>
          </g>
        );
      })}
      <polygon points={pts.join(" ")} fill={`${cls.neon}33`} stroke={cls.neon} strokeWidth="1.5" />
    </svg>
  );
}

export function CharacterSelect() {
  const { setGate, setEntered, setAvatar, avatar } = useCity();
  const { user, profile } = useAuth();
  const { connected, publicKey } = useWallet();
  const [selectedId, setSelectedId] = useState<CharacterClassId>(avatar.classId ?? "trader");
  const [name, setName] = useState(profile?.username ?? avatar.name ?? "Traveler");
  const [visible, setVisible] = useState(false);
  const [flash, setFlash] = useState(false);

  const selected = useMemo(
    () => CHARACTER_CLASSES.find((c) => c.id === selectedId) ?? CHARACTER_CLASSES[0]!,
    [selectedId],
  );
  const flavor = CLASS_FLAVOR[selected.id];

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  const ready = Boolean(user || connected);

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

  const randomize = () => {
    const pick = CHARACTER_CLASSES[Math.floor(Math.random() * CHARACTER_CLASSES.length)]!;
    cityAudio.play("ui");
    setSelectedId(pick.id);
  };

  const walletLabel =
    connected && publicKey
      ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)} · ready`
      : "Wallet offline";

  const displayName = name.trim() || "Traveler";

  return (
    <div className={`oxc-chars ${visible ? "is-in" : ""}`} style={{ ["--pod-neon" as string]: selected.neon }}>
      <CosmicBackdrop variant="chamber" />
      <div className={`oxc-chars-flash ${flash ? "is-on" : ""}`} aria-hidden />

      <header className="oxc-chars-top">
        <div className="oxc-chars-top-row">
          <button type="button" className="oxc-chars-back" onClick={() => setGate("menu")}>
            ← Menu
          </button>
          <div className="oxc-chars-wallet-slot">
            <WalletConnectButton />
          </div>
        </div>
        <p className="oxc-chars-kicker">Holographic Recruitment Chamber</p>
        <h1 className="oxc-chars-title">
          ORBIT<span className="oxc-chars-title-x">X</span> CITY
        </h1>
        <p className="oxc-chars-sub">Select your operative · {FEATURES_PER_SYSTEM} character systems</p>
        <p className={`oxc-chars-wallet-status ${connected ? "is-on" : ""}`}>{walletLabel}</p>
      </header>

      <div className="oxc-chars-body">
        <section className="oxc-chars-rail-wrap">
          <div className="oxc-pod-rail" role="listbox" aria-label="Character classes">
            {CHARACTER_CLASSES.map((cls, i) => {
              const on = cls.id === selectedId;
              const badge = CLASS_FLAVOR[cls.id].badge;
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
                  {badge && <span className="oxc-pod-badge">{badge}</span>}
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
          <div className="oxc-chars-tools">
            <button type="button" className="oxc-btn ghost oxc-chars-random" onClick={randomize}>
              Randomize Operative
            </button>
          </div>
        </section>

        <aside className="oxc-chars-preview glass" aria-live="polite">
          <div className="oxc-chars-dossier">
            <div className="oxc-chars-preview-fig">
              <HoloAvatar cls={selected} selected size="lg" />
            </div>
            <div className="oxc-chars-preview-meta">
              <p className="oxc-chars-dossier-kicker">Operative dossier</p>
              <h2 style={{ color: selected.neon }}>{displayName}</h2>
              <p>
                <b style={{ color: selected.neon }}>{selected.name}</b>
                <span className="oxc-chars-gold"> · {selected.tagline}</span>
              </p>
              {flavor.badge && <span className="oxc-chars-badge">{flavor.badge}</span>}
              <p className="oxc-chars-lore">{flavor.lore}</p>
              <p className="oxc-chars-perk" style={{ color: selected.neon }}>
                {flavor.perk}
              </p>
              <p className="oxc-chars-synergy">{flavor.synergy}</p>
              <label>
                Callsign
                <input
                  value={name}
                  maxLength={24}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Traveler"
                />
              </label>
            </div>
          </div>
          <div className="oxc-chars-stats-grid">
            <ul className="oxc-pod-stats oxc-chars-stats-full">
              {selected.stats.map((s) => (
                <li key={s.label}>
                  <span>{s.label}</span>
                  <div className="oxc-pod-bar">
                    <i key={`${selected.id}-${s.label}`} style={{ width: `${s.value}%` }} />
                  </div>
                  <em>{s.value}</em>
                </li>
              ))}
            </ul>
            <StatRadar cls={selected} />
          </div>
        </aside>
      </div>

      <details className="oxc-chars-catalog glass">
        <summary>{FEATURES_PER_SYSTEM} character capabilities</summary>
        <CharactersSystemExtras />
      </details>

      <footer className="oxc-chars-foot">
        <button
          type="button"
          className="oxc-btn primary oxc-chars-enter"
          onClick={() => commitAndEnter(false)}
          disabled={!ready}
        >
          {ready ? "Enter OrbitX City → Lobbies" : "Connect wallet to start"}
        </button>
        <button type="button" className="oxc-btn ghost oxc-chars-demo" onClick={() => commitAndSkipLobby(true)}>
          Quick Demo Mode
        </button>
        <p className="oxc-chars-powered">Powered by OrbitX · holographic chamber v2</p>
      </footer>
    </div>
  );
}
