import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";

/* ── Data ───────────────────────────────────────────────────────── */

const BRAND = "OrbitX";

const LINKS = {
  app: "https://orbitx.world",
  signin: "/auth?mode=signin",
  signup: "/auth?mode=signup",
  telegram: "https://t.me/ogscan",
  x: "https://x.com/orbitx_wrldbackup",
  xOrbitXPredictionMarket: "https://x.com/orbitx-predictionbet",
  ogdex: "/ORBITX_DEX",
  orbitxPrediction: "https://solno.fun",
  degen: "https://degen-tower.vercel.app",
  privacy: "/privacy",
  terms: "/terms",
};

const PRODUCT_SHOTS = [
  { src: "/ogscan-shot-screener.jpg", label: "OrbitX DEX", depth: 0 },
  { src: "/ogscan-shot-scanner.jpg", label: "Scanner", depth: 1 },
  { src: "/ogscan-shot-deck.jpg", label: "Command deck", depth: 2 },
  { src: "/ogscan-shot-track.jpg", label: "Track record", depth: 3 },
  { src: "/ogscan-shot-mobile.jpg", label: "Mobile", depth: 4 },
] as const;

const GALLERY = [
  { src: "/ogscan-shot-screener.jpg", title: "Live screener", copy: "Orderbook-style pairs, momentum, and one-click trade." },
  { src: "/ogscan-shot-scanner.jpg", title: "Forensic scanner", copy: "OG score, holder quality, and risk in one sweep." },
  { src: "/ogscan-shot-deck.jpg", title: "Command deck", copy: "Your OS home — signals, spaces, and wallet intel." },
  { src: "/ogscan-shot-track.jpg", title: "Track record", copy: "Prove the calls. Public proof, not vibes." },
  { src: "/ogscan-splash-banner.jpg", title: "Full product surface", copy: "Trading, social, and intelligence — one destination." },
  { src: "/ogscan-shot-mobile.jpg", title: "Built for the phone", copy: "Same OS energy on mobile — scan anywhere." },
] as const;

type Feature = { tag: string; title: string; copy: string; tone: string; icon: string };
const FEATURES: Feature[] = [
  { tag: "Discovery", title: "Intelligent token discovery", tone: "f1", icon: "discover",
    copy: "Real-time multi-chain scanner with a proprietary OrbitX Score — on-chain metrics, holder quality, momentum and AI signals." },
  { tag: "Wallet forensics", title: "Track smart money like a pro", tone: "f2", icon: "wallet",
    copy: "Any wallet's full history, win rate, hold time and PnL. Smart-money and KOL labels, whale alerts, one-click actions." },
  { tag: "OrbitX DEX", title: "Blazing-fast trading & execution", tone: "f3", icon: "dex",
    copy: "Live screener, one-click Phantom trading, buy/sell feeds, charts with on-chain overlays, multi-wallet portfolio." },
  { tag: "Launch", title: "Fair-launch & token tools", tone: "f4", icon: "launch",
    copy: "Token creation with anti-rug safeguards, auto-listing, and post-launch monitoring from minute one." },
  { tag: "Prediction", title: "Markets & 1v1 games", tone: "f5", icon: "predict",
    copy: "Prediction markets plus Coinflip, Dice, Crash and Plinko — provably fair, wired into OrbitX insights." },
  { tag: "Social", title: "Community & social layer", tone: "f6", icon: "social",
    copy: "Spaces, voice lobbies, per-token chat, creator tools, and identity that follows you across the OS." },
  { tag: "AI", title: "AI-powered intelligence", tone: "f7", icon: "ai",
    copy: "Natural-language queries across on-chain data — who bought, who's accumulating, automated alerts." },
  { tag: "Gaming", title: "Degen Tower & entertainment", tone: "f8", icon: "gaming",
    copy: "Tap-to-earn with real USDC payouts, combos, upgrades, leaderboards — on-chain consequences coming." },
  { tag: "Developers", title: "Creator & developer tools", tone: "f9", icon: "dev",
    copy: "Webhooks, bot framework, API access, white-label builds, featured listings and premium analytics." },
];

const PHASES = [
  { k: "Phase 1", t: "Now", d: "Core intelligence + trading + social/gaming primitives.", active: true },
  { k: "Phase 2", t: "Near-term", d: "Deep KOL tools, AI analyst, voice lobbies, Spaces, expanded predictions.", active: false },
  { k: "Phase 3", t: "Coming", d: "Social graph, on-chain identity, copy-trading, multi-chain, mobile.", active: false },
  { k: "Phase 4", t: "Vision", d: "The default operating system for serious on-chain activity.", active: false },
];

const FOR = [
  "Degens who want better tools than everyone else",
  "Serious traders tired of fragmented data",
  "KOLs & creators who want to own their community",
  "New projects that want a real home base",
  "Power users who want APIs, webhooks & bots",
  "Casual users who want one clean place to trade, play & hang out",
];

type LiveStats = {
  users: number;
  kols: number;
  communities: number;
  spaces: number;
  tokens: number;
  walletsTracked: number;
  daysLive: number;
};

const STATS_FALLBACK: LiveStats = {
  users: 0, kols: 0, communities: 0, spaces: 0, tokens: 0, walletsTracked: 0, daysLive: 1,
};

