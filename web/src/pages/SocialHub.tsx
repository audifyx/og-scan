import { useEffect } from "react";
import {
  Hash, Mic, Headphones, Mail, User, Radio, Sparkles, ArrowRight,
} from "lucide-react";

const BRAND = "OGSCAN";

type Card = { tag: string; title: string; copy: string; href: string; Icon: typeof Hash; tone: string };
const CARDS: Card[] = [
  { tag: "Community", title: "Community", copy: "Channels, rooms and live chat with the whole community.", href: "/community", Icon: Hash, tone: "c1" },
  { tag: "Spaces", title: "Spaces", copy: "Host and join live audio Spaces with token context built in.", href: "/spaces", Icon: Mic, tone: "c2" },
  { tag: "Voice", title: "Voice Lobbies", copy: "Drop into real-time voice lobbies with friends and holders.", href: "/voice-rooms", Icon: Headphones, tone: "c3" },
  { tag: "Messages", title: "Messages", copy: "Direct messages and group chats across the platform.", href: "/messages", Icon: Mail, tone: "c4" },
  { tag: "Profile", title: "Your Profile", copy: "Your identity, activity, watchlists and on-chain reputation.", href: "/profile", Icon: User, tone: "c5" },
  { tag: "Feed", title: "Live Feed", copy: "Callouts, updates and what the community is talking about.", href: "/live-feed-page", Icon: Radio, tone: "c6" },
];

export default function SocialHub() {
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("in")), { threshold: 0.15 });
    document.querySelectorAll<HTMLElement>(".sh-reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="sh">
      <style>{css}</style>
      <div className="sh-bg" aria-hidden><span className="o o1" /><span className="o o2" /><span className="sh-grid" /></div>

      <header className="sh-nav">
        <a className="sh-brand" href="/app"><span className="sh-mark" />{BRAND}</a>
        <nav className="sh-nav-links"><a href="/app">Hub</a><a href="/OGDEX">OG Dex</a><a href="/social" className="active">Social</a></nav>
        <a className="sh-nav-cta" href="/profile">Profile</a>
      </header>

      <main className="sh-main">
        <div className="sh-hero sh-reveal">
          <p className="sh-eyebrow"><Sparkles className="h-3.5 w-3.5" /> Social</p>
          <h1 className="sh-h1">The people layer.</h1>
          <p className="sh-sub">Spaces, voice, community and messages — everything social, in one clean place.</p>
        </div>

        <div className="sh-grid-cards">
          {CARDS.map((c, i) => (
            <a key={c.href} href={c.href} className={`sh-card ${c.tone} sh-reveal`} style={{ transitionDelay: `${i * 70}ms` }}>
              <span className="sh-card-glow" aria-hidden />
              <span className="sh-card-ic"><c.Icon className="h-6 w-6" /></span>
              <span className="sh-card-tag">{c.tag}</span>
              <h3>{c.title}</h3>
              <p>{c.copy}</p>
              <span className="sh-card-cta">Open <ArrowRight className="h-4 w-4" /></span>
            </a>
          ))}
        </div>
      </main>

      <footer className="sh-foot">
        <span><span className="sh-mark" />{BRAND}</span>
        <span className="sh-foot-links"><a href="/app">Hub</a><a href="/OGDEX">OG Dex</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></span>
      </footer>
    </div>
  );
}

