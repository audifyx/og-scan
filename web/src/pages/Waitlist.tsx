import { useEffect, useRef, useState } from "react";

// ── PLACEHOLDER BRAND NAME ── replace when rebrand is finalized
const BRAND = "NOVA";

/**
 * Waitlist — standalone, ultra-clean white page with a premium 3D email capture.
 * Route: /waitlist  (separate from the main landing)
 */
export default function Waitlist() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const cardRef = useRef<HTMLDivElement>(null);

  // 3D tilt that follows the pointer for a high-quality, tactile feel
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--rx", `${(-py * 6).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${(px * 8).toFixed(2)}deg`);
      el.style.setProperty("--mx", `${(px * 18).toFixed(1)}px`);
      el.style.setProperty("--my", `${(py * 18).toFixed(1)}px`);
    };
    const reset = () => {
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
      el.style.setProperty("--mx", "0px");
      el.style.setProperty("--my", "0px");
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", reset);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", reset);
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    // TODO: wire to Supabase `waitlist` table insert. Simulated success for now.
    await new Promise((r) => setTimeout(r, 900));
    setStatus("done");
  };

  return (
    <div className="wl">
      <style>{css}</style>

      <header className="wl-nav">
        <a className="wl-brand" href="/">
          <span className="wl-mark" /> {BRAND}
        </a>
        <a className="wl-back" href="/">Back to home</a>
      </header>

      <main className="wl-main">
        <div className="wl-glow" aria-hidden />
        <p className="wl-eyebrow">Coming soon</p>
        <h1 className="wl-title">
          Be first when <span>{BRAND}</span> launches.
        </h1>
        <p className="wl-sub">
          One platform to trade everything. Join the waitlist and we&apos;ll notify
          you the moment we go live.
        </p>

        <div className="wl-card-wrap">
          <div className="wl-card" ref={cardRef}>
            <div className="wl-card-sheen" aria-hidden />
            {status === "done" ? (
              <div className="wl-done">
                <div className="wl-check">
                  <svg viewBox="0 0 24 24" width="34" height="34" fill="none">
                    <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.5"
                      strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h3>You&apos;re on the list</h3>
                <p>We&apos;ll email <strong>{email}</strong> when launch is ready.</p>
              </div>
            ) : (
              <form className="wl-form" onSubmit={submit}>
                <label className="wl-label" htmlFor="wl-email">Get launch notification</label>
                <div className={`wl-field ${status === "error" ? "err" : ""}`}>
                  <span className="wl-field-ic" aria-hidden>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                      <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.6" />
                      <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </span>
                  <input
                    id="wl-email"
                    type="email"
                    inputMode="email"
                    placeholder="you@email.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (status === "error") setStatus("idle"); }}
                    autoComplete="email"
                  />
                  <button type="submit" disabled={status === "loading"}>
                    {status === "loading" ? <span className="wl-spin" /> : "Notify me"}
                  </button>
                </div>
                {status === "error" && <p className="wl-msg">Please enter a valid email address.</p>}
                <p className="wl-fine">No spam. Just a single launch announcement.</p>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

const css = `
.wl{--ink:#0a0a0b;--muted:#6b7280;--line:#ececef;--accent:#5b5bf0;--accent2:#9b6bff;
  min-height:100vh;background:#fff;color:var(--ink);
  font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Inter,Roboto,sans-serif;
  -webkit-font-smoothing:antialiased;display:flex;flex-direction:column;overflow-x:hidden;}
.wl-nav{display:flex;align-items:center;justify-content:space-between;padding:22px clamp(18px,5vw,52px);}
.wl-brand{display:flex;align-items:center;gap:10px;font-weight:650;letter-spacing:.14em;
  font-size:14px;text-decoration:none;color:var(--ink);}
.wl-mark{width:16px;height:16px;border-radius:5px;
  background:conic-gradient(from 140deg,var(--accent),var(--accent2),var(--accent));
  box-shadow:0 4px 14px rgba(91,91,240,.35);}
.wl-back{font-size:13.5px;color:var(--muted);text-decoration:none;transition:color .2s;}
.wl-back:hover{color:var(--ink);}
.wl-main{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
  text-align:center;padding:min(8vh,90px) 20px 12vh;position:relative;}
.wl-glow{position:absolute;top:-10%;left:50%;transform:translateX(-50%);width:680px;height:680px;
  background:radial-gradient(circle at 50% 40%,rgba(155,107,255,.16),rgba(91,91,240,.08) 38%,transparent 66%);
  filter:blur(8px);pointer-events:none;}
.wl-eyebrow{margin:0 0 16px;font-size:12.5px;letter-spacing:.22em;text-transform:uppercase;
  color:var(--accent);font-weight:600;}
.wl-title{margin:0;font-size:clamp(34px,6.2vw,60px);line-height:1.04;letter-spacing:-.03em;
  font-weight:680;max-width:14ch;}
.wl-title span{background:linear-gradient(120deg,var(--accent),var(--accent2));
  -webkit-background-clip:text;background-clip:text;color:transparent;}
.wl-sub{margin:20px 0 0;color:var(--muted);font-size:clamp(15px,1.6vw,18px);max-width:46ch;line-height:1.55;}
.wl-card-wrap{margin-top:46px;perspective:1200px;}
.wl-card{position:relative;width:min(520px,92vw);padding:30px;border-radius:24px;background:#fff;
  border:1px solid var(--line);text-align:left;
  transform:rotateX(var(--rx,0)) rotateY(var(--ry,0));transform-style:preserve-3d;
  transition:transform .25s cubic-bezier(.2,.7,.2,1),box-shadow .3s;
  box-shadow:0 1px 0 rgba(255,255,255,.9) inset,0 18px 40px -18px rgba(17,17,40,.28),
    0 60px 90px -50px rgba(91,91,240,.35);}
.wl-card-sheen{position:absolute;inset:0;border-radius:24px;pointer-events:none;
  background:linear-gradient(135deg,rgba(255,255,255,.55),transparent 38%);
  transform:translate(var(--mx,0),var(--my,0));transition:transform .25s;mix-blend-mode:overlay;}
.wl-label{display:block;font-size:13px;font-weight:600;color:#3a3a40;margin-bottom:12px;
  transform:translateZ(40px);}
.wl-field{display:flex;align-items:center;gap:10px;background:#f6f6f8;border:1.5px solid #e9e9ee;
  border-radius:16px;padding:8px 8px 8px 14px;transform:translateZ(30px);
  box-shadow:inset 0 2px 6px rgba(17,17,40,.06),inset 0 -1px 0 rgba(255,255,255,.7);
  transition:border-color .2s,box-shadow .2s,background .2s;}
.wl-field:focus-within{background:#fff;border-color:var(--accent);
  box-shadow:0 0 0 4px rgba(91,91,240,.14),inset 0 1px 3px rgba(17,17,40,.05);}
.wl-field.err{border-color:#ef4444;box-shadow:0 0 0 4px rgba(239,68,68,.12);}
.wl-field-ic{color:#9aa0aa;display:flex;}
.wl-field input{flex:1;border:0;outline:0;background:transparent;font-size:16px;color:var(--ink);padding:10px 0;}
.wl-field input::placeholder{color:#aeb2bb;}
.wl-field button{border:0;cursor:pointer;font-size:14.5px;font-weight:600;color:#fff;
  padding:0 20px;height:44px;border-radius:12px;white-space:nowrap;
  background:linear-gradient(120deg,var(--accent),var(--accent2));
  box-shadow:0 8px 18px -8px rgba(91,91,240,.8);transition:transform .15s,filter .2s,opacity .2s;}
.wl-field button:hover{filter:brightness(1.06);transform:translateY(-1px);}
.wl-field button:active{transform:translateY(1px) scale(.99);}
.wl-field button:disabled{opacity:.7;cursor:default;}
.wl-msg{color:#ef4444;font-size:13px;margin:10px 2px 0;transform:translateZ(20px);}
.wl-fine{color:#9aa0aa;font-size:12.5px;margin:14px 2px 0;transform:translateZ(20px);}
.wl-spin{display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,.4);
  border-top-color:#fff;border-radius:50%;animation:wlspin .7s linear infinite;}
@keyframes wlspin{to{transform:rotate(360deg)}}
.wl-done{text-align:center;padding:8px 4px;animation:wlpop .5s cubic-bezier(.2,.8,.2,1);}
.wl-check{width:64px;height:64px;margin:0 auto 16px;border-radius:50%;display:grid;place-items:center;color:#fff;
  background:linear-gradient(120deg,#22c55e,#16a34a);box-shadow:0 14px 30px -12px rgba(34,197,94,.7);}
.wl-done h3{margin:0 0 8px;font-size:22px;letter-spacing:-.02em;}
.wl-done p{margin:0;color:var(--muted);font-size:15px;}
@keyframes wlpop{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
@media (max-width:520px){.wl-field{flex-wrap:wrap}.wl-field button{width:100%}}
`;