const ICONS: Record<string, JSX.Element> = {
  discover: (<><circle cx="11" cy="11" r="6.4" /><path d="m20 20-3.6-3.6" /><path d="M11 7.9v6.2M7.9 11h6.2" opacity=".45" /></>),
  wallet: (<><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 9.5h18" /><circle cx="16.6" cy="13" r="1.25" fill="currentColor" stroke="none" /></>),
  dex: (<><path d="M13 2.5 4.6 13.4H11l-1 8.1L19.4 10H13l1-7.5Z" strokeLinejoin="round" /></>),
  launch: (<><path d="M4.6 16.4c-1.4 1.2-1.9 4.8-1.9 4.8s3.6-.5 4.8-1.9a2.05 2.05 0 0 0-.08-2.78 2.07 2.07 0 0 0-2.82-.12z" /><path d="m12 14.8-2.9-2.9a21 21 0 0 1 1.9-3.8A12.3 12.3 0 0 1 21.5 2.5c0 2.6-.75 7.2-5.75 10.5a21.4 21.4 0 0 1-3.75 1.8z" /></>),
  predict: (<><circle cx="12" cy="12" r="8.7" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" /></>),
  social: (<><path d="M20.5 11.3a7.5 7.5 0 0 1-11 6.6L3.6 19.4l1.55-5A7.5 7.5 0 1 1 20.5 11.3Z" /></>),
  ai: (<><path d="M12 3.3l1.85 4.55L18.4 9.7l-4.55 1.85L12 16.1l-1.85-4.55L5.6 9.7l4.55-1.85L12 3.3Z" strokeLinejoin="round" /></>),
  gaming: (<><rect x="2" y="6.5" width="20" height="11" rx="4.6" /><path d="M6.6 11.6h3.1M8.15 10v3.1" /><circle cx="15.7" cy="12.5" r="1" fill="currentColor" stroke="none" /></>),
  dev: (<><path d="m15.5 17 5-5-5-5M8.5 7l-5 5 5 5" strokeLinejoin="round" /></>),
  dexchart: (<><path d="M4 3.5v17h16.5" /><rect x="7.1" y="9" width="2.6" height="6.5" rx="1" /><rect x="13.9" y="6" width="2.6" height="6" rx="1" /></>),
  target: (<><circle cx="12" cy="12" r="8.7" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" /></>),
  gamepad: (<><rect x="2" y="6.5" width="20" height="11" rx="4.6" /><path d="M6.6 11.6h3.1M8.15 10v3.1" /><circle cx="15.7" cy="12.5" r="1" fill="currentColor" stroke="none" /></>),
};
function Icon({ name }: { name: string }) {
  return (
    <svg className="sp-ico-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[name] ?? ICONS.discover}
    </svg>
  );
}

function useCounter(end: number, duration = 1600) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLElement>(null);
  const counted = useRef(false);
  const endRef = useRef(end);
  endRef.current = end;

  useEffect(() => { counted.current = false; setValue(0); }, [end]);

  useEffect(() => {
    if (!ref.current || end <= 0) return;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || counted.current) return;
      counted.current = true;
      const target = endRef.current;
      const t0 = performance.now();
      const tick = () => {
        const progress = Math.min((performance.now() - t0) / duration, 1);
        setValue(Math.round(target * (1 - Math.pow(1 - progress, 4))));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.25 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [end, duration]);

  return { ref, display: value.toLocaleString() };
}

function useStarfield(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId = 0;
    let stars: { x: number; y: number; z: number; r: number; tw: number }[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: Math.min(160, Math.floor(window.innerWidth / 9)) }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        z: Math.random(),
        r: Math.random() * 1.5 + 0.25,
        tw: Math.random() * Math.PI * 2,
      }));
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (t: number) => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const s of stars) {
        const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.001 + s.tw));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * (0.7 + s.z), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 230, 255, ${(0.12 + s.z * 0.55) * pulse})`;
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };
    animId = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, [canvasRef]);
}

async function fetchLiveStats(): Promise<LiveStats> {
  try {
    const r = await fetch("/api/ogdex/platform-stats");
    if (!r.ok) throw new Error(String(r.status));
    const d = await r.json();
    if (!d?.ok) throw new Error("bad payload");
    return {
      users: Number(d.users ?? d.activeUsers) || 0,
      kols: Number(d.kols) || 0,
      communities: Number(d.communities) || 0,
      spaces: Number(d.spaces) || 0,
      tokens: Number(d.tokens ?? d.tokenCount) || 0,
      walletsTracked: Number(d.walletsTracked) || 0,
      daysLive: Number(d.daysLive) || 1,
    };
  } catch {
    return STATS_FALLBACK;
  }
}

/* ── Component ──────────────────────────────────────────────────── */

export default function Splash() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [heroReady, setHeroReady] = useState(false);
  const [activeShot, setActiveShot] = useState(0);
  const [stats, setStats] = useState<LiveStats>(STATS_FALLBACK);
  const [statsLive, setStatsLive] = useState(false);

  useStarfield(canvasRef);

  const cUsers = useCounter(stats.users, 1400);
  const cKols = useCounter(stats.kols, 1600);
  const cWallets = useCounter(stats.walletsTracked || stats.kols, 1500);
  const cDays = useCounter(stats.daysLive, 1200);

  useEffect(() => {
    if (!loading && user) navigate("/app", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    const ready = setTimeout(() => setHeroReady(true), 60);
    fetchLiveStats().then((s) => {
      setStats(s);
      setStatsLive(s.users > 0 || s.kols > 0);
    });
    const cycle = setInterval(() => setActiveShot((i) => (i + 1) % PRODUCT_SHOTS.length), 3800);
    return () => { clearTimeout(ready); clearInterval(cycle); };
  }, []);

  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      e.target.querySelectorAll<HTMLElement>(".stagger").forEach((child, i) => {
        child.style.transitionDelay = `${i * 70}ms`;
        child.classList.add("in");
      });
    }), { threshold: 0.12 });
    document.querySelectorAll<HTMLElement>(".reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (heroRef.current) {
        heroRef.current.style.setProperty("--py", `${y * 0.18}px`);
        heroRef.current.style.setProperty("--pf", `${Math.max(0, 1 - y / 560)}`);
      }
      document.querySelector(".sp-nav")?.classList.toggle("scrolled", y > 12);
    };
    const onMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      if (heroRef.current) {
        heroRef.current.style.setProperty("--mx", `${x * 18}px`);
        heroRef.current.style.setProperty("--my", `${y * 12}px`);
        heroRef.current.style.setProperty("--rx", `${(-y * 7).toFixed(2)}deg`);
        heroRef.current.style.setProperty("--ry", `${(x * 10).toFixed(2)}deg`);
      }
      if (stageRef.current) {
        stageRef.current.style.setProperty("--tx", `${(x * 28).toFixed(1)}px`);
        stageRef.current.style.setProperty("--ty", `${(y * 18).toFixed(1)}px`);
        stageRef.current.style.setProperty("--srx", `${(-y * 9).toFixed(2)}deg`);
        stageRef.current.style.setProperty("--sry", `${(x * 14).toFixed(2)}deg`);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  const handleCardMouse = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--card-x", `${((e.clientX - rect.left) / rect.width) * 100}%`);
    e.currentTarget.style.setProperty("--card-y", `${((e.clientY - rect.top) / rect.height) * 100}%`);
  }, []);

  const heroStats = [
    { ref: cUsers.ref, display: statsLive ? cUsers.display : "—", label: "Traders" },
    { ref: cKols.ref, display: statsLive ? cKols.display : "—", label: "KOLs mapped" },
    { ref: cWallets.ref, display: statsLive ? cWallets.display : "—", label: "Wallets tracked" },
    { ref: cDays.ref, display: statsLive ? cDays.display : "—", label: "Days live" },
  ];

  return (
    <div className="sp">
      <style>{css}</style>
      <canvas ref={canvasRef} className="sp-stars" aria-hidden />
      <div className="sp-noise" aria-hidden />

      <nav className="sp-nav">
        <a className="sp-brand" href="/">
          <img src={logo} alt="" width={30} height={30} className="sp-brand-logo" />
          <span className="sp-brand-text">{BRAND}</span>
        </a>
        <div className="sp-links">
          <a href="#product">Product</a>
          <a href="#build">Build</a>
          <a href="#roadmap">Roadmap</a>
          <a href="#ecosystem">Ecosystem</a>
        </div>
        <div className="sp-nav-cta">
          <a className="sp-btn-ghost sm" href={LINKS.signin}>Sign in</a>
          <a className="sp-cta" href={LINKS.signup}>Get started</a>
        </div>
      </nav>

      <header className={`sp-hero ${heroReady ? "sp-hero-ready" : ""}`} ref={heroRef}>
        <div className="sp-hero-bg" aria-hidden>
          <div className="sp-cosmos" />
          <div className="sp-beam" />
          <div className="sp-orb sp-orb-a" />
          <div className="sp-orb sp-orb-b" />
          <div className="sp-orb sp-orb-c" />
          <div className="sp-grid3d" />
          <div className="sp-vignette" />
        </div>

        <div className="sp-hero-shell">
          <div className="sp-hero-copy">
            <p className="sp-live">
              <span className="sp-live-dot" />
              {statsLive ? "Live · synced from OrbitX DB" : "Connecting live data…"}
            </p>
            <h1 className="sp-brand-hero">{BRAND}</h1>
            <p className="sp-h1">The on-chain operating system.</p>
            <p className="sp-lead">
              Trade, scan, launch, and gather — real product, real wallets, real KOL data.
            </p>
            <div className="sp-hero-actions">
              <a className="sp-btn-primary" href={LINKS.signup}>Create free account</a>
              <a className="sp-btn-ghost" href={LINKS.ogdex}>Open OrbitX DEX</a>
            </div>
          </div>

          {/* 3D product stage — real site art */}
          <div className="sp-stage-wrap" aria-hidden>
            <div className="sp-stage" ref={stageRef}>
              <div className="sp-stage-floor" />
              {PRODUCT_SHOTS.map((shot, i) => {
                const offset = i - activeShot;
                const abs = Math.abs(offset);
                return (
                  <figure
                    key={shot.src}
                    className={`sp-panel ${i === activeShot ? "is-active" : ""}`}
                    style={{
                      ["--i" as string]: String(i),
                      ["--off" as string]: String(offset),
                      ["--abs" as string]: String(abs),
                      zIndex: 20 - abs,
                    }}
                    onClick={() => setActiveShot(i)}
                  >
                    <img src={shot.src} alt="" loading={i === 0 ? "eager" : "lazy"} decoding="async" />
                    <figcaption>{shot.label}</figcaption>
                  </figure>
                );
              })}
            </div>
            <div className="sp-stage-dots">
              {PRODUCT_SHOTS.map((s, i) => (
                <button
                  key={s.src}
                  type="button"
                  aria-label={s.label}
                  className={i === activeShot ? "on" : ""}
                  onClick={() => setActiveShot(i)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="sp-statbar" aria-label="Live platform statistics">
          {heroStats.map((item) => (
            <div key={item.label} className="sp-stat">
              <strong ref={item.ref as React.Ref<HTMLElement>}>{item.display}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </header>

      <div className="sp-marquee" aria-hidden>
        <div className="sp-marquee-track">
          {Array.from({ length: 3 }).map((_, i) => (
            <span key={i}>
              {["Token discovery", "Wallet forensics", "Smart money", "OrbitX DEX", "Fair launches", "Prediction markets", "Voice & Spaces", "AI analyst", "Degen Tower", "APIs"].map((label) => (
                <span key={`${i}-${label}`}>
                  <span className="sp-marquee-item">{label}</span>
                  <span className="sp-marquee-dot" />
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      <section id="product" className="sp-sec reveal">
        <span className="sp-kicker">Inside the product</span>
        <h2 className="sp-h2">Real surfaces.<br />Not mockups.</h2>
        <p className="sp-body">Screenshots from the live OrbitX stack — screener, scanner, deck, track, and mobile.</p>
        <div className="sp-gallery">
          {GALLERY.map((g, i) => (
            <article key={g.src} className={`sp-shot stagger ${i === 0 ? "sp-shot-hero" : ""}`} style={{ transitionDelay: `${i * 60}ms` }}>
              <div className="sp-shot-frame">
                <img src={g.src} alt={g.title} loading="lazy" decoding="async" />
              </div>
              <h3>{g.title}</h3>
              <p>{g.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="problem" className="sp-sec reveal">
        <span className="sp-kicker">The problem</span>
        <h2 className="sp-h2">You shouldn&apos;t need<br />12 tabs to trade.</h2>
        <p className="sp-body">
          Traders juggle 8–12 disconnected tools. Nothing talks. When you find a token you can&apos;t instantly see KOLs, smart-money pressure, holder history, or sentiment.
        </p>
        <div className="sp-chips">
          {["Pump.fun / Raydium", "Dexscreener / Birdeye", "Nansen / Arkham", "Twitter + Telegram", "Prediction sites", "Random TG bots", "Phantom / Solflare", "Notion KOL notes", "Holder checkers", "Portfolio dashboards"].map((c) => (
            <span key={c} className="sp-chip stagger">{c}</span>
          ))}
        </div>
      </section>

      <section id="build" className="sp-sec reveal">
        <span className="sp-kicker">What we&apos;re building</span>
        <h2 className="sp-h2">A complete OS<br />for on-chain.</h2>
        <div className="sp-grid">
          {FEATURES.map((f, i) => (
            <article key={f.tag} className={`sp-card ${f.tone} stagger`} style={{ transitionDelay: `${i * 55}ms` }} onMouseMove={handleCardMouse}>
              <div className="sp-card-glow" />
              <div className="sp-card-icon"><Icon name={f.icon} /></div>
              <span className="sp-card-tag">{f.tag}</span>
              <h3>{f.title}</h3>
              <p>{f.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="sp-sec reveal">
        <span className="sp-kicker">Why different</span>
        <h2 className="sp-h2">Built by people who ground every day.</h2>
        <div className="sp-why">
          {["No more tab switching", "No more paying 5 services for basic alpha", "No more guessing if a wallet is smart or lucky", "No more launching with zero growth tools", "No more community as an afterthought", "Everything connected by design"].map((w) => (
            <div key={w} className="sp-why-item stagger">
              <span className="sp-why-dot" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="roadmap" className="sp-sec reveal">
        <span className="sp-kicker">Roadmap</span>
        <h2 className="sp-h2">Shipping daily.</h2>
        <div className="sp-phases">
          {PHASES.map((p, i) => (
            <div key={p.k} className={`sp-phase stagger ${p.active ? "sp-phase-active" : ""}`} style={{ transitionDelay: `${i * 70}ms` }}>
              <div className="sp-phase-header">
                <span className="sp-phase-k">{p.k}</span>
                <span className={`sp-phase-badge ${p.active ? "sp-phase-badge-active" : ""}`}>{p.t}</span>
              </div>
              <p>{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="sp-sec reveal">
        <span className="sp-kicker">Who it&apos;s for</span>
        <h2 className="sp-h2">For people tired of the same old thing.</h2>
        <div className="sp-for">
          {FOR.map((f) => (
            <div key={f} className="sp-for-item stagger">
              <span className="sp-for-check">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4.5 4.5L19 7" /></svg>
              </span>
              <span>{f}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="ecosystem" className="sp-sec reveal">
        <span className="sp-kicker">Ecosystem</span>
        <h2 className="sp-h2">Already live.</h2>
        <div className="sp-eco">
          <a className="sp-eco-card stagger" href={LINKS.ogdex} onMouseMove={handleCardMouse}>
            <div className="sp-eco-icon" style={{ ["--ic" as string]: "#38BDF8" }}><Icon name="dexchart" /></div>
            <h3>OrbitX DEX</h3>
            <p>Real-time Solana screener, scanner & trading.</p>
            <span className="sp-eco-link">Open →</span>
          </a>
          <a className="sp-eco-card stagger" href={LINKS.orbitxPrediction} target="_blank" rel="noreferrer" onMouseMove={handleCardMouse}>
            <div className="sp-eco-icon" style={{ ["--ic" as string]: "#22D3EE" }}><Icon name="target" /></div>
            <h3>Prediction Market</h3>
            <p>Markets + provably-fair 1v1 games.</p>
            <span className="sp-eco-link">solno.fun →</span>
          </a>
          <a className="sp-eco-card stagger" href={LINKS.degen} target="_blank" rel="noreferrer" onMouseMove={handleCardMouse}>
            <div className="sp-eco-icon" style={{ ["--ic" as string]: "#F59E0B" }}><Icon name="gamepad" /></div>
            <h3>Degen Tower</h3>
            <p>Tap-to-earn with real USDC payouts.</p>
            <span className="sp-eco-link">Play →</span>
          </a>
        </div>
      </section>

      <section className="sp-close reveal">
        <div className="sp-close-bg" aria-hidden />
        <h2>The last platform you open<br />for on-chain activity.</h2>
        <p>Create your account — wallet or email — and dive in.</p>
        <a className="sp-btn-primary lg" href={LINKS.signup}>Sign up now</a>
      </section>

      <footer className="sp-foot">
        <div className="sp-foot-top">
          <a className="sp-brand" href="/">
            <img src={logo} alt="" width={28} height={28} className="sp-brand-logo" />
            <span className="sp-brand-text">{BRAND}</span>
          </a>
          <div className="sp-foot-cols">
            <div>
              <h4>Product</h4>
              <a href={LINKS.ogdex}>OrbitX DEX</a>
              <a href={LINKS.orbitxPrediction} target="_blank" rel="noreferrer">Prediction Market</a>
              <a href={LINKS.degen} target="_blank" rel="noreferrer">Degen Tower</a>
              <a href={LINKS.signup}>Sign up</a>
            </div>
            <div>
              <h4>Community</h4>
              <a href={LINKS.telegram} target="_blank" rel="noreferrer">Telegram</a>
              <a href={LINKS.x} target="_blank" rel="noreferrer">X · @orbitx_wrld</a>
              <a href={LINKS.xOrbitXPredictionMarket} target="_blank" rel="noreferrer">X · prediction</a>
            </div>
            <div>
              <h4>Legal</h4>
              <a href={LINKS.privacy}>Privacy</a>
              <a href={LINKS.terms}>Terms</a>
            </div>
          </div>
        </div>
        <div className="sp-foot-bottom">
          <span>© {new Date().getFullYear()} {BRAND}. Building in public.</span>
        </div>
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */

const css = `
.sp {
  --bg: #02050c;
  --ink: #f3f7ff;
  --muted: #8b9bb3;
  --line: rgba(255,255,255,0.08);
  --line-bright: rgba(255,255,255,0.16);
  --accent: #38BDF8;
  --accent2: #22D3EE;
  --accent3: #818CF8;
  --font-display: 'Unbounded', 'Syne', sans-serif;
  --font-body: 'Figtree', 'Manrope', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
  background: var(--bg);
  color: var(--ink);
  overflow-x: hidden;
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.sp *, .sp *::before, .sp *::after { box-sizing: border-box; }
.sp a { text-decoration: none; color: inherit; }

.sp-noise {
  position: fixed; inset: 0; z-index: 60; pointer-events: none; opacity: 0.04;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 180px;
}
.sp-stars { position: fixed; inset: 0; z-index: 0; pointer-events: none; opacity: 0.9; }

.sp-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 16px clamp(18px, 4vw, 48px);
  transition: background .3s, border-color .3s, backdrop-filter .3s;
}
.sp-nav.scrolled {
  background: rgba(2,5,12,0.78);
  backdrop-filter: blur(18px) saturate(150%);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
  border-bottom: 1px solid var(--line);
}
.sp-brand {
  display: flex; align-items: center; gap: 10px;
  font-family: var(--font-display);
  font-weight: 700; letter-spacing: 0.02em; font-size: 15px; color: #fff;
}
.sp-brand-logo { border-radius: 8px; display: block; }
.sp-links { display: flex; gap: 26px; font-size: 13px; font-weight: 600; color: var(--muted); }
.sp-links a:hover { color: #fff; }
.sp-nav-cta { display: flex; align-items: center; gap: 10px; }
.sp-cta {
  font-family: var(--font-display);
  font-size: 12px; font-weight: 700; color: #041018; letter-spacing: 0.02em;
  padding: 10px 16px; border-radius: 10px;
  background: linear-gradient(135deg, #a5f3fc, var(--accent2) 40%, var(--accent));
  transition: transform .2s, filter .2s;
}
.sp-cta:hover { transform: translateY(-1px); filter: brightness(1.06); }
@media(max-width:880px) { .sp-links { display: none; } }
@media(max-width:520px) { .sp-btn-ghost.sm { display: none; } }

.sp-btn-primary {
  display: inline-flex; align-items: center; justify-content: center;
  font-family: var(--font-display);
  font-weight: 700; font-size: 14px; color: #041018; letter-spacing: 0.01em;
  padding: 15px 26px; border-radius: 12px;
  background: linear-gradient(135deg, #a5f3fc, var(--accent2) 42%, var(--accent));
  transition: transform .2s, filter .2s;
}
.sp-btn-primary:hover { transform: translateY(-2px); filter: brightness(1.06); }
.sp-btn-primary.lg { font-size: 15px; padding: 17px 32px; }
.sp-btn-ghost {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--font-display);
  font-weight: 600; font-size: 13px; color: rgba(255,255,255,0.88);
  padding: 14px 20px; border-radius: 12px;
  border: 1px solid var(--line-bright);
  background: rgba(255,255,255,0.03);
  transition: border-color .2s, background .2s;
}
.sp-btn-ghost.sm { font-size: 12px; padding: 9px 14px; }
.sp-btn-ghost:hover { border-color: rgba(56,189,248,0.45); background: rgba(56,189,248,0.08); }

/* ── Hero ── */
.sp-hero {
  position: relative;
  min-height: 100vh; min-height: 100dvh;
  display: flex; flex-direction: column;
  padding: 100px clamp(18px, 4vw, 48px) 0;
  overflow: hidden;
}
.sp-hero-bg { position: absolute; inset: 0; z-index: 0; }
.sp-cosmos {
  position: absolute; inset: -15%;
  background:
    radial-gradient(ellipse 50% 40% at 20% 25%, rgba(56,189,248,0.32), transparent 60%),
    radial-gradient(ellipse 45% 35% at 80% 18%, rgba(129,140,248,0.28), transparent 58%),
    radial-gradient(ellipse 70% 50% at 50% 100%, rgba(34,211,238,0.18), transparent 55%),
    radial-gradient(ellipse 40% 30% at 60% 55%, rgba(14,165,233,0.12), transparent 60%),
    linear-gradient(180deg, #050a16 0%, #02050c 100%);
  transform: translate3d(var(--mx,0), calc(var(--py,0) + var(--my,0)), 0);
  animation: cosmosDrift 22s ease-in-out infinite alternate;
}
@keyframes cosmosDrift {
  to { transform: translate3d(calc(var(--mx,0px) + 20px), calc(var(--py,0px) + var(--my,0px) - 14px), 0) scale(1.05); }
}
.sp-beam {
  position: absolute; left: 50%; top: 8%;
  width: min(900px, 110vw); height: min(900px, 110vw);
  transform: translate(-50%, -10%);
  background: conic-gradient(from 180deg at 50% 50%, transparent 0deg, rgba(56,189,248,0.08) 60deg, transparent 120deg, rgba(129,140,248,0.07) 200deg, transparent 280deg);
  filter: blur(40px);
  animation: beamSpin 28s linear infinite;
  opacity: 0.7;
}
@keyframes beamSpin { to { transform: translate(-50%, -10%) rotate(360deg); } }
.sp-orb {
  position: absolute; border-radius: 50%; filter: blur(72px); opacity: 0.5;
  transform: translate3d(var(--mx,0), calc(var(--py,0) * 0.35 + var(--my,0)), 0);
}
.sp-orb-a { width: min(480px,65vw); height: min(480px,65vw); top: 6%; left: -6%; background: radial-gradient(circle, rgba(56,189,248,0.55), transparent 68%); }
.sp-orb-b { width: min(420px,55vw); height: min(420px,55vw); top: 2%; right: -4%; background: radial-gradient(circle, rgba(129,140,248,0.45), transparent 68%); }
.sp-orb-c { width: min(360px,48vw); height: min(360px,48vw); bottom: 22%; left: 40%; background: radial-gradient(circle, rgba(34,211,238,0.3), transparent 70%); opacity: 0.35; }
.sp-grid3d {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px);
  background-size: 72px 72px;
  transform: perspective(700px) rotateX(62deg) translateY(18%) scale(1.4);
  transform-origin: center top;
  -webkit-mask-image: linear-gradient(180deg, transparent, black 25%, black 55%, transparent);
  mask-image: linear-gradient(180deg, transparent, black 25%, black 55%, transparent);
  opacity: 0.55;
}
.sp-vignette {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 75% 60% at 50% 40%, transparent 15%, rgba(2,5,12,0.5) 72%, rgba(2,5,12,0.95) 100%),
    linear-gradient(180deg, rgba(2,5,12,0.25), transparent 30%, transparent 70%, var(--bg));
}

.sp-hero-shell {
  position: relative; z-index: 2;
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: clamp(24px, 4vw, 56px);
  align-items: center;
  width: min(1240px, 100%);
  margin: 0 auto;
  flex: 1;
  opacity: var(--pf, 1);
}
@media(max-width:980px) {
  .sp-hero-shell { grid-template-columns: 1fr; text-align: center; padding-top: 12px; }
}
.sp-hero-ready .sp-hero-copy { animation: riseIn .95s cubic-bezier(0.16,1,0.3,1) both; }
.sp-hero-ready .sp-stage-wrap { animation: riseIn 1.1s cubic-bezier(0.16,1,0.3,1) .12s both; }
@keyframes riseIn {
  from { opacity: 0; transform: translateY(32px); filter: blur(8px); }
  to { opacity: 1; transform: none; filter: none; }
}

.sp-live {
  display: inline-flex; align-items: center; gap: 8px; margin: 0 0 18px;
  font-family: var(--font-mono);
  font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase;
  color: #b6c6dc; font-weight: 500;
}
.sp-live-dot {
  width: 7px; height: 7px; border-radius: 50%; background: var(--accent2);
  box-shadow: 0 0 0 0 rgba(34,211,238,0.5);
  animation: livePulse 1.8s ease-out infinite;
}
@keyframes livePulse {
  0% { box-shadow: 0 0 0 0 rgba(34,211,238,0.5); }
  70% { box-shadow: 0 0 0 10px rgba(34,211,238,0); }
  100% { box-shadow: 0 0 0 0 rgba(34,211,238,0); }
}
.sp-brand-hero {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(52px, 9vw, 104px);
  line-height: 0.9; letter-spacing: -0.04em; font-weight: 800;
  background: linear-gradient(180deg, #fff 8%, #dbeafe 48%, #67e8f9 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 24px 50px rgba(56,189,248,0.22));
}
.sp-h1 {
  margin: 16px 0 0;
  font-family: var(--font-display);
  font-size: clamp(20px, 3vw, 32px);
  line-height: 1.2; letter-spacing: -0.03em; font-weight: 600;
  color: rgba(243,247,255,0.92);
}
.sp-lead {
  margin: 14px 0 0; max-width: 38ch;
  font-size: clamp(14px, 1.5vw, 17px);
  line-height: 1.6; color: var(--muted); font-weight: 500;
}
@media(max-width:980px) { .sp-lead { margin-left: auto; margin-right: auto; } }
.sp-hero-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 28px; }
@media(max-width:980px) { .sp-hero-actions { justify-content: center; } }

/* ── 3D stage ── */
.sp-stage-wrap {
  position: relative;
  min-height: clamp(320px, 48vw, 480px);
  perspective: 1400px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.sp-stage {
  position: relative;
  width: min(560px, 92vw);
  height: clamp(280px, 40vw, 400px);
  transform-style: preserve-3d;
  transform:
    rotateX(calc(12deg + var(--srx, 0deg)))
    rotateY(calc(-18deg + var(--sry, 0deg)))
    translate3d(var(--tx, 0px), var(--ty, 0px), 0);
  transition: transform .12s linear;
}
.sp-stage-floor {
  position: absolute; left: 5%; right: 5%; bottom: -8%;
  height: 40%;
  background: radial-gradient(ellipse at 50% 0%, rgba(56,189,248,0.28), transparent 70%);
  filter: blur(28px);
  transform: rotateX(75deg) translateZ(-40px);
  pointer-events: none;
}
.sp-panel {
  position: absolute; inset: 0;
  margin: 0;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.14);
  background: #0a1220;
  box-shadow:
    0 40px 80px -30px rgba(0,0,0,0.85),
    0 0 0 1px rgba(255,255,255,0.04) inset,
    0 0 60px -20px rgba(56,189,248,0.35);
  cursor: pointer;
  transform:
    translate3d(
      calc(var(--off) * 42px),
      calc(var(--abs) * 10px),
      calc(var(--off) * -70px - var(--abs) * 30px)
    )
    rotateY(calc(var(--off) * -14deg))
    scale(calc(1 - var(--abs) * 0.07));
  opacity: calc(1 - var(--abs) * 0.28);
  transition: transform .7s cubic-bezier(0.16,1,0.3,1), opacity .7s, box-shadow .4s;
  will-change: transform, opacity;
}
.sp-panel.is-active {
  box-shadow:
    0 50px 100px -28px rgba(0,0,0,0.9),
    0 0 80px -10px rgba(34,211,238,0.45),
    0 0 0 1px rgba(255,255,255,0.08) inset;
}
.sp-panel img {
  width: 100%; height: 100%;
  object-fit: cover; object-position: top center;
  display: block;
  filter: saturate(1.08) contrast(1.04);
}
.sp-panel figcaption {
  position: absolute; left: 12px; bottom: 12px;
  font-family: var(--font-mono);
  font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;
  color: #fff;
  padding: 6px 10px; border-radius: 8px;
  background: rgba(2,5,12,0.65);
  border: 1px solid rgba(255,255,255,0.1);
  backdrop-filter: blur(8px);
}
.sp-stage-dots {
  display: flex; gap: 8px; margin-top: 22px; position: relative; z-index: 5;
}
.sp-stage-dots button {
  width: 8px; height: 8px; border-radius: 50%; border: none; padding: 0;
  background: rgba(255,255,255,0.22); cursor: pointer; transition: all .25s;
}
.sp-stage-dots button.on {
  width: 22px; border-radius: 999px; background: var(--accent2);
}

.sp-statbar {
  position: relative; z-index: 2;
  display: grid; grid-template-columns: repeat(4, 1fr);
  width: min(980px, 100%);
  margin: clamp(28px, 5vh, 48px) auto 0;
  border-top: 1px solid var(--line);
  padding: 20px 0 32px;
}
.sp-stat { text-align: center; padding: 6px 12px; border-right: 1px solid var(--line); }
.sp-stat:last-child { border-right: none; }
.sp-stat strong {
  display: block;
  font-family: var(--font-display);
  font-size: clamp(24px, 3.2vw, 36px);
  font-weight: 700; letter-spacing: -0.03em; color: #fff;
}
.sp-stat span {
  display: block; margin-top: 5px;
  font-family: var(--font-mono);
  font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted);
}
@media(max-width:720px) {
  .sp-statbar { grid-template-columns: 1fr 1fr; gap: 14px 0; }
  .sp-stat { border-right: none; border-bottom: 1px solid var(--line); padding-bottom: 12px; }
  .sp-stat:nth-last-child(-n+2) { border-bottom: none; }
}

