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
  launchpad: "/orbitxlaunch",
  orbitxPrediction: "https://solno.fun",
  degen: "https://degen-tower.vercel.app",
  privacy: "/privacy",
  terms: "/terms",
  whitepaper: "/whitepaper",
  roadmap: "/roadmap",
};

const HERO_PLANES = [
  { src: "/ogscan-splash-banner.jpg", alt: "OrbitX product" },
  { src: "/ogscan-shot-screener.jpg", alt: "OrbitX DEX screener" },
  { src: "/orbitx-banner.jpg", alt: "OrbitX brand" },
  { src: "/orbitx-space-bg.png", alt: "OrbitX atmosphere" },
] as const;

type ShowcaseShot = { src: string; label: string };
type ProductShowcase = {
  id: string;
  tag: string;
  title: string;
  copy: string;
  href: string;
  cta: string;
  tone: "gold" | "blue" | "silver";
  shots: ShowcaseShot[];
};

const SHOWCASES: ProductShowcase[] = [
  {
    id: "dex",
    tag: "OrbitX DEX",
    title: "Trade with live intel.",
    copy: "Screener, scanner, charts, and one-click execution — the Solana desk that stays open.",
    href: LINKS.ogdex,
    cta: "Open DEX",
    tone: "blue",
    shots: [
      { src: "/splash/dex-01.jpg", label: "Terminal" },
      { src: "/splash/dex-02.jpg", label: "Scanner" },
      { src: "/splash/dex-03.jpg", label: "Pulse" },
      { src: "/splash/dex-04.jpg", label: "Wallets" },
    ],
  },
  {
    id: "launch",
    tag: "Launchpad",
    title: "Ship coins. Keep control.",
    copy: "Create, claim, rescue, and lead — anti-vamp checks and metal chrome for new launches.",
    href: LINKS.launchpad,
    cta: "Open Launchpad",
    tone: "gold",
    shots: [
      { src: "/splash/launch-01.jpg", label: "Board" },
      { src: "/splash/launch-02.jpg", label: "Create" },
      { src: "/splash/launch-03.jpg", label: "Leaders" },
      { src: "/splash/launch-04.jpg", label: "Claim" },
    ],
  },
  {
    id: "predict",
    tag: "Prediction",
    title: "Markets & fair games.",
    copy: "Prediction markets plus Coinflip, Dice, Crash, Plinko — wired into the OrbitX stack.",
    href: LINKS.orbitxPrediction,
    cta: "Open solno.fun",
    tone: "silver",
    shots: [
      { src: "/splash/predict-01.jpg", label: "Hero" },
      { src: "/splash/predict-02.jpg", label: "Stats" },
      { src: "/splash/predict-03.jpg", label: "Markets" },
      { src: "/splash/predict-04.jpg", label: "Games" },
    ],
  },
];

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

function probeShot(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = Math.min(img.naturalWidth, 48);
        const h = Math.min(img.naturalHeight, 48);
        if (w < 8 || h < 8) { resolve(false); return; }
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        if (!ctx) { resolve(true); return; }
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) sum += data[i] + data[i + 1] + data[i + 2];
        resolve(sum / (w * h * 3) > 8);
      } catch {
        resolve(true);
      }
    };
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

function useValidShots(shots: ShowcaseShot[]) {
  const [valid, setValid] = useState<ShowcaseShot[]>(shots);
  useEffect(() => {
    let cancelled = false;
    Promise.all(shots.map(async (s) => ((await probeShot(s.src)) ? s : null))).then((results) => {
      if (cancelled) return;
      const ok = results.filter(Boolean) as ShowcaseShot[];
      setValid(ok.length ? ok : shots);
    });
    return () => { cancelled = true; };
  }, [shots]);
  return valid;
}

function ProductSlideshow({ showcase, reverse }: { showcase: ProductShowcase; reverse?: boolean }) {
  const shots = useValidShots(showcase.shots);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  useEffect(() => { setIdx(0); }, [shots]);

  useEffect(() => {
    if (paused || shots.length < 2) return;
    const id = setInterval(() => {
      if (!document.hidden) setIdx((i) => (i + 1) % shots.length);
    }, 3800);
    return () => clearInterval(id);
  }, [paused, shots.length, idx]);

  const go = (dir: number) => setIdx((i) => (i + dir + shots.length) % shots.length);

  return (
    <article className={`sp-show reveal ${reverse ? "sp-show--rev" : ""} sp-show--${showcase.tone}`}>
      <div className="sp-show-copy">
        <span className="sp-kicker">{showcase.tag}</span>
        <h2 className="sp-h2">{showcase.title}</h2>
        <p className="sp-body">{showcase.copy}</p>
        <a
          className="sp-btn-primary"
          href={showcase.href}
          {...(showcase.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
        >
          {showcase.cta}
        </a>
      </div>

      <div
        className="sp-show-stage"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        }}
      >
        <div className="sp-show-chrome">
          <span /><span /><span />
          <em>{showcase.tag}</em>
        </div>
        <div className="sp-show-viewport">
          {shots.map((shot, i) => (
            <figure
              key={shot.src}
              className={`sp-show-slide ${i === idx ? "is-on" : ""} ${i === (idx - 1 + shots.length) % shots.length ? "is-exit" : ""}`}
            >
              <img src={shot.src} alt={`${showcase.tag} — ${shot.label}`} loading="lazy" decoding="async" draggable={false} />
            </figure>
          ))}
          <div className="sp-show-progress" aria-hidden>
            <i key={idx} style={{ animationDuration: "3.8s" }} />
          </div>
        </div>
        <div className="sp-show-controls">
          <button type="button" className="sp-show-arrow" aria-label="Previous" onClick={() => go(-1)}>‹</button>
          <div className="sp-show-dots">
            {shots.map((s, i) => (
              <button
                key={s.src}
                type="button"
                aria-label={s.label}
                className={i === idx ? "on" : ""}
                onClick={() => setIdx(i)}
              />
            ))}
          </div>
          <button type="button" className="sp-show-arrow" aria-label="Next" onClick={() => go(1)}>›</button>
          <span className="sp-show-caption">{shots[idx]?.label}</span>
        </div>
      </div>
    </article>
  );
}

