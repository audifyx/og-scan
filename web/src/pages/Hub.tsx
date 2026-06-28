import { useEffect, useRef } from "react";

const BRAND = "OGSCAN";

type Tile = { key: string; tag: string; title: string; copy: string; href: string; external?: boolean; tone: string; cta: string };
const TILES: Tile[] = [
  { key: "dex", tag: "Trade & scan", title: "OG Dex", tone: "t-dex", cta: "Open OG Dex",
    copy: "Real-time scanner, forensic OG attribution, wallet intel, charts and one-click trading.", href: "/OGDEX" },
  { key: "social", tag: "Community", title: "Social", tone: "t-social", cta: "Enter Social",
    copy: "Spaces, voice lobbies, community chat, messages and your profile — the people layer.", href: "/social" },
  { key: "predict", tag: "Play & predict", title: "Prediction Markets", tone: "t-predict", cta: "Open Solno",
    copy: "Native prediction markets and provably-fair 1v1 games. Coinflip, Crash, Dice and more.", href: "https://solno.fun", external: true },
];
const QUICK = [
  { label: "OG Scanner", href: "/OGDEX/scanner" },
  { label: "Launch a token", href: "/OGDEX/launch" },
  { label: "Degen Tower", href: "https://degen-tower.vercel.app", external: true },
  { label: "Settings", href: "/settings" },
];

export default function Hub() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("in")), { threshold: 0.12 });
    document.querySelectorAll<HTMLElement>(".hb-reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const move = (e: MouseEvent) => {
      const x = e.clientX / window.innerWidth - 0.5, y = e.clientY / window.innerHeight - 0.5;
      el.style.setProperty("--mx", `${x * 60}px`); el.style.setProperty("--my", `${y * 60}px`);
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);

  const tilt = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = e.currentTarget; const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", `${(-py * 12).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(px * 14).toFixed(2)}deg`);
    el.style.setProperty("--gx", `${(px * 100 + 50).toFixed(0)}%`);
    el.style.setProperty("--gy", `${(py * 100 + 50).toFixed(0)}%`);
  };
  const reset = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.setProperty("--rx", "0deg"); e.currentTarget.style.setProperty("--ry", "0deg");
  };

  return (
    <div className="hb" ref={ref}>
      <style>{css}</style>
      <div className="hb-bg" aria-hidden>
        <span className="mesh m1" /><span className="mesh m2" /><span className="mesh m3" /><span className="mesh m4" />
        <span className="hb-grid" /><span className="hb-vignette" /><span className="hb-grain" />
        <span className="beam" />
      </div>

      <header className="hb-nav hb-reveal">
        <span className="hb-brand"><span className="hb-mark" />{BRAND}</span>
        <nav className="hb-nav-links">
          <a href="/OGDEX">OG Dex</a><a href="/social">Social</a><a href="https://solno.fun" target="_blank" rel="noreferrer">Predictions</a>
        </nav>
        <a className="hb-nav-cta" href="/settings">Account</a>
      </header>

      <main className="hb-main">
        <div className="hb-hero hb-reveal">
          <p className="hb-eyebrow"><span className="dot" /> Welcome to the hub</p>
          <h1 className="hb-h1">Everything on-chain,<br /><span className="grad">in one place.</span></h1>
          <p className="hb-sub">Pick your destination. Trade and scan, dive into the community, or play the markets.</p>
        </div>

        <div className="hb-tiles">
          {TILES.map((t, i) => (
            <a key={t.key} className={`hb-tile ${t.tone} hb-reveal`} style={{ ["--d" as any]: `${i * 110}ms` }}
              href={t.href} target={t.external ? "_blank" : undefined} rel={t.external ? "noreferrer" : undefined}
              onMouseMove={tilt} onMouseLeave={reset}>
              <span className="hb-border" aria-hidden />
              <span className="hb-tile-glow" aria-hidden />
              <span className="hb-shine" aria-hidden />
              <span className="hb-tile-art" aria-hidden><span className="ring r1" /><span className="ring r2" /><span className="ring r3" /><span className="core" /></span>
              <span className="hb-tile-body">
                <span className="hb-tile-tag">{t.tag}</span>
                <span className="hb-tile-title">{t.title}</span>
                <span className="hb-tile-copy">{t.copy}</span>
                <span className="hb-tile-cta">{t.cta} <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
              </span>
            </a>
          ))}
        </div>

        <div className="hb-quick hb-reveal">
          {QUICK.map((q) => (
            <a key={q.label} className="hb-chip" href={q.href} target={q.external ? "_blank" : undefined} rel={q.external ? "noreferrer" : undefined}><span>{q.label}</span></a>
          ))}
        </div>
      </main>

      <footer className="hb-foot hb-reveal">
        <span className="hb-foot-brand"><span className="hb-mark" />{BRAND}</span>
        <span className="hb-foot-links">
          <a href="/OGDEX">OG Dex</a><a href="/social">Social</a><a href="https://solno.fun" target="_blank" rel="noreferrer">Solno</a>
          <a href="/privacy">Privacy</a><a href="/terms">Terms</a>
        </span>
      </footer>
    </div>
  );
}