.sp-marquee {
  position: relative; z-index: 2;
  border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
  overflow: hidden; padding: 14px 0; background: rgba(255,255,255,0.015);
}
.sp-marquee::before, .sp-marquee::after {
  content: ""; position: absolute; top: 0; bottom: 0; width: 70px; z-index: 2;
}
.sp-marquee::before { left: 0; background: linear-gradient(90deg, var(--bg), transparent); }
.sp-marquee::after { right: 0; background: linear-gradient(90deg, transparent, var(--bg)); }
.sp-marquee-track { display: flex; white-space: nowrap; animation: mq 42s linear infinite; }
.sp-marquee-item { font-family: var(--font-display); font-size: 12px; font-weight: 600; color: var(--muted); letter-spacing: 0.02em; }
.sp-marquee-dot { display: inline-block; width: 4px; height: 4px; margin: 0 16px 2px; border-radius: 50%; background: var(--accent2); opacity: 0.45; vertical-align: middle; }
@keyframes mq { to { transform: translateX(-33.333%); } }

.sp-sec {
  position: relative; z-index: 2;
  max-width: 1140px; margin: 0 auto;
  padding: clamp(64px, 11vw, 120px) clamp(18px, 4vw, 40px);
}
.sp-kicker {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 10.5px; font-weight: 600;
  letter-spacing: 0.16em; text-transform: uppercase; color: var(--accent2);
}
.sp-h2 {
  margin: 14px 0 0;
  font-family: var(--font-display);
  font-size: clamp(28px, 4.6vw, 48px);
  line-height: 1.05; letter-spacing: -0.035em; font-weight: 700; max-width: 14ch;
}
.sp-body {
  margin: 16px 0 0; max-width: 56ch;
  font-size: clamp(14px, 1.4vw, 16.5px);
  line-height: 1.65; color: var(--muted); font-weight: 500;
}

