import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";

const BRAND = "OrbitX";
const OS = "OrbitX OS";
const VERSION = "v1.0.4";

type App = {
  key: string;
  name: string;
  caption: string;
  href: string;
  external?: boolean;
  tone: string; // accent color
  glyph: JSX.Element;
};

const Glyph = {
  dex: (
    <svg viewBox="0 0 48 48" fill="none">
      <path d="M8 34l9-11 7 6 11-15" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 40h32" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".5" />
      <circle cx="35" cy="14" r="3" fill="currentColor" />
    </svg>
  ),
  social: (
    <svg viewBox="0 0 48 48" fill="none">
      <circle cx="18" cy="18" r="6" stroke="currentColor" strokeWidth="3" />
      <circle cx="32" cy="22" r="5" stroke="currentColor" strokeWidth="3" opacity=".7" />
      <path d="M8 40c0-6 5-10 10-10s10 4 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M30 40c0-5 3-8 6-8s6 3 6 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".7" />
    </svg>
  ),
  predict: (
    <svg viewBox="0 0 48 48" fill="none">
      <rect x="9" y="9" width="30" height="30" rx="7" stroke="currentColor" strokeWidth="3" />
      <circle cx="18" cy="18" r="2.6" fill="currentColor" />
      <circle cx="30" cy="30" r="2.6" fill="currentColor" />
      <circle cx="30" cy="18" r="2.6" fill="currentColor" />
      <circle cx="18" cy="30" r="2.6" fill="currentColor" />
      <circle cx="24" cy="24" r="2.6" fill="currentColor" />
    </svg>
  ),
  scanner: (
    <svg viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="15" stroke="currentColor" strokeWidth="3" opacity=".4" />
      <circle cx="24" cy="24" r="8" stroke="currentColor" strokeWidth="3" opacity=".7" />
      <path d="M24 24L37 13" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="24" cy="24" r="2.6" fill="currentColor" />
    </svg>
  ),
  tower: (
    <svg viewBox="0 0 48 48" fill="none">
      <path d="M18 40V14l6-6 6 6v26" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <path d="M12 40h24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 8v6M21 20h6M21 27h6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54a.49.49 0 0 0-.48-.41h-3.84a.49.49 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87a.49.49 0 0 0 .12.61l2.03 1.58c-.05.3-.07.62-.07.94 0 .32.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.49.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.07.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z" />
    </svg>
  ),
};

const APPS: App[] = [
  { key: "dex", name: "OG Dex", caption: "Scanner · Trade", href: "/OGDEX", tone: "#2F80FF", glyph: Glyph.dex },
  { key: "social", name: "Social", caption: "Spaces · Chat", href: "/social", tone: "#9945FF", glyph: Glyph.social },
  { key: "predict", name: "Prediction Markets", caption: "Provably fair", href: "https://solno.fun", external: true, tone: "#FFC53D", glyph: Glyph.predict },
  { key: "scanner", name: "OG Scanner", caption: "Forensic scan", href: "/OGDEX/scanner", tone: "#14E0C8", glyph: Glyph.scanner },
  { key: "tower", name: "Degen Tower", caption: "Climb · Win", href: "https://degen-tower.vercel.app", external: true, tone: "#FF5BBD", glyph: Glyph.tower },
  { key: "settings", name: "Settings", caption: "Preferences", href: "/settings", tone: "#8A93A6", glyph: Glyph.settings },
];

