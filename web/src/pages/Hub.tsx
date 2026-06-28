import { useEffect, useRef } from "react";

const BRAND = "OGSCAN";

type Tile = {
  key: string; tag: string; title: string; copy: string; href: string;
  external?: boolean; tone: string; cta: string;
};
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
  { label: "Admin", href: "/OGDEX/admin" },
];

export default function Hub() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
      { threshold: 0.15 }
    );
    document.querySelectorAll<HTMLElement>(".hb-reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // pointer-driven aurora movement
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const move = (e: MouseEvent) => {
      const x = e.clientX / window.innerWidth - 0.5, y = e.clientY / window.innerHeight - 0.5;
      el.style.setProperty("--mx", `${x * 40}px`); el.style.setProperty("--my", `${y * 40}px`);
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);

  const tilt = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = e.currentTarget; const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", `${(-py * 8).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(px * 10).toFixed(2)}deg`);
    el.style.setProperty("--gx", `${(px * 100 + 50).toFixed(0)}%`);
    el.style.setProperty("--gy", `${(py * 100 + 50).toFixed(0)}%`);
  };
  const reset = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.setProperty("--rx", "0deg");
    e.currentTarget.style.setProperty("--ry", "0deg");
  };

  return (
    <div className="hb" ref={ref}>
      <style>{css}</style>
      <div className="hb-aurora" aria-hidden><span className="a a1" /><span className="a a2" /><span className="a a3" /><span className="hb-grid" /><span className="hb-grain" /></div>

      <header className="hb-nav">
        <span className="hb-brand"><span className="hb-mark" />{BRAND}</span>
        <nav className="hb-nav-links">
          <a href="/OGDEX">OG Dex</a><a href="/social">Social</a><a href="https://solno.fun" target="_blank" rel="noreferrer">Predictions</a>
        </nav>
        <a className="hb-nav-cta" href="/settings">Account</a>
      </header>

      <main className="hb-main">
        <div className="hb-hero hb-reveal">
          <p className="hb-eyebrow">Welcome to the hub</p>
          <h1 className="hb-h1">Everything on-chain,<br/><span>in one place.</span></h1>
          <p className="hb-sub">Pick where you want to go. Trade and scan, jump into the community, or play the markets.</p>
        </div>

        <div className="hb-tiles">
          {TILES.map((t, i) => (
            <a key={t.key} className={`hb-tile ${t.tone} hb-reveal`} style={{ transitionDelay: `${i * 90}ms` }}
              href={t.href} target={t.external ? "_blank" : undefined} rel={t.external ? "noreferrer" : undefined}
              onMouseMove={tilt} onMouseLeave={reset}>
              <span className="hb-tile-glow" aria-hidden />
              <span className="hb-tile-art" aria-hidden><span className="ring r1" /><span className="ring r2" /><span className="ring r3" /><span className="core" /></span>
              <span className="hb-tile-body">
                <span className="hb-tile-tag">{t.tag}</span>
                <span className="hb-tile-title">{t.title}</span>
                <span className="hb-tile-copy">{t.copy}</span>
                <span className="hb-tile-cta">{t.cta} <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
              </span>
            </a>
          ))}
        </div>

        <div className="hb-quick hb-reveal">
          {QUICK.map((q) => (
            <a key={q.label} className="hb-chip" href={q.href} target={q.external ? "_blank" : undefined} rel={q.external ? "noreferrer" : undefined}>{q.label}</a>
          ))}
        </div>
      </main>

      <footer className="hb-foot">
        <span><span className="hb-mark" />{BRAND}</span>
        <span className="hb-foot-links">
          <a href="/OGDEX">OG Dex</a><a href="/social">Social</a><a href="https://solno.fun" target="_blank" rel="noreferrer">Solno</a>
          <a href="/privacy">Privacy</a><a href="/terms">Terms</a>
        </span>
      </footer>
    </div>
  );
}