function CaBar({ id }: { id?: string }) {
  return (
    <section id={id} className="sp-ca reveal" aria-label="Official contract address">
      <div className="sp-ca-inner">
        <div className="sp-ca-meta">
          <img src="/ogscan-our-coin-logo.webp" alt="" width={40} height={40} className="sp-ca-logo" />
          <div>
            <span className="sp-ca-kicker">Official CA</span>
            <strong className="sp-ca-name">OrbitX token</strong>
          </div>
        </div>
        <code className="sp-ca-addr">13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9</code>
      </div>
    </section>
  );
}

/* ── Component ──────────────────────────────────────────────────── */

export default function Splash() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const heroRef = useRef<HTMLElement>(null);
  const [heroReady, setHeroReady] = useState(false);
  const [plane, setPlane] = useState(0);
  const [stats, setStats] = useState<LiveStats>(STATS_FALLBACK);
  const [statsLive, setStatsLive] = useState(false);

  const cUsers = useCounter(stats.users, 1400);
  const cKols = useCounter(stats.kols, 1600);
  const cWallets = useCounter(stats.walletsTracked || stats.kols, 1500);
  const cDays = useCounter(stats.daysLive, 1200);

  useEffect(() => {
    if (!loading && user) navigate("/app", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    const ready = setTimeout(() => setHeroReady(true), 40);
    fetchLiveStats().then((s) => {
      setStats(s);
      setStatsLive(s.users > 0 || s.kols > 0);
    });
    HERO_PLANES.forEach((p) => { const im = new Image(); im.decoding = "async"; im.src = p.src; });
    return () => clearTimeout(ready);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) setPlane((i) => (i + 1) % HERO_PLANES.length);
    }, 6200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      e.target.querySelectorAll<HTMLElement>(".stagger").forEach((child, i) => {
        child.style.transitionDelay = `${i * 100}ms`;
        child.classList.add("in");
      });
    }), { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll<HTMLElement>(".reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    let raf = 0;
    let mx = 0, my = 0, sy = 0;
    const apply = () => {
      raf = 0;
      if (heroRef.current) {
        heroRef.current.style.setProperty("--mx", `${(mx * 12).toFixed(1)}px`);
        heroRef.current.style.setProperty("--my", `${(my * 8).toFixed(1)}px`);
        heroRef.current.style.setProperty("--py", `${(sy * 0.22).toFixed(1)}px`);
        heroRef.current.style.setProperty("--pf", `${Math.max(0, 1 - sy / 640).toFixed(3)}`);
      }
      document.querySelector(".sp-nav")?.classList.toggle("scrolled", sy > 10);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(apply); };
    const onScroll = () => { sy = window.scrollY; schedule(); };
    const onMove = (e: MouseEvent) => {
      mx = (e.clientX / window.innerWidth - 0.5) * 2;
      my = (e.clientY / window.innerHeight - 0.5) * 2;
      schedule();
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
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
      <div className="sp-noise" aria-hidden />

      <nav className="sp-nav">
        <a className="sp-brand" href="/">
          <img src={logo} alt="" width={28} height={28} className="sp-brand-logo" />
          <span className="sp-brand-text">Orbit<span>X</span></span>
        </a>
        <div className="sp-links">
          <a href="#product">Product</a>
          <a href="#build">Build</a>
          <a href="#roadmap">Roadmap</a>
          <a href="#ca">CA</a>
        </div>
        <div className="sp-nav-cta">
          <a className="sp-btn-ghost sm" href={LINKS.signin}>Sign in</a>
          <a className="sp-cta" href={LINKS.signup}>Get started</a>
        </div>
      </nav>

      <header className={`sp-hero ${heroReady ? "sp-hero-ready" : ""}`} ref={heroRef}>
        <div className="sp-hero-media" aria-hidden>
          {HERO_PLANES.map((p, i) => (
            <img
              key={p.src}
              src={p.src}
              alt=""
              className={`sp-hero-plane ${i === plane ? "is-on" : ""}`}
              draggable={false}
            />
          ))}
          <div className="sp-hero-grain" />
          <div className="sp-hero-scrim" />
          <img src="/orbitx-globe.png" alt="" className="sp-hero-globe" />
        </div>

        <div className="sp-hero-content">
          <h1 className="sp-brand-hero">
            Orbit<span>X</span>
          </h1>
          <p className="sp-h1">The on-chain operating system.</p>
          <p className="sp-lead">
            Trade, scan, launch, and gather — one desk for Solana.
          </p>
          <div className="sp-hero-actions">
            <a className="sp-btn-primary" href={LINKS.signup}>Create free account</a>
            <a className="sp-btn-ghost" href={LINKS.ogdex}>Open OrbitX DEX</a>
          </div>
        </div>

        <div className="sp-hero-scroll" aria-hidden>
          <span>Scroll</span>
          <i />
        </div>
      </header>

      <CaBar id="ca" />

      <section className="sp-statbar reveal" aria-label="Live platform statistics">
        <div className="sp-statbar-inner">
          <p className="sp-stat-live">
            <span className="sp-live-dot" />
            {statsLive ? "Live from OrbitX" : "Connecting…"}
          </p>
          <div className="sp-stats">
            {heroStats.map((item) => (
              <div key={item.label} className="sp-stat stagger">
                <strong ref={item.ref as React.Ref<HTMLElement>}>{item.display}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

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

      <section id="product" className="sp-product">
        <div className="sp-sec reveal" style={{ paddingBottom: 24 }}>
          <span className="sp-kicker">Inside the product</span>
          <h2 className="sp-h2">Real surfaces.<br />Live product shots.</h2>
          <p className="sp-body">DEX, Launchpad, and Prediction — swipe or autoplay through each desk.</p>
        </div>
        {SHOWCASES.map((s, i) => (
          <ProductSlideshow key={s.id} showcase={s} reverse={i % 2 === 1} />
        ))}
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
            <article key={f.tag} className={`sp-card ${f.tone} stagger`} style={{ transitionDelay: `${i * 90}ms` }} onMouseMove={handleCardMouse}>
              <div className="sp-card-border" aria-hidden />
              <div className="sp-card-glow" />
              <div className="sp-card-corner" aria-hidden />
              <div className="sp-card-icon"><span className="sp-card-ring" aria-hidden /><Icon name={f.icon} /></div>
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
          <a className="sp-eco-card stagger" href={LINKS.ogdex} onMouseMove={handleCardMouse} style={{ ["--ic" as string]: "#60A5FA" }}>
            <div className="sp-card-border" aria-hidden />
            <div className="sp-eco-icon"><span className="sp-card-ring" aria-hidden /><Icon name="dexchart" /></div>
            <h3>OrbitX DEX</h3>
            <p>Real-time Solana screener, scanner & trading.</p>
            <span className="sp-eco-link">Open →</span>
          </a>
          <a className="sp-eco-card stagger" href={LINKS.launchpad} onMouseMove={handleCardMouse} style={{ ["--ic" as string]: "#F0C75E" }}>
            <div className="sp-card-border" aria-hidden />
            <div className="sp-eco-icon"><span className="sp-card-ring" aria-hidden /><Icon name="launch" /></div>
            <h3>Launchpad</h3>
            <p>Create, claim, rescue — anti-vamp from minute one.</p>
            <span className="sp-eco-link">Launch →</span>
          </a>
          <a className="sp-eco-card stagger" href={LINKS.orbitxPrediction} target="_blank" rel="noreferrer" onMouseMove={handleCardMouse} style={{ ["--ic" as string]: "#A8B0BC" }}>
            <div className="sp-card-border" aria-hidden />
            <div className="sp-eco-icon"><span className="sp-card-ring" aria-hidden /><Icon name="target" /></div>
            <h3>Prediction Market</h3>
            <p>Markets + provably-fair 1v1 games.</p>
            <span className="sp-eco-link">solno.fun →</span>
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
            <span className="sp-brand-text">Orbit<span>X</span></span>
          </a>
          <div className="sp-foot-cols">
            <div>
              <h4>Product</h4>
              <a href={LINKS.ogdex}>OrbitX DEX</a>
              <a href={LINKS.launchpad}>Launchpad</a>
              <a href={LINKS.orbitxPrediction} target="_blank" rel="noreferrer">Prediction Market</a>
              <a href={LINKS.signup}>Sign up</a>
            </div>
            <div>
              <h4>Token</h4>
              <span className="sp-foot-ca">CA · Coming soon</span>
              <a href={LINKS.degen} target="_blank" rel="noreferrer">Degen Tower</a>
            </div>
            <div>
              <h4>Community</h4>
              <a href={LINKS.telegram} target="_blank" rel="noreferrer">Telegram</a>
              <a href={LINKS.x} target="_blank" rel="noreferrer">X · @orbitx_wrld</a>
              <a href={LINKS.xOrbitXPredictionMarket} target="_blank" rel="noreferrer">X · prediction</a>
            </div>
            <div>
              <h4>Legal</h4>
              <a href={LINKS.whitepaper}>Whitepaper</a>
              <a href={LINKS.roadmap}>Roadmap</a>
              <a href={LINKS.terms}>Terms</a>
              <a href={LINKS.privacy}>Privacy</a>
            </div>
          </div>
        </div>
        <div className="sp-foot-bottom">
          <span>© {new Date().getFullYear()} {BRAND}. Building in public.</span>
          <span className="sp-foot-mint">CA · Coming soon</span>
        </div>
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */

const css = `
.sp {
  --bg: #050505;
  --ink: #f4f5f7;
  --muted: #9aa3b2;
  --line: rgba(168,176,188,0.14);
  --line-bright: rgba(168,176,188,0.28);
  --gold: #D4AF37;
  --gold-hi: #F0C75E;
  --blue: #3B82F6;
  --blue-hi: #60A5FA;
  --silver: #A8B0BC;
  --font-display: "Bricolage Grotesque", "Syne", system-ui, sans-serif;
  --font-body: "Instrument Sans", "Manrope", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
  background: var(--bg);
  color: var(--ink);
  overflow-x: hidden;
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.sp *, .sp *::before, .sp *::after { box-sizing: border-box; }
.sp a { text-decoration: none; color: inherit; }
.sp button { font: inherit; color: inherit; background: none; border: none; cursor: pointer; }

.sp-noise {
  position: fixed; inset: 0; z-index: 80; pointer-events: none; opacity: 0.045;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 200px;
}

.sp-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 18px clamp(18px, 4vw, 48px);
  transition: background .35s, border-color .35s, backdrop-filter .35s, transform .4s;
}
.sp-nav.scrolled {
  background: rgba(5,5,5,0.82);
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
  border-bottom: 1px solid var(--line);
}
.sp-brand {
  display: flex; align-items: center; gap: 10px;
  font-family: var(--font-display);
  font-weight: 700; letter-spacing: -0.03em; font-size: 1.05rem; color: #fff;
}
.sp-brand-text span { color: var(--gold-hi); }
.sp-brand-logo {
  border-radius: 9px; display: block;
  box-shadow: 0 0 0 1px rgba(212,175,55,0.35);
}
.sp-links {
  display: flex; gap: 28px;
  font-size: 13px; font-weight: 600; color: var(--muted);
}
.sp-links a { transition: color .2s; }
.sp-links a:hover { color: #fff; }
.sp-nav-cta { display: flex; align-items: center; gap: 10px; }
.sp-cta {
  font-family: var(--font-display);
  font-size: 12px; font-weight: 700; color: #0a0a0a; letter-spacing: -0.01em;
  padding: 10px 16px; border-radius: 10px;
  background: linear-gradient(180deg, var(--gold-hi), var(--gold));
  box-shadow: 0 8px 24px -12px rgba(212,175,55,0.7);
  transition: transform .2s, filter .2s;
}
.sp-cta:hover { transform: translateY(-1px); filter: brightness(1.05); }
@media(max-width:880px) { .sp-links { display: none; } }
@media(max-width:520px) { .sp-btn-ghost.sm { display: none; } }

.sp-btn-primary {
  display: inline-flex; align-items: center; justify-content: center;
  font-family: var(--font-display);
  font-weight: 700; font-size: 14px; color: #0a0a0a; letter-spacing: -0.01em;
  padding: 15px 26px; border-radius: 12px;
  background: linear-gradient(180deg, var(--gold-hi), var(--gold));
  box-shadow: 0 12px 32px -14px rgba(212,175,55,0.75);
  transition: transform .25s cubic-bezier(0.16,1,0.3,1), filter .2s;
}
.sp-btn-primary:hover { transform: translateY(-2px); filter: brightness(1.05); }
.sp-btn-primary.lg { font-size: 15px; padding: 17px 32px; }
.sp-btn-ghost {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--font-display);
  font-weight: 600; font-size: 13px; color: rgba(255,255,255,0.9);
  padding: 14px 20px; border-radius: 12px;
  border: 1px solid var(--line-bright);
  background: rgba(255,255,255,0.04);
  backdrop-filter: blur(8px);
  transition: border-color .2s, background .2s, color .2s, transform .2s;
}
.sp-btn-ghost.sm { font-size: 12px; padding: 9px 14px; }
.sp-btn-ghost:hover {
  border-color: rgba(96,165,250,0.5);
  background: rgba(59,130,246,0.1);
  color: #fff;
  transform: translateY(-1px);
}

/* ── Hero ── */
.sp-hero {
  position: relative;
  min-height: 100vh; min-height: 100dvh;
  display: flex; flex-direction: column; justify-content: flex-end;
  padding: 0 clamp(18px, 5vw, 56px) clamp(40px, 8vh, 72px);
  overflow: hidden;
}
.sp-hero-media {
  position: absolute; inset: 0; z-index: 0;
  transform: translate3d(calc(var(--mx,0) * 0.35), calc(var(--py,0) * 0.4 + var(--my,0) * 0.35), 0) scale(1.06);
  will-change: transform;
}
.sp-hero-plane {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover; object-position: center 35%;
  opacity: 0;
  transform: scale(1.08);
  transition: opacity 1.6s cubic-bezier(0.4,0,0.2,1), transform 7s ease;
  filter: saturate(1.05) contrast(1.05) brightness(0.7);
}
.sp-hero-plane.is-on {
  opacity: 1;
  transform: scale(1);
}
.sp-hero-grain {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 80% 55% at 70% 20%, rgba(59,130,246,0.22), transparent 55%),
    radial-gradient(ellipse 50% 40% at 15% 70%, rgba(212,175,55,0.12), transparent 50%);
  pointer-events: none;
}
.sp-hero-scrim {
  position: absolute; inset: 0;
  background:
    linear-gradient(90deg, rgba(5,5,5,0.92) 0%, rgba(5,5,5,0.55) 42%, rgba(5,5,5,0.2) 70%, rgba(5,5,5,0.45) 100%),
    linear-gradient(180deg, rgba(5,5,5,0.55) 0%, transparent 28%, transparent 48%, rgba(5,5,5,0.88) 78%, var(--bg) 100%);
  pointer-events: none;
}
.sp-hero-globe {
  position: absolute;
  right: -8%; bottom: 8%;
  width: min(52vw, 620px);
  opacity: 0.38;
  pointer-events: none;
  mix-blend-mode: screen;
  filter: drop-shadow(0 0 40px rgba(59,130,246,0.25));
  animation: globeFloat 14s ease-in-out infinite alternate;
}
@keyframes globeFloat {
  from { transform: translate3d(0, 0, 0) rotate(-2deg); }
  to { transform: translate3d(-18px, -22px, 0) rotate(3deg); }
}

.sp-hero-content {
  position: relative; z-index: 2;
  max-width: min(720px, 100%);
  opacity: var(--pf, 1);
}
.sp-hero-ready .sp-brand-hero { animation: brandIn 1.05s cubic-bezier(0.16,1,0.3,1) both; }
.sp-hero-ready .sp-h1 { animation: brandIn 1.05s cubic-bezier(0.16,1,0.3,1) .08s both; }
.sp-hero-ready .sp-lead { animation: brandIn 1.05s cubic-bezier(0.16,1,0.3,1) .16s both; }
.sp-hero-ready .sp-hero-actions { animation: brandIn 1.05s cubic-bezier(0.16,1,0.3,1) .24s both; }
@keyframes brandIn {
  from { opacity: 0; transform: translateY(28px); filter: blur(10px); }
  to { opacity: 1; transform: none; filter: none; }
}

.sp-brand-hero {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(64px, 14vw, 148px);
  line-height: 0.86;
  letter-spacing: -0.055em;
  font-weight: 800;
  color: #fff;
}
.sp-brand-hero span {
  background: linear-gradient(135deg, var(--gold-hi) 10%, var(--gold) 55%, #fff 120%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.sp-h1 {
  margin: clamp(18px, 3vh, 28px) 0 0;
  font-family: var(--font-display);
  font-size: clamp(22px, 3.4vw, 36px);
  line-height: 1.15; letter-spacing: -0.035em; font-weight: 600;
  color: rgba(244,245,247,0.92);
  max-width: 16ch;
}
.sp-lead {
  margin: 14px 0 0; max-width: 34ch;
  font-size: clamp(15px, 1.6vw, 18px);
  line-height: 1.55; color: var(--muted); font-weight: 500;
}
.sp-hero-actions {
  display: flex; gap: 12px; flex-wrap: wrap;
  margin-top: clamp(26px, 4vh, 36px);
}
.sp-hero-scroll {
  position: absolute; z-index: 3;
  right: clamp(18px, 4vw, 48px); bottom: clamp(28px, 5vh, 48px);
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  font-family: var(--font-mono);
  font-size: 9px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--silver);
  opacity: 0.7;
}
.sp-hero-scroll i {
  display: block; width: 1px; height: 42px;
  background: linear-gradient(180deg, var(--gold-hi), transparent);
  animation: scrollPulse 2.2s ease-in-out infinite;
}
@keyframes scrollPulse {
  0%, 100% { opacity: 0.35; transform: scaleY(0.7); transform-origin: top; }
  50% { opacity: 1; transform: scaleY(1); }
}
@media(max-width:720px) {
  .sp-hero-scroll { display: none; }
  .sp-hero-globe { opacity: 0.22; right: -20%; width: 70vw; }
  .sp-hero { justify-content: flex-end; padding-bottom: 48px; }
}

/* ── CA bar ── */
.sp-ca { position: relative; z-index: 2; }
.sp-ca-inner {
  max-width: 1140px; margin: 0 auto;
  display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
  padding: 18px clamp(18px, 4vw, 40px);
  border-block: 1px solid var(--line);
  background:
    linear-gradient(90deg, rgba(212,175,55,0.08), transparent 40%, rgba(59,130,246,0.06)),
    #080808;
}
.sp-ca-meta { display: flex; align-items: center; gap: 12px; min-width: 160px; }
.sp-ca-logo {
  border-radius: 10px;
  border: 1px solid rgba(212,175,55,0.35);
  background: #111;
}
.sp-ca-kicker {
  display: block;
  font-family: var(--font-mono);
  font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--gold-hi);
}
.sp-ca-name {
  display: block; margin-top: 2px;
  font-family: var(--font-display);
  font-size: 15px; font-weight: 700; letter-spacing: -0.02em;
}
.sp-ca-addr {
  flex: 1;
  min-width: 0;
  font-family: var(--font-mono);
  font-size: clamp(10px, 1.2vw, 12.5px);
  color: var(--silver);
  letter-spacing: 0.01em;
  word-break: break-all;
}
@media(max-width:640px) {
  .sp-ca-inner { flex-direction: column; align-items: stretch; }
  .sp-ca-actions { margin-left: 0; }
  .sp-ca-addr { white-space: normal; word-break: break-all; }
}

/* ── Stats ── */
.sp-statbar {
  position: relative; z-index: 2;
  background: linear-gradient(180deg, #0a0a0a, var(--bg));
}
.sp-statbar-inner {
  max-width: 1140px; margin: 0 auto;
  padding: 28px clamp(18px, 4vw, 40px) 36px;
}
.sp-stat-live {
  display: inline-flex; align-items: center; gap: 8px; margin: 0 0 18px;
  font-family: var(--font-mono);
  font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--silver); font-weight: 500;
}
.sp-live-dot {
  width: 6px; height: 6px; border-radius: 50%; background: var(--blue);
  box-shadow: 0 0 0 0 rgba(59,130,246,0.45);
  animation: livePulse 1.8s ease-out infinite;
}
@keyframes livePulse {
  0% { box-shadow: 0 0 0 0 rgba(59,130,246,0.45); }
  70% { box-shadow: 0 0 0 10px rgba(59,130,246,0); }
  100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
}
.sp-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.sp-stat { padding: 8px 4px 4px 0; border-right: 1px solid var(--line); }
.sp-stat:last-child { border-right: none; }
.sp-stat strong {
  display: block;
  font-family: var(--font-display);
  font-size: clamp(26px, 3.4vw, 40px);
  font-weight: 700; letter-spacing: -0.04em; color: #fff;
}
.sp-stat span {
  display: block; margin-top: 6px;
  font-family: var(--font-mono);
  font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted);
}
@media(max-width:720px) {
  .sp-stats { grid-template-columns: 1fr 1fr; gap: 18px 12px; }
  .sp-stat { border-right: none; border-bottom: 1px solid var(--line); padding-bottom: 14px; }
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
.sp-marquee-item { font-family: var(--font-display); font-size: 12px; font-weight: 600; color: var(--muted); letter-spacing: -0.01em; }
.sp-marquee-dot { display: inline-block; width: 4px; height: 4px; margin: 0 16px 2px; border-radius: 50%; background: var(--gold); opacity: 0.55; vertical-align: middle; }
@keyframes mq { to { transform: translateX(-33.333%); } }

.sp-sec {
  position: relative; z-index: 2;
  max-width: 1140px; margin: 0 auto;
  padding: clamp(64px, 11vw, 120px) clamp(18px, 4vw, 40px);
}
.sp-product { position: relative; z-index: 2; padding-bottom: 40px; }
.sp-kicker {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 10.5px; font-weight: 600;
  letter-spacing: 0.18em; text-transform: uppercase; color: var(--gold-hi);
}
.sp-h2 {
  margin: 14px 0 0;
  font-family: var(--font-display);
  font-size: clamp(30px, 5vw, 52px);
  line-height: 1.02; letter-spacing: -0.04em; font-weight: 700; max-width: 14ch;
}
.sp-body {
  margin: 16px 0 0; max-width: 56ch;
  font-size: clamp(14px, 1.4vw, 16.5px);
  line-height: 1.65; color: var(--muted); font-weight: 500;
}

/* ── Product showcases / slideshows ── */
.sp-show {
  max-width: 1180px; margin: 0 auto;
  padding: clamp(36px, 6vw, 72px) clamp(18px, 4vw, 40px);
  display: grid;
  grid-template-columns: 0.9fr 1.2fr;
  gap: clamp(28px, 5vw, 56px);
  align-items: center;
}
.sp-show--rev { direction: rtl; }
.sp-show--rev > * { direction: ltr; }
@media(max-width:960px) {
  .sp-show, .sp-show--rev { grid-template-columns: 1fr; direction: ltr; }
}
.sp-show-copy .sp-btn-primary { margin-top: 28px; }
.sp-show-stage {
  position: relative;
  border-radius: 16px;
  border: 1px solid var(--line);
  background: linear-gradient(180deg, #121212, #080808);
  box-shadow:
    0 40px 80px -36px rgba(0,0,0,0.9),
    0 0 0 1px rgba(255,255,255,0.03) inset;
  overflow: hidden;
  transform: perspective(1200px) rotateY(-4deg) rotateX(2deg);
  transition: transform .5s cubic-bezier(0.16,1,0.3,1), box-shadow .4s;
}
.sp-show--rev .sp-show-stage { transform: perspective(1200px) rotateY(4deg) rotateX(2deg); }
.sp-show-stage:hover {
  transform: perspective(1200px) rotateY(0deg) rotateX(0deg) translateY(-4px);
  box-shadow: 0 48px 90px -30px rgba(0,0,0,0.95), 0 0 40px -20px var(--tone, rgba(212,175,55,0.35));
}
.sp-show--gold { --tone: rgba(212,175,55,0.4); }
.sp-show--blue { --tone: rgba(59,130,246,0.4); }
.sp-show--silver { --tone: rgba(168,176,188,0.35); }
.sp-show--gold .sp-show-stage { border-color: rgba(212,175,55,0.22); }
.sp-show--blue .sp-show-stage { border-color: rgba(59,130,246,0.22); }
.sp-show--silver .sp-show-stage { border-color: rgba(168,176,188,0.22); }

.sp-show-chrome {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--line);
  background: rgba(0,0,0,0.45);
}
.sp-show-chrome span {
  width: 8px; height: 8px; border-radius: 50%;
  background: rgba(255,255,255,0.18);
}
.sp-show-chrome span:nth-child(1) { background: #ff5f57; }
.sp-show-chrome span:nth-child(2) { background: #febc2e; }
.sp-show-chrome span:nth-child(3) { background: #28c840; }
.sp-show-chrome em {
  margin-left: 10px;
  font-style: normal;
  font-family: var(--font-mono);
  font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted);
}
.sp-show-viewport {
  position: relative;
  aspect-ratio: 16 / 10;
  background: #000;
  overflow: hidden;
}
.sp-show-slide {
  position: absolute; inset: 0; margin: 0;
  opacity: 0;
  transform: scale(1.04) translateX(18px);
  filter: blur(6px);
  transition:
    opacity .85s cubic-bezier(0.22,1,0.36,1),
    transform 1s cubic-bezier(0.22,1,0.36,1),
    filter .85s ease;
  pointer-events: none;
}
.sp-show-slide.is-on {
  opacity: 1;
  transform: scale(1) translateX(0);
  filter: none;
  z-index: 2;
  animation: ken 3.8s ease-out both;
}
.sp-show-slide.is-exit {
  opacity: 0;
  transform: scale(0.98) translateX(-24px);
  filter: blur(4px);
  z-index: 1;
}
@keyframes ken {
  from { transform: scale(1) translateX(0); }
  to { transform: scale(1.045) translateX(-1.5%); }
}
.sp-show-slide img {
  width: 100%; height: 100%;
  object-fit: cover; object-position: top center;
  display: block;
}
.sp-show-progress {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 4;
  height: 2px; background: rgba(255,255,255,0.08);
}
.sp-show-progress i {
  display: block; height: 100%; width: 0;
  background: linear-gradient(90deg, var(--gold-hi), var(--blue-hi));
  animation: prog linear forwards;
}
@keyframes prog { to { width: 100%; } }
.sp-show-controls {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px;
  border-top: 1px solid var(--line);
  background: rgba(0,0,0,0.35);
}
.sp-show-arrow {
  width: 32px; height: 32px;
  display: grid; place-items: center;
  border-radius: 8px;
  border: 1px solid var(--line);
  color: #fff; font-size: 18px; line-height: 1;
  transition: background .2s, border-color .2s;
}
.sp-show-arrow:hover { background: rgba(255,255,255,0.06); border-color: var(--line-bright); }
.sp-show-dots { display: flex; gap: 6px; }
.sp-show-dots button {
  width: 7px; height: 7px; border-radius: 50%; padding: 0;
  background: rgba(255,255,255,0.22);
  transition: width .25s, background .25s, border-radius .25s;
}
.sp-show-dots button.on {
  width: 20px; border-radius: 999px;
  background: var(--gold-hi);
}
.sp-show-caption {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted);
}

.sp-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 24px; }
.sp-chip {
  font-size: 12.5px; color: #c5d0e0; font-weight: 500;
  padding: 8px 12px; border-radius: 999px;
  border: 1px solid var(--line); background: rgba(255,255,255,0.02);
  transition: border-color .2s, color .2s, transform .2s;
}
.sp-chip:hover { border-color: rgba(212,175,55,0.4); color: #fff; transform: translateY(-1px); }

.sp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 32px; perspective: 1200px; }
@media(max-width:900px) { .sp-grid { grid-template-columns: 1fr 1fr; } }
@media(max-width:600px) { .sp-grid { grid-template-columns: 1fr; } }
.sp-card {
  position: relative; isolation: isolate;
  border: 1px solid transparent;
  background:
    linear-gradient(165deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012) 55%, rgba(8,14,24,0.6)) padding-box,
    linear-gradient(145deg, rgba(255,255,255,0.16), rgba(255,255,255,0.03) 40%, color-mix(in srgb, var(--ic,#D4AF37) 35%, transparent)) border-box;
  border-radius: 16px; padding: 24px; overflow: hidden;
  transform-style: preserve-3d;
  transition: transform .45s cubic-bezier(0.16,1,0.3,1), box-shadow .4s ease;
  box-shadow: 0 18px 40px -28px rgba(0,0,0,0.7);
}
.sp-card-border {
  position: absolute; inset: 0; border-radius: inherit; pointer-events: none; z-index: 0;
  background: radial-gradient(ellipse 80% 55% at 50% -10%, color-mix(in srgb, var(--ic,#D4AF37) 18%, transparent), transparent 70%);
  opacity: 0.7;
}
.sp-card-glow {
  position: absolute; inset: 0; opacity: 0; pointer-events: none; z-index: 0;
  background: radial-gradient(circle 160px at var(--card-x,50%) var(--card-y,50%), var(--c, rgba(212,175,55,0.16)), transparent 70%);
  transition: opacity .35s;
}
.sp-card-corner {
  position: absolute; top: 12px; right: 12px; width: 18px; height: 18px; z-index: 1;
  border-top: 1.5px solid color-mix(in srgb, var(--ic,#D4AF37) 55%, transparent);
  border-right: 1.5px solid color-mix(in srgb, var(--ic,#D4AF37) 55%, transparent);
  opacity: 0.35; transition: opacity .35s, transform .45s cubic-bezier(0.16,1,0.3,1);
}
.sp-card:hover .sp-card-glow { opacity: 1; }
.sp-card:hover .sp-card-corner { opacity: 1; transform: translate(2px, -2px); }
.sp-card:hover {
  transform: translateY(-7px) rotateX(2.5deg);
  box-shadow:
    0 28px 56px -22px rgba(0,0,0,0.75),
    0 0 36px -12px color-mix(in srgb, var(--ic,#D4AF37) 45%, transparent);
}
.sp-ico-svg { width: 22px; height: 22px; position: relative; z-index: 1; }
.sp-for-check svg { width: 12px; height: 12px; }
.sp-card.f1{--c:rgba(59,130,246,0.16);--ic:#60A5FA}
.sp-card.f2{--c:rgba(212,175,55,0.16);--ic:#F0C75E}
.sp-card.f3{--c:rgba(168,176,188,0.16);--ic:#A8B0BC}
.sp-card.f4{--c:rgba(240,199,94,0.16);--ic:#F0C75E}
.sp-card.f5{--c:rgba(59,130,246,0.16);--ic:#3B82F6}
.sp-card.f6{--c:rgba(96,165,250,0.16);--ic:#60A5FA}
.sp-card.f7{--c:rgba(212,175,55,0.14);--ic:#D4AF37}
.sp-card.f8{--c:rgba(168,176,188,0.16);--ic:#A8B0BC}
.sp-card.f9{--c:rgba(96,165,250,0.14);--ic:#60A5FA}
.sp-card-icon {
  position: relative;
  width: 48px; height: 48px; margin-bottom: 16px;
  display: grid; place-items: center; border-radius: 14px;
  color: var(--ic,#F0C75E);
  background: color-mix(in srgb, var(--ic,#F0C75E) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--ic,#F0C75E) 32%, transparent);
  z-index: 1;
}
.sp-card-ring {
  position: absolute; inset: -5px; border-radius: 18px; pointer-events: none;
  border: 1px solid color-mix(in srgb, var(--ic,#D4AF37) 35%, transparent);
  opacity: 0; transform: scale(0.92) rotate(0deg);
}
.sp-card:hover .sp-card-ring,
.sp-eco-card:hover .sp-card-ring {
  opacity: 0.85;
  animation: ringSpin 4.5s linear infinite;
}
@keyframes ringSpin {
  from { transform: scale(1) rotate(0deg); }
  to { transform: scale(1) rotate(360deg); }
}
.sp-card-tag {
  position: relative; z-index: 1;
  display: inline-flex; align-items: center;
  font-family: var(--font-mono);
  font-size: 10px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--ic,#F0C75E);
  padding: 4px 9px; border-radius: 999px;
  background: color-mix(in srgb, var(--ic,#D4AF37) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--ic,#D4AF37) 26%, transparent);
}
.sp-card h3 {
  position: relative; z-index: 1;
  margin: 12px 0 8px;
  font-family: var(--font-display);
  font-size: 18.5px; font-weight: 800; letter-spacing: -0.035em; line-height: 1.2;
}
.sp-card p { position: relative; z-index: 1; margin: 0; font-size: 13.5px; line-height: 1.58; color: var(--muted); }

.sp-why { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 28px; }
@media(max-width:600px) { .sp-why { grid-template-columns: 1fr; } }
.sp-why-item {
  display: flex; align-items: center; gap: 12px;
  font-size: 14.5px; color: #e8ecf2; font-weight: 500;
  padding: 12px 0; border-bottom: 1px solid var(--line);
}
.sp-why-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; background: var(--gold); }

.sp-phases { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 28px; }
@media(max-width:900px) { .sp-phases { grid-template-columns: 1fr 1fr; } }
@media(max-width:520px) { .sp-phases { grid-template-columns: 1fr; } }
.sp-phase {
  border: 1px solid transparent; border-radius: 16px; padding: 20px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)) padding-box,
    linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03)) border-box;
  transition: transform .4s cubic-bezier(0.16,1,0.3,1), box-shadow .35s ease;
}
.sp-phase:hover { transform: translateY(-3px); }
.sp-phase-active {
  background:
    linear-gradient(160deg, rgba(212,175,55,0.1), rgba(255,255,255,0.01)) padding-box,
    linear-gradient(145deg, rgba(212,175,55,0.45), rgba(240,199,94,0.12), rgba(255,255,255,0.04)) border-box;
  box-shadow: 0 0 32px -12px rgba(212,175,55,0.35);
}
.sp-phase-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.sp-phase-k { font-family: var(--font-display); font-size: 13px; font-weight: 700; }
.sp-phase-badge {
  font-family: var(--font-mono); font-size: 9.5px; font-weight: 600;
  letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted);
}
.sp-phase-badge-active { color: var(--gold-hi); }
.sp-phase p { margin: 0; font-size: 13px; line-height: 1.55; color: var(--muted); }

.sp-for { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 28px; }
@media(max-width:600px) { .sp-for { grid-template-columns: 1fr; } }
.sp-for-item {
  display: flex; align-items: center; gap: 12px;
  font-size: 14.5px; color: #e8ecf2; font-weight: 500;
  padding: 12px 0; border-bottom: 1px solid var(--line);
}
.sp-for-check {
  width: 20px; height: 20px; flex-shrink: 0; display: grid; place-items: center;
  border-radius: 6px; background: rgba(212,175,55,0.12); color: var(--gold-hi);
}

.sp-eco { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 28px; }
@media(max-width:760px) { .sp-eco { grid-template-columns: 1fr; } }
.sp-eco-card {
  position: relative; isolation: isolate; overflow: hidden;
  border: 1px solid transparent; border-radius: 16px; padding: 26px;
  background:
    linear-gradient(160deg, rgba(212,175,55,0.07), rgba(255,255,255,0.015) 50%, rgba(8,12,20,0.5)) padding-box,
    linear-gradient(145deg, rgba(255,255,255,0.18), color-mix(in srgb, var(--ic,#D4AF37) 35%, transparent), rgba(255,255,255,0.04)) border-box;
  transition: transform .45s cubic-bezier(0.16,1,0.3,1), box-shadow .4s ease;
  box-shadow: 0 18px 40px -28px rgba(0,0,0,0.7);
}
.sp-eco-card .sp-card-border {
  position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: radial-gradient(ellipse 70% 50% at 20% 0%, color-mix(in srgb, var(--ic,#D4AF37) 22%, transparent), transparent 65%);
  opacity: 0.65;
}
.sp-eco-card:hover {
  transform: translateY(-6px) rotateX(1.5deg);
  box-shadow:
    0 28px 56px -22px rgba(0,0,0,0.75),
    0 0 40px -10px color-mix(in srgb, var(--ic,#D4AF37) 40%, transparent);
}
.sp-eco-icon {
  position: relative;
  width: 50px; height: 50px; margin-bottom: 14px;
  display: grid; place-items: center; border-radius: 14px;
  color: var(--ic,#F0C75E);
  background: color-mix(in srgb, var(--ic,#F0C75E) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--ic,#F0C75E) 32%, transparent);
}
.sp-eco-card h3 { margin: 0; font-family: var(--font-display); font-size: 22px; font-weight: 800; letter-spacing: -0.035em; }
.sp-eco-card p { margin: 10px 0 16px; font-size: 14px; color: var(--muted); line-height: 1.55; }
.sp-eco-link {
  position: relative;
  display: inline-block;
  font-family: var(--font-display); font-size: 13.5px; font-weight: 700; color: var(--gold-hi);
}
.sp-eco-link::after {
  content: ""; position: absolute; left: 0; bottom: -3px; height: 1.5px; width: 0;
  background: linear-gradient(90deg, var(--gold-hi), transparent);
  transition: width .4s cubic-bezier(0.16,1,0.3,1);
}
.sp-eco-card:hover .sp-eco-link::after { width: 100%; }

.sp-close {
  position: relative; z-index: 2; text-align: center;
  padding: clamp(80px, 13vw, 150px) 22px; overflow: hidden;
}
.sp-close-bg {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse at 50% 20%, rgba(212,175,55,0.12), transparent 55%),
    radial-gradient(ellipse at 50% 100%, rgba(59,130,246,0.1), transparent 50%);
}
.sp-close h2 {
  position: relative; margin: 0;
  font-family: var(--font-display);
  font-size: clamp(30px, 5.4vw, 56px);
  line-height: 1.05; letter-spacing: -0.04em; font-weight: 700;
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
.sp-foot-cols a, .sp-foot-ca {
  display: block; font-size: 13.5px; color: #8b95a8; margin-bottom: 8px; font-weight: 500; text-align: left;
}
.sp-foot-cols a:hover, .sp-foot-ca:hover { color: var(--gold-hi); }
.sp-foot-bottom {
  max-width: 1140px; margin: 32px auto 0; padding-top: 18px;
  border-top: 1px solid var(--line); font-size: 12px; color: #5a6275;
  display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap;
}
.sp-foot-mint {
  font-family: var(--font-mono);
  font-size: 10px; word-break: break-all; color: #6b7280;
}

.reveal {
  opacity: 0;
  transform: translateY(28px) scale(0.985);
  filter: blur(6px);
  clip-path: inset(8% 0 0 0);
  transition:
    opacity .95s cubic-bezier(0.16,1,0.3,1),
    transform .95s cubic-bezier(0.16,1,0.3,1),
    filter .95s cubic-bezier(0.16,1,0.3,1),
    clip-path .95s cubic-bezier(0.16,1,0.3,1);
}
.reveal.in {
  opacity: 1;
  transform: none;
  filter: none;
  clip-path: inset(0 0 0 0);
}
.stagger {
  opacity: 0;
  transform: translateY(18px) scale(0.98);
  filter: blur(4px);
  transition:
    opacity .7s cubic-bezier(0.16,1,0.3,1),
    transform .7s cubic-bezier(0.16,1,0.3,1),
    filter .7s cubic-bezier(0.16,1,0.3,1);
}
.stagger.in {
  opacity: 1;
  transform: none;
  filter: none;
}
.sp ::selection { background: rgba(212,175,55,0.3); color: #fff; }
@media (prefers-reduced-motion: no-preference) { .sp { scroll-behavior: smooth; } }
@media (prefers-reduced-motion: reduce) {
  .sp-hero-globe, .sp-live-dot, .sp-marquee-track, .sp-hero-scroll i, .sp-show-slide.is-on, .sp-show-progress i, .sp-card-ring { animation: none !important; }
  .sp-hero-plane, .sp-show-slide, .sp-card, .sp-eco-card { transition: opacity .35s ease !important; transform: none !important; }
  .reveal, .stagger {
    opacity: 1 !important; transform: none !important; filter: none !important;
    clip-path: none !important; animation: none !important;
  }
}
`;
