import { useEffect, useRef, useState } from "react";
import logo from "@/assets/logo.png";

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

type Feature = { tag: string; title: string; copy: string; tone: string };
const FEATURES: Feature[] = [
  { tag: "Discovery", title: "Intelligent token discovery", tone: "f1",
    copy: "Real-time multi-chain scanner with a proprietary OG Score — on-chain metrics, holder quality, momentum and AI signals. Trending, hidden gems and about-to-explode, powered by live data." },
  { tag: "Wallet forensics", title: "Track smart money like a pro", tone: "f2",
    copy: "Any wallet's full history, win rate, hold time and PnL. Smart-money and KOL labels (Ansem, blknoiz06 + 37 more mapped), whale alerts and full holder lists with one-click actions." },
  { tag: "OG DEX", title: "Blazing-fast trading & execution", tone: "f3",
    copy: "Live orderbook-style screener, one-click trading with Phantom, real-time buy/sell feeds, advanced charts with on-chain overlays and portfolio across every wallet." },
  { tag: "Launch", title: "Fair-launch & token tools", tone: "f4",
    copy: "Simple, powerful token creation with anti-rug safeguards, auto-listing on our DEX + aggregators, and post-launch monitoring with community tools baked in from minute one." },
  { tag: "OrbitX Prediction Market", title: "Prediction markets & 1v1 games", tone: "f5",
    copy: "Native prediction markets plus Coinflip, Dice, Crash and Plinko with provably-fair, on-chain settlement — wired into your OrbitX insights, with leaderboards and achievements." },
  { tag: "Social", title: "Community & social layer", tone: "f6",
    copy: "Host Twitter Spaces with token context, voice lobbies, per-token chat and updates, creator tools, and a cross-platform identity that follows you across trading, gaming and social." },
  { tag: "AI", title: "AI-powered intelligence", tone: "f7",
    copy: "Ask: 'which wallets bought $TOKEN in the last 30 min?' or 'top smart-money accumulating now?' Natural-language queries across all on-chain data, with automated reports and alerts." },
  { tag: "Gaming", title: "Degen Tower & entertainment", tone: "f8",
    copy: "Tap-to-earn with real USDC payouts, combos, upgrades and leaderboards — plus future games where in-game actions have on-chain consequences and rewards." },
  { tag: "Developers", title: "Creator & developer tools", tone: "f9",
    copy: "Webhooks and a bot framework, API access for power users, white-label community builds and monetization for projects — featured listings, premium analytics, promoted Spaces." },
];

const PHASES = [
  { k: "Phase 1", t: "Now", d: "Core intelligence + trading + social/gaming primitives." },
  { k: "Phase 2", t: "Near-term", d: "Deep KOL/smart-money tools, AI analyst, voice lobbies, Spaces, expanded predictions, creator monetization." },
  { k: "Phase 3", t: "Coming", d: "Full social graph, on-chain identity, cross-platform reputation, copy-trading automation, multi-chain, mobile." },
  { k: "Phase 4", t: "Vision", d: "The default operating system for anyone serious about on-chain crypto." },
];

const FOR = [
  "Degens who want better tools than everyone else",
  "Serious traders tired of fragmented data",
  "KOLs & creators who want to own their community",
  "New projects that want a real home base",
  "Power users who want APIs, webhooks & bots",
  "Casual users who want one clean place to trade, play & hang out",
];

