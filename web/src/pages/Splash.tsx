import { useEffect, useRef } from "react";

// ── PLACEHOLDER BRAND NAME ── replace when rebrand is finalized
const BRAND = "NOVA";
const TAGLINE = "Trade everything.";

type Pillar = { tag: string; title: string; copy: string; tone: string; img: string };

const PILLARS: Pillar[] = [
  { tag: "Meme coins", title: "Catch the next move first.",
    copy: "Discover, scan and trade meme coins across every chain. Early launch detection, live charts and one-tap swaps.",
    tone: "t-meme", img: "Meme coins" },
  { tag: "Social", title: "A feed that trades.",
    copy: "A social layer built for traders, kept separate from your tools. Spaces, callouts, communities and live rooms.",
    tone: "t-social", img: "Social" },
  { tag: "Crypto & trading tools", title: "Pro tools, zero clutter.",
    copy: "Wallet forensics, AI analyst, market radar, alerts and PDF reports. Institutional-grade intelligence for everyone.",
    tone: "t-tools", img: "Trading tools" },
  { tag: "Our DEX", title: "Our custom DEX.",
    copy: "Swap anything with deep liquidity and the best routing. Built in-house, designed to feel instant.",
    tone: "t-dex", img: "Custom DEX" },
];

export default function Splash() {
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
      { threshold: 0.18 }
    );
    document.querySelectorAll<HTMLElement>(".reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (heroRef.current) {
        heroRef.current.style.setProperty("--py", `${y * 0.25}px`);
        heroRef.current.style.setProperty("--ps", `${1 + Math.min(y, 600) * 0.0004}`);
        heroRef.current.style.setProperty("--pf", `${Math.max(0, 1 - y / 520)}`);
      }
      document.querySelector(".sp-nav")?.classList.toggle("scrolled", y > 24);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const ids = ["meme", "social", "tools", "dex"];

  return (
    <div className="sp">
      <style>{css}</style>

      <nav className="sp-nav">
        <a className="sp-brand" href="/"><span className="sp-mark" />{BRAND}</a>
        <div className="sp-links">
          <a href="#meme">Meme coins</a><a href="#social">Social</a>
          <a href="#tools">Tools</a><a href="#dex">DEX</a>
        </div>
        <a className="sp-cta" href="/waitlist">Join waitlist</a>
      </nav>

      <header className="sp-hero" ref={heroRef}>
        <div className="sp-hero-bg" aria-hidden>
          <div className="orb orb-a" /><div className="orb orb-b" /><div className="orb orb-c" />
          <div className="grid-fade" />
        </div>
        <div className="sp-hero-inner">
          <p className="sp-eyebrow">Introducing {BRAND} <span className="ph">/ placeholder name</span></p>
          <h1 className="sp-h1">{TAGLINE}</h1>
          <p className="sp-lead">Meme coins, social, pro trading tools and our own DEX, finally in one place. The everything-exchange is coming.</p>
          <div className="sp-hero-actions">
            <a className="btn-primary" href="/waitlist">Join the waitlist</a>
            <a className="btn-ghost" href="#meme">See what&apos;s coming</a>
          </div>
          <div className="sp-hero-stage">
            <div className="device"><div className="device-glare" /><span className="device-label">App preview · placeholder</span></div>
          </div>
        </div>
        <div className="scroll-hint" aria-hidden><span /></div>
      </header>

      <div className="sp-marquee" aria-hidden>
        <div className="track">
          {Array.from({ length: 2 }).map((_, i) => (
            <span key={i}>Meme coins · Social · Wallet intel · AI analyst · Market radar · Early launch detection · Custom DEX · Alerts · PDF reports · </span>
          ))}
        </div>
      </div>

      <section className="sp-pillars">
        {PILLARS.map((p, i) => (
          <article id={ids[i]} key={p.tag} className={`pillar reveal ${i % 2 ? "rev" : ""}`}>
            <div className="pillar-copy">
              <span className="pillar-tag">{p.tag}</span>
              <h2>{p.title}</h2>
              <p>{p.copy}</p>
              <a className="pillar-link" href="/waitlist">Get early access</a>
            </div>
            <div className={`pillar-art ${p.tone}`}>
              <div className="art-shine" />
              <span className="art-label">{p.img} · image placeholder</span>
            </div>
          </article>
        ))}
      </section>

      <section className="sp-close reveal">
        <h2>One account.<br/>Every market.</h2>
        <p>Be first in line when {BRAND} opens.</p>
        <a className="btn-primary lg" href="/waitlist">Join the waitlist</a>
      </section>

      <footer className="sp-foot">
        <span><span className="sp-mark" />{BRAND}</span>
        <span className="sp-foot-note">© {new Date().getFullYear()} {BRAND} · placeholder brand, final name TBD</span>
      </footer>
    </div>
  );
}

