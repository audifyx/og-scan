import { useEffect, useRef, useState } from "react";
import logo from "@/assets/logo.png";

const HERO_SLIDES = [
  { src: "/ogscan-splash-banner.jpg", label: "Platform", accent: "#2F80FF" },
  { src: "/ogscan-shot-screener.jpg", label: "Screener", accent: "#14E0C8" },
  { src: "/ogscan-shot-scanner.jpg", label: "Scanner", accent: "#9945FF" },
  { src: "/ogscan-shot-track.jpg", label: "Tracking", accent: "#FFC53D" },
];

const SHOWCASE_ITEMS = [
  { src: "/ogscan-shot-deck.jpg", label: "Dashboard", caption: "Command center", accent: "#2F80FF" },
  { src: "/ogscan-shot-screener.jpg", label: "Screener", caption: "Live pairs", accent: "#14E0C8" },
  { src: "/ogscan-shot-mobile.jpg", label: "Mobile", caption: "On the go", accent: "#9945FF" },
  { src: "/ogscan-shot-track.jpg", label: "Tracker", caption: "Smart money", accent: "#FFC53D" },
];

const BRAND = "OG Scan";
const LINKS = {
  app: "/ORBITX_DEX",
  signin: "/auth?mode=signin",
  signup: "/auth?mode=signup",
  telegram: "https://t.me/ogscan",
  x: "https://x.com/ogscan",
  privacy: "/privacy",
  terms: "/terms",
};

const FEATURES = [
  { title: "Multi-chain scanner", desc: "Forensic scanning across 16 blockchains with OG Score, holder quality, and risk flags.", img: "/ogscan-shot-scanner.jpg", tag: "Scan", accent: "#2F80FF" },
  { title: "Live screener", desc: "Orderbook-style screener with trending pairs, launches, and advanced filters.", img: "/ogscan-shot-screener.jpg", tag: "Trade", accent: "#14E0C8" },
  { title: "Smart money tracker", desc: "Top wallet PnL, win rate, timing patterns. KOL labels mapped in real-time.", img: "/ogscan-shot-track.jpg", tag: "Alpha", accent: "#9945FF" },
  { title: "Portfolio dashboard", desc: "Unified holdings across every wallet. See everything in one live view.", img: "/ogscan-shot-deck.jpg", tag: "Portfolio", accent: "#FFC53D" },
  { title: "AI analyst", desc: "Natural language queries. Ask anything about any token or wallet.", img: "/ogscan-splash-banner.jpg", tag: "AI", accent: "#14a0ff" },
  { title: "Reports & exports", desc: "Generate branded PDF reports with charts, metrics, and AI insights.", img: "/ogscan-shot-deck.jpg", tag: "Reports", accent: "#ff6bd0" },
];

