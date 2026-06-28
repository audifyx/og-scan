import { useEffect, useRef, useState, useCallback } from "react";
import logo from "@/assets/logo.png";

/* ── Data ───────────────────────────────────────────────────────── */

const HERO_FRAMES = [
  { src: "/bg/bg-nebula.jpg", label: "OG DEX", caption: "Live screener & trade", accent: "#2F80FF" },
  { src: "/bg/bg-galaxy.jpg", label: "Scanner", caption: "Forensic on-chain scan", accent: "#14E0C8" },
  { src: "/bg/bg-aurora.jpg", label: "Social", caption: "Spaces · voice · chat", accent: "#9945FF" },
  { src: "/bg/bg-earth.jpg", label: "Intelligence", caption: "Smart money & AI", accent: "#FFC53D" },
] as const;

const BRAND = "OrbitX";

const LINKS = {
  app: "https://orbitx.world",
  signin: "/auth?mode=signin",
  signup: "/auth?mode=signup",
  telegram: "https://t.me/ogscan",
  x: "https://x.com/orbitx_wrldbackup",
  xOrbitXPredictionMarket: "https://x.com/orbitx-predictionbet",
  ogdex: "/ORBITX_DEX",
  orbitxPrediction: "https://orbitx-prediction.fun",
  degen: "https://degen-tower.vercel.app",
  privacy: "/privacy",
  terms: "/terms",
};

type Feature = { tag: string; title: string; copy: string; tone: string; icon: string };
const FEATURES: Feature[] = [
  { tag: "Discovery", title: "Intelligent token discovery", tone: "f1", icon: "🔍",
    copy: "Real-time multi-chain scanner with a proprietary OG Score — on-chain metrics, holder quality, momentum and AI signals. Trending, hidden gems and about-to-explode, powered by live data." },
  { tag: "Wallet forensics", title: "Track smart money like a pro", tone: "f2", icon: "💰",
    copy: "Any wallet's full history, win rate, hold time and PnL. Smart-money and KOL labels (Ansem, blknoiz06 + 37 more mapped), whale alerts and full holder lists with one-click actions." },
  { tag: "OG DEX", title: "Blazing-fast trading & execution", tone: "f3", icon: "⚡",
    copy: "Live orderbook-style screener, one-click trading with Phantom, real-time buy/sell feeds, advanced charts with on-chain overlays and portfolio across every wallet." },
  { tag: "Launch", title: "Fair-launch & token tools", tone: "f4", icon: "🚀",
    copy: "Simple, powerful token creation with anti-rug safeguards, auto-listing on our DEX + aggregators, and post-launch monitoring with community tools baked in from minute one." },
  { tag: "OrbitX Prediction Market", title: "Prediction markets & 1v1 games", tone: "f5", icon: "🎯",
    copy: "Native prediction markets plus Coinflip, Dice, Crash and Plinko with provably-fair, on-chain settlement — wired into your OrbitX insights, with leaderboards and achievements." },
  { tag: "Social", title: "Community & social layer", tone: "f6", icon: "💬",
    copy: "Host Twitter Spaces with token context, voice lobbies, per-token chat and updates, creator tools, and a cross-platform identity that follows you across trading, gaming and social." },
  { tag: "AI", title: "AI-powered intelligence", tone: "f7", icon: "🧠",
    copy: "Ask: 'which wallets bought $TOKEN in the last 30 min?' or 'top smart-money accumulating now?' Natural-language queries across all on-chain data, with automated reports and alerts." },
  { tag: "Gaming", title: "Degen Tower & entertainment", tone: "f8", icon: "🎮",
    copy: "Tap-to-earn with real USDC payouts, combos, upgrades and leaderboards — plus future games where in-game actions have on-chain consequences and rewards." },
  { tag: "Developers", title: "Creator & developer tools", tone: "f9", icon: "⚙️",
    copy: "Webhooks and a bot framework, API access for power users, white-label community builds and monetization for projects — featured listings, premium analytics, promoted Spaces." },
];

const PHASES = [
  { k: "Phase 1", t: "Now", d: "Core intelligence + trading + social/gaming primitives.", active: true },
  { k: "Phase 2", t: "Near-term", d: "Deep KOL/smart-money tools, AI analyst, voice lobbies, Spaces, expanded predictions, creator monetization.", active: false },
  { k: "Phase 3", t: "Coming", d: "Full social graph, on-chain identity, cross-platform reputation, copy-trading automation, multi-chain, mobile.", active: false },
  { k: "Phase 4", t: "Vision", d: "The default operating system for anyone serious about on-chain crypto.", active: false },
];

const FOR = [
  "Degens who want better tools than everyone else",
  "Serious traders tired of fragmented data",
  "KOLs & creators who want to own their community",
  "New projects that want a real home base",
  "Power users who want APIs, webhooks & bots",
  "Casual users who want one clean place to trade, play & hang out",
];

/* ── Animated counter hook ──────────────────────────────────────── */

function useCounter(end: number, duration = 2000, start = 0, suffix = "") {
  const [value, setValue] = useState(start);
  const ref = useRef<HTMLElement>(null);
  const counted = useRef(false);

  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !counted.current) {
          counted.current = true;
          const t0 = performance.now();
          const tick = () => {
            const progress = Math.min((performance.now() - t0) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 4);
            setValue(Math.round(start + (end - start) * ease));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [end, duration, start]);

  return { ref, display: `${value}${suffix}` };
}

/* ── Canvas particles ───────────────────────────────────────────── */

function useParticles(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let particles: { x: number; y: number; vx: number; vy: number; r: number; o: number; color: string }[] = [];
    const COLORS = ["#2F80FF", "#9945FF", "#14E0C8", "#FFC53D", "#ff6bd0"];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const COUNT = Math.min(80, Math.floor(window.innerWidth / 18));
    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 2 + 0.5,
        o: Math.random() * 0.5 + 0.1,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.o;
        ctx.fill();

        // Draw connections
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 140) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = p.color;
            ctx.globalAlpha = (1 - dist / 140) * 0.08;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [canvasRef]);
}

/* ── Component ──────────────────────────────────────────────────── */