const css = `
.hb{--bg:#050608;--ink:#fff;--muted:#a7adba;--line:rgba(255,255,255,.10);--blue:#2F80FF;--purple:#9945FF;--gold:#FFC53D;--green:#14F195;
  position:relative;min-height:100vh;background:var(--bg);color:var(--ink);overflow-x:hidden;display:flex;flex-direction:column;
  font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Inter,'Plus Jakarta Sans',sans-serif;-webkit-font-smoothing:antialiased;}
.hb a{text-decoration:none;color:inherit;}
.hb-aurora{position:fixed;inset:0;z-index:0;pointer-events:none;}
.hb-aurora .a{position:absolute;border-radius:50%;filter:blur(90px);opacity:.5;transform:translate(var(--mx,0),var(--my,0));transition:transform .4s ease-out;}
.a1{width:620px;height:620px;top:-160px;left:-120px;background:radial-gradient(circle,#2F80FF,transparent 70%);animation:fl1 16s ease-in-out infinite;}
.a2{width:640px;height:640px;top:-80px;right:-160px;background:radial-gradient(circle,#9945FF,transparent 70%);animation:fl2 19s ease-in-out infinite;}
.a3{width:560px;height:560px;bottom:-200px;left:40%;background:radial-gradient(circle,#14a0ff,transparent 70%);opacity:.32;animation:fl3 22s ease-in-out infinite;}
@keyframes fl1{50%{transform:translate(60px,40px)}}@keyframes fl2{50%{transform:translate(-50px,30px)}}@keyframes fl3{50%{transform:translate(30px,-40px)}}
.hb-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:58px 58px;-webkit-mask-image:radial-gradient(circle at 50% 35%,#000,transparent 72%);mask-image:radial-gradient(circle at 50% 35%,#000,transparent 72%);}
.hb-grain{position:absolute;inset:0;opacity:.04;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}
.hb-nav{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:18px clamp(18px,5vw,52px);}
.hb-brand{display:flex;align-items:center;gap:9px;font-weight:800;letter-spacing:.16em;font-size:15px;}
.hb-mark{width:16px;height:16px;border-radius:5px;background:conic-gradient(from 140deg,var(--blue),var(--purple),var(--blue));box-shadow:0 4px 16px rgba(47,128,255,.5);}
.hb-nav-links{display:flex;gap:28px;font-size:14px;color:var(--muted);}
.hb-nav-links a:hover{color:#fff;}
.hb-nav-cta{font-size:13.5px;font-weight:700;padding:9px 18px;border-radius:980px;border:1px solid var(--line);background:rgba(255,255,255,.04);transition:all .2s;}
.hb-nav-cta:hover{border-color:var(--blue);background:rgba(47,128,255,.12);}
@media(max-width:720px){.hb-nav-links{display:none}}
.hb-main{position:relative;z-index:1;flex:1;max-width:1200px;width:100%;margin:0 auto;padding:clamp(24px,5vh,60px) clamp(18px,5vw,40px) 40px;}
.hb-hero{text-align:center;margin-bottom:clamp(34px,5vh,60px);}
.hb-eyebrow{font-size:12.5px;letter-spacing:.24em;text-transform:uppercase;color:var(--blue);font-weight:700;margin:0 0 16px;}
.hb-h1{margin:0;font-size:clamp(40px,7vw,86px);line-height:.98;letter-spacing:-.04em;font-weight:800;}
.hb-h1 span{background:linear-gradient(120deg,var(--blue),var(--purple) 60%,var(--gold));-webkit-background-clip:text;background-clip:text;color:transparent;}
.hb-sub{margin:22px auto 0;max-width:52ch;font-size:clamp(15px,1.7vw,19px);line-height:1.6;color:var(--muted);}
.hb-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;perspective:1400px;}
@media(max-width:920px){.hb-tiles{grid-template-columns:1fr}}
.hb-tile{position:relative;display:flex;min-height:340px;border-radius:28px;border:1px solid var(--line);overflow:hidden;padding:26px;
  background:linear-gradient(160deg,rgba(255,255,255,.05),rgba(255,255,255,.015));
  transform:rotateX(var(--rx,0)) rotateY(var(--ry,0));transform-style:preserve-3d;transition:transform .2s ease-out,border-color .3s,box-shadow .3s;
  box-shadow:0 30px 80px -40px rgba(0,0,0,.9);}
.hb-tile:hover{border-color:var(--tc,#2F80FF);box-shadow:0 40px 90px -40px var(--tg,rgba(47,128,255,.6));}
.hb-tile-glow{position:absolute;inset:0;border-radius:28px;pointer-events:none;opacity:0;transition:opacity .3s;background:radial-gradient(380px circle at var(--gx,50%) var(--gy,50%),var(--tg,rgba(47,128,255,.18)),transparent 60%);}
.hb-tile:hover .hb-tile-glow{opacity:1;}
.t-dex{--tc:#2F80FF;--tg:rgba(47,128,255,.5);}
.t-social{--tc:#9945FF;--tg:rgba(153,69,255,.5);}
.t-predict{--tc:#FFC53D;--tg:rgba(255,197,61,.45);}
.hb-tile-art{position:absolute;top:-30px;right:-30px;width:200px;height:200px;transform:translateZ(40px);}
.hb-tile-art .ring{position:absolute;inset:0;margin:auto;border-radius:50%;border:1.5px solid var(--tc);opacity:.25;}
.hb-tile-art .r1{width:200px;height:200px;animation:spin 18s linear infinite;}
.hb-tile-art .r2{width:140px;height:140px;opacity:.4;animation:spin 12s linear infinite reverse;}
.hb-tile-art .r3{width:84px;height:84px;opacity:.6;}
.hb-tile-art .core{position:absolute;inset:0;margin:auto;width:44px;height:44px;border-radius:50%;background:radial-gradient(circle,var(--tc),transparent 72%);filter:blur(2px);box-shadow:0 0 40px var(--tc);}
@keyframes spin{to{transform:rotate(360deg)}}
.hb-tile-body{position:relative;z-index:1;display:flex;flex-direction:column;margin-top:auto;transform:translateZ(30px);}
.hb-tile-tag{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--tc);}
.hb-tile-title{margin:8px 0 10px;font-size:32px;font-weight:800;letter-spacing:-.02em;}
.hb-tile-copy{font-size:14px;line-height:1.55;color:var(--muted);max-width:34ch;}
.hb-tile-cta{display:inline-flex;align-items:center;gap:8px;margin-top:20px;align-self:flex-start;font-size:14.5px;font-weight:700;color:#000;padding:11px 20px;border-radius:980px;background:linear-gradient(120deg,var(--tc),color-mix(in srgb,var(--tc) 55%,#fff));box-shadow:0 12px 30px -12px var(--tg);transition:transform .15s,filter .2s;}
.hb-tile:hover .hb-tile-cta{transform:translateY(-2px);filter:brightness(1.05);}
.hb-quick{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:34px;}
.hb-chip{font-size:13.5px;font-weight:600;color:#cfd4dd;padding:10px 18px;border-radius:980px;border:1px solid var(--line);background:rgba(255,255,255,.03);transition:all .2s;}
.hb-chip:hover{border-color:var(--blue);color:#fff;background:rgba(47,128,255,.1);}
.hb-foot{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;padding:24px clamp(18px,5vw,52px);border-top:1px solid var(--line);font-size:13px;color:#7e879a;}
.hb-foot span:first-child{display:flex;align-items:center;gap:9px;font-weight:800;letter-spacing:.16em;color:#fff;}
.hb-foot-links{display:flex;gap:18px;}
.hb-foot-links a:hover{color:#fff;}
.hb-reveal{opacity:0;transform:translateY(34px);transition:opacity .8s cubic-bezier(.2,.7,.2,1),transform .8s cubic-bezier(.2,.7,.2,1);}
.hb-reveal.in{opacity:1;transform:none;}
`;