const css = `
.hb{--bg:#030306;--ink:#fff;--muted:#9aa3b2;--line:rgba(255,255,255,.08);--blue:#2F80FF;--purple:#9945FF;--cyan:#14a8ff;--gold:#FFC53D;
  position:relative;min-height:100vh;background:#030306;color:var(--ink);overflow-x:hidden;display:flex;flex-direction:column;
  font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Inter,'Plus Jakarta Sans',sans-serif;-webkit-font-smoothing:antialiased;}
.hb a{text-decoration:none;color:inherit;}
/* ── animated mesh background ── */
.hb-bg{position:fixed;inset:0;z-index:0;pointer-events:none;background:#020204;}
.mesh{position:absolute;border-radius:50%;filter:blur(100px);opacity:.55;mix-blend-mode:screen;transform:translate(var(--mx,0),var(--my,0));transition:transform .5s ease-out;}
.m1{width:46vw;height:46vw;top:-12vw;left:-8vw;background:radial-gradient(circle,#2F80FF,transparent 68%);animation:drift1 18s ease-in-out infinite;}
.m2{width:48vw;height:48vw;top:-6vw;right:-12vw;background:radial-gradient(circle,#9945FF,transparent 68%);animation:drift2 22s ease-in-out infinite;}
.m3{width:44vw;height:44vw;bottom:-16vw;left:34%;background:radial-gradient(circle,#14a8ff,transparent 70%);opacity:.38;animation:drift3 26s ease-in-out infinite;}
.m4{width:30vw;height:30vw;top:38%;left:50%;background:radial-gradient(circle,#ff5bbd,transparent 72%);opacity:.18;animation:drift1 30s ease-in-out infinite reverse;}
@keyframes drift1{50%{transform:translate(8vw,5vw) scale(1.12)}}
@keyframes drift2{50%{transform:translate(-7vw,4vw) scale(1.08)}}
@keyframes drift3{50%{transform:translate(4vw,-6vw) scale(1.15)}}
.hb-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:60px 60px;-webkit-mask-image:radial-gradient(circle at 50% 30%,#000,transparent 75%);mask-image:radial-gradient(circle at 50% 30%,#000,transparent 75%);animation:gridfloat 20s ease-in-out infinite;}
@keyframes gridfloat{50%{background-position:30px 30px}}
.hb-vignette{position:absolute;inset:0;background:radial-gradient(circle at 50% 40%,transparent 40%,rgba(0,0,0,.55) 100%);}
.hb-grain{position:absolute;inset:0;opacity:.035;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}
.beam{position:absolute;top:-40%;left:50%;width:140%;height:60%;transform:translateX(-50%) rotate(8deg);background:linear-gradient(90deg,transparent,rgba(47,128,255,.10),rgba(153,69,255,.08),transparent);filter:blur(40px);animation:beam 9s ease-in-out infinite;}
@keyframes beam{0%,100%{opacity:.3;transform:translateX(-54%) rotate(8deg)}50%{opacity:.7;transform:translateX(-46%) rotate(8deg)}}
/* ── nav ── */
.hb-nav{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:18px clamp(18px,5vw,52px);}
.hb-brand{display:flex;align-items:center;gap:9px;font-weight:800;letter-spacing:.18em;font-size:15px;}
.hb-mark{width:16px;height:16px;border-radius:5px;background:conic-gradient(from 140deg,var(--blue),var(--purple),var(--cyan),var(--blue));box-shadow:0 0 18px rgba(47,128,255,.6);animation:spin 8s linear infinite;}
@keyframes spin{to{transform:rotate(360deg)}}
.hb-nav-links{display:flex;gap:28px;font-size:14px;color:var(--muted);}
.hb-nav-links a{position:relative;transition:color .2s;}
.hb-nav-links a::after{content:"";position:absolute;left:0;right:100%;bottom:-5px;height:1.5px;background:linear-gradient(90deg,var(--blue),var(--purple));transition:right .25s;}
.hb-nav-links a:hover{color:#fff;}.hb-nav-links a:hover::after{right:0;}
.hb-nav-cta{font-size:13.5px;font-weight:700;padding:9px 18px;border-radius:980px;border:1px solid var(--line);background:rgba(255,255,255,.04);transition:all .25s;}
.hb-nav-cta:hover{border-color:var(--blue);background:rgba(47,128,255,.14);box-shadow:0 0 24px -6px rgba(47,128,255,.6);}
@media(max-width:720px){.hb-nav-links{display:none}}
/* ── main ── */
.hb-main{position:relative;z-index:1;flex:1;max-width:1220px;width:100%;margin:0 auto;padding:clamp(28px,6vh,72px) clamp(18px,5vw,40px) 44px;}
.hb-hero{text-align:center;margin-bottom:clamp(38px,6vh,68px);}
.hb-eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:12px;letter-spacing:.26em;text-transform:uppercase;color:#cdd5e3;font-weight:700;margin:0 0 18px;padding:7px 16px;border-radius:980px;border:1px solid var(--line);background:rgba(255,255,255,.03);backdrop-filter:blur(8px);}
.hb-eyebrow .dot{width:7px;height:7px;border-radius:50%;background:var(--blue);box-shadow:0 0 12px var(--blue);animation:pulse 2s ease-in-out infinite;}
@keyframes pulse{50%{opacity:.4;transform:scale(.8)}}
.hb-h1{margin:0;font-size:clamp(44px,8vw,104px);line-height:.95;letter-spacing:-.045em;font-weight:800;}
.hb-h1 .grad{background:linear-gradient(100deg,var(--blue),var(--purple) 40%,var(--gold) 70%,var(--blue));background-size:250% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:sheen 6s linear infinite;}
@keyframes sheen{to{background-position:250% center}}
.hb-sub{margin:24px auto 0;max-width:54ch;font-size:clamp(15px,1.7vw,19px);line-height:1.6;color:var(--muted);}
/* ── tiles ── */
.hb-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;perspective:1600px;}
@media(max-width:920px){.hb-tiles{grid-template-columns:1fr}}
.hb-tile{position:relative;display:flex;min-height:360px;border-radius:30px;overflow:hidden;padding:28px;isolation:isolate;
  background:linear-gradient(165deg,rgba(255,255,255,.05),rgba(255,255,255,.012));border:1px solid var(--line);
  transform:rotateX(var(--rx,0)) rotateY(var(--ry,0)) translateZ(0);transform-style:preserve-3d;
  transition:transform .18s ease-out,box-shadow .35s,border-color .35s;
  box-shadow:0 40px 90px -50px rgba(0,0,0,1);}
.hb-tile:hover{box-shadow:0 50px 120px -45px var(--tg,rgba(47,128,255,.7)),0 0 0 1px var(--tc,#2F80FF) inset;border-color:transparent;}
/* rotating gradient border on hover */
.hb-border{position:absolute;inset:-1px;border-radius:30px;padding:1px;opacity:0;transition:opacity .35s;
  background:conic-gradient(from var(--a,0deg),transparent 0deg,var(--tc,#2F80FF) 80deg,var(--cyan) 140deg,transparent 220deg);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;
  animation:rot 4s linear infinite;}
.hb-tile:hover .hb-border{opacity:1;}
@keyframes rot{to{--a:360deg}}
@property --a{syntax:'<angle>';inherits:false;initial-value:0deg;}
.hb-tile-glow{position:absolute;inset:0;border-radius:30px;pointer-events:none;opacity:0;transition:opacity .35s;background:radial-gradient(420px circle at var(--gx,50%) var(--gy,50%),var(--tg,rgba(47,128,255,.22)),transparent 60%);}
.hb-tile:hover .hb-tile-glow{opacity:1;}
.hb-shine{position:absolute;top:0;left:-60%;width:50%;height:100%;transform:skewX(-20deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.14),transparent);transition:left .7s ease;pointer-events:none;}
.hb-tile:hover .hb-shine{left:120%;}
.t-dex{--tc:#2F80FF;--tg:rgba(47,128,255,.55);}
.t-social{--tc:#9945FF;--tg:rgba(153,69,255,.55);}
.t-predict{--tc:#FFC53D;--tg:rgba(255,197,61,.5);}
.hb-tile-art{position:absolute;top:-28px;right:-28px;width:210px;height:210px;transform:translateZ(50px);opacity:.9;}
.hb-tile-art .ring{position:absolute;inset:0;margin:auto;border-radius:50%;border:1.5px solid var(--tc);opacity:.22;}
.hb-tile-art .r1{width:210px;height:210px;animation:spin 16s linear infinite;}
.hb-tile-art .r2{width:150px;height:150px;opacity:.38;animation:spin 11s linear infinite reverse;}
.hb-tile-art .r3{width:90px;height:90px;opacity:.55;}
.hb-tile-art .core{position:absolute;inset:0;margin:auto;width:46px;height:46px;border-radius:50%;background:radial-gradient(circle,var(--tc),transparent 72%);filter:blur(2px);box-shadow:0 0 50px var(--tc);animation:pulse 3s ease-in-out infinite;}
.hb-tile-body{position:relative;z-index:1;display:flex;flex-direction:column;margin-top:auto;transform:translateZ(40px);}
.hb-tile-tag{font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--tc);}
.hb-tile-title{margin:8px 0 10px;font-size:34px;font-weight:800;letter-spacing:-.025em;}
.hb-tile-copy{font-size:14px;line-height:1.55;color:var(--muted);max-width:34ch;}
.hb-tile-cta{display:inline-flex;align-items:center;gap:8px;margin-top:22px;align-self:flex-start;font-size:14.5px;font-weight:800;color:#000;padding:12px 22px;border-radius:980px;background:linear-gradient(120deg,var(--tc),color-mix(in srgb,var(--tc) 50%,#fff));box-shadow:0 14px 34px -12px var(--tg);transition:transform .2s,filter .2s,gap .2s;}
.hb-tile:hover .hb-tile-cta{transform:translateY(-3px) scale(1.03);filter:brightness(1.08);gap:12px;}
/* ── quick chips ── */
.hb-quick{display:flex;flex-wrap:wrap;justify-content:center;gap:11px;margin-top:38px;}
.hb-chip{position:relative;overflow:hidden;font-size:13.5px;font-weight:600;color:#cfd6e2;padding:11px 20px;border-radius:980px;border:1px solid var(--line);background:rgba(255,255,255,.03);transition:all .25s;}
.hb-chip span{position:relative;z-index:1;}
.hb-chip::before{content:"";position:absolute;inset:0;background:linear-gradient(120deg,var(--blue),var(--purple));opacity:0;transition:opacity .25s;}
.hb-chip:hover{color:#fff;border-color:transparent;transform:translateY(-2px);box-shadow:0 10px 30px -10px rgba(47,128,255,.6);}
.hb-chip:hover::before{opacity:.9;}
/* ── footer ── */
.hb-foot{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;padding:26px clamp(18px,5vw,52px);border-top:1px solid var(--line);font-size:13px;color:#71798a;}
.hb-foot-brand{display:flex;align-items:center;gap:9px;font-weight:800;letter-spacing:.16em;color:#fff;}
.hb-foot-links{display:flex;gap:18px;}.hb-foot-links a:hover{color:#fff;}
/* ── reveal (crazier entrance: blur + scale + slide) ── */
.hb-reveal{opacity:0;transform:translateY(40px) scale(.96);filter:blur(10px);transition:opacity .9s cubic-bezier(.2,.7,.2,1) var(--d,0ms),transform .9s cubic-bezier(.2,.7,.2,1) var(--d,0ms),filter .9s ease var(--d,0ms);}
.hb-reveal.in{opacity:1;transform:none;filter:blur(0);}
@media(prefers-reduced-motion:reduce){.mesh,.beam,.hb-grid,.hb-mark,.core,.hb-border,.hb-h1 .grad{animation:none!important}.hb-reveal{transition-duration:.4s;filter:none;}}
`;