export default function Splash() {
  const heroRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [heroFrame, setHeroFrame] = useState(0);
  const [heroReady, setHeroReady] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });

  useParticles(canvasRef);

  const stat1 = useCounter(16, 1600, 0, "");
  const stat2 = useCounter(500, 2000, 0, "+");
  const stat3 = useCounter(2, 1800, 0, "M+");
  const stat4 = useCounter(10, 1400, 0, "ms");

  useEffect(() => {
    const ready = setTimeout(() => setHeroReady(true), 120);
    const cycle = setInterval(() => setHeroFrame((i) => (i + 1) % 4), 4200);
    return () => { clearTimeout(ready); clearInterval(cycle); };
  }, []);

  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          // Stagger children
          const children = e.target.querySelectorAll<HTMLElement>(".stagger");
          children.forEach((child, i) => {
            child.style.transitionDelay = `${i * 80}ms`;
            child.classList.add("in");
          });
        }
      }),
      { threshold: 0.1 }
    );
    document.querySelectorAll<HTMLElement>(".reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (heroRef.current) {
        heroRef.current.style.setProperty("--py", `${y * 0.3}px`);
        heroRef.current.style.setProperty("--pf", `${Math.max(0, 1 - y / 500)}`)
      }
      document.querySelector(".sp-nav")?.classList.toggle("scrolled", y > 20);
    };
    const onMove = (e: MouseEvent) => {
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;
      setMousePos({ x, y });
      if (heroRef.current) {
        heroRef.current.style.setProperty("--mx", `${(x - 0.5) * 40}px`);
        heroRef.current.style.setProperty("--my", `${(y - 0.5) * 30}px`);
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
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    e.currentTarget.style.setProperty("--card-x", `${x}%`);
    e.currentTarget.style.setProperty("--card-y", `${y}%`);
  }, []);

  return (
    <div className="sp">
      <style>{css}</style>

      {/* ─── Particle canvas ─── */}
      <canvas ref={canvasRef} className="sp-particles" aria-hidden />

      {/* ─── Noise overlay ─── */}
      <div className="sp-noise" aria-hidden />

      {/* ─── Nav ─── */}
      <nav className="sp-nav">
        <a className="sp-brand" href="/">
          <span className="sp-mark" />
          <span className="sp-brand-text">{BRAND}</span>
        </a>
        <div className="sp-links">
          <a href="#problem">The problem</a>
          <a href="#build">What we build</a>
          <a href="#roadmap">Roadmap</a>
          <a href="#ecosystem">Ecosystem</a>
        </div>
        <div className="sp-nav-cta">
          <a className="sp-btn-ghost sm" href={LINKS.signin}>Sign in</a>
          <a className="sp-cta" href={LINKS.signup}>
            <span>Get started</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </a>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <header className={`sp-hero ${heroReady ? "sp-hero-ready" : ""}`} ref={heroRef}>
        <div className="sp-hero-bg" aria-hidden>
          {HERO_FRAMES.map((f, i) => (
            <div
              key={f.src}
              className={`sp-hero-photo ${i === heroFrame ? "is-active" : ""}`}
              style={{ backgroundImage: `url(${f.src})` }}
            />
          ))}
          <div className="sp-mesh" />
          <div className="orb orb-a" />
          <div className="orb orb-b" />
          <div className="orb orb-c" />
          <div className="orb orb-d" />
          <div className="sp-grid-overlay" />
        </div>

        <div className="sp-hero-layout">
          <div className="sp-hero-inner">
            <div className="sp-hero-badge">
              <div className="sp-logo-ring">
                <img src={logo} alt="" width={36} height={36} className="sp-hero-logo" />
              </div>
              <p className="sp-eyebrow">
                <span className="sp-eyebrow-dot" />
                {BRAND} · The On-Chain OS
              </p>
            </div>

            <h1 className="sp-h1">
              <div className="sp-h1-line" style={{ animationDelay: "0.2s" }}>One platform.</div>
              <div className="sp-h1-line" style={{ animationDelay: "0.4s" }}>One ecosystem.</div>
              <div className="sp-h1-line" style={{ animationDelay: "0.6s" }}>
                <span className="sp-gradient-text">One place.</span>
              </div>
            </h1>

            <p className="sp-lead">
              Crypto tooling is a sea of clones and disconnected tabs. We&apos;re building the everything app for on-chain — trading, launching, intelligence, community, prediction markets and games in a single destination, powered by real on-chain data and AI that understands what you&apos;re trying to do.
            </p>

            <div className="sp-hero-actions">
              <a className="sp-btn-primary" href={LINKS.signup}>
                <span className="sp-btn-glow" />
                <span className="sp-btn-text">Get started free</span>
              </a>
              <a className="sp-btn-ghost" href={LINKS.signin}>
                Sign in
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </a>
            </div>
          </div>

          <div className="sp-showcase">
            <div className="sp-data-grid">
              {[
                { ref: stat1.ref, display: stat1.display, label: "Blockchains" },
                { ref: stat2.ref, display: stat2.display, label: "Live pairs" },
                { ref: stat3.ref, display: stat3.display, label: "Wallets tracked" },
                { ref: stat4.ref, display: stat4.display, label: "Avg scan time" },
              ].map((item, i) => (
                <div key={item.label} className="sp-data-cell" style={{ animationDelay: `${0.6 + i * 0.12}s` }} onMouseMove={handleCardMouse}>
                  <div className="sp-data-cell-glow" />
                  <strong className="sp-data-num" ref={item.ref as React.Ref<HTMLElement>}>{item.display}</strong>
                  <span className="sp-data-label">{item.label}</span>
                </div>
              ))}
            </div>
            {/* Decorative orbital ring */}
            <div className="sp-orbital" aria-hidden>
              <div className="sp-orbital-ring" />
              <div className="sp-orbital-ring sp-orbital-ring-2" />
              <div className="sp-orbital-dot" />
            </div>
          </div>
        </div>

        <div className="sp-scroll-indicator" aria-hidden>
          <div className="sp-scroll-line" />
          <span className="sp-scroll-text">Scroll</span>
        </div>
      </header>

      {/* ─── Marquee ─── */}
      <div className="sp-marquee" aria-hidden>
        <div className="sp-marquee-track">
          {Array.from({ length: 3 }).map((_, i) => (
            <span key={i}>
              <span className="sp-marquee-item">Token discovery</span>
              <span className="sp-marquee-dot">◆</span>
              <span className="sp-marquee-item">Wallet forensics</span>
              <span className="sp-marquee-dot">◆</span>
              <span className="sp-marquee-item">Smart money</span>
              <span className="sp-marquee-dot">◆</span>
              <span className="sp-marquee-item">OG DEX</span>
              <span className="sp-marquee-dot">◆</span>
              <span className="sp-marquee-item">Fair launches</span>
              <span className="sp-marquee-dot">◆</span>
              <span className="sp-marquee-item">Prediction markets</span>
              <span className="sp-marquee-dot">◆</span>
              <span className="sp-marquee-item">Voice & Spaces</span>
              <span className="sp-marquee-dot">◆</span>
              <span className="sp-marquee-item">AI analyst</span>
              <span className="sp-marquee-dot">◆</span>
              <span className="sp-marquee-item">Degen Tower</span>
              <span className="sp-marquee-dot">◆</span>
              <span className="sp-marquee-item">APIs</span>
              <span className="sp-marquee-dot">◆</span>
            </span>
          ))}
        </div>
      </div>

      {/* ─── Problem ─── */}
      <section id="problem" className="sp-sec reveal">
        <span className="sp-kicker">The problem</span>
        <h2 className="sp-h2">You shouldn&apos;t need<br/>12 tabs to trade.</h2>
        <p className="sp-body">
          The average trader juggles 8–12 disconnected tools just to have a functional workflow. Nothing talks to each other. When you find a good token you can&apos;t instantly see which KOLs hold it, smart-money pressure, top-holder history or community sentiment. You piece it together manually like it&apos;s 2017.
        </p>
        <div className="sp-chips">
          {["Pump.fun / Raydium","Dexscreener / Birdeye","Nansen / Arkham","Twitter + Telegram","Prediction sites","Random TG bots","Phantom / Solflare","Notion KOL notes","Holder checkers","Portfolio dashboards"].map((c, i) => (
            <span key={c} className="sp-chip stagger" style={{ transitionDelay: `${i * 50}ms` }}>{c}</span>
          ))}
        </div>
        <p className="sp-body sp-dim">The future isn&apos;t more single-purpose apps. It&apos;s convergence — one intelligent platform that surfaces the exact info and actions you need, instantly.</p>
      </section>

      {/* ─── Build ─── */}
      <section id="build" className="sp-sec reveal">
        <span className="sp-kicker">What we&apos;re building</span>
        <h2 className="sp-h2">A complete operating system<br/>for the on-chain economy.</h2>
        <div className="sp-grid">
          {FEATURES.map((f, i) => (
            <article
              key={f.tag}
              className={`sp-card ${f.tone} stagger`}
              style={{ transitionDelay: `${i * 70}ms` }}
              onMouseMove={handleCardMouse}
            >
              <div className="sp-card-glow" />
              <div className="sp-card-icon">{f.icon}</div>
              <span className="sp-card-tag">{f.tag}</span>
              <h3>{f.title}</h3>
              <p>{f.copy}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ─── Why ─── */}
      <section className="sp-sec reveal">
        <span className="sp-kicker">Why this is different</span>
        <h2 className="sp-h2">Build the platform we wished existed while grinding every day.</h2>
        <div className="sp-why">
          {["No more tab switching","No more paying 5 services for basic alpha","No more guessing if a wallet is smart or lucky","No more launching a coin with zero tools to grow it","No more community as an afterthought","Everything connected by design"].map((w, i) => (
            <div key={w} className="sp-why-item stagger" style={{ transitionDelay: `${i * 60}ms` }}>
              <span className="sp-why-dot" />
              <span>{w}</span>
            </div>
          ))}
        </div>
        <p className="sp-body">Open a token and instantly see the full on-chain picture, which KOLs and smart wallets are in, jump into trading, host a Space, drop into a voice lobby, check related prediction markets and read live sentiment — without ever leaving the platform.</p>
      </section>

      {/* ─── Roadmap ─── */}
      <section id="roadmap" className="sp-sec reveal">
        <span className="sp-kicker">Roadmap</span>
        <h2 className="sp-h2">Shipping daily. Building in public.</h2>
        <div className="sp-phases">
          {PHASES.map((p, i) => (
            <div key={p.k} className={`sp-phase stagger ${p.active ? "sp-phase-active" : ""}`} style={{ transitionDelay: `${i * 100}ms` }}>
              <div className="sp-phase-header">
                <span className="sp-phase-k">{p.k}</span>
                <span className={`sp-phase-badge ${p.active ? "sp-phase-badge-active" : ""}`}>{p.t}</span>
              </div>
              <p>{p.d}</p>
              {p.active && <div className="sp-phase-pulse" />}
            </div>
          ))}
        </div>
      </section>

      {/* ─── Who ─── */}
      <section className="sp-sec reveal">
        <span className="sp-kicker">Who it&apos;s for</span>
        <h2 className="sp-h2">For people tired of the same old thing.</h2>
        <div className="sp-for">
          {FOR.map((f, i) => (
            <div key={f} className="sp-for-item stagger" style={{ transitionDelay: `${i * 70}ms` }}>
              <span className="sp-for-check">✓</span>
              <span>{f}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Ecosystem ─── */}
      <section id="ecosystem" className="sp-sec reveal">
        <span className="sp-kicker">The ecosystem</span>
        <h2 className="sp-h2">Already live. Already shipping.</h2>
        <div className="sp-eco">
          <a className="sp-eco-card stagger" href={LINKS.ogdex} onMouseMove={handleCardMouse}>
            <div className="sp-eco-glow" />
            <div className="sp-eco-icon">📊</div>
            <h3>OG DEX</h3>
            <p>Real-time Solana screener, scanner & trading.</p>
            <span className="sp-eco-link">Open <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></span>
          </a>
          <a className="sp-eco-card stagger" href={LINKS.orbitxPrediction} target="_blank" rel="noreferrer" onMouseMove={handleCardMouse} style={{ transitionDelay: "100ms" }}>
            <div className="sp-eco-glow" />
            <div className="sp-eco-icon">🎯</div>
            <h3>OrbitX Prediction Market</h3>
            <p>Prediction markets + provably-fair 1v1 games.</p>
            <span className="sp-eco-link">orbitx-prediction.fun <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></span>
          </a>
          <a className="sp-eco-card stagger" href={LINKS.degen} target="_blank" rel="noreferrer" onMouseMove={handleCardMouse} style={{ transitionDelay: "200ms" }}>
            <div className="sp-eco-glow" />
            <div className="sp-eco-icon">🎮</div>
            <h3>Degen Tower</h3>
            <p>Tap-to-earn with real USDC payouts.</p>
            <span className="sp-eco-link">Play <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></span>
          </a>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="sp-close reveal">
        <div className="sp-close-bg" aria-hidden />
        <h2>The last platform you ever open<br/>for on-chain activity.</h2>
        <p>New name coming soon. New domain coming soon. Create your account and dive in.</p>
        <a className="sp-btn-primary lg" href={LINKS.signup}>
          <span className="sp-btn-glow" />
          <span className="sp-btn-text">Sign up now</span>
        </a>
      </section>

      {/* ─── Footer ─── */}
      <footer className="sp-foot">
        <div className="sp-foot-top">
          <a className="sp-brand" href="/">
            <span className="sp-mark" />
            <span className="sp-brand-text">{BRAND}</span>
          </a>
          <div className="sp-foot-cols">
            <div>
              <h4>Product</h4>
              <a href={LINKS.ogdex}>OG DEX</a>
              <a href={LINKS.orbitxPrediction} target="_blank" rel="noreferrer">OrbitX Prediction Market</a>
              <a href={LINKS.degen} target="_blank" rel="noreferrer">Degen Tower</a>
              <a href={LINKS.signup}>Sign up</a>
            </div>
            <div>
              <h4>Community</h4>
              <a href={LINKS.telegram} target="_blank" rel="noreferrer">Telegram</a>
              <a href={LINKS.x} target="_blank" rel="noreferrer">X · @orbitx_wrld</a>
              <a href={LINKS.xOrbitXPredictionMarket} target="_blank" rel="noreferrer">X · @orbitx-predictionbet</a>
            </div>
            <div>
              <h4>Legal</h4>
              <a href={LINKS.privacy}>Privacy Policy</a>
              <a href={LINKS.terms}>Terms of Service</a>
            </div>
          </div>
        </div>
        <div className="sp-foot-bottom">
          <span>© {new Date().getFullYear()} {BRAND}. Reimagined. Building in public, shipping daily.</span>
        </div>
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CSS — Ultra-premium glassmorphism + animation system
   ═══════════════════════════════════════════════════════════════════ */

const css = `
/* ── Reset & tokens ─── */
.sp {
  --bg: #030508;
  --bg-elevated: rgba(8, 12, 22, 0.7);
  --ink: #f0f2f5;
  --muted: #8b95a8;
  --line: rgba(255,255,255,0.06);
  --line-bright: rgba(255,255,255,0.12);
  --accent: #2F80FF;
  --accent2: #9945FF;
  --accent3: #14E0C8;
  --glass: rgba(12, 16, 28, 0.55);
  --glass-border: rgba(255,255,255,0.08);
  --glass-highlight: rgba(255,255,255,0.04);
  --radius-sm: 12px;
  --radius-md: 18px;
  --radius-lg: 24px;
  --radius-xl: 32px;
  --font-display: 'Space Grotesk', 'Inter', sans-serif;
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', monospace;
  background: var(--bg);
  color: var(--ink);
  overflow-x: hidden;
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
.sp *, .sp *::before, .sp *::after { box-sizing: border-box; }
.sp a { text-decoration: none; color: inherit; }

/* ── Noise texture ─── */
.sp-noise {
  position: fixed; inset: 0; z-index: 9999; pointer-events: none;
  opacity: 0.025;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 200px;
}

/* ── Canvas particles ─── */
.sp-particles {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  opacity: 0.6;
}

/* ── Nav ─── */
.sp-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 16px clamp(20px, 5vw, 56px);
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}
.sp-nav.scrolled {
  background: rgba(3, 5, 8, 0.65);
  backdrop-filter: saturate(180%) blur(24px);
  -webkit-backdrop-filter: saturate(180%) blur(24px);
  border-bottom: 1px solid var(--glass-border);
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.3);
}
.sp-brand {
  display: flex; align-items: center; gap: 10px;
  font-family: var(--font-display);
  font-weight: 700; letter-spacing: 0.12em; font-size: 16px; color: #fff;
}
.sp-brand-text { position: relative; }
.sp-mark {
  width: 20px; height: 20px; border-radius: 6px;
  background: conic-gradient(from 140deg, var(--accent), var(--accent2), var(--accent3), var(--accent));
  box-shadow: 0 0 20px rgba(47, 128, 255, 0.5), 0 0 40px rgba(153, 69, 255, 0.2);
  animation: spMarkSpin 8s linear infinite;
}
@keyframes spMarkSpin {
  to { filter: hue-rotate(360deg); }
}
.sp-links {
  display: flex; gap: 32px; font-size: 13.5px;
  font-weight: 500; color: var(--muted);
}
.sp-links a {
  position: relative; transition: color 0.3s;
}
.sp-links a::after {
  content: ""; position: absolute; bottom: -4px; left: 0; right: 0;
  height: 2px; border-radius: 2px;
  background: linear-gradient(90deg, var(--accent), var(--accent2));
  transform: scaleX(0); transform-origin: center;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.sp-links a:hover { color: #fff; }
.sp-links a:hover::after { transform: scaleX(1); }
.sp-nav-cta { display: flex; align-items: center; gap: 12px; }
.sp-cta {
  display: flex; align-items: center; gap: 6px;
  font-family: var(--font-display);
  font-size: 13.5px; font-weight: 700; color: #fff;
  padding: 10px 20px; border-radius: 980px;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  box-shadow: 0 0 20px rgba(47, 128, 255, 0.4), inset 0 1px 0 rgba(255,255,255,0.15);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative; overflow: hidden;
}
.sp-cta::before {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(135deg, transparent, rgba(255,255,255,0.15), transparent);
  transform: translateX(-100%);
  transition: transform 0.5s;
}
.sp-cta:hover { transform: translateY(-2px); box-shadow: 0 0 30px rgba(47, 128, 255, 0.6), 0 8px 32px rgba(47, 128, 255, 0.3); }
.sp-cta:hover::before { transform: translateX(100%); }
@media(max-width:880px) { .sp-links { display: none; } }
@media(max-width:520px) { .sp-btn-ghost.sm { display: none; } }

/* ── Buttons ─── */
.sp-btn-primary {
  position: relative; overflow: hidden;
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--font-display);
  font-weight: 700; font-size: 16px; color: #fff;
  padding: 16px 32px; border-radius: 980px;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  box-shadow: 0 0 30px rgba(47, 128, 255, 0.4), inset 0 1px 0 rgba(255,255,255,0.2);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: none; cursor: pointer;
}
.sp-btn-primary .sp-btn-glow {
  position: absolute; top: 50%; left: 50%; width: 120%; height: 120%;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(255,255,255,0.2), transparent 60%);
  opacity: 0; transition: opacity 0.4s;
}
.sp-btn-primary:hover .sp-btn-glow { opacity: 1; }
.sp-btn-primary .sp-btn-text { position: relative; z-index: 1; }
.sp-btn-primary:hover {
  transform: translateY(-3px) scale(1.02);
  box-shadow: 0 0 50px rgba(47, 128, 255, 0.5), 0 12px 40px rgba(47, 128, 255, 0.3);
}
.sp-btn-primary.lg { font-size: 18px; padding: 18px 40px; }
.sp-btn-ghost {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--font-display);
  font-weight: 600; font-size: 16px; color: rgba(255,255,255,0.8);
  padding: 16px 28px; border-radius: 980px;
  border: 1px solid var(--line-bright);
  background: var(--glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.sp-btn-ghost.sm { font-size: 13.5px; padding: 9px 18px; }
.sp-btn-ghost:hover {
  border-color: var(--accent);
  background: rgba(47, 128, 255, 0.1);
  color: #fff;
  box-shadow: 0 0 20px rgba(47, 128, 255, 0.15);
  transform: translateY(-1px);
}

/* ── Hero ─── */
.sp-hero {
  position: relative; min-height: 100vh;
  display: flex; align-items: center; justify-content: center;
  padding: 140px clamp(20px, 5vw, 56px) 100px;
  overflow: hidden;
}
.sp-hero-ready .sp-hero-inner { animation: spHeroIn 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both; }
.sp-hero-ready .sp-showcase { animation: spShowIn 1.3s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both; }
.sp-hero-layout {
  position: relative; z-index: 2;
  display: grid; grid-template-columns: 1.05fr 0.95fr;
  gap: clamp(30px, 5vw, 64px);
  width: min(1200px, 100%); align-items: center;
}
@media(max-width:980px) {
  .sp-hero-layout { grid-template-columns: 1fr; text-align: center; }
  .sp-hero-inner { max-width: 100%; margin: 0 auto; }
}

/* Hero background layers */
.sp-hero-bg { position: absolute; inset: 0; z-index: 0; }
.sp-hero-photo {
  position: absolute; inset: 0;
  background-position: center; background-size: cover; background-repeat: no-repeat;
  opacity: 0; transform: scale(1.06);
  transition: opacity 1.8s cubic-bezier(0.4, 0, 0.2, 1), transform 12s ease-out;
  filter: saturate(0.7) brightness(0.8);
}
.sp-hero-photo.is-active {
  opacity: 0.4;
  animation: heroDrift 24s ease-in-out infinite alternate;
}
.sp-hero-photo::after {
  content: ""; position: absolute; inset: 0;
  background:
    radial-gradient(ellipse at 50% 20%, transparent 20%, rgba(3,5,8,0.6) 70%),
    linear-gradient(180deg, rgba(3,5,8,0.2), rgba(3,5,8,0.6) 50%, var(--bg));
}
@keyframes heroDrift {
  0% { transform: scale(1.04) translate3d(0, 0, 0); }
  100% { transform: scale(1.12) translate3d(-1%, -1.5%, 0); }
}

/* Animated gradient mesh */
.sp-mesh {
  position: absolute; inset: 0; opacity: 0.5;
  background:
    radial-gradient(ellipse 600px 600px at 20% 30%, rgba(47, 128, 255, 0.15), transparent),
    radial-gradient(ellipse 500px 500px at 80% 60%, rgba(153, 69, 255, 0.12), transparent),
    radial-gradient(ellipse 400px 400px at 50% 80%, rgba(20, 224, 200, 0.08), transparent);
  animation: meshDrift 20s ease-in-out infinite alternate;
}
@keyframes meshDrift {
  0% { transform: translate(0, 0) rotate(0deg); }
  33% { transform: translate(2%, -1%) rotate(1deg); }
  66% { transform: translate(-1%, 2%) rotate(-1deg); }
  100% { transform: translate(1%, -2%) rotate(0.5deg); }
}

/* Orbs */
.orb {
  position: absolute; border-radius: 50%;
  filter: blur(80px); opacity: 0.35;
  transform: translate3d(var(--mx, 0), calc(var(--py, 0) + var(--my, 0)), 0);
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
}
.orb-a {
  width: 600px; height: 600px; top: -180px; left: -120px;
  background: radial-gradient(circle, rgba(47, 128, 255, 0.6), transparent 70%);
  animation: spOrbDrift 20s ease-in-out infinite;
}
.orb-b {
  width: 650px; height: 650px; top: -100px; right: -160px;
  background: radial-gradient(circle, rgba(153, 69, 255, 0.5), transparent 70%);
  animation: spOrbDrift 24s ease-in-out infinite reverse;
}
.orb-c {
  width: 550px; height: 550px; bottom: -200px; left: 30%;
  background: radial-gradient(circle, rgba(20, 224, 200, 0.4), transparent 70%);
  opacity: 0.25;
  animation: spOrbDrift 28s ease-in-out infinite;
}
.orb-d {
  width: 400px; height: 400px; top: 40%; right: 10%;
  background: radial-gradient(circle, rgba(255, 197, 61, 0.3), transparent 70%);
  opacity: 0.2;
  animation: spOrbDrift 22s ease-in-out infinite 2s;
}
@keyframes spOrbDrift {
  0% { transform: translate3d(var(--mx, 0), calc(var(--py, 0) + var(--my, 0)), 0) scale(1); }
  50% { transform: translate3d(calc(var(--mx, 0px) + 30px), calc(var(--py, 0px) + var(--my, 0px) + 24px), 0) scale(1.1); }
  100% { transform: translate3d(var(--mx, 0), calc(var(--py, 0) + var(--my, 0)), 0) scale(1); }
}

/* Grid overlay */
.sp-grid-overlay {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
  background-size: 60px 60px;
  -webkit-mask-image: radial-gradient(ellipse at 50% 30%, black, transparent 65%);
  mask-image: radial-gradient(ellipse at 50% 30%, black, transparent 65%);
  animation: gridPulse 8s ease-in-out infinite;
}
@keyframes gridPulse {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; }
}

/* Hero content */
@keyframes spHeroIn {
  from { opacity: 0; transform: translateY(48px) scale(0.97); filter: blur(8px); }
  to { opacity: 1; transform: none; filter: blur(0); }
}
@keyframes spShowIn {
  from { opacity: 0; transform: translateY(56px) scale(0.93); filter: blur(6px); }
  to { opacity: 1; transform: none; filter: blur(0); }
}

.sp-hero-inner {
  position: relative; max-width: 660px;
  opacity: var(--pf, 1);
}
@media(max-width:980px) { .sp-hero-inner { text-align: center; } }

/* Logo ring */
.sp-logo-ring {
  position: relative; display: inline-flex;
  padding: 4px; border-radius: 14px;
  background: conic-gradient(from 0deg, var(--accent), var(--accent2), var(--accent3), var(--accent));
  animation: logoRingSpin 6s linear infinite;
}
.sp-logo-ring::before {
  content: ""; position: absolute; inset: 0; border-radius: 14px;
  background: conic-gradient(from 0deg, var(--accent), var(--accent2), var(--accent3), var(--accent));
  filter: blur(12px); opacity: 0.5;
  animation: logoRingSpin 6s linear infinite;
}
@keyframes logoRingSpin {
  to { filter: hue-rotate(360deg); }
}
.sp-hero-logo {
  position: relative; z-index: 1;
  border-radius: 10px;
  animation: spLogoFloat 5s ease-in-out infinite;
}
@keyframes spLogoFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
.sp-hero-badge {
  display: flex; align-items: center; gap: 14px; margin-bottom: 24px;
}
@media(max-width:980px) { .sp-hero-badge { justify-content: center; } }
.sp-eyebrow {
  display: flex; align-items: center; gap: 8px;
  font-family: var(--font-mono);
  font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--accent); font-weight: 600; margin: 0;
}
.sp-eyebrow-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--accent3);
  box-shadow: 0 0 8px var(--accent3);
  animation: dotPulse 2s ease-in-out infinite;
}
@keyframes dotPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

/* Headline */
.sp-h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(44px, 7.2vw, 88px);
  line-height: 0.95; letter-spacing: -0.045em;
  font-weight: 700;
}
.sp-h1-line {
  opacity: 0; transform: translateY(30px);
  animation: lineReveal 0.9s cubic-bezier(0.16, 1, 0.3, 1) both;
}
@keyframes lineReveal {
  to { opacity: 1; transform: none; }
}
.sp-gradient-text {
  background: linear-gradient(135deg, var(--accent), var(--accent2), var(--accent3));
  background-size: 200% 200%;
  -webkit-background-clip: text; background-clip: text; color: transparent;
  animation: gradientFlow 4s ease-in-out infinite;
}
@keyframes gradientFlow {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
@media(max-width:480px) {
  .sp-h1 { font-size: clamp(36px, 10vw, 52px); line-height: 1.08; }
}

/* Lead */
.sp-lead {
  margin: 28px 0 0;
  font-size: clamp(15px, 1.6vw, 18px);
  line-height: 1.7; color: var(--muted);
  max-width: 58ch;
}
@media(max-width:980px) { .sp-lead { margin-left: auto; margin-right: auto; } }

/* Hero actions */
.sp-hero-actions { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 38px; }
@media(max-width:980px) { .sp-hero-actions { justify-content: center; } }

/* ── Showcase / Stats ─── */
.sp-showcase {
  position: relative; min-height: 380px;
  display: flex; align-items: center; justify-content: center;
}
.sp-data-grid {
  display: grid; grid-template-columns: repeat(2, 1fr);
  gap: 16px; width: min(540px, 100%); position: relative; z-index: 2;
}
.sp-data-cell {
  position: relative;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 26px 28px;
  background: var(--glass);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  animation: cellIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
  cursor: default;
}
@keyframes cellIn {
  from { opacity: 0; transform: translateY(30px) scale(0.95); }
  to { opacity: 1; transform: none; }
}
.sp-data-cell:hover {
  border-color: rgba(47, 128, 255, 0.3);
  transform: translateY(-6px) scale(1.02);
  box-shadow: 0 20px 60px -20px rgba(47, 128, 255, 0.2);
}
.sp-data-cell-glow {
  position: absolute; inset: 0; opacity: 0;
  background: radial-gradient(circle 120px at var(--card-x, 50%) var(--card-y, 50%), rgba(47, 128, 255, 0.15), transparent);
  transition: opacity 0.4s;
  pointer-events: none;
}
.sp-data-cell:hover .sp-data-cell-glow { opacity: 1; }
.sp-data-num {
  display: block;
  font-family: var(--font-display);
  font-size: clamp(36px, 4vw, 48px);
  font-weight: 700; letter-spacing: -0.03em;
  background: linear-gradient(180deg, #fff 20%, rgba(255,255,255,0.5));
  -webkit-background-clip: text; background-clip: text; color: transparent;
  line-height: 1;
}
.sp-data-label {
  display: block; margin-top: 8px;
  font-family: var(--font-mono);
  font-size: 11px; color: var(--muted);
  letter-spacing: 0.1em; text-transform: uppercase; font-weight: 600;
}

/* Orbital decoration */
.sp-orbital {
  position: absolute; inset: 0; pointer-events: none;
  display: flex; align-items: center; justify-content: center;
}
.sp-orbital-ring {
  position: absolute;
  width: 420px; height: 420px;
  border: 1px solid rgba(47, 128, 255, 0.1);
  border-radius: 50%;
  animation: orbitalSpin 30s linear infinite;
}
.sp-orbital-ring-2 {
  width: 520px; height: 520px;
  border-color: rgba(153, 69, 255, 0.08);
  animation-duration: 40s;
  animation-direction: reverse;
}
.sp-orbital-dot {
  position: absolute;
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 16px var(--accent);
  animation: orbitalSpin 30s linear infinite;
  transform-origin: 210px 0;
}
@keyframes orbitalSpin { to { transform: rotate(360deg); } }

/* Scroll indicator */
.sp-scroll-indicator {
  position: absolute; bottom: 36px; left: 50%;
  transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 10px;
}
.sp-scroll-line {
  width: 1px; height: 48px; position: relative; overflow: hidden;
  background: rgba(255,255,255,0.1); border-radius: 1px;
}
.sp-scroll-line::after {
  content: ""; position: absolute; top: -100%; left: 0;
  width: 1px; height: 100%;
  background: linear-gradient(to bottom, transparent, var(--accent));
  animation: scrollLine 2s ease-in-out infinite;
}
@keyframes scrollLine {
  0% { top: -100%; }
  100% { top: 100%; }
}
.sp-scroll-text {
  font-family: var(--font-mono);
  font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--muted); opacity: 0.6;
}

/* ── Marquee ─── */
.sp-marquee {
  position: relative;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  overflow: hidden; padding: 18px 0;
  background: rgba(255,255,255,0.015);
}
.sp-marquee::before, .sp-marquee::after {
  content: ""; position: absolute; top: 0; bottom: 0; width: 120px; z-index: 2;
}
.sp-marquee::before { left: 0; background: linear-gradient(90deg, var(--bg), transparent); }
.sp-marquee::after { right: 0; background: linear-gradient(90deg, transparent, var(--bg)); }
.sp-marquee-track {
  display: flex; white-space: nowrap; gap: 0;
  animation: mq 40s linear infinite;
}
.sp-marquee-item {
  font-family: var(--font-display);
  font-size: 14px; font-weight: 600; color: var(--muted);
}
.sp-marquee-dot {
  margin: 0 16px; font-size: 6px; color: var(--accent); opacity: 0.5;
}
@keyframes mq { to { transform: translateX(-33.333%); } }

/* ── Sections ─── */
.sp-sec {
  max-width: 1140px; margin: 0 auto;
  padding: clamp(72px, 12vw, 140px) clamp(20px, 5vw, 44px);
}
.sp-kicker {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 11px; font-weight: 700;
  letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--accent);
  padding: 8px 16px; border-radius: 980px;
  background: rgba(47, 128, 255, 0.08);
  border: 1px solid rgba(47, 128, 255, 0.15);
}
.sp-h2 {
  margin: 22px 0 0;
  font-family: var(--font-display);
  font-size: clamp(32px, 5vw, 56px);
  line-height: 1.06; letter-spacing: -0.035em;
  font-weight: 700; max-width: 16ch;
}
.sp-body {
  margin: 22px 0 0;
  font-size: clamp(15px, 1.5vw, 17px);
  line-height: 1.7; color: var(--muted); max-width: 62ch;
}
.sp-dim { color: #6b7384; }

/* ── Chips ─── */
.sp-chips { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 28px; }
.sp-chip {
  font-family: var(--font-body);
  font-size: 13px; color: #c7ccd6;
  padding: 9px 16px; border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
  background: var(--glass);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.sp-chip:hover {
  border-color: rgba(47, 128, 255, 0.35);
  background: rgba(47, 128, 255, 0.08);
  transform: translateY(-3px);
  box-shadow: 0 8px 24px -8px rgba(47, 128, 255, 0.15);
}

/* ── Feature cards ─── */
.sp-grid {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 18px; margin-top: 38px;
}
@media(max-width:900px) { .sp-grid { grid-template-columns: 1fr 1fr; } }
@media(max-width:600px) { .sp-grid { grid-template-columns: 1fr; } }

.sp-card {
  position: relative;
  border: 1px solid var(--glass-border);
  background: var(--glass);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: var(--radius-lg);
  padding: 28px;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: default;
}
.sp-card-glow {
  position: absolute; inset: 0; opacity: 0;
  background: radial-gradient(circle 150px at var(--card-x, 50%) var(--card-y, 50%), var(--c, rgba(47,128,255,0.12)), transparent);
  transition: opacity 0.4s; pointer-events: none;
}
.sp-card:hover .sp-card-glow { opacity: 1; }
.sp-card:hover {
  border-color: rgba(47, 128, 255, 0.3);
  transform: translateY(-6px);
  box-shadow: 0 24px 64px -24px rgba(47, 128, 255, 0.15);
}
.sp-card::before {
  content: ""; position: absolute; top: -1px; left: -1px; right: -1px;
  height: 2px; border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  background: linear-gradient(90deg, transparent, var(--c, var(--accent)), transparent);
  opacity: 0; transition: opacity 0.4s;
}
.sp-card:hover::before { opacity: 1; }
.sp-card.f1{--c:rgba(47,128,255,0.15)} .sp-card.f2{--c:rgba(20,241,149,0.15)} .sp-card.f3{--c:rgba(47,128,255,0.15)} .sp-card.f4{--c:rgba(255,197,61,0.15)} .sp-card.f5{--c:rgba(153,69,255,0.15)} .sp-card.f6{--c:rgba(255,107,208,0.15)} .sp-card.f7{--c:rgba(20,160,255,0.15)} .sp-card.f8{--c:rgba(255,138,61,0.15)} .sp-card.f9{--c:rgba(123,91,255,0.15)}
.sp-card-icon { font-size: 28px; margin-bottom: 10px; }
.sp-card-tag {
  position: relative;
  font-family: var(--font-mono);
  font-size: 10px; font-weight: 700;
  letter-spacing: 0.15em; text-transform: uppercase;
  color: var(--accent);
}
.sp-card h3 {
  position: relative; margin: 10px 0 10px;
  font-family: var(--font-display);
  font-size: 18px; font-weight: 700; letter-spacing: -0.01em;
}
.sp-card p {
  position: relative; margin: 0;
  font-size: 13.5px; line-height: 1.6; color: var(--muted);
}

/* ── Why ─── */
.sp-why {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 14px; margin-top: 32px;
}
@media(max-width:600px) { .sp-why { grid-template-columns: 1fr; } }
.sp-why-item {
  display: flex; align-items: center; gap: 14px;
  font-size: 15px; color: #dfe3ea;
  padding: 16px 20px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.sp-why-item:hover {
  border-color: rgba(47, 128, 255, 0.3);
  transform: translateY(-3px);
  box-shadow: 0 12px 32px -12px rgba(47, 128, 255, 0.15);
}
.sp-why-dot {
  width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  box-shadow: 0 0 12px var(--accent);
}

/* ── Phases ─── */
.sp-phases {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 16px; margin-top: 34px;
}
@media(max-width:900px) { .sp-phases { grid-template-columns: 1fr 1fr; } }
@media(max-width:520px) { .sp-phases { grid-template-columns: 1fr; } }
.sp-phase {
  position: relative;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 24px;
  background: var(--glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.sp-phase:hover {
  border-color: rgba(47, 128, 255, 0.3);
  transform: translateY(-4px);
  box-shadow: 0 16px 48px -16px rgba(47, 128, 255, 0.15);
}
.sp-phase-active {
  border-color: rgba(47, 128, 255, 0.25);
  background: linear-gradient(160deg, rgba(47, 128, 255, 0.08), var(--glass));
}
.sp-phase-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.sp-phase-k {
  font-family: var(--font-display);
  font-size: 14px; font-weight: 700; color: #fff;
}
.sp-phase-badge {
  font-family: var(--font-mono);
  font-size: 10px; font-weight: 700;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--muted);
  padding: 3px 10px; border-radius: 980px;
  border: 1px solid var(--glass-border);
}
.sp-phase-badge-active {
  color: var(--accent3);
  border-color: rgba(20, 224, 200, 0.3);
  background: rgba(20, 224, 200, 0.08);
}
.sp-phase p {
  margin: 0;
  font-size: 13.5px; line-height: 1.6; color: var(--muted);
}
.sp-phase-pulse {
  position: absolute; top: 12px; right: 12px;
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--accent3);
  box-shadow: 0 0 12px var(--accent3);
  animation: phasePulse 2s ease-in-out infinite;
}
@keyframes phasePulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.7); }
}

/* ── For ─── */
.sp-for {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 14px; margin-top: 32px;
}
@media(max-width:600px) { .sp-for { grid-template-columns: 1fr; } }
.sp-for-item {
  display: flex; align-items: center; gap: 14px;
  font-size: 15px; color: #dfe3ea;
  padding: 18px 22px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.sp-for-item:hover {
  border-color: rgba(47, 128, 255, 0.3);
  transform: translateY(-3px);
  box-shadow: 0 12px 32px -12px rgba(47, 128, 255, 0.15);
}
.sp-for-check {
  width: 24px; height: 24px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 800;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(47, 128, 255, 0.2), rgba(153, 69, 255, 0.2));
  color: var(--accent);
}

/* ── Eco ─── */
.sp-eco {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 18px; margin-top: 34px;
}
@media(max-width:760px) { .sp-eco { grid-template-columns: 1fr; } }
.sp-eco-card {
  position: relative;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 28px;
  background: linear-gradient(160deg, rgba(47, 128, 255, 0.06), var(--glass));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.sp-eco-glow {
  position: absolute; inset: 0; opacity: 0;
  background: radial-gradient(circle 150px at var(--card-x, 50%) var(--card-y, 50%), rgba(47, 128, 255, 0.12), transparent);
  transition: opacity 0.4s; pointer-events: none;
}
.sp-eco-card:hover .sp-eco-glow { opacity: 1; }
.sp-eco-card:hover {
  border-color: rgba(47, 128, 255, 0.4);
  transform: translateY(-6px);
  box-shadow: 0 24px 64px -20px rgba(47, 128, 255, 0.2);
}
.sp-eco-icon { font-size: 32px; margin-bottom: 12px; }
.sp-eco-card h3 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 22px; font-weight: 700;
}
.sp-eco-card p { margin: 10px 0 18px; font-size: 14px; color: var(--muted); line-height: 1.6; }
.sp-eco-link {
  display: flex; align-items: center; gap: 6px;
  font-family: var(--font-display);
  font-size: 13.5px; font-weight: 700; color: var(--accent);
  transition: gap 0.3s;
}
.sp-eco-card:hover .sp-eco-link { gap: 10px; }

/* ── Close CTA ─── */
.sp-close {
  position: relative; text-align: center;
  padding: clamp(100px, 16vw, 200px) 24px;
  overflow: hidden;
}
.sp-close-bg {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse at 50% 0%, rgba(47, 128, 255, 0.12), transparent 60%),
    radial-gradient(ellipse at 30% 80%, rgba(153, 69, 255, 0.06), transparent 50%);
}
.sp-close h2 {
  position: relative; margin: 0;
  font-family: var(--font-display);
  font-size: clamp(36px, 6.5vw, 72px);
  line-height: 1.04; letter-spacing: -0.04em; font-weight: 700;
}
.sp-close p {
  position: relative;
  margin: 24px 0 38px;
  font-size: 17px; color: var(--muted); line-height: 1.6;
}

/* ── Footer ─── */
.sp-foot {
  border-top: 1px solid var(--line);
  padding: 56px clamp(20px, 5vw, 56px) 32px;
}
.sp-foot-top {
  display: flex; justify-content: space-between; gap: 44px; flex-wrap: wrap;
  max-width: 1140px; margin: 0 auto;
}
.sp-foot-cols { display: flex; gap: clamp(28px, 6vw, 80px); flex-wrap: wrap; }
.sp-foot-cols h4 {
  font-family: var(--font-mono);
  font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase;
  color: #6b7384; margin: 0 0 14px; font-weight: 700;
}
.sp-foot-cols a {
  display: block; font-size: 14px; color: #8b95a8;
  margin-bottom: 10px; transition: color 0.2s;
}
.sp-foot-cols a:hover { color: var(--accent); }
.sp-foot-bottom {
  max-width: 1140px; margin: 40px auto 0;
  padding-top: 24px; border-top: 1px solid var(--line);
  font-size: 12px; color: #5a6275;
}

/* ── Reveal animations ─── */
.reveal {
  opacity: 0; transform: translateY(50px);
  transition: opacity 1s cubic-bezier(0.16, 1, 0.3, 1), transform 1s cubic-bezier(0.16, 1, 0.3, 1);
}
.reveal.in { opacity: 1; transform: none; }

.stagger {
  opacity: 0; transform: translateY(24px);
  transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
}
.stagger.in { opacity: 1; transform: none; }

/* ── Selection ─── */
.sp ::selection {
  background: rgba(47, 128, 255, 0.3);
  color: #fff;
}

/* ── Smooth scroll ─── */
@media (prefers-reduced-motion: no-preference) {
  .sp { scroll-behavior: smooth; }
}
`;