export default function Splash() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [heroFrame, setHeroFrame] = useState(0);
  const [heroReady, setHeroReady] = useState(false);

  useEffect(() => {
    const ready = setTimeout(() => setHeroReady(true), 80);
    const cycle = setInterval(() => setHeroFrame((i) => (i + 1) % 4), 4200);
    return () => { clearTimeout(ready); clearInterval(cycle); };
  }, []);

  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
      { threshold: 0.14 }
    );
    document.querySelectorAll<HTMLElement>(".reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (heroRef.current) {
        heroRef.current.style.setProperty("--py", `${y * 0.25}px`);
        heroRef.current.style.setProperty("--pf", `${Math.max(0, 1 - y / 560)}`);
      }
      document.querySelector(".sp-nav")?.classList.toggle("scrolled", y > 24);
    };
    const onMove = (e: MouseEvent) => {
      if (!heroRef.current) return;
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      heroRef.current.style.setProperty("--mx", `${x * 36}px`);
      heroRef.current.style.setProperty("--my", `${y * 28}px`);
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
          <a className="sp-cta" href={LINKS.signup}>Get started</a>
        </div>
      </nav>

      <header className={`sp-hero ${heroReady ? "sp-hero-ready" : ""}`} ref={heroRef}>
        <div className="sp-hero-bg" aria-hidden>
          <div className="sp-hero-photo is-active" style={{ backgroundImage: `url(/bg/bg-nebula.jpg)` }} />
          <div className="sp-hero-photo" style={{ backgroundImage: `url(/bg/bg-galaxy.jpg)` }} />
          <div className="sp-hero-photo" style={{ backgroundImage: `url(/bg/bg-aurora.jpg)` }} />
          <div className="sp-hero-photo" style={{ backgroundImage: `url(/bg/bg-earth.jpg)` }} />
          <div className="orb orb-a" /><div className="orb orb-b" /><div className="orb orb-c" />
          <div className="grid-fade" />
        </div>

        <div className="sp-hero-layout">
          <div className="sp-hero-inner">
            <div className="sp-hero-badge">
              <img src={logo} alt="" width={28} height={28} className="sp-hero-logo" />
              <p className="sp-eyebrow">{BRAND} · Reimagined</p>
            </div>
            <h1 className="sp-h1">
              <div>One platform.</div>
              <div>One ecosystem.</div>
              <div><span>One place.</span></div>
            </h1>
            <p className="sp-lead">
              Crypto tooling is a sea of clones and disconnected tabs. We&apos;re building the everything app for on-chain — trading, launching, intelligence, community, prediction markets and games in a single destination, powered by real on-chain data and AI that understands what you&apos;re trying to do.
            </p>
            <div className="sp-hero-actions">
              <a className="btn-primary" href={LINKS.signup}>Get started</a>
              <a className="btn-ghost" href={LINKS.signin}>Sign in →</a>
            </div>
          </div>

          <div className="sp-showcase">
            <div className="sp-data-grid">
              {[
                { k: "16", v: "Blockchains" },
                { k: "500+", v: "Live pairs" },
                { k: "2M+", v: "Wallets tracked" },
                { k: "10ms", v: "Avg scan time" },
              ].map((item) => (
                <div key={item.k} className="sp-data-cell">
                  <strong className="sp-data-num">{item.k}</strong>
                  <span className="sp-data-label">{item.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="scroll-hint" aria-hidden><span /></div>
      </header>

      <div className="sp-marquee" aria-hidden>
        <div className="track">
          {Array.from({ length: 2 }).map((_, i) => (
            <span key={i}>Token discovery · Wallet forensics · Smart money · OG DEX · Fair launches · Prediction markets · Voice & Spaces · AI analyst · Degen Tower · APIs · </span>
          ))}
        </div>
      </div>

      <section id="problem" className="sp-sec reveal">
        <span className="sp-kicker">The problem</span>
        <h2 className="sp-h2">You shouldn&apos;t need 12 tabs to trade.</h2>
        <p className="sp-body">
          The average trader juggles 8–12 disconnected tools just to have a functional workflow. Nothing talks to each other. When you find a good token you can&apos;t instantly see which KOLs hold it, smart-money pressure, top-holder history or community sentiment. You piece it together manually like it&apos;s 2017.
        </p>
        <div className="sp-chips">
          {["Pump.fun / Raydium","Dexscreener / Birdeye","Nansen / Arkham","Twitter + Telegram","Prediction sites","Random TG bots","Phantom / Solflare","Notion KOL notes","Holder checkers","Portfolio dashboards"].map((c) => (
            <span key={c} className="sp-chip">{c}</span>
          ))}
        </div>
        <p className="sp-body dim">The future isn&apos;t more single-purpose apps. It&apos;s convergence — one intelligent platform that surfaces the exact info and actions you need, instantly.</p>
      </section>

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

      <section className="sp-sec reveal">
        <span className="sp-kicker">Who it&apos;s for</span>
        <h2 className="sp-h2">For people tired of the same old thing.</h2>
        <div className="sp-for">
          {FOR.map((f) => <div key={f} className="sp-for-item">{f}</div>)}
        </div>
      </section>

      <section id="ecosystem" className="sp-sec reveal">
        <span className="sp-kicker">The ecosystem</span>
        <h2 className="sp-h2">Already live. Already shipping.</h2>
        <div className="sp-eco">
          <a className="sp-eco-card" href={LINKS.ogdex}><h3>OG DEX</h3><p>Real-time Solana screener, scanner & trading.</p><span>Open →</span></a>
          <a className="sp-eco-card" href={LINKS.orbitxPrediction} target="_blank" rel="noreferrer"><h3>OrbitX Prediction Market</h3><p>Prediction markets + provably-fair 1v1 games.</p><span>orbitx-prediction.fun →</span></a>
          <a className="sp-eco-card" href={LINKS.degen} target="_blank" rel="noreferrer"><h3>Degen Tower</h3><p>Tap-to-earn with real USDC payouts.</p><span>Play →</span></a>
        </div>
      </section>

      <section className="sp-close reveal">
        <h2>The last platform you ever open<br/>for on-chain activity.</h2>
        <p>New name coming soon. New domain coming soon. Create your account and dive in.</p>
        <a className="btn-primary lg" href={LINKS.signup}>Sign up</a>
      </section>

      <footer className="sp-foot">
        <div className="sp-foot-top">
          <a className="sp-brand" href="/"><span className="sp-mark" />{BRAND}</a>
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

const css = `
.sp{--bg:#030508;--ink:#ffffff;--muted:#a7adba;--line:rgba(255,255,255,0.10);--accent:#2F80FF;--accent2:#9945FF;
  background:var(--bg);color:var(--ink);overflow-x:hidden;
  font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Inter,'Plus Jakarta Sans',sans-serif;-webkit-font-smoothing:antialiased;}
.sp a{text-decoration:none;color:inherit;}
.sp-nav{position:fixed;top:0;left:0;right:0;z-index:50;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px clamp(18px,5vw,56px);transition:all .4s;}
.sp-nav.scrolled{background:rgba(3,5,8,.72);backdrop-filter:saturate(180%) blur(20px);border-bottom:1px solid var(--line);}
.sp-brand{display:flex;align-items:center;gap:9px;font-weight:800;letter-spacing:.16em;font-size:15px;color:#fff;}
.sp-mark{width:16px;height:16px;border-radius:5px;background:conic-gradient(from 140deg,var(--accent),var(--accent2),var(--accent));box-shadow:0 4px 16px rgba(47,128,255,.5);}
.sp-links{display:flex;gap:26px;font-size:13.5px;color:var(--muted);}
.sp-links a:hover{color:#fff;}
.sp-nav-cta{display:flex;align-items:center;gap:10px;}
.sp-cta{font-size:13.5px;font-weight:700;color:#000;padding:9px 16px;border-radius:980px;background:linear-gradient(120deg,var(--accent),var(--accent2));box-shadow:0 8px 22px -8px rgba(47,128,255,.8);transition:transform .2s,filter .2s;}
.sp-cta:hover{filter:brightness(1.08);transform:translateY(-1px);}
@media(max-width:880px){.sp-links{display:none}}
@media(max-width:520px){.btn-ghost.sm{display:none}}

.sp-hero{position:relative;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:130px clamp(18px,5vw,52px) 80px;overflow:hidden;}
.sp-hero-ready .sp-hero-inner{animation:spHeroIn 1.1s cubic-bezier(.2,.7,.2,1) .15s both;}
.sp-hero-layout{position:relative;z-index:1;display:grid;grid-template-columns:1.05fr .95fr;gap:clamp(24px,4vw,56px);width:min(1180px,100%);align-items:center;}
@media(max-width:980px){.sp-hero-layout{grid-template-columns:1fr;text-align:center}.sp-hero-inner{max-width:100%;margin:0 auto}}
.sp-hero-bg{position:absolute;inset:0;z-index:0;}
.sp-hero-photo{position:absolute;inset:0;background-position:center;background-size:cover;background-repeat:no-repeat;opacity:0;transform:scale(1.08);transition:opacity 1.6s ease,transform 10s ease-out;filter:saturate(.85);}
.sp-hero-photo.is-active{opacity:.55;animation:heroDrift 22s ease-in-out infinite alternate;}
.sp-hero-photo::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 32%,transparent 26%,rgba(3,5,8,.72) 82%),linear-gradient(180deg,rgba(3,5,8,.3),rgba(3,5,8,.72) 55%,#030508);}
@keyframes heroDrift{from{transform:scale(1.05) translate3d(0,0,0)}to{transform:scale(1.14) translate3d(-1.5%,-2%,0)}}
@keyframes spHeroIn{from{opacity:0;transform:translateY(36px) scale(.98)}to{opacity:1;transform:none}}
.orb{position:absolute;border-radius:50%;filter:blur(70px);opacity:.45;transform:translate3d(var(--mx,0),calc(var(--py,0) + var(--my,0)),0);transition:transform .5s ease-out;}
.orb-a{width:540px;height:540px;top:-140px;left:-80px;background:radial-gradient(circle,#2F80FF,transparent 70%);animation:spOrbDrift 18s ease-in-out infinite;}
.orb-b{width:560px;height:560px;top:-60px;right:-120px;background:radial-gradient(circle,#9945FF,transparent 70%);animation:spOrbDrift 22s ease-in-out infinite reverse;}
.orb-c{width:520px;height:520px;bottom:-180px;left:38%;background:radial-gradient(circle,#14a0ff,transparent 70%);opacity:.3;animation:spOrbDrift 26s ease-in-out infinite;}
@keyframes spOrbDrift{50%{transform:translate3d(calc(var(--mx,0px) + 24px),calc(var(--py,0px) + var(--my,0px) + 18px),0) scale(1.08)}}
.grid-fade{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:56px 56px;-webkit-mask-image:radial-gradient(circle at 50% 32%,#000,transparent 70%);mask-image:radial-gradient(circle at 50% 32%,#000,transparent 70%);}
.sp-hero-inner{position:relative;max-width:640px;opacity:var(--pf,1);text-align:center;}
@media(max-width:980px){.sp-hero-inner{text-align:center}}
.sp-hero-badge{display:flex;align-items:center;gap:12px;margin-bottom:20px;}
@media(max-width:980px){.sp-hero-badge{justify-content:center}}
.sp-hero-logo{border-radius:10px;box-shadow:0 10px 30px -12px rgba(47,128,255,.65);animation:spLogoFloat 4s ease-in-out infinite;}
@keyframes spLogoFloat{50%{transform:translateY(-4px)}}
.sp-eyebrow{font-size:12.5px;letter-spacing:.24em;text-transform:uppercase;color:var(--accent);font-weight:700;margin:0;}
.sp-h1{margin:0;font-size:clamp(42px,7.5vw,92px);line-height:.96;letter-spacing:-.04em;font-weight:800;position:relative;text-align:center;}
@media(max-width:480px){.sp-h1{font-size:clamp(36px,6.5vw,52px);line-height:1.12;letter-spacing:-.02em;}}
.sp-h1 span{background:linear-gradient(120deg,var(--accent),var(--accent2));-webkit-background-clip:text;background-clip:text;color:transparent;}
@keyframes spGlitchR{0%,93%,100%{transform:translate(0)}94%{transform:translate(-4px,1px)}96%{transform:translate(2px,-1px)}}
@keyframes spGlitchB{0%,91%,100%{transform:translate(0)}92%{transform:translate(4px,-1px)}95%{transform:translate(-3px,1px)}}
@media(max-width:480px){
  .sp-hero-ready .sp-h1::before{clip-path:inset(0 0 55% 0);}
  .sp-hero-ready .sp-h1::after{clip-path:inset(40% 0 0 0);}
}
.sp-lead{margin:28px 0 0;font-size:clamp(15.5px,1.7vw,19px);line-height:1.6;color:var(--muted);max-width:62ch;}
@media(max-width:980px){.sp-lead{margin-left:auto;margin-right:auto}}
.sp-hero-actions{display:flex;gap:14px;flex-wrap:wrap;margin-top:36px;}
@media(max-width:980px){.sp-hero-actions{justify-content:center}}
.sp-showcase{position:relative;min-height:360px;display:flex;align-items:center;justify-content:center;animation:showcaseIn 1.3s cubic-bezier(.2,.8,.2,1) .2s both;}
@keyframes showcaseIn{from{opacity:0;transform:translateY(44px) scale(.94)}to{opacity:1;transform:none}}
.sp-data-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;width:min(520px,100%);}
.sp-data-cell{position:relative;border:1px solid var(--line);border-radius:18px;padding:22px 24px;background:linear-gradient(170deg,rgba(255,255,255,.04),rgba(255,255,255,.01));overflow:hidden;transition:border-color .3s,transform .3s;}
.sp-data-cell:hover{border-color:rgba(47,128,255,.38);transform:translateY(-3px);}
.sp-data-cell::before{content:"";position:absolute;top:-30px;right:-30px;width:90px;height:90px;border-radius:50%;filter:blur(30px);opacity:.35;background:var(--accent);transition:opacity .4s;}
.sp-data-cell:hover::before{opacity:.55;}
.sp-data-num{display:block;font-size:clamp(32px,3.6vw,42px);font-weight:800;letter-spacing:-.03em;background:linear-gradient(180deg,#fff 30%,rgba(255,255,255,.45));-webkit-background-clip:text;background-clip:text;color:transparent;line-height:1;}
.sp-data-label{display:block;margin-top:6px;font-size:12.5px;color:var(--muted);letter-spacing:.06em;text-transform:uppercase;font-weight:700;}
.btn-primary{font-weight:700;font-size:16px;color:#000;padding:14px 28px;border-radius:980px;background:linear-gradient(120deg,var(--accent),var(--accent2));box-shadow:0 16px 34px -12px rgba(47,128,255,.8);transition:transform .2s,filter .2s;}
.btn-primary:hover{filter:brightness(1.08);transform:translateY(-2px);}
.btn-ghost{font-weight:700;font-size:16px;color:#fff;padding:14px 22px;border-radius:980px;border:1px solid var(--line);background:rgba(255,255,255,.03);transition:all .2s;}
.btn-ghost.sm{font-size:13.5px;padding:9px 16px;}
.btn-ghost:hover{border-color:var(--accent);color:#fff;background:rgba(47,128,255,.1);}
.scroll-hint{position:absolute;bottom:26px;left:50%;transform:translateX(-50%);width:24px;height:38px;border:2px solid rgba(255,255,255,.2);border-radius:14px;display:flex;justify-content:center;padding-top:6px;}
.scroll-hint span{width:4px;height:8px;border-radius:4px;background:rgba(255,255,255,.4);animation:sd 1.6s infinite;}
@keyframes sd{0%{opacity:0;transform:translateY(-4px)}40%{opacity:1}100%{opacity:0;transform:translateY(10px)}}
.sp-marquee{border-top:1px solid var(--line);border-bottom:1px solid var(--line);overflow:hidden;padding:16px 0;background:rgba(255,255,255,.02);}
.sp-marquee .track{display:flex;white-space:nowrap;gap:24px;animation:mq 32s linear infinite;font-size:14.5px;color:#7e879a;font-weight:600;}
@keyframes mq{to{transform:translateX(-50%)}}
.sp-sec{max-width:1100px;margin:0 auto;padding:clamp(64px,10vw,130px) clamp(18px,5vw,40px);}
.sp-kicker{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--accent);padding:6px 14px;border-radius:980px;background:rgba(47,128,255,.1);border:1px solid rgba(47,128,255,.2);}
.sp-h2{margin:18px 0 0;font-size:clamp(30px,4.6vw,52px);line-height:1.05;letter-spacing:-.03em;font-weight:800;max-width:18ch;}
.sp-body{margin:20px 0 0;font-size:clamp(15px,1.6vw,18px);line-height:1.65;color:var(--muted);max-width:64ch;}
.sp-body.dim{color:#7e879a;}

.sp-chips{display:flex;flex-wrap:wrap;gap:10px;margin-top:26px;}
.sp-chip{font-size:13px;color:#c7ccd6;padding:8px 14px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.03);transition:border-color .25s,transform .25s;}
.sp-chip:hover{border-color:rgba(47,128,255,.4);transform:translateY(-2px);}

.sp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:34px;}
@media(max-width:900px){.sp-grid{grid-template-columns:1fr 1fr}}
@media(max-width:600px){.sp-grid{grid-template-columns:1fr}}
.sp-card{position:relative;border:1px solid var(--line);background:linear-gradient(160deg,rgba(255,255,255,.05),rgba(255,255,255,.02));border-radius:20px;padding:24px;overflow:hidden;transition:border-color .3s,transform .3s,box-shadow .3s;}
.sp-card:hover{border-color:rgba(47,128,255,.45);transform:translateY(-4px);box-shadow:0 24px 60px -24px rgba(47,128,255,.2);}
.sp-card::before{content:"";position:absolute;top:-40px;right:-40px;width:120px;height:120px;border-radius:50%;filter:blur(40px);opacity:.4;background:var(--c,#2F80FF);transition:opacity .4s;}
.sp-card:hover::before{opacity:.65;}
.sp-card.f1{--c:#2F80FF}.sp-card.f2{--c:#14F195}.sp-card.f3{--c:#2F80FF}.sp-card.f4{--c:#FFC53D}.sp-card.f5{--c:#9945FF}.sp-card.f6{--c:#ff6bd0}.sp-card.f7{--c:#14a0ff}.sp-card.f8{--c:#ff8a3d}.sp-card.f9{--c:#7b5bff}
.sp-card-tag{position:relative;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);}
.sp-card h3{position:relative;margin:10px 0 8px;font-size:19px;font-weight:700;letter-spacing:-.01em;}
.sp-card p{position:relative;margin:0;font-size:13.5px;line-height:1.55;color:var(--muted);}

.sp-why{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:30px;}
@media(max-width:600px){.sp-why{grid-template-columns:1fr}}
.sp-why-item{display:flex;align-items:center;gap:12px;font-size:15px;color:#dfe3ea;padding:14px 16px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.03);transition:border-color .25s,transform .25s;}
.sp-why-item:hover{border-color:rgba(47,128,255,.35);transform:translateY(-2px);}
.sp-why-item .dot{width:8px;height:8px;border-radius:50%;background:linear-gradient(120deg,var(--accent),var(--accent2));box-shadow:0 0 12px var(--accent);flex-shrink:0;}

.sp-phases{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:32px;}
@media(max-width:900px){.sp-phases{grid-template-columns:1fr 1fr}}
@media(max-width:520px){.sp-phases{grid-template-columns:1fr}}
.sp-phase{border:1px solid var(--line);border-radius:18px;padding:20px;background:rgba(255,255,255,.03);transition:border-color .3s,transform .3s;}
.sp-phase:hover{border-color:rgba(47,128,255,.4);transform:translateY(-3px);}
.sp-phase-k{font-size:13px;font-weight:800;color:#fff;display:flex;flex-direction:column;gap:2px;margin-bottom:10px;}
.sp-phase-k span{font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);}
.sp-phase p{margin:0;font-size:13.5px;line-height:1.55;color:var(--muted);}

.sp-for{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:30px;}
@media(max-width:600px){.sp-for{grid-template-columns:1fr}}
.sp-for-item{font-size:15px;color:#dfe3ea;padding:16px 18px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.03);transition:border-color .25s,transform .25s;}
.sp-for-item:hover{border-color:rgba(47,128,255,.4);transform:translateY(-2px);}

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
