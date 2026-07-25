import { useState } from "react";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@solana/wallet-adapter-react";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { ORBITX_CITIES } from "@/lib/orbitxcity/cities";

export function EnterScreen() {
  const { setEntered, avatar, setAvatar } = useCity();
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
    setEntered(true);
  };

  return (
    <div className="oxc-enter">
      <div className="oxc-enter-bg" aria-hidden />
      <div className="oxc-enter-card">
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

        <div className="oxc-enter-meta">
          <span>{connected && publicKey ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}` : "Wallet offline"}</span>
          <span>WASD move · E interact · Esc close panels</span>
        </div>
      </div>
    </div>
  );
}