const css = `
.sh{--bg:#050608;--ink:#fff;--muted:#a7adba;--line:rgba(255,255,255,.10);--blue:#2F80FF;--purple:#9945FF;--gold:#FFC53D;--green:#14F195;
  position:relative;min-height:100vh;background:var(--bg);color:var(--ink);overflow-x:hidden;display:flex;flex-direction:column;
  font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Inter,'Plus Jakarta Sans',sans-serif;-webkit-font-smoothing:antialiased;}
.sh a{text-decoration:none;color:inherit;}
.sh-bg{position:fixed;inset:0;z-index:0;pointer-events:none;}
.sh-bg .o{position:absolute;border-radius:50%;filter:blur(90px);opacity:.45;}
.o1{width:560px;height:560px;top:-160px;left:-120px;background:radial-gradient(circle,#9945FF,transparent 70%);}
.o2{width:600px;height:600px;bottom:-200px;right:-140px;background:radial-gradient(circle,#2F80FF,transparent 70%);}
.sh-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:58px 58px;-webkit-mask-image:radial-gradient(circle at 50% 30%,#000,transparent 72%);mask-image:radial-gradient(circle at 50% 30%,#000,transparent 72%);}
.sh-nav{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:18px clamp(18px,5vw,52px);}
.sh-brand{display:flex;align-items:center;gap:9px;font-weight:800;letter-spacing:.16em;font-size:15px;}
.sh-mark{width:16px;height:16px;border-radius:5px;background:conic-gradient(from 140deg,var(--purple),var(--blue),var(--purple));box-shadow:0 4px 16px rgba(153,69,255,.5);}
.sh-nav-links{display:flex;gap:26px;font-size:14px;color:var(--muted);}
.sh-nav-links a:hover,.sh-nav-links a.active{color:#fff;}
.sh-nav-cta{font-size:13.5px;font-weight:700;padding:9px 18px;border-radius:980px;border:1px solid var(--line);background:rgba(255,255,255,.04);transition:all .2s;}
.sh-nav-cta:hover{border-color:var(--purple);background:rgba(153,69,255,.12);}
@media(max-width:720px){.sh-nav-links{display:none}}
.sh-main{position:relative;z-index:1;flex:1;max-width:1140px;width:100%;margin:0 auto;padding:clamp(24px,5vh,56px) clamp(18px,5vw,40px) 40px;}
.sh-hero{text-align:center;margin-bottom:clamp(30px,5vh,52px);}
.sh-eyebrow{display:inline-flex;align-items:center;gap:6px;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--purple);font-weight:700;margin:0 0 14px;}
.sh-h1{margin:0;font-size:clamp(38px,6.5vw,76px);line-height:1;letter-spacing:-.035em;font-weight:800;background:linear-gradient(120deg,#fff,#b9a7ff);-webkit-background-clip:text;background-clip:text;color:transparent;}
.sh-sub{margin:20px auto 0;max-width:48ch;font-size:clamp(15px,1.6vw,18px);line-height:1.6;color:var(--muted);}
.sh-grid-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;}
@media(max-width:880px){.sh-grid-cards{grid-template-columns:1fr 1fr}}
@media(max-width:560px){.sh-grid-cards{grid-template-columns:1fr}}
.sh-card{position:relative;display:flex;flex-direction:column;border-radius:24px;border:1px solid var(--line);padding:24px;overflow:hidden;background:linear-gradient(160deg,rgba(255,255,255,.05),rgba(255,255,255,.015));transition:transform .25s,border-color .3s,box-shadow .3s;}
.sh-card:hover{transform:translateY(-4px);border-color:var(--cc,#9945FF);box-shadow:0 30px 70px -36px var(--cg,rgba(153,69,255,.6));}
.sh-card-glow{position:absolute;top:-40px;right:-40px;width:140px;height:140px;border-radius:50%;filter:blur(46px);opacity:.5;background:var(--cc,#9945FF);}
.c1{--cc:#9945FF;--cg:rgba(153,69,255,.5);}.c2{--cc:#2F80FF;--cg:rgba(47,128,255,.5);}.c3{--cc:#14F195;--cg:rgba(20,241,149,.4);}.c4{--cc:#FFC53D;--cg:rgba(255,197,61,.4);}.c5{--cc:#ff6bd0;--cg:rgba(255,107,208,.4);}.c6{--cc:#14a0ff;--cg:rgba(20,160,255,.4);}
.sh-card-ic{position:relative;display:grid;place-items:center;width:48px;height:48px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.05);color:var(--cc,#9945FF);margin-bottom:16px;}
.sh-card-tag{position:relative;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--cc,#9945FF);}
.sh-card h3{position:relative;margin:8px 0 8px;font-size:22px;font-weight:800;letter-spacing:-.01em;}
.sh-card p{position:relative;margin:0;font-size:13.5px;line-height:1.55;color:var(--muted);}
.sh-card-cta{position:relative;display:inline-flex;align-items:center;gap:6px;margin-top:18px;font-size:13.5px;font-weight:700;color:var(--cc,#9945FF);}
.sh-foot{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;padding:24px clamp(18px,5vw,52px);border-top:1px solid var(--line);font-size:13px;color:#7e879a;}
.sh-foot span:first-child{display:flex;align-items:center;gap:9px;font-weight:800;letter-spacing:.16em;color:#fff;}
.sh-foot-links{display:flex;gap:18px;}.sh-foot-links a:hover{color:#fff;}
.sh-reveal{opacity:0;transform:translateY(30px);transition:opacity .8s cubic-bezier(.2,.7,.2,1),transform .8s cubic-bezier(.2,.7,.2,1);}
.sh-reveal.in{opacity:1;transform:none;}
`;
