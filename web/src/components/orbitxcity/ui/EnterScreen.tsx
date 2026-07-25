import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@solana/wallet-adapter-react";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { ORBITX_CITIES } from "@/lib/orbitxcity/cities";
import { citySound } from "@/lib/orbitxcity/sound";

export function EnterScreen() {
  const { setEntered, avatar, setAvatar, soundEnabled, toggleSound } = useCity();
  const { user, profile } = useAuth();
  const { connected, publicKey } = useWallet();
  const [name, setName] = useState(profile?.username ?? avatar.name);
  const [accent, setAccent] = useState(avatar.accentColor);

  const ready = Boolean(user || connected);

  const enter = () => {
    setAvatar({
      ...avatar,
      name: name.trim() || profile?.username || "Traveler",
      accentColor: accent,
    });
    citySound.play("enter");
    citySound.startAmbient();
    setEntered(true);
  };

  return (
    <div className="oxc-enter">
      <div className="oxc-enter-bg" aria-hidden />
      <div className="oxc-enter-card">
        <button
          type="button"
          className="oxc-sound-toggle"
          onClick={toggleSound}
          aria-label={soundEnabled ? "Mute sound" : "Enable sound"}
          title={soundEnabled ? "Sound on" : "Sound off"}
        >
          {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
        <div className="oxc-kicker">OrbitX World · Milestone 1</div>
        <h1 className="oxc-brand">
          OrbitX<span>City</span>
        </h1>
        <p className="oxc-lead">
          Spawn into a persistent crypto-native city. Walk districts, meet the market, and trade with your real wallet —
          not fake loot.
        </p>

        <div className="oxc-city-rail">
          {ORBITX_CITIES.map((c) => (
            <div key={c.id} className={`oxc-city-chip ${c.unlocked ? "live" : "locked"}`} style={{ ["--chip" as string]: c.accent }}>
              <span>{c.name}</span>
              <small>{c.unlocked ? "LIVE DEMO" : "SOON"}</small>
            </div>
          ))}
        </div>

        <div className="oxc-enter-row">
          <label>
            Avatar name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              placeholder="Traveler"
            />
          </label>
          <label>
            Neon accent
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} />
          </label>
        </div>

        <div className="oxc-enter-actions">
          <WalletConnectButton />
          <button type="button" className="oxc-btn primary" onClick={enter} disabled={!ready}>
            {ready ? "Enter OrbitX NYC" : "Connect wallet to enter"}
          </button>
          <button type="button" className="oxc-btn ghost" onClick={enter}>
            Explore demo
          </button>
        </div>

        <div className="oxc-controls">
          <span><b>WASD</b> move</span>
          <span><b>Shift</b> sprint</span>
          <span><b>Drag</b> look</span>
          <span><b>E</b> interact</span>
          <span><b>Esc</b> close</span>
        </div>

        <div className="oxc-enter-meta">
          <span>{connected && publicKey ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}` : "Wallet offline"}</span>
          <span>Collect all 10 $OBX shards hidden in the block</span>
        </div>
      </div>
    </div>
  );
}