export default function Splash() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [slide, setSlide] = useState(0);
  const [ready, setReady] = useState(false);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 60);
    const cycle = setInterval(() => setSlide((s) => (s + 1) % HERO_SLIDES.length), 5000);
    return () => { clearTimeout(t); clearInterval(cycle); };
  }, []);

  useEffect(() => {
    const onScroll = () => {
      document.querySelector(".sp-nav")?.classList.toggle("scrolled", window.scrollY > 24);
    };
    const onMove = (e: MouseEvent) => {
      if (!heroRef.current) return;
      setMouse({
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <div className="sp">
      <style>{css}</style>

      <nav className="sp-nav">
        <a className="sp-brand" href="/"><span className="sp-mark" />{BRAND}</a>
        <div className="sp-links">
          <a href="#problem">The problem</a>
          <a href="#build">What we build</a>
          <a href="#roadmap">Roadmap</a>
          <a href="#ecosystem">Ecosystem</a>
        </div>
        <div className="sp-nav-cta">
          <a className="btn-ghost sm" href={LINKS.signin}>Sign in</a>
          <a className="sp-cta" href={LINKS.signup}>Sign up</a>
        </div>
      </nav>

      {/* HERO */}
      <header className={`sp-hero ${heroReady ? "sp-hero-ready" : ""}`} ref={heroRef}>
        <div className="sp-hero-bg" aria-hidden>
          {HERO_FRAMES.map((frame, i) => (
            <div
              key={frame.src}
              className={`sp-hero-photo ${i === heroFrame ? "is-active" : ""}`}
              style={{ backgroundImage: `url(${frame.src})` }}
            />
          ))}
          <div className="sp-hero-flash" />
          <div className="orb orb-a" /><div className="orb orb-b" /><div className="orb orb-c" />
          <div className="grid-fade" />
          <div className="sp-hero-scan" />
          <div className="sp-hero-noise" />
        </div>

        <div className="sp-hero-layout">
          <div className="sp-hero-inner">
            <div className="sp-hero-badge">
              <img src={logo} alt="" width={28} height={28} className="sp-hero-logo" />
              <p className="sp-eyebrow">{BRAND} · Reimagined</p>
            </div>
            <h1 className="sp-h1" data-text="One platform. One ecosystem. One place.">
              One platform.<br/>One ecosystem.<br/><span>One place.</span>
            </h1>
            <p className="sp-lead">
              Crypto tooling is a sea of clones and disconnected tabs. We&apos;re building the
              everything app for on-chain — trading, launching, intelligence, community,
              prediction markets and games in a single destination, powered by real on-chain
              data and AI that understands what you&apos;re trying to do.
            </p>
            <div className="sp-hero-actions">
              <a className="btn-primary" href={LINKS.signup}>Sign up</a>
              <a className="btn-ghost" href={LINKS.signin}>Sign in →</a>
            </div>
          </div>

          <div className="sp-showcase" aria-hidden>
            <div className="sp-showcase-stage">
              {HERO_FRAMES.map((frame, i) => (
                <div
                  key={frame.label}
                  className={`sp-showcase-card ${i === heroFrame ? "is-active" : ""} ${i === (heroFrame + 1) % HERO_FRAMES.length ? "is-next" : ""}`}
                  style={{ ["--accent" as string]: frame.accent }}
                >
                  <div className="sp-showcase-frame">
                    <img src={frame.src} alt="" className="sp-showcase-img" />
                    <div className="sp-showcase-ui">
                      <span className="sp-showcase-dot" />
                      <span className="sp-showcase-bar" />
                      <span className="sp-showcase-bar short" />
                    </div>
                    <div className="sp-showcase-meta">
                      <strong>{frame.label}</strong>
                      <span>{frame.caption}</span>
                    </div>
                    <div className="sp-showcase-shine" />
                  </div>
                </div>
              ))}
            </div>
            <div className="sp-showcase-dots">
              {HERO_FRAMES.map((frame, i) => (
                <span key={frame.label} className={`sp-showcase-pip ${i === heroFrame ? "is-active" : ""}`} style={{ ["--accent" as string]: frame.accent }} />
              ))}
            </div>
            <div className="sp-showcase-glow" style={{ ["--accent" as string]: HERO_FRAMES[heroFrame].accent }} />
          </div>
        </div>

        <div className="scroll-hint" aria-hidden><span /></div>
      </header>

      {/* MARQUEE */}
      <div className="sp-marquee" aria-hidden>
        <div className="track">
          {Array.from({ length: 2 }).map((_, i) => (
            <span key={i}>Token discovery · Wallet forensics · Smart money · OG DEX · Fair launches · Prediction markets · Voice & Spaces · AI analyst · Degen Tower · APIs · </span>
          ))}
        </div>
      </div>

      {/* PLATFORM SHOWCASE STRIP */}
      <section className="sp-strip reveal" aria-label="Platform preview">
        <div className="sp-strip-track">
          {[...HERO_FRAMES, ...HERO_FRAMES].map((frame, i) => (
            <div key={`${frame.label}-${i}`} className="sp-strip-card" style={{ ["--accent" as string]: frame.accent }}>
              <img src={frame.src} alt="" className="sp-strip-img" loading="lazy" />
              <div className="sp-strip-overlay">
                <span>{frame.label}</span>
                <small>{frame.caption}</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PROBLEM */}
      <section id="problem" className="sp-sec reveal">
        <span className="sp-kicker">The problem</span>
        <h2 className="sp-h2">You shouldn&apos;t need 12 tabs to trade.</h2>
        <p className="sp-body">
          The average trader juggles 8–12 disconnected tools just to have a functional
          workflow. Nothing talks to each other. When you find a good token you can&apos;t
          instantly see which KOLs hold it, smart-money pressure, top-holder history or
          community sentiment. You piece it together manually like it&apos;s 2017.
        </p>
        <div className="sp-chips">
          {["Pump.fun / Raydium","Dexscreener / Birdeye","Nansen / Arkham","Twitter + Telegram","Prediction sites","Random TG bots","Phantom / Solflare","Notion KOL notes","Holder checkers","Portfolio dashboards"].map((c) => (
            <span key={c} className="sp-chip">{c}</span>
          ))}
        </div>
        <p className="sp-body dim">The future isn&apos;t more single-purpose apps. It&apos;s convergence — one intelligent platform that surfaces the exact info and actions you need, instantly.</p>
      </section>

      {/* WHAT WE BUILD */}
      <section id="build" className="sp-sec reveal">
        <span className="sp-kicker">What we&apos;re building</span>
        <h2 className="sp-h2">A complete operating system for the on-chain economy.</h2>
        <div className="sp-grid">
          {FEATURES.map((f) => (
            <article key={f.tag} className={`sp-card ${f.tone}`}>
              <span className="sp-card-tag">{f.tag}</span>
              <h3>{f.title}</h3>
              <p>{f.copy}</p>
            </article>
          ))}
        </div>
      </section>

      {/* WHY DIFFERENT */}
      <section className="sp-sec reveal">
        <span className="sp-kicker">Why this is different</span>
        <h2 className="sp-h2">Build the platform we wished existed while grinding every day.</h2>
        <div className="sp-why">
          {["No more tab switching","No more paying 5 services for basic alpha","No more guessing if a wallet is smart or lucky","No more launching a coin with zero tools to grow it","No more community as an afterthought","Everything connected by design"].map((w) => (
            <div key={w} className="sp-why-item"><span className="dot" />{w}</div>
          ))}
        </div>
        <p className="sp-body">Open a token and instantly see the full on-chain picture, which KOLs and smart wallets are in, jump into trading, host a Space, drop into a voice lobby, check related prediction markets and read live sentiment — without ever leaving the platform.</p>
      </section>

      {/* ROADMAP */}
      <section id="roadmap" className="sp-sec reveal">
        <span className="sp-kicker">Roadmap</span>
        <h2 className="sp-h2">Shipping daily. Building in public.</h2>
        <div className="sp-phases">
          {PHASES.map((p) => (
            <div key={p.k} className="sp-phase">
              <div className="sp-phase-k">{p.k}<span>{p.t}</span></div>
              <p>{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WHO FOR */}
      <section className="sp-sec reveal">
        <span className="sp-kicker">Who it&apos;s for</span>
        <h2 className="sp-h2">For people tired of the same old thing.</h2>
        <div className="sp-for">
          {FOR.map((f) => <div key={f} className="sp-for-item">{f}</div>)}
        </div>
      </section>

      {/* ECOSYSTEM */}
      <section id="ecosystem" className="sp-sec reveal">
        <span className="sp-kicker">The ecosystem</span>
        <h2 className="sp-h2">Already live. Already shipping.</h2>
        <div className="sp-eco">
          <a className="sp-eco-card" href={LINKS.ogdex}><h3>OG DEX</h3><p>Real-time Solana screener, scanner & trading.</p><span>Open →</span></a>
          <a className="sp-eco-card" href={LINKS.orbitxPrediction} target="_blank" rel="noreferrer"><h3>OrbitX Prediction Market</h3><p>Prediction markets + provably-fair 1v1 games.</p><span>orbitx-prediction.fun →</span></a>
          <a className="sp-eco-card" href={LINKS.degen} target="_blank" rel="noreferrer"><h3>Degen Tower</h3><p>Tap-to-earn with real USDC payouts.</p><span>Play →</span></a>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="sp-close reveal">
        <h2>The last platform you ever open<br/>for on-chain activity.</h2>
        <p>New name coming soon. New domain coming soon. Create your account and dive in.</p>
        <a className="btn-primary lg" href={LINKS.signup}>Sign up</a>
      </section>

      {/* FOOTER */}
      <footer className="sp-foot">
        <div className="sp-foot-top">
          <a className="sp-brand" href="/"><span className="sp-mark" />{BRAND}</a>
          <div className="sp-foot-cols">
            <div>
              <h4>Product</h4>
              <a href={LINKS.app}>OG DEX</a>
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

const css = `
.sp{--bg:#050608;--ink:#ffffff;--muted:#a7adba;--line:rgba(255,255,255,0.10);--accent:#2F80FF;--accent2:#9945FF;
  background:var(--bg);color:var(--ink);overflow-x:hidden;
  font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Inter,'Plus Jakarta Sans',sans-serif;-webkit-font-smoothing:antialiased;}
.sp a{text-decoration:none;color:inherit;}
.sp-nav{position:fixed;top:0;left:0;right:0;z-index:50;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px clamp(16px,5vw,52px);transition:all .35s;}
.sp-nav.scrolled{background:rgba(5,6,8,.72);backdrop-filter:saturate(160%) blur(18px);border-bottom:1px solid var(--line);}
.sp-brand{display:flex;align-items:center;gap:9px;font-weight:800;letter-spacing:.16em;font-size:15px;color:#fff;}
.sp-mark{width:16px;height:16px;border-radius:5px;background:conic-gradient(from 140deg,var(--accent),var(--accent2),var(--accent));box-shadow:0 4px 16px rgba(47,128,255,.5);}
.sp-links{display:flex;gap:26px;font-size:13.5px;color:var(--muted);}
.sp-links a:hover{color:#fff;}
.sp-nav-cta{display:flex;align-items:center;gap:10px;}
.sp-cta{font-size:13.5px;font-weight:700;color:#000;padding:9px 16px;border-radius:980px;background:linear-gradient(120deg,var(--accent),var(--accent2));box-shadow:0 8px 22px -8px rgba(47,128,255,.8);transition:transform .15s,filter .2s;}
.sp-cta:hover{filter:brightness(1.08);transform:translateY(-1px);}
@media(max-width:880px){.sp-links{display:none}}
@media(max-width:520px){.btn-ghost.sm{display:none}}
.sp-hero{position:relative;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:130px clamp(18px,5vw,52px) 80px;overflow:hidden;}
.sp-hero-ready .sp-hero-inner,.sp-hero-ready .sp-showcase{animation:spHeroIn 1.1s cubic-bezier(.2,.7,.2,1) .15s both;}
.sp-hero-layout{position:relative;z-index:1;display:grid;grid-template-columns:1.05fr .95fr;gap:clamp(24px,4vw,56px);width:min(1180px,100%);align-items:center;}
@media(max-width:980px){.sp-hero-layout{grid-template-columns:1fr;text-align:center}.sp-showcase{display:none}.sp-hero-inner{max-width:1000px;margin:0 auto}}
.sp-hero-bg{position:absolute;inset:0;z-index:0;}
.sp-hero-photo{position:absolute;inset:0;background-position:center;background-size:cover;background-repeat:no-repeat;opacity:0;transform:scale(1.08);filter:saturate(1.08);transition:opacity 1.2s ease,transform 8s ease;}
.sp-hero-photo.is-active{opacity:.62;animation:heroDrift 24s ease-in-out infinite alternate;}
.sp-hero-photo::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 32%,transparent 26%,rgba(5,6,8,.72) 82%),linear-gradient(180deg,rgba(5,6,8,.34),rgba(5,6,8,.62) 55%,#050608);}
.sp-hero-flash{position:absolute;inset:0;background:radial-gradient(circle at 50% 40%,rgba(47,128,255,.35),transparent 58%);opacity:0;animation:spHeroFlash 1.4s ease-out .1s forwards;}
.sp-hero-scan{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(to bottom,rgba(255,255,255,.03) 0 1px,transparent 1px 4px);mix-blend-mode:overlay;opacity:.45;animation:spHeroScan 8s linear infinite;}
.sp-hero-noise{position:absolute;inset:0;opacity:.04;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}
@keyframes heroDrift{from{transform:scale(1.05) translate3d(0,0,0)}to{transform:scale(1.16) translate3d(-1.5%,-2%,0)}}
@keyframes spHeroFlash{0%{opacity:0}20%{opacity:.55}100%{opacity:0}}
@keyframes spHeroScan{to{background-position:0 240px}}
@keyframes spHeroIn{from{opacity:0;transform:translateY(36px) scale(.98)}to{opacity:1;transform:none}}
.orb{position:absolute;border-radius:50%;filter:blur(70px);opacity:.5;transform:translate3d(var(--mx,0),calc(var(--py,0) + var(--my,0)),0);transition:transform .5s ease-out;}
.orb-a{width:540px;height:540px;top:-140px;left:-80px;background:radial-gradient(circle,#2F80FF,transparent 70%);animation:spOrbDrift 18s ease-in-out infinite;}
.orb-b{width:560px;height:560px;top:-60px;right:-120px;background:radial-gradient(circle,#9945FF,transparent 70%);animation:spOrbDrift 22s ease-in-out infinite reverse;}
.orb-c{width:520px;height:520px;bottom:-180px;left:38%;background:radial-gradient(circle,#14a0ff,transparent 70%);opacity:.32;animation:spOrbDrift 26s ease-in-out infinite;}
@keyframes spOrbDrift{50%{transform:translate3d(calc(var(--mx,0px) + 24px),calc(var(--py,0px) + var(--my,0px) + 18px),0) scale(1.08)}}
.grid-fade{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);background-size:56px 56px;-webkit-mask-image:radial-gradient(circle at 50% 32%,#000,transparent 70%);mask-image:radial-gradient(circle at 50% 32%,#000,transparent 70%);}
.sp-hero-inner{position:relative;max-width:640px;opacity:var(--pf,1);text-align:left;}
@media(max-width:980px){.sp-hero-inner{text-align:center}}
.sp-hero-badge{display:flex;align-items:center;gap:12px;margin-bottom:20px;}
@media(max-width:980px){.sp-hero-badge{justify-content:center}}
.sp-hero-logo{border-radius:10px;box-shadow:0 10px 30px -12px rgba(47,128,255,.65);animation:spLogoFloat 4s ease-in-out infinite;}
@keyframes spLogoFloat{50%{transform:translateY(-4px)}}
.sp-eyebrow{font-size:12.5px;letter-spacing:.24em;text-transform:uppercase;color:var(--accent);font-weight:700;margin:0;}
.sp-h1{margin:0;font-size:clamp(42px,7.5vw,92px);line-height:.96;letter-spacing:-.04em;font-weight:800;position:relative;}
.sp-h1 span{background:linear-gradient(120deg,var(--accent),var(--accent2));-webkit-background-clip:text;background-clip:text;color:transparent;}
.sp-h1::before,.sp-h1::after{content:attr(data-text);position:absolute;inset:0;pointer-events:none;opacity:0;}
.sp-hero-ready .sp-h1::before{color:#2F80FF;opacity:.55;animation:spGlitchR 4.5s steps(1) infinite;clip-path:inset(0 0 58% 0);}
.sp-hero-ready .sp-h1::after{color:#9945FF;opacity:.45;animation:spGlitchB 4.5s steps(1) infinite;clip-path:inset(42% 0 0 0);}
@keyframes spGlitchR{0%,93%,100%{transform:translate(0)}94%{transform:translate(-4px,1px)}96%{transform:translate(2px,-1px)}}
@keyframes spGlitchB{0%,91%,100%{transform:translate(0)}92%{transform:translate(4px,-1px)}95%{transform:translate(-3px,1px)}}
.sp-lead{margin:28px 0 0;font-size:clamp(15.5px,1.7vw,19px);line-height:1.6;color:var(--muted);max-width:62ch;}
@media(max-width:980px){.sp-lead{margin-left:auto;margin-right:auto}}
.sp-hero-actions{display:flex;gap:14px;flex-wrap:wrap;margin-top:36px;}
@media(max-width:980px){.sp-hero-actions{justify-content:center}}
.sp-showcase{position:relative;min-height:420px;display:flex;flex-direction:column;align-items:center;justify-content:center;perspective:1200px;}
.sp-showcase-stage{position:relative;width:min(260px,62vw);height:min(420px,68vh);}
.sp-showcase-card{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0;transform:translate3d(60px,20px,-120px) rotateY(-28deg) scale(.88);filter:blur(6px);transition:opacity .7s ease,transform .8s cubic-bezier(.2,.8,.2,1),filter .7s ease;pointer-events:none;}
.sp-showcase-card.is-active{opacity:1;transform:translate3d(0,0,0) rotateY(-8deg) scale(1);filter:blur(0);z-index:3;}
.sp-showcase-card.is-next{opacity:.35;transform:translate3d(40px,12px,-80px) rotateY(-18deg) scale(.92);filter:blur(2px);z-index:2;}
.sp-showcase-frame{position:relative;width:100%;height:100%;border-radius:22px;overflow:hidden;border:1px solid rgba(255,255,255,.14);background:#0a0c14;box-shadow:0 30px 80px -30px rgba(0,0,0,.85),0 0 0 1px rgba(255,255,255,.06) inset,0 0 40px -10px var(--accent);animation:spCardFloat 5s ease-in-out infinite;}
.sp-showcase-card.is-active .sp-showcase-frame{animation:spCardFloat 5s ease-in-out infinite,spCardPulse 4.2s ease-in-out infinite;}
@keyframes spCardFloat{50%{transform:translateY(-10px)}}
@keyframes spCardPulse{50%{box-shadow:0 34px 90px -28px rgba(0,0,0,.9),0 0 0 1px rgba(255,255,255,.08) inset,0 0 50px -6px var(--accent)}}
.sp-showcase-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scale(1.08);}
.sp-showcase-dots{display:flex;gap:8px;margin-top:18px;}
.sp-showcase-pip{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.18);transition:transform .3s ease,background .3s ease,box-shadow .3s ease;}
.sp-showcase-pip.is-active{background:var(--accent);transform:scale(1.25);box-shadow:0 0 14px var(--accent);}
.sp-showcase-ui{position:absolute;top:14px;left:14px;right:14px;display:flex;align-items:center;gap:8px;}
.sp-showcase-dot{width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 12px var(--accent);}
.sp-showcase-bar{flex:1;height:6px;border-radius:999px;background:rgba(255,255,255,.12);}
.sp-showcase-bar.short{flex:0 0 28%;}
.sp-showcase-meta{position:absolute;left:0;right:0;bottom:0;padding:16px 14px 14px;background:linear-gradient(to top,rgba(5,6,8,.92),transparent);display:flex;flex-direction:column;gap:4px;}
.sp-showcase-meta strong{font-size:13px;letter-spacing:.08em;text-transform:uppercase;}
.sp-showcase-meta span{font-size:11px;color:var(--muted);}
.sp-showcase-shine{position:absolute;inset:0;background:linear-gradient(105deg,transparent 42%,rgba(255,255,255,.16) 50%,transparent 58%);transform:translateX(-120%);animation:spShine 3.2s ease-in-out infinite;}
@keyframes spShine{0%,35%{transform:translateX(-120%)}100%{transform:translateX(120%)}}
.sp-showcase-glow{position:absolute;inset:20% 10%;border-radius:50%;background:radial-gradient(circle,var(--accent),transparent 68%);filter:blur(60px);opacity:.35;transition:background .8s ease;}
.btn-primary{font-weight:700;font-size:16px;color:#000;padding:14px 28px;border-radius:980px;background:linear-gradient(120deg,var(--accent),var(--accent2));box-shadow:0 16px 34px -12px rgba(47,128,255,.8);transition:transform .15s,filter .2s;}
.btn-primary:hover{filter:brightness(1.08);transform:translateY(-2px);}
.btn-primary.lg{font-size:18px;padding:17px 38px;}
.btn-ghost{font-weight:700;font-size:16px;color:#fff;padding:14px 22px;border-radius:980px;border:1px solid var(--line);background:rgba(255,255,255,.03);transition:all .2s;}
.btn-ghost.sm{font-size:13.5px;padding:9px 16px;}
.btn-ghost:hover{border-color:var(--accent);color:#fff;background:rgba(47,128,255,.1);}
.scroll-hint{position:absolute;bottom:26px;left:50%;transform:translateX(-50%);width:24px;height:38px;border:2px solid rgba(255,255,255,.2);border-radius:14px;display:flex;justify-content:center;padding-top:6px;}
.scroll-hint span{width:4px;height:8px;border-radius:4px;background:rgba(255,255,255,.4);animation:sd 1.6s infinite;}
@keyframes sd{0%{opacity:0;transform:translateY(-4px)}40%{opacity:1}100%{opacity:0;transform:translateY(10px)}}
.sp-marquee{border-top:1px solid var(--line);border-bottom:1px solid var(--line);overflow:hidden;padding:16px 0;background:rgba(255,255,255,.02);}
.sp-marquee .track{display:flex;white-space:nowrap;gap:24px;animation:mq 32s linear infinite;font-size:14.5px;color:#7e879a;font-weight:600;}
@keyframes mq{to{transform:translateX(-50%)}}
.sp-strip{overflow:hidden;padding:28px 0;border-bottom:1px solid var(--line);background:linear-gradient(180deg,rgba(255,255,255,.02),transparent);}
.sp-strip-track{display:flex;gap:18px;width:max-content;animation:spStrip 38s linear infinite;padding:0 18px;}
.sp-strip-track:hover{animation-play-state:paused;}
@keyframes spStrip{to{transform:translateX(-50%)}}
.sp-strip-card{position:relative;width:220px;aspect-ratio:16/10;border-radius:16px;overflow:hidden;border:1px solid var(--line);flex-shrink:0;transition:transform .35s ease,border-color .35s ease;}
.sp-strip-card:hover{transform:translateY(-6px) scale(1.03);border-color:rgba(47,128,255,.45);}
.sp-strip-img{width:100%;height:100%;object-fit:cover;transform:scale(1.05);transition:transform .6s ease;}
.sp-strip-card:hover .sp-strip-img{transform:scale(1.12);}
.sp-strip-overlay{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;padding:14px;background:linear-gradient(to top,rgba(5,6,8,.92),rgba(5,6,8,.15));gap:4px;}
.sp-strip-overlay span{font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#fff;}
.sp-strip-overlay small{font-size:11px;color:var(--muted);}
.sp-strip-card::after{content:"";position:absolute;top:0;left:-120%;width:60%;height:100%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.12),transparent);animation:spStripShine 4s ease-in-out infinite;}
@keyframes spStripShine{0%,40%{left:-120%}100%{left:140%}}
.sp-sec{max-width:1100px;margin:0 auto;padding:clamp(64px,10vw,130px) clamp(18px,5vw,40px);}
.sp-kicker{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--accent);padding:6px 14px;border-radius:980px;background:rgba(47,128,255,.1);border:1px solid rgba(47,128,255,.2);}
.sp-h2{margin:18px 0 0;font-size:clamp(30px,4.6vw,52px);line-height:1.05;letter-spacing:-.03em;font-weight:800;max-width:18ch;}
.sp-body{margin:20px 0 0;font-size:clamp(15px,1.6vw,18px);line-height:1.65;color:var(--muted);max-width:64ch;}
.sp-body.dim{color:#7e879a;}
.sp-chips{display:flex;flex-wrap:wrap;gap:10px;margin-top:26px;}
.sp-chip{font-size:13px;color:#c7ccd6;padding:8px 14px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.03);}
.sp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:34px;}
@media(max-width:900px){.sp-grid{grid-template-columns:1fr 1fr}}
@media(max-width:600px){.sp-grid{grid-template-columns:1fr}}
.sp-card{position:relative;border:1px solid var(--line);background:linear-gradient(160deg,rgba(255,255,255,.045),rgba(255,255,255,.015));border-radius:20px;padding:22px;overflow:hidden;transition:border-color .25s,transform .25s;}
.sp-card:hover{border-color:rgba(47,128,255,.45);transform:translateY(-3px);}
.sp-card::before{content:"";position:absolute;top:-40px;right:-40px;width:120px;height:120px;border-radius:50%;filter:blur(40px);opacity:.5;background:var(--c,#2F80FF);}
.sp-card.f1{--c:#2F80FF}.sp-card.f2{--c:#14F195}.sp-card.f3{--c:#2F80FF}.sp-card.f4{--c:#FFC53D}.sp-card.f5{--c:#9945FF}.sp-card.f6{--c:#ff6bd0}.sp-card.f7{--c:#14a0ff}.sp-card.f8{--c:#ff8a3d}.sp-card.f9{--c:#7b5bff}
.sp-card-tag{position:relative;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);}
.sp-card h3{position:relative;margin:10px 0 8px;font-size:19px;font-weight:700;letter-spacing:-.01em;}
.sp-card p{position:relative;margin:0;font-size:13.5px;line-height:1.55;color:var(--muted);}
.sp-why{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:30px;}
@media(max-width:600px){.sp-why{grid-template-columns:1fr}}
.sp-why-item{display:flex;align-items:center;gap:12px;font-size:15px;color:#dfe3ea;padding:14px 16px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.025);}
.sp-why-item .dot{width:8px;height:8px;border-radius:50%;background:linear-gradient(120deg,var(--accent),var(--accent2));box-shadow:0 0 12px var(--accent);flex-shrink:0;}
.sp-phases{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:32px;}
@media(max-width:900px){.sp-phases{grid-template-columns:1fr 1fr}}
@media(max-width:520px){.sp-phases{grid-template-columns:1fr}}
.sp-phase{border:1px solid var(--line);border-radius:18px;padding:20px;background:rgba(255,255,255,.025);}
.sp-phase-k{font-size:13px;font-weight:800;color:#fff;display:flex;flex-direction:column;gap:2px;margin-bottom:10px;}
.sp-phase-k span{font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);}
.sp-phase p{margin:0;font-size:13.5px;line-height:1.55;color:var(--muted);}
.sp-for{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:30px;}
@media(max-width:600px){.sp-for{grid-template-columns:1fr}}
.sp-for-item{font-size:15px;color:#dfe3ea;padding:16px 18px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.025);}
.sp-eco{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:32px;}
@media(max-width:760px){.sp-eco{grid-template-columns:1fr}}
.sp-eco-card{border:1px solid var(--line);border-radius:20px;padding:24px;background:linear-gradient(160deg,rgba(47,128,255,.08),rgba(153,69,255,.04));transition:border-color .25s,transform .25s;}
.sp-eco-card:hover{border-color:rgba(47,128,255,.5);transform:translateY(-3px);}
.sp-eco-card h3{margin:0;font-size:22px;font-weight:800;}
.sp-eco-card p{margin:8px 0 16px;font-size:14px;color:var(--muted);}
.sp-eco-card span{font-size:13.5px;font-weight:700;color:var(--accent);}
.sp-close{text-align:center;padding:clamp(80px,14vw,170px) 20px;background:radial-gradient(circle at 50% 0%,rgba(47,128,255,.12),transparent 55%);}
.sp-close h2{margin:0;font-size:clamp(34px,6.5vw,76px);line-height:1.02;letter-spacing:-.035em;font-weight:800;}
.sp-close p{margin:22px 0 34px;font-size:17px;color:var(--muted);}
.sp-foot{border-top:1px solid var(--line);padding:50px clamp(18px,5vw,52px) 30px;}
.sp-foot-top{display:flex;justify-content:space-between;gap:40px;flex-wrap:wrap;max-width:1100px;margin:0 auto;}
.sp-foot-cols{display:flex;gap:clamp(24px,6vw,72px);flex-wrap:wrap;}
.sp-foot-cols h4{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#7e879a;margin:0 0 12px;}
.sp-foot-cols a{display:block;font-size:14px;color:#c7ccd6;margin-bottom:9px;transition:color .2s;}
.sp-foot-cols a:hover{color:var(--accent);}
.sp-foot-bottom{max-width:1100px;margin:36px auto 0;padding-top:20px;border-top:1px solid var(--line);font-size:12.5px;color:#6b7384;}
.reveal{opacity:0;transform:translateY(40px);transition:opacity .9s cubic-bezier(.2,.7,.2,1),transform .9s cubic-bezier(.2,.7,.2,1);}
.reveal.in{opacity:1;transform:none;}
`;
