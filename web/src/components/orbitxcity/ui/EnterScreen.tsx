import { useState } from "react";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@solana/wallet-adapter-react";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { ORBITX_CITIES } from "@/lib/orbitxcity/cities";

const BODY_PRESETS = ["#1a2438", "#2a1f3d", "#1e4436", "#3d2a1e", "#1a3040", "#3a1f28"];
const SKIN_PRESETS = ["#e8d5c0", "#c9a07a", "#8d5524", "#f0d5b8", "#5c3a21", "#ffdbac"];
const ACCENT_PRESETS = ["#17ff4d", "#3de7ff", "#ff4d9a", "#f5c542", "#a78bfa", "#ff6b35"];

export function EnterScreen() {
  const { setEntered, avatar, setAvatar } = useCity();
  const { user, profile } = useAuth();
  const { connected, publicKey } = useWallet();
  const [name, setName] = useState(profile?.username ?? avatar.name);
  const [accent, setAccent] = useState(avatar.accentColor);
  const [body, setBody] = useState(avatar.bodyColor);
  const [skin, setSkin] = useState(avatar.skinColor);

  const ready = Boolean(user || connected);

  const enter = () => {
    setAvatar({
      name: name.trim() || profile?.username || "Traveler",
      accentColor: accent,
      bodyColor: body,
      skinColor: skin,
    });
    setEntered(true);
  };

  return (
    <div className="oxc-enter">
      <div className="oxc-enter-bg" aria-hidden />
      <div className="oxc-enter-card">
        <div className="oxc-kicker">OrbitX World · Phase 1</div>
        <h1 className="oxc-brand">
          OrbitX<span>City</span>
        </h1>
        <p className="oxc-lead">
          Enter a persistent crypto-native city. Walk districts, meet traders, buy real tokens from billboards, and talk
          on voice — all linked to your OrbitX wallet.
        </p>

        <div className="oxc-city-rail">
          {ORBITX_CITIES.map((c) => (
            <div key={c.id} className="oxc-city-chip live" style={{ ["--chip" as string]: c.accent }}>
              <span>{c.name}</span>
              <small>LIVE</small>
            </div>
          ))}
        </div>

        <div className="oxc-creator">
          <div className="oxc-avatar-stage" style={{ background: `radial-gradient(circle at 50% 30%, ${accent}33, transparent 60%), #0a101c` }}>
            <div className="oxc-avatar-preview-3d">
              <div className="oxc-av-head" style={{ background: skin }} />
              <div className="oxc-av-visor" style={{ background: accent }} />
              <div className="oxc-av-body" style={{ background: body, boxShadow: `0 0 24px ${accent}55` }} />
              <div className="oxc-av-pack" style={{ background: accent }} />
            </div>
            <div className="oxc-av-name">@{name || "traveler"}</div>
          </div>

          <div className="oxc-creator-fields">
            <label>
              Avatar name
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Traveler" />
            </label>

            <div className="oxc-swatch-block">
              <span>Body</span>
              <div className="oxc-swatches">
                {BODY_PRESETS.map((c) => (
                  <button key={c} type="button" className={body === c ? "on" : ""} style={{ background: c }} onClick={() => setBody(c)} aria-label={c} />
                ))}
                <input type="color" value={body} onChange={(e) => setBody(e.target.value)} />
              </div>
            </div>

            <div className="oxc-swatch-block">
              <span>Skin</span>
              <div className="oxc-swatches">
                {SKIN_PRESETS.map((c) => (
                  <button key={c} type="button" className={skin === c ? "on" : ""} style={{ background: c }} onClick={() => setSkin(c)} aria-label={c} />
                ))}
                <input type="color" value={skin} onChange={(e) => setSkin(e.target.value)} />
              </div>
            </div>

            <div className="oxc-swatch-block">
              <span>Neon accent</span>
              <div className="oxc-swatches">
                {ACCENT_PRESETS.map((c) => (
                  <button key={c} type="button" className={accent === c ? "on" : ""} style={{ background: c }} onClick={() => setAccent(c)} aria-label={c} />
                ))}
                <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} />
              </div>
            </div>
          </div>
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
          <span>WASD · E · Shift sprint · Space jump · Enter chat</span>
        </div>
      </div>
    </div>
  );
}