/* Product gallery */
.sp-gallery {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 14px; margin-top: 32px;
}
.sp-shot { grid-column: span 4; }
.sp-shot-hero { grid-column: span 8; }
@media(max-width:900px) {
  .sp-shot, .sp-shot-hero { grid-column: span 6; }
}
@media(max-width:600px) {
  .sp-shot, .sp-shot-hero { grid-column: span 12; }
}
.sp-shot-frame {
  position: relative;
  border-radius: 16px; overflow: hidden;
  border: 1px solid var(--line);
  aspect-ratio: 16/10;
  background: #071018;
  transform: perspective(900px) rotateX(2deg);
  transition: transform .4s cubic-bezier(0.16,1,0.3,1), border-color .3s, box-shadow .3s;
  box-shadow: 0 24px 50px -28px rgba(0,0,0,0.8);
}
.sp-shot-hero .sp-shot-frame { aspect-ratio: 16/9; }
.sp-shot:hover .sp-shot-frame {
  transform: perspective(900px) rotateX(0deg) translateY(-6px) scale(1.015);
  border-color: rgba(56,189,248,0.35);
  box-shadow: 0 36px 70px -24px rgba(56,189,248,0.25);
}
.sp-shot-frame img {
  width: 100%; height: 100%; object-fit: cover; object-position: top center;
  display: block; filter: saturate(1.05) contrast(1.03);
}
.sp-shot h3 {
  margin: 12px 0 4px;
  font-family: var(--font-display);
  font-size: 16px; font-weight: 700; letter-spacing: -0.02em;
}
.sp-shot p { margin: 0; font-size: 13px; color: var(--muted); line-height: 1.5; }