const BOOT_LINES = [
  "OrbitX OS · bootloader " + VERSION,
  "› mounting on-chain kernel ............ ok",
  "› linking helius rpc node ............. ok",
  "› forensic attribution engine ........ ok",
  "› loading social layer ............... ok",
  "› prediction market daemon ........... ok",
  "› decrypting user session ............ ok",
  "› launching desktop environment ......",
];

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function Hub() {
  const [booted, setBooted] = useState(false);
  const [bootStep, setBootStep] = useState(0);
  const [launching, setLaunching] = useState<App | null>(null);
  const [glitchKey, setGlitchKey] = useState(0);
  const deskRef = useRef<HTMLDivElement>(null);
  const now = useClock();
  const { signOut } = useAuth();
  const logout = async () => { try { await signOut(); } finally { window.location.assign("/auth"); } };

  // boot sequence
  useEffect(() => {
    if (sessionStorage.getItem("ogos_booted")) { setBooted(true); return; }
    let i = 0;
    const tick = setInterval(() => {
      i += 1;
      setBootStep(i);
      if (i >= BOOT_LINES.length) {
        clearInterval(tick);
        setTimeout(() => { sessionStorage.setItem("ogos_booted", "1"); setBooted(true); }, 600);
      }
    }, 360);
    return () => clearInterval(tick);
  }, []);

  // parallax wallpaper
  useEffect(() => {
    const el = deskRef.current; if (!el) return;
    const move = (e: MouseEvent) => {
      const x = e.clientX / window.innerWidth - 0.5, y = e.clientY / window.innerHeight - 0.5;
      el.style.setProperty("--mx", `${x * 30}px`);
      el.style.setProperty("--my", `${y * 30}px`);
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);

  // periodic ambient glitch flicker
  useEffect(() => {
    if (!booted) return;
    const t = setInterval(() => setGlitchKey((k) => k + 1), 6500);
    return () => clearInterval(t);
  }, [booted]);

  const openApp = useCallback((app: App) => {
    if (launching) return;
    setLaunching(app);
    window.setTimeout(() => {
      if (app.external) {
        window.open(app.href, "_blank", "noopener");
        setLaunching(null);
      } else {
        window.location.assign(app.href);
      }
    }, 820);
  }, [launching]);

  const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  const date = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="os" ref={deskRef}>
      <style>{css}</style>

      {/* ── BOOT SCREEN ── */}
      {!booted && (
        <div className="boot">
          <div className="boot-grid" />
          <div className="boot-inner">
            <div className="boot-logo" data-text={BRAND}>{BRAND}</div>
            <div className="boot-os">{OS}</div>
            <pre className="boot-log">
              {BOOT_LINES.slice(0, bootStep).map((l, i) => (
                <div key={i} className="boot-line">{l}</div>
              ))}
              <span className="boot-cursor">█</span>
            </pre>
            <div className="boot-bar"><span style={{ width: `${(bootStep / BOOT_LINES.length) * 100}%` }} /></div>
          </div>
          <div className="scan" />
        </div>
      )}

      {/* ── DESKTOP ── */}
      <div className={`desk ${booted ? "on" : ""}`} key={glitchKey + "-d"}>
        {/* wallpaper */}
        <div className="wp" aria-hidden>
          <span className="wp-photo" />
          <span className="wp-mesh w1" /><span className="wp-mesh w2" /><span className="wp-mesh w3" />
          <span className="wp-grid" /><span className="wp-vignette" /><span className="scan" /><span className="wp-noise" />
        </div>

        {/* menu bar */}
        <header className="menubar">
          <div className="mb-left">
            <span className="mb-mark" />
            <span className="mb-os">{OS}</span>
            <nav className="mb-menu">
              <span>File</span><span>Apps</span><span>View</span><span>Help</span>
            </nav>
          </div>
          <div className="mb-right">
            <span className="mb-stat" title="On-chain link active"><i className="led" /> ONLINE</span>
            <span className="mb-sig" aria-hidden><i /><i /><i /><i /></span>
            <span className="mb-clock">{date}<b>{time}</b></span>
            <a className="mb-acct" href="/settings"><span className="mb-acct-dot" />Account</a>
            <button className="mb-logout" onClick={logout} title="Log out">Log out</button>
          </div>
        </header>

        {/* desktop body */}
        <main className="desk-body">
          <div className="welcome">
            <p className="wl-eyebrow"><span className="dot" /> SYSTEM READY</p>
            <h1 className="wl-title" data-text="Choose your application">Choose your application</h1>
            <p className="wl-sub">Everything on-chain, one operating system. Launch an app to begin.</p>
          </div>

          <div className="launcher">
            {APPS.map((app, i) => (
              <button
                key={app.key}
                className={`app ${launching?.key === app.key ? "opening" : ""}`}
                style={{ ["--tone" as any]: app.tone, ["--d" as any]: `${i * 70}ms` }}
                onClick={() => openApp(app)}
                disabled={!!launching}
              >
                <span className="app-icon" data-glyph>
                  <span className="app-icon-bg" />
                  <span className="app-icon-glyph g-main">{app.glyph}</span>
                  <span className="app-icon-glyph g-r" aria-hidden>{app.glyph}</span>
                  <span className="app-icon-glyph g-b" aria-hidden>{app.glyph}</span>
                  <span className="app-icon-gloss" />
                </span>
                <span className="app-name" data-text={app.name}>{app.name}</span>
                <span className="app-cap">{app.caption}</span>
              </button>
            ))}
          </div>
        </main>

        {/* dock */}
        <footer className="dock">
          <div className="dock-inner">
            {APPS.map((app) => (
              <button key={app.key} className="dock-item" style={{ ["--tone" as any]: app.tone }} title={app.name} onClick={() => openApp(app)}>
                <span className="dock-glyph">{app.glyph}</span>
                <span className="dock-tip">{app.name}</span>
              </button>
            ))}
          </div>
        </footer>
      </div>

      {/* ── LAUNCH GLITCH OVERLAY ── */}
      {launching && (
        <div className="launch" style={{ ["--tone" as any]: launching.tone }}>
          <div className="launch-scan" />
          <div className="launch-core">
            <span className="launch-glyph">{launching.glyph}</span>
            <span className="launch-name" data-text={launching.name}>{launching.name}</span>
            <span className="launch-status">opening…</span>
            <span className="launch-bar"><i /></span>
          </div>
          <div className="launch-bands" aria-hidden><i /><i /><i /><i /><i /></div>
        </div>
      )}
    </div>
  );
}

const css = `
.os{--bg:#040509;--ink:#f4f7ff;--muted:#8b94a8;--line:rgba(255,255,255,.08);
  position:relative;min-height:100vh;background:#040509;color:var(--ink);overflow:hidden;
  font-family:'SF Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;-webkit-font-smoothing:antialiased;}
.os button{font-family:inherit;border:0;background:none;color:inherit;cursor:pointer;}
.os a{color:inherit;text-decoration:none;}

/* ── shared FX ── */
.scan{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(to bottom,rgba(255,255,255,.035) 0 1px,transparent 1px 3px);mix-blend-mode:overlay;opacity:.5;animation:scanmove 8s linear infinite;}
@keyframes scanmove{to{background-position:0 240px}}

/* ── BOOT ── */
.boot{position:fixed;inset:0;z-index:50;background:#020306;display:flex;align-items:center;justify-content:center;overflow:hidden;animation:bootout .5s ease 3.2s forwards;}
.boot-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(47,128,255,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(47,128,255,.07) 1px,transparent 1px);background-size:42px 42px;-webkit-mask-image:radial-gradient(circle at 50% 50%,#000,transparent 78%);mask-image:radial-gradient(circle at 50% 50%,#000,transparent 78%);}
.boot-inner{position:relative;z-index:1;width:min(620px,86vw);text-align:center;}
.boot-logo{font-family:'SF Pro Display',Inter,system-ui,sans-serif;font-weight:900;font-size:clamp(46px,9vw,84px);letter-spacing:.06em;line-height:1;position:relative;color:#fff;text-shadow:0 0 30px rgba(47,128,255,.6);}
.boot-logo::before,.boot-logo::after{content:attr(data-text);position:absolute;inset:0;}
.boot-logo::before{color:#2F80FF;animation:gl-r 2.6s steps(1) infinite;}
.boot-logo::after{color:#FF5BBD;animation:gl-b 2.6s steps(1) infinite;}
.boot-os{margin-top:6px;font-size:12px;letter-spacing:.5em;color:#2F80FF;text-transform:uppercase;}
.boot-log{display:inline-block;text-align:left;margin:26px 0 0;font-size:12.5px;line-height:1.7;color:#7fd3c4;white-space:pre-wrap;min-height:150px;}
.boot-line{animation:typein .3s ease;}
.boot-cursor{color:#2F80FF;animation:blink 1s steps(1) infinite;}
.boot-bar{margin-top:14px;height:3px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden;}
.boot-bar span{display:block;height:100%;background:linear-gradient(90deg,#2F80FF,#9945FF);transition:width .35s ease;box-shadow:0 0 14px #2F80FF;}
@keyframes typein{from{opacity:0;transform:translateX(-6px)}}
@keyframes blink{50%{opacity:0}}
@keyframes bootout{to{opacity:0;visibility:hidden;filter:blur(8px)}}

/* ── DESKTOP ── */
.desk{position:relative;z-index:1;min-height:100vh;display:flex;flex-direction:column;opacity:0;transform:scale(1.04);filter:blur(12px);}
.desk.on{animation:deskin 1s cubic-bezier(.2,.7,.2,1) .1s forwards;}
@keyframes deskin{60%{filter:blur(0)}to{opacity:1;transform:none;filter:blur(0)}}

.wp{position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(120% 90% at 50% -10%,#0a1326,#040509 60%);}
.wp-photo{position:absolute;inset:0;background:url(/bg/bg-nebula.jpg) center/cover no-repeat;opacity:.5;filter:blur(2px) saturate(1.15);transform:scale(1.08) translate(var(--mx,0),var(--my,0));transition:transform .6s ease-out;}
.wp-photo::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(4,5,10,.5),rgba(4,5,10,.8));}
.wp-mesh{position:absolute;border-radius:50%;filter:blur(110px);opacity:.5;mix-blend-mode:screen;transform:translate(var(--mx,0),var(--my,0));transition:transform .6s ease-out;}
.w1{width:48vw;height:48vw;top:-14vw;left:-8vw;background:radial-gradient(circle,#2F80FF,transparent 68%);animation:drift 20s ease-in-out infinite;}
.w2{width:50vw;height:50vw;top:-6vw;right:-14vw;background:radial-gradient(circle,#9945FF,transparent 68%);animation:drift 26s ease-in-out infinite reverse;}
.w3{width:42vw;height:42vw;bottom:-18vw;left:36%;background:radial-gradient(circle,#14E0C8,transparent 70%);opacity:.3;animation:drift 30s ease-in-out infinite;}
@keyframes drift{50%{transform:translate(6vw,4vw) scale(1.12)}}
.wp-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);background-size:54px 54px;-webkit-mask-image:radial-gradient(circle at 50% 40%,#000,transparent 80%);mask-image:radial-gradient(circle at 50% 40%,#000,transparent 80%);}
.wp-vignette{position:absolute;inset:0;background:radial-gradient(circle at 50% 35%,transparent 38%,rgba(0,0,0,.6) 100%);}
.wp-noise{position:absolute;inset:0;opacity:.04;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}

/* ── MENU BAR ── */
.menubar{position:relative;z-index:3;display:flex;align-items:center;justify-content:space-between;height:38px;padding:0 16px;
  background:rgba(8,11,20,.6);backdrop-filter:blur(22px);border-bottom:1px solid var(--line);font-size:12.5px;}
.mb-left{display:flex;align-items:center;gap:14px;}
.mb-mark{width:15px;height:15px;border-radius:5px;background:conic-gradient(from 130deg,#2F80FF,#9945FF,#14E0C8,#2F80FF);box-shadow:0 0 14px rgba(47,128,255,.6);animation:spin 9s linear infinite;}
@keyframes spin{to{transform:rotate(360deg)}}
.mb-os{font-weight:800;letter-spacing:.16em;}
.mb-menu{display:flex;gap:16px;color:var(--muted);}
.mb-menu span{transition:color .2s;cursor:default;}
.mb-menu span:hover{color:#fff;}
.mb-right{display:flex;align-items:center;gap:16px;color:var(--muted);}
.mb-stat{display:inline-flex;align-items:center;gap:7px;letter-spacing:.14em;font-size:11px;}
.led{width:7px;height:7px;border-radius:50%;background:#14E0C8;box-shadow:0 0 10px #14E0C8;animation:pulse 2s ease-in-out infinite;}
@keyframes pulse{50%{opacity:.4;transform:scale(.8)}}
.mb-sig{display:inline-flex;align-items:flex-end;gap:2px;height:13px;}
.mb-sig i{width:3px;background:#2F80FF;border-radius:1px;opacity:.85;}
.mb-sig i:nth-child(1){height:4px}.mb-sig i:nth-child(2){height:7px}.mb-sig i:nth-child(3){height:10px}.mb-sig i:nth-child(4){height:13px}
.mb-clock{display:inline-flex;flex-direction:column;align-items:flex-end;line-height:1.1;font-size:10px;color:var(--muted);}
.mb-clock b{font-size:12.5px;color:#fff;letter-spacing:.04em;}
.mb-acct{display:inline-flex;align-items:center;gap:7px;padding:5px 12px;border-radius:980px;border:1px solid var(--line);background:rgba(255,255,255,.04);font-size:11.5px;color:#fff;transition:all .2s;}
.mb-acct:hover{border-color:#2F80FF;background:rgba(47,128,255,.16);}
.mb-logout{font-family:inherit;cursor:pointer;display:inline-flex;align-items:center;padding:5px 12px;border-radius:980px;border:1px solid var(--line);background:rgba(255,255,255,.04);font-size:11.5px;color:#cfd6e2;transition:all .2s;}
.mb-logout:hover{border-color:#ff5b6b;color:#fff;background:rgba(255,91,107,.16);}
.mb-acct-dot{width:14px;height:14px;border-radius:50%;background:linear-gradient(135deg,#2F80FF,#9945FF);}
@media(max-width:680px){.mb-menu,.mb-sig,.mb-stat{display:none}}

/* ── BODY / LAUNCHER ── */
.desk-body{position:relative;z-index:1;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:clamp(24px,5vh,60px) 20px 130px;}
.welcome{text-align:center;margin-bottom:clamp(30px,5vh,56px);}
.wl-eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:11px;letter-spacing:.34em;color:#cdd5e3;margin:0 0 16px;padding:6px 14px;border-radius:980px;border:1px solid var(--line);background:rgba(255,255,255,.03);}
.wl-eyebrow .dot{width:6px;height:6px;border-radius:50%;background:#14E0C8;box-shadow:0 0 10px #14E0C8;animation:pulse 2s infinite;}
.wl-title{font-family:'SF Pro Display',Inter,system-ui,sans-serif;margin:0;font-weight:900;letter-spacing:-.02em;font-size:clamp(32px,6vw,68px);line-height:1;position:relative;color:#fff;}
.wl-title::before,.wl-title::after{content:attr(data-text);position:absolute;inset:0;opacity:0;}
.wl-title:hover::before,.desk.on .wl-title::before{opacity:.0;}
.wl-sub{margin:18px auto 0;max-width:46ch;color:var(--muted);font-size:clamp(13px,1.6vw,15px);line-height:1.6;}

.launcher{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(16px,2.4vw,30px);width:min(880px,100%);}
@media(max-width:720px){.launcher{grid-template-columns:repeat(2,1fr)}}
@media(max-width:440px){.launcher{grid-template-columns:repeat(2,1fr);gap:14px}}

.app{display:flex;flex-direction:column;align-items:center;gap:12px;padding:18px 10px;border-radius:24px;position:relative;
  opacity:0;transform:translateY(24px) scale(.9);animation:appin .7s cubic-bezier(.2,.7,.2,1) var(--d,0ms) forwards;transition:transform .25s;}
.app:hover{transform:translateY(-6px);}
.app:disabled{cursor:default;}
@keyframes appin{to{opacity:1;transform:none}}

.app-icon{position:relative;width:clamp(78px,12vw,104px);height:clamp(78px,12vw,104px);border-radius:26px;display:grid;place-items:center;overflow:hidden;
  background:linear-gradient(160deg,rgba(255,255,255,.1),rgba(255,255,255,.02));border:1px solid var(--line);
  box-shadow:0 22px 50px -26px rgba(0,0,0,1),inset 0 1px 0 rgba(255,255,255,.12);transition:all .3s;isolation:isolate;}
.app:hover .app-icon{border-color:var(--tone);box-shadow:0 30px 60px -22px var(--tone),inset 0 1px 0 rgba(255,255,255,.2);transform:scale(1.05);}
.app-icon-bg{position:absolute;inset:0;opacity:.9;background:
  radial-gradient(120% 120% at 30% 10%,color-mix(in srgb,var(--tone) 42%,transparent),transparent 60%),
  linear-gradient(160deg,color-mix(in srgb,var(--tone) 28%,#0a0e18),#070a12);}
.app-icon-glyph{position:absolute;inset:0;display:grid;place-items:center;}
.app-icon-glyph svg{width:46%;height:46%;}
.g-main{color:#fff;z-index:2;filter:drop-shadow(0 4px 10px rgba(0,0,0,.5));}
.g-r,.g-b{opacity:0;display:none;}
.g-r{opacity:0;display:none;}
.app:hover .g-r{opacity:0;display:none;}
.app:hover .g-b{opacity:0;display:none;}
@keyframes rgbR{0%,100%{transform:translate(2px,-1px)}50%{transform:translate(-2px,1px)}}
@keyframes rgbB{0%,100%{transform:translate(-2px,1px)}50%{transform:translate(2px,-1px)}}
.app-icon-gloss{position:absolute;top:0;left:0;right:0;height:42%;background:linear-gradient(180deg,rgba(255,255,255,.22),transparent);z-index:3;pointer-events:none;}
.app-name{font-family:'SF Pro Display',Inter,system-ui,sans-serif;font-weight:700;font-size:clamp(13px,1.5vw,15px);color:#fff;position:relative;}
.app-cap{font-size:10.5px;color:var(--muted);letter-spacing:.04em;white-space:nowrap;}
.app.opening .app-icon{animation:openpop .8s ease forwards;border-color:var(--tone);}
@keyframes openpop{30%{transform:scale(1.12)}100%{transform:scale(.6);opacity:0;filter:blur(6px)}}

/* ── DOCK ── */
.dock{position:fixed;left:0;right:0;bottom:16px;z-index:4;display:flex;justify-content:center;pointer-events:none;}
.dock-inner{pointer-events:auto;display:flex;gap:8px;padding:9px 12px;border-radius:22px;background:rgba(10,13,22,.6);backdrop-filter:blur(24px);border:1px solid var(--line);box-shadow:0 24px 60px -30px #000;}
.dock-item{position:relative;width:46px;height:46px;border-radius:14px;display:grid;place-items:center;color:#cfd6e2;
  background:linear-gradient(160deg,rgba(255,255,255,.08),rgba(255,255,255,.02));border:1px solid var(--line);transition:all .2s;}
.dock-item:hover{transform:translateY(-8px) scale(1.12);color:#fff;border-color:var(--tone);box-shadow:0 14px 30px -12px var(--tone);}
.dock-glyph svg{width:24px;height:24px;}
.dock-tip{position:absolute;bottom:120%;left:50%;transform:translateX(-50%) translateY(6px);opacity:0;white-space:nowrap;font-size:11px;padding:5px 9px;border-radius:8px;background:#0c1018;border:1px solid var(--line);color:#fff;transition:all .2s;pointer-events:none;}
.dock-item:hover .dock-tip{opacity:1;transform:translateX(-50%) translateY(0);}
@media(max-width:560px){.dock{display:none}}

/* ── LAUNCH OVERLAY ── */
.launch{position:fixed;inset:0;z-index:60;display:grid;place-items:center;background:rgba(2,4,8,.86);backdrop-filter:blur(6px);animation:lin .25s ease;}
@keyframes lin{from{opacity:0}}
.launch-scan{position:absolute;inset:0;background:repeating-linear-gradient(to bottom,rgba(255,255,255,.05) 0 1px,transparent 1px 4px);opacity:.6;animation:scanmove 4s linear infinite;}
.launch-core{position:relative;display:flex;flex-direction:column;align-items:center;gap:12px;}
.launch-glyph{width:84px;height:84px;border-radius:22px;display:grid;place-items:center;color:#fff;background:linear-gradient(160deg,color-mix(in srgb,var(--tone) 40%,#0a0e18),#070a12);border:1px solid var(--tone);box-shadow:0 0 50px -8px var(--tone);animation:lpop .8s ease infinite alternate;}
.launch-glyph svg{width:42px;height:42px;}
@keyframes lpop{to{transform:scale(1.08)}}
.launch-name{font-family:'SF Pro Display',Inter,system-ui,sans-serif;font-weight:800;font-size:22px;color:#fff;position:relative;}
.launch-name::before,.launch-name::after{content:attr(data-text);position:absolute;inset:0;}
.launch-name::before{color:#2fe0ff;animation:gl-r 1.2s steps(1) infinite;}
.launch-name::after{color:#ff3b5c;animation:gl-b 1.2s steps(1) infinite;}
.launch-status{font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:var(--tone);}
.launch-bar{width:160px;height:3px;border-radius:3px;background:rgba(255,255,255,.1);overflow:hidden;}
.launch-bar i{display:block;height:100%;width:40%;background:var(--tone);box-shadow:0 0 12px var(--tone);animation:lbar .82s ease forwards;}
@keyframes lbar{to{width:100%}}
.launch-bands{position:absolute;inset:0;pointer-events:none;mix-blend-mode:screen;}
.launch-bands i{position:absolute;left:0;right:0;height:2px;background:var(--tone);opacity:.0;}
.launch-bands i:nth-child(1){top:22%;animation:band 1.1s steps(1) infinite}
.launch-bands i:nth-child(2){top:44%;animation:band 1.4s steps(1) infinite .2s}
.launch-bands i:nth-child(3){top:61%;animation:band .9s steps(1) infinite .1s}
.launch-bands i:nth-child(4){top:73%;animation:band 1.6s steps(1) infinite .3s}
.launch-bands i:nth-child(5){top:88%;animation:band 1.2s steps(1) infinite .15s}
@keyframes band{0%,92%{opacity:0}94%{opacity:.5;transform:translateX(8px)}96%{opacity:.2;transform:translateX(-8px)}}

/* ── glitch keyframes ── */
@keyframes glitch{0%,90%,100%{transform:none}92%{transform:translate(-2px,1px)}94%{transform:translate(2px,-1px)}96%{transform:translate(-1px,0)}}
@keyframes gl-r{0%,90%,100%{opacity:0;transform:none}92%{opacity:.8;transform:translate(-3px,1px)}96%{opacity:.6;transform:translate(2px,-1px)}}
@keyframes gl-b{0%,90%,100%{opacity:0;transform:none}93%{opacity:.8;transform:translate(3px,-1px)}97%{opacity:.6;transform:translate(-2px,1px)}}

@media(prefers-reduced-motion:reduce){
  .boot{animation-delay:0s}.wp-mesh,.scan,.mb-mark,.led,.app,.boot-logo,.launch-name{animation:none!important}
  .desk{opacity:1;transform:none;filter:none}.desk.on{animation:none}.app{opacity:1;transform:none}
}
`;