const css = `
.sp{--ink:#0a0a0b;--muted:#86868b;--line:#e7e7ea;--accent:#5b5bf0;--accent2:#9b6bff;
  background:#fff;color:var(--ink);overflow-x:hidden;
  font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Inter,Roboto,sans-serif;-webkit-font-smoothing:antialiased;}
.sp a{text-decoration:none;color:inherit;}
.sp-nav{position:fixed;top:0;left:0;right:0;z-index:50;display:flex;align-items:center;justify-content:space-between;padding:14px clamp(16px,5vw,52px);transition:all .35s;}
.sp-nav.scrolled{background:rgba(255,255,255,.72);backdrop-filter:saturate(180%) blur(20px);border-bottom:1px solid var(--line);}
.sp-brand{display:flex;align-items:center;gap:9px;font-weight:650;letter-spacing:.14em;font-size:15px;}
.sp-mark{width:16px;height:16px;border-radius:5px;background:conic-gradient(from 140deg,var(--accent),var(--accent2),var(--accent));box-shadow:0 4px 14px rgba(91,91,240,.4);}
.sp-links{display:flex;gap:30px;font-size:14px;color:#3a3a40;}
.sp-links a{transition:color .2s;}.sp-links a:hover{color:var(--accent);}
.sp-cta{font-size:14px;font-weight:600;color:#fff;padding:9px 18px;border-radius:980px;background:linear-gradient(120deg,var(--accent),var(--accent2));box-shadow:0 8px 20px -8px rgba(91,91,240,.8);transition:transform .15s,filter .2s;}
.sp-cta:hover{filter:brightness(1.07);transform:translateY(-1px);}
@media(max-width:780px){.sp-links{display:none}}
.sp-hero{position:relative;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:120px 20px 60px;overflow:hidden;}
.sp-hero-bg{position:absolute;inset:0;z-index:0;}
.orb{position:absolute;border-radius:50%;filter:blur(60px);opacity:.55;transform:translateY(var(--py,0)) scale(var(--ps,1));}
.orb-a{width:520px;height:520px;top:-120px;left:-60px;background:radial-gradient(circle,#9b6bff,transparent 70%);}
.orb-b{width:560px;height:560px;top:-40px;right:-120px;background:radial-gradient(circle,#3da5ff,transparent 70%);}
.orb-c{width:480px;height:480px;bottom:-160px;left:40%;background:radial-gradient(circle,#ff6bd0,transparent 70%);opacity:.4;}
.grid-fade{position:absolute;inset:0;background-image:linear-gradient(rgba(10,10,20,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(10,10,20,.05) 1px,transparent 1px);background-size:54px 54px;-webkit-mask-image:radial-gradient(circle at 50% 30%,#000,transparent 72%);mask-image:radial-gradient(circle at 50% 30%,#000,transparent 72%);}
.sp-hero-inner{position:relative;z-index:1;max-width:980px;opacity:var(--pf,1);}
.sp-eyebrow{font-size:13px;letter-spacing:.04em;color:var(--accent);font-weight:600;margin:0 0 18px;}
.sp-eyebrow .ph{color:#b9bcc4;font-weight:500;}
.sp-h1{margin:0;font-size:clamp(52px,11vw,128px);line-height:.95;letter-spacing:-.045em;font-weight:700;background:linear-gradient(180deg,#0a0a0b 30%,#3a3a55);-webkit-background-clip:text;background-clip:text;color:transparent;}
.sp-lead{margin:26px auto 0;max-width:54ch;font-size:clamp(17px,2vw,21px);line-height:1.5;color:#54545c;}
.sp-hero-actions{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-top:34px;}
.btn-primary{font-weight:600;font-size:16px;color:#fff;padding:14px 28px;border-radius:980px;background:linear-gradient(120deg,var(--accent),var(--accent2));box-shadow:0 14px 30px -10px rgba(91,91,240,.75);transition:transform .15s,filter .2s;}
.btn-primary:hover{filter:brightness(1.07);transform:translateY(-2px);}
.btn-primary.lg{font-size:18px;padding:17px 36px;}
.btn-ghost{font-weight:600;font-size:16px;color:var(--ink);padding:14px 22px;border-radius:980px;border:1px solid var(--line);background:rgba(255,255,255,.6);transition:all .2s;}
.btn-ghost:hover{border-color:var(--accent);color:var(--accent);}
.sp-hero-stage{margin-top:70px;perspective:1400px;}
.device{position:relative;width:min(760px,90vw);aspect-ratio:16/9;margin:0 auto;border-radius:26px;background:linear-gradient(160deg,#15151c,#26263a);transform:rotateX(14deg) translateY(var(--py,0)) scale(var(--ps,1));transform-style:preserve-3d;display:grid;place-items:center;box-shadow:0 40px 80px -30px rgba(20,20,60,.55),0 0 0 1px rgba(255,255,255,.06) inset;}
.device-glare{position:absolute;inset:0;border-radius:26px;background:linear-gradient(120deg,rgba(255,255,255,.22),transparent 40%);}
.device-label{color:rgba(255,255,255,.5);font-size:14px;letter-spacing:.04em;}
.scroll-hint{position:absolute;bottom:26px;left:50%;transform:translateX(-50%);width:24px;height:38px;border:2px solid rgba(10,10,20,.25);border-radius:14px;display:flex;justify-content:center;padding-top:6px;}
.scroll-hint span{width:4px;height:8px;border-radius:4px;background:rgba(10,10,20,.35);animation:sd 1.6s infinite;}
@keyframes sd{0%{opacity:0;transform:translateY(-4px)}40%{opacity:1}100%{opacity:0;transform:translateY(10px)}}
.sp-marquee{border-top:1px solid var(--line);border-bottom:1px solid var(--line);overflow:hidden;padding:18px 0;background:#fafafb;}
.sp-marquee .track{display:flex;white-space:nowrap;gap:24px;animation:mq 28s linear infinite;font-size:15px;color:#9a9aa2;font-weight:500;}
@keyframes mq{to{transform:translateX(-50%)}}
.sp-pillars{max-width:1180px;margin:0 auto;padding:clamp(60px,10vw,140px) clamp(18px,5vw,40px);display:flex;flex-direction:column;gap:clamp(80px,12vw,180px);}
.pillar{display:grid;grid-template-columns:1fr 1fr;gap:clamp(30px,5vw,80px);align-items:center;}
.pillar.rev .pillar-copy{order:2;}
.pillar-tag{display:inline-block;font-size:13px;font-weight:600;letter-spacing:.02em;color:var(--accent);padding:6px 14px;border-radius:980px;background:rgba(91,91,240,.08);margin-bottom:18px;}
.pillar-copy h2{margin:0;font-size:clamp(30px,4.6vw,52px);line-height:1.04;letter-spacing:-.03em;font-weight:680;}
.pillar-copy p{margin:18px 0 24px;font-size:clamp(16px,1.7vw,19px);line-height:1.55;color:#54545c;max-width:42ch;}
.pillar-link{font-weight:600;color:var(--accent);font-size:16px;transition:opacity .2s;}
.pillar-link:hover{opacity:.7;}
.pillar-art{position:relative;aspect-ratio:4/3;border-radius:26px;overflow:hidden;display:grid;place-items:center;box-shadow:0 40px 80px -36px rgba(30,20,70,.5);}
.t-meme{background:linear-gradient(140deg,#ff8a3d,#ff3d77);}
.t-social{background:linear-gradient(140deg,#3da5ff,#7b5bff);}
.t-tools{background:linear-gradient(140deg,#19d3a2,#1f8bff);}
.t-dex{background:linear-gradient(140deg,#9b6bff,#5b5bf0);}
.art-shine{position:absolute;inset:0;background:linear-gradient(120deg,rgba(255,255,255,.28),transparent 45%);}
.art-label{position:relative;color:rgba(255,255,255,.9);font-size:14px;font-weight:500;letter-spacing:.03em;background:rgba(0,0,0,.18);padding:8px 16px;border-radius:980px;backdrop-filter:blur(6px);}
.reveal{opacity:0;transform:translateY(40px);transition:opacity .9s cubic-bezier(.2,.7,.2,1),transform .9s cubic-bezier(.2,.7,.2,1);}
.reveal.in{opacity:1;transform:none;}
@media(max-width:820px){.pillar{grid-template-columns:1fr}.pillar.rev .pillar-copy{order:0}}
.sp-close{text-align:center;padding:clamp(80px,14vw,180px) 20px;background:linear-gradient(180deg,#fff,#f5f5f9);}
.sp-close h2{margin:0;font-size:clamp(40px,8vw,88px);line-height:1;letter-spacing:-.04em;font-weight:700;}
.sp-close p{margin:22px 0 34px;font-size:19px;color:#54545c;}
.sp-foot{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;padding:30px clamp(18px,5vw,52px);border-top:1px solid var(--line);font-size:13.5px;color:#9a9aa2;}
.sp-foot span:first-child{display:flex;align-items:center;gap:9px;font-weight:650;letter-spacing:.14em;color:var(--ink);}
.sp-foot-note{font-size:12.5px;}
`;