.sp-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 24px; }
.sp-chip {
  font-size: 12.5px; color: #c5d0e0; font-weight: 500;
  padding: 8px 12px; border-radius: 999px;
  border: 1px solid var(--line); background: rgba(255,255,255,0.02);
}
.sp-chip:hover { border-color: rgba(56,189,248,0.35); color: #fff; }

.sp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 32px; }
@media(max-width:900px) { .sp-grid { grid-template-columns: 1fr 1fr; } }
@media(max-width:600px) { .sp-grid { grid-template-columns: 1fr; } }
.sp-card {
  position: relative; border: 1px solid var(--line);
  background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
  border-radius: 16px; padding: 22px; overflow: hidden;
  transition: border-color .3s, transform .3s;
}
.sp-card-glow {
  position: absolute; inset: 0; opacity: 0; pointer-events: none;
  background: radial-gradient(circle 140px at var(--card-x,50%) var(--card-y,50%), var(--c, rgba(56,189,248,0.12)), transparent);
  transition: opacity .3s;
}
.sp-card:hover .sp-card-glow { opacity: 1; }
.sp-card:hover { border-color: color-mix(in srgb, var(--ic,#38BDF8) 40%, transparent); transform: translateY(-4px); }
.sp-ico-svg { width: 22px; height: 22px; }
.sp-for-check svg { width: 12px; height: 12px; }
.sp-card.f1{--c:rgba(56,189,248,0.14);--ic:#38BDF8}
.sp-card.f2{--c:rgba(34,211,238,0.14);--ic:#22D3EE}
.sp-card.f3{--c:rgba(129,140,248,0.14);--ic:#818CF8}
.sp-card.f4{--c:rgba(245,158,11,0.14);--ic:#F59E0B}
.sp-card.f5{--c:rgba(14,165,233,0.14);--ic:#0EA5E9}
.sp-card.f6{--c:rgba(96,165,250,0.14);--ic:#60A5FA}
.sp-card.f7{--c:rgba(125,211,252,0.14);--ic:#7DD3FC}
.sp-card.f8{--c:rgba(251,146,60,0.14);--ic:#FB923C}
.sp-card.f9{--c:rgba(165,180,252,0.14);--ic:#A5B4FC}
.sp-card-icon {
  width: 44px; height: 44px; margin-bottom: 14px;
  display: grid; place-items: center; border-radius: 12px;
  color: var(--ic,#38BDF8);
  background: color-mix(in srgb, var(--ic,#38BDF8) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--ic,#38BDF8) 28%, transparent);
}
.sp-card-tag {
  font-family: var(--font-mono);
  font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent2);
}
.sp-card h3 { margin: 8px 0 6px; font-family: var(--font-display); font-size: 16px; font-weight: 700; letter-spacing: -0.02em; }
.sp-card p { margin: 0; font-size: 13px; line-height: 1.55; color: var(--muted); }

.sp-why { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 28px; }
@media(max-width:600px) { .sp-why { grid-template-columns: 1fr; } }
.sp-why-item {
  display: flex; align-items: center; gap: 12px;
  font-size: 14.5px; color: #dfe8f5; font-weight: 500;
  padding: 12px 0; border-bottom: 1px solid var(--line);
}
.sp-why-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; background: var(--accent2); }

.sp-phases { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 28px; }
@media(max-width:900px) { .sp-phases { grid-template-columns: 1fr 1fr; } }
@media(max-width:520px) { .sp-phases { grid-template-columns: 1fr; } }
.sp-phase {
  border: 1px solid var(--line); border-radius: 14px; padding: 18px;
  background: rgba(255,255,255,0.015);
}
.sp-phase-active {
  border-color: rgba(34,211,238,0.28);
  background: linear-gradient(160deg, rgba(34,211,238,0.08), transparent);
}
.sp-phase-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.sp-phase-k { font-family: var(--font-display); font-size: 13px; font-weight: 700; }
.sp-phase-badge {
  font-family: var(--font-mono); font-size: 9.5px; font-weight: 600;
  letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted);
}
.sp-phase-badge-active { color: var(--accent2); }
.sp-phase p { margin: 0; font-size: 13px; line-height: 1.55; color: var(--muted); }

.sp-for { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 28px; }
@media(max-width:600px) { .sp-for { grid-template-columns: 1fr; } }
.sp-for-item {
  display: flex; align-items: center; gap: 12px;
  font-size: 14.5px; color: #dfe8f5; font-weight: 500;
  padding: 12px 0; border-bottom: 1px solid var(--line);
}
.sp-for-check {
  width: 20px; height: 20px; flex-shrink: 0; display: grid; place-items: center;
  border-radius: 6px; background: rgba(34,211,238,0.12); color: var(--accent2);
}

.sp-eco { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 28px; }
@media(max-width:760px) { .sp-eco { grid-template-columns: 1fr; } }
.sp-eco-card {
  border: 1px solid var(--line); border-radius: 16px; padding: 24px;
  background: linear-gradient(160deg, rgba(56,189,248,0.06), rgba(255,255,255,0.01));
  transition: border-color .3s, transform .3s;
}
.sp-eco-card:hover { border-color: rgba(56,189,248,0.35); transform: translateY(-3px); }
.sp-eco-icon {
  width: 46px; height: 46px; margin-bottom: 12px;
  display: grid; place-items: center; border-radius: 12px;
  color: var(--ic,#38BDF8);
  background: color-mix(in srgb, var(--ic,#38BDF8) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--ic,#38BDF8) 28%, transparent);
}
.sp-eco-card h3 { margin: 0; font-family: var(--font-display); font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
.sp-eco-card p { margin: 8px 0 14px; font-size: 13.5px; color: var(--muted); line-height: 1.5; }
.sp-eco-link { font-family: var(--font-display); font-size: 13px; font-weight: 700; color: var(--accent2); }

.sp-close {
  position: relative; z-index: 2; text-align: center;
  padding: clamp(80px, 13vw, 150px) 22px; overflow: hidden;
}
.sp-close-bg {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse at 50% 20%, rgba(56,189,248,0.14), transparent 55%),
    radial-gradient(ellipse at 50% 100%, rgba(129,140,248,0.1), transparent 50%);
}
.sp-close h2 {
  position: relative; margin: 0;
  font-family: var(--font-display);
  font-size: clamp(30px, 5.4vw, 56px);
  line-height: 1.05; letter-spacing: -0.035em; font-weight: 700;
}
.sp-close p { position: relative; margin: 16px 0 28px; font-size: 15.5px; color: var(--muted); }

.sp-foot {
  position: relative; z-index: 2;
  border-top: 1px solid var(--line);
  padding: 44px clamp(18px, 4vw, 48px) 26px;
}
.sp-foot-top {
  display: flex; justify-content: space-between; gap: 36px; flex-wrap: wrap;
  max-width: 1140px; margin: 0 auto;
}
.sp-foot-cols { display: flex; gap: clamp(24px, 5vw, 64px); flex-wrap: wrap; }
.sp-foot-cols h4 {
  font-family: var(--font-mono);
  font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;
  color: #657084; margin: 0 0 10px; font-weight: 600;
}
.sp-foot-cols a { display: block; font-size: 13.5px; color: #8b95a8; margin-bottom: 8px; font-weight: 500; }
.sp-foot-cols a:hover { color: var(--accent2); }
.sp-foot-bottom {
  max-width: 1140px; margin: 32px auto 0; padding-top: 18px;
  border-top: 1px solid var(--line); font-size: 12px; color: #5a6275;
}

.reveal { opacity: 0; transform: translateY(24px); transition: opacity .85s cubic-bezier(0.16,1,0.3,1), transform .85s cubic-bezier(0.16,1,0.3,1); }
.reveal.in { opacity: 1; transform: none; }
.stagger { opacity: 0; transform: translateY(14px); transition: opacity .6s cubic-bezier(0.16,1,0.3,1), transform .6s cubic-bezier(0.16,1,0.3,1); }
.stagger.in { opacity: 1; transform: none; }
.sp ::selection { background: rgba(34,211,238,0.28); color: #fff; }
@media (prefers-reduced-motion: no-preference) { .sp { scroll-behavior: smooth; } }
@media (prefers-reduced-motion: reduce) {
  .sp-cosmos, .sp-beam, .sp-live-dot, .sp-marquee-track, .sp-stage { animation: none !important; transition: none !important; }
}
`;
