import { useEffect, useState } from "react";
import logo from "@/assets/logo.png";

interface SplashScreenProps {
  onComplete: () => void;
}

const PLATFORM_FRAMES = [
  { src: "/bg/bg-nebula.jpg", label: "OG DEX", accent: "#2F80FF" },
  { src: "/bg/bg-galaxy.jpg", label: "Scanner", accent: "#14E0C8" },
  { src: "/bg/bg-aurora.jpg", label: "Social", accent: "#9945FF" },
  { src: "/bg/bg-earth.jpg", label: "Intelligence", accent: "#FFC53D" },
] as const;

type Phase = "flash" | "reveal" | "orbit" | "lock" | "brand" | "warp" | "exit";

export const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [phase, setPhase] = useState<Phase>("flash");
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase("reveal"), 120),
      setTimeout(() => setPhase("orbit"), 900),
      setTimeout(() => setPhase("lock"), 2100),
      setTimeout(() => setPhase("brand"), 2900),
      setTimeout(() => setPhase("warp"), 3800),
      setTimeout(() => setPhase("exit"), 4300),
      setTimeout(onComplete, 4800),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  useEffect(() => {
    if (phase !== "orbit" && phase !== "lock") return;
    const interval = setInterval(() => {
      setFrameIndex((i) => (i + 1) % PLATFORM_FRAMES.length);
    }, 520);
    return () => clearInterval(interval);
  }, [phase]);

  const active = PLATFORM_FRAMES[frameIndex];
  const showOrbit = phase === "orbit" || phase === "lock" || phase === "brand";
  const showBrand = phase === "brand" || phase === "warp" || phase === "exit";
  const exiting = phase === "exit";

  return (
    <div
      className={`splash-root fixed inset-0 z-[200] overflow-hidden bg-[#030408] ${exiting ? "splash-exit" : ""}`}
      aria-label="Loading Sol Tools"
    >
      <style>{splashCss}</style>

      {/* Cinematic background layers */}
      <div className="absolute inset-0">
        {PLATFORM_FRAMES.map((frame, i) => (
          <div
            key={frame.src}
            className={`splash-bg-layer absolute inset-0 bg-cover bg-center transition-opacity duration-700 ${
              i === frameIndex && (phase === "reveal" || showOrbit) ? "opacity-100" : "opacity-0"
            }`}
            style={{ backgroundImage: `url(${frame.src})` }}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-b from-[#030408]/40 via-[#030408]/75 to-[#030408]" />
        <div className="splash-vignette absolute inset-0" />
      </div>

      {/* Ambient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="splash-orb splash-orb-a" />
        <div className="splash-orb splash-orb-b" />
        <div className="splash-orb splash-orb-c" />
      </div>

      {/* Scan lines + noise */}
      <div className="splash-scanlines absolute inset-0 pointer-events-none" />
      <div className="splash-noise absolute inset-0 pointer-events-none" />

      {/* Particle burst */}
      <div className={`splash-particles absolute inset-0 pointer-events-none ${phase === "flash" ? "splash-particles-burst" : ""}`}>
        {Array.from({ length: 24 }).map((_, i) => (
          <span key={i} className="splash-particle" style={{ ["--i" as string]: i }} />
        ))}
      </div>

      {/* Orbiting platform previews */}
      <div className={`splash-orbit-stage absolute inset-0 flex items-center justify-center ${showOrbit ? "splash-orbit-on" : ""}`}>
        {PLATFORM_FRAMES.map((frame, i) => (
          <div
            key={frame.label}
            className={`splash-orbit-card ${i === frameIndex ? "is-active" : ""}`}
            style={{
              ["--angle" as string]: `${i * (360 / PLATFORM_FRAMES.length)}deg`,
              ["--accent" as string]: frame.accent,
            }}
          >
            <div className="splash-orbit-frame">
              <img src={frame.src} alt="" className="splash-orbit-img" draggable={false} />
              <div className="splash-orbit-chrome">
                <span className="splash-orbit-dot" style={{ background: frame.accent }} />
                <span className="splash-orbit-label">{frame.label}</span>
              </div>
              <div className="splash-orbit-shimmer" />
            </div>
          </div>
        ))}
      </div>

      {/* Center logo lock-in */}
      <div className={`splash-center absolute inset-0 flex flex-col items-center justify-center ${phase === "lock" || showBrand ? "splash-center-on" : ""}`}>
        <div className={`splash-logo-wrap ${phase === "lock" ? "splash-logo-snap" : ""} ${showBrand ? "splash-logo-settled" : ""}`}>
          <div className="splash-logo-ring splash-logo-ring-1" />
          <div className="splash-logo-ring splash-logo-ring-2" />
          <div className="splash-logo-core">
            <img src={logo} alt="Sol Tools" className="splash-logo-img" draggable={false} />
          </div>
          <div className="splash-logo-pulse" />
        </div>

        <div className={`splash-brand mt-8 text-center ${showBrand ? "splash-brand-on" : ""}`}>
          <h1 className="splash-title font-display text-3xl font-bold tracking-[0.18em] text-foreground" data-text="SOL TOOLS">
            SOL TOOLS
          </h1>
          <p className="splash-sub mt-3 text-[10px] font-mono tracking-[0.45em] text-primary/80 uppercase">
            Pro Trading Suite
          </p>
          <div className="splash-tags mt-5 flex flex-wrap justify-center gap-2 px-6">
            {["Scanner", "DEX", "Spaces", "AI"].map((tag, i) => (
              <span key={tag} className="splash-tag" style={{ animationDelay: `${i * 80}ms` }}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className={`splash-loader mt-10 w-44 ${showBrand ? "splash-loader-on" : ""}`}>
          <div className="splash-loader-track">
            <div className="splash-loader-fill" style={{ ["--accent" as string]: active.accent }} />
          </div>
          <p className="splash-loader-text mt-3 text-[9px] font-mono tracking-[0.35em] text-muted-foreground uppercase">
            Initializing {active.label}
          </p>
        </div>
      </div>

      {/* Warp streaks on exit */}
      <div className={`splash-warp absolute inset-0 pointer-events-none ${phase === "warp" || exiting ? "splash-warp-on" : ""}`}>
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} className="splash-warp-line" style={{ ["--wi" as string]: i }} />
        ))}
      </div>

      {/* Opening flash */}
      <div className={`splash-flash absolute inset-0 pointer-events-none ${phase === "flash" ? "splash-flash-on" : ""}`} />
    </div>
  );
};

const splashCss = `
.splash-root { transition: opacity 0.55s ease, transform 0.55s ease; }
.splash-exit { opacity: 0; transform: scale(1.08); filter: blur(10px); }

.splash-bg-layer { transform: scale(1.12); animation: splashKenBurns 6s ease-in-out infinite alternate; }
@keyframes splashKenBurns {
  from { transform: scale(1.08) translate3d(0, 0, 0); }
  to { transform: scale(1.22) translate3d(-2%, -1.5%, 0); }
}

.splash-vignette {
  background: radial-gradient(circle at 50% 42%, transparent 18%, rgba(3,4,8,.88) 72%);
}

.splash-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.45;
  animation: splashOrbFloat 8s ease-in-out infinite;
}
.splash-orb-a { width: 220px; height: 220px; top: 10%; left: -10%; background: #2F80FF; }
.splash-orb-b { width: 180px; height: 180px; bottom: 15%; right: -8%; background: #9945FF; animation-delay: -2s; }
.splash-orb-c { width: 140px; height: 140px; top: 55%; left: 35%; background: #14E0C8; opacity: 0.25; animation-delay: -4s; }
@keyframes splashOrbFloat {
  50% { transform: translate3d(12px, -18px, 0) scale(1.08); }
}

.splash-scanlines {
  opacity: 0.35;
  background: repeating-linear-gradient(to bottom, rgba(255,255,255,.04) 0 1px, transparent 1px 4px);
  mix-blend-mode: overlay;
  animation: splashScan 7s linear infinite;
}
@keyframes splashScan { to { background-position: 0 240px; } }

.splash-noise {
  opacity: 0.05;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

.splash-particle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: linear-gradient(120deg, #2F80FF, #9945FF);
  opacity: 0;
  transform: translate(-50%, -50%);
}
.splash-particles-burst .splash-particle {
  animation: splashParticle 1.2s ease-out forwards;
  animation-delay: calc(var(--i) * 35ms);
}
@keyframes splashParticle {
  0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) rotate(calc(var(--i) * 15deg)) translateY(-130px) scale(0); }
}

.splash-orbit-stage { opacity: 0; transform: scale(0.6); transition: opacity 0.6s ease, transform 0.8s cubic-bezier(.2,.8,.2,1); }
.splash-orbit-on { opacity: 1; transform: scale(1); }

.splash-orbit-card {
  position: absolute;
  width: 118px;
  height: 210px;
  transform: rotate(var(--angle)) translateY(-132px) rotate(calc(-1 * var(--angle)));
  opacity: 0.35;
  transition: opacity 0.35s ease, transform 0.5s cubic-bezier(.2,.8,.2,1);
  filter: blur(1px) saturate(0.85);
}
.splash-orbit-card.is-active {
  opacity: 1;
  filter: blur(0) saturate(1.15);
  transform: rotate(var(--angle)) translateY(-148px) rotate(calc(-1 * var(--angle))) scale(1.08);
  z-index: 2;
}

.splash-orbit-frame {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.14);
  box-shadow: 0 20px 50px -20px rgba(0,0,0,.8), 0 0 0 1px rgba(255,255,255,.06) inset, 0 0 30px -8px var(--accent);
  background: #0a0c14;
}
.splash-orbit-img { width: 100%; height: 100%; object-fit: cover; transform: scale(1.08); }
.splash-orbit-chrome {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: linear-gradient(to top, rgba(3,4,8,.92), transparent);
}
.splash-orbit-dot { width: 6px; height: 6px; border-radius: 50%; box-shadow: 0 0 10px currentColor; }
.splash-orbit-label { font-size: 9px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: #fff; }
.splash-orbit-shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,.18) 50%, transparent 60%);
  transform: translateX(-120%);
  animation: splashShimmer 2.4s ease-in-out infinite;
}
@keyframes splashShimmer {
  0%, 40% { transform: translateX(-120%); }
  100% { transform: translateX(120%); }
}

.splash-center { opacity: 0; pointer-events: none; transition: opacity 0.5s ease; }
.splash-center-on { opacity: 1; }

.splash-logo-wrap {
  position: relative;
  width: 96px;
  height: 96px;
  transform: scale(0) rotate(-180deg);
  opacity: 0;
  transition: transform 0.7s cubic-bezier(.2,.9,.2,1.2), opacity 0.4s ease;
}
.splash-logo-snap { transform: scale(1.15) rotate(0deg); opacity: 1; }
.splash-logo-settled { transform: scale(1) rotate(0deg); }

.splash-logo-ring {
  position: absolute;
  inset: -8px;
  border-radius: 32px;
  border: 1px solid rgba(47,128,255,.35);
}
.splash-logo-ring-1 { animation: splashRingSpin 4s linear infinite; }
.splash-logo-ring-2 { inset: -16px; border-color: rgba(153,69,255,.25); animation: splashRingSpin 6s linear infinite reverse; }
@keyframes splashRingSpin { to { transform: rotate(360deg); } }

.splash-logo-core {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 28px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.12);
  box-shadow: 0 24px 60px -20px rgba(47,128,255,.55), 0 0 0 1px rgba(255,255,255,.08) inset;
  background: linear-gradient(145deg, rgba(47,128,255,.15), rgba(153,69,255,.1));
}
.splash-logo-img { width: 100%; height: 100%; object-fit: cover; }
.splash-logo-pulse {
  position: absolute;
  inset: 0;
  border-radius: 28px;
  border: 2px solid rgba(47,128,255,.4);
  animation: splashLogoPing 1.8s ease-out infinite;
}
@keyframes splashLogoPing {
  0% { transform: scale(1); opacity: 0.7; }
  100% { transform: scale(1.35); opacity: 0; }
}

.splash-brand { opacity: 0; transform: translateY(24px); transition: opacity 0.5s ease 0.15s, transform 0.6s cubic-bezier(.2,.8,.2,1) 0.15s; }
.splash-brand-on { opacity: 1; transform: translateY(0); }

.splash-title {
  position: relative;
  text-shadow: 0 0 30px rgba(47,128,255,.45);
  animation: splashGlitch 3.5s steps(1) infinite;
}
.splash-title::before,
.splash-title::after {
  content: attr(data-text);
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.splash-title::before { color: #2F80FF; animation: splashGlitchR 3.5s steps(1) infinite; clip-path: inset(0 0 62% 0); }
.splash-title::after { color: #9945FF; animation: splashGlitchB 3.5s steps(1) infinite; clip-path: inset(38% 0 0 0); }
@keyframes splashGlitchR {
  0%, 92%, 100% { transform: translate(0); }
  93% { transform: translate(-3px, 1px); }
  95% { transform: translate(2px, -1px); }
}
@keyframes splashGlitchB {
  0%, 90%, 100% { transform: translate(0); }
  91% { transform: translate(3px, -1px); }
  94% { transform: translate(-2px, 1px); }
}
@keyframes splashGlitch {
  0%, 90%, 100% { filter: none; }
  92% { filter: brightness(1.2); }
}

.splash-tag {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: .14em;
  text-transform: uppercase;
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.1);
  background: rgba(255,255,255,.04);
  color: rgba(255,255,255,.72);
  animation: splashTagPop 0.5s cubic-bezier(.2,.9,.2,1.2) both;
}
@keyframes splashTagPop {
  from { opacity: 0; transform: translateY(8px) scale(0.8); }
  to { opacity: 1; transform: none; }
}

.splash-loader { opacity: 0; transform: translateY(10px); transition: opacity 0.4s ease 0.25s, transform 0.4s ease 0.25s; }
.splash-loader-on { opacity: 1; transform: none; }
.splash-loader-track {
  height: 3px;
  border-radius: 999px;
  background: rgba(255,255,255,.08);
  overflow: hidden;
}
.splash-loader-fill {
  height: 100%;
  width: 0;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--accent), #9945FF);
  box-shadow: 0 0 14px var(--accent);
  animation: splashLoadBar 1.1s ease-in-out forwards;
}
@keyframes splashLoadBar { to { width: 100%; } }
.splash-loader-text { text-align: center; }

.splash-warp { opacity: 0; }
.splash-warp-on { opacity: 1; }
.splash-warp-line {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2px;
  height: 120vh;
  background: linear-gradient(to bottom, transparent, rgba(255,255,255,.5), transparent);
  transform-origin: center top;
  transform: rotate(calc(var(--wi) * 30deg)) translateY(-50%);
  opacity: 0;
  animation: splashWarpLine 0.55s ease-out forwards;
  animation-delay: calc(var(--wi) * 25ms);
}
@keyframes splashWarpLine {
  0% { opacity: 0; transform: rotate(calc(var(--wi) * 30deg)) translateY(-50%) scaleY(0); }
  40% { opacity: 0.8; }
  100% { opacity: 0; transform: rotate(calc(var(--wi) * 30deg)) translateY(-50%) scaleY(1.2); }
}

.splash-flash {
  background: radial-gradient(circle at 50% 50%, rgba(255,255,255,.95), rgba(47,128,255,.4), transparent 70%);
  opacity: 0;
}
.splash-flash-on { animation: splashFlash 0.45s ease-out forwards; }
@keyframes splashFlash {
  0% { opacity: 0; }
  15% { opacity: 1; }
  100% { opacity: 0; }
}
`;
