import { useState, useEffect } from "react";
import { XrayReport, short } from "../lib/api";
import WalletLink from "./WalletLink";
import BubbleMap from "./BubbleMap";
import {
  ShieldCheck, ShieldAlert, ShieldX, Crosshair, Boxes, Users, Wallet,
  ExternalLink, CheckCircle2, XCircle, AlertTriangle, Target, Network,
  Share2, Code2, Lock, Unlock, Flame, Eye, TrendingDown, Clock,
  Activity, BarChart3, Zap, Database,
} from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────
function Solscan({ kind, id, label }: { kind: "account"|"tx"|"token"; id: string; label?: string }) {
  return (
    <a href={`https://solscan.io/${kind}/${id}`} target="_blank" rel="noreferrer"
       className="inline-flex items-center gap-1 text-[11px] transition-colors"
       style={{ color: "rgba(34,211,238,0.75)" }}
       onMouseEnter={e => (e.currentTarget.style.color="#22d3ee")}
       onMouseLeave={e => (e.currentTarget.style.color="rgba(34,211,238,0.75)")}>
      {label || "Solscan"} <ExternalLink className="w-3 h-3" />
    </a>
  );
}

function useCountUp(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(target * e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return val;
}

function AnimNum({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const v = useCountUp(value);
  return <>{v.toFixed(decimals)}{suffix}</>;
}

// ── Risk Gauge ─────────────────────────────────────────────────────────
function RiskGauge({ score, tone }: { score: number; tone: "red"|"yellow"|"green" }) {
  const animated = useCountUp(score, 1500);
  const colors = { red: "#ef4444", yellow: "#f59e0b", green: "#22c55e" };
  const color = colors[tone];
  const R = 70, CX = 88, CY = 88;
  const circ = 2 * Math.PI * R;
  const filled = (animated / 100) * circ;

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: 176, height: 176 }}>
      <svg width={176} height={176} className="absolute inset-0">
        {/* Grid ticks */}
        {Array.from({ length: 24 }).map((_, i) => {
          const a = (i / 24) * 360 - 90;
          const rad = (a * Math.PI) / 180;
          const x1 = CX + (R - 14) * Math.cos(rad), y1 = CY + (R - 14) * Math.sin(rad);
          const x2 = CX + (R - 6)  * Math.cos(rad), y2 = CY + (R - 6)  * Math.sin(rad);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.1)" strokeWidth={1.5} />;
        })}
        {/* BG track */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={9} />
        {/* Filled arc */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={color} strokeWidth={9} strokeLinecap="round"
          strokeDasharray={`${filled} ${circ - filled}`}
          style={{ transform: `rotate(-90deg)`, transformOrigin: `${CX}px ${CY}px`, filter: `drop-shadow(0 0 10px ${color})` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <div className="text-4xl font-black tabular-nums" style={{ color, textShadow: `0 0 24px ${color}80` }}>
          <AnimNum value={score} />
        </div>
        <div className="text-[9px] font-black tracking-[0.2em] uppercase" style={{ color, opacity: 0.75 }}>
          {score >= 70 ? "HIGH RISK" : score >= 40 ? "MODERATE" : "LOW RISK"}
        </div>
      </div>
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────
function StatCard({ icon, label, value, tone, sub }: { icon: React.ReactNode; label: string; value: string|number; tone?: "red"|"yellow"|"green"|"cyan"; sub?: string }) {
  const c = tone === "red" ? "#ef4444" : tone === "yellow" ? "#f59e0b" : tone === "green" ? "#22c55e" : "#22d3ee";
  return (
    <div className="rounded-xl p-3.5 relative overflow-hidden"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="absolute top-0 right-0 w-14 h-14 rounded-full opacity-15 blur-xl" style={{ background: c }} />
      <div className="text-[10px] text-white/35 flex items-center gap-1.5 mb-2">{icon}{label}</div>
      <div className="text-xl font-black tabular-nums" style={{ color: c, textShadow: `0 0 18px ${c}55` }}>
        {typeof value === "number" ? <AnimNum value={value} /> : value}
      </div>
      {sub && <div className="text-[9px] text-white/25 mt-0.5">{sub}</div>}
    </div>
  );
}

function pctTone(p: number | null, warn = 30, bad = 60): "red"|"yellow"|"green" {
  if (p == null) return "cyan";
  return p >= bad ? "red" : p >= warn ? "yellow" : "green";
}

// ── Section Nav ────────────────────────────────────────────────────────
type Section = "overview"|"map"|"snipers"|"bundles"|"insiders"|"devsafety"|"buyers";

function SectionNav({ active, onChange, x }: { active: Section; onChange: (s: Section) => void; x: XrayReport }) {
  const cards = [
    { id: "overview"  as Section, icon: <Activity className="w-5 h-5" />,  label: "Overview",   sub: `Score ${x.score ?? "—"}`,                    color: "#22d3ee" },
    { id: "map"       as Section, icon: <Network   className="w-5 h-5" />,  label: "Graph",      sub: `${x.earlyBuyers?.length ?? 0} nodes`,          color: "#a855f7" },
    { id: "snipers"   as Section, icon: <Crosshair className="w-5 h-5" />,  label: "Snipers",    sub: `${x.snipers.count ?? 0} detected`,             color: "#eab308" },
    { id: "bundles"   as Section, icon: <Boxes     className="w-5 h-5" />,  label: "Bundles",    sub: `${x.bundles.count ?? 0} clusters`,             color: "#f59e0b" },
    { id: "insiders"  as Section, icon: <Share2    className="w-5 h-5" />,  label: "Insiders",   sub: `${x.insiders?.count ?? 0} found`,              color: "#ef4444" },
    { id: "devsafety" as Section, icon: <Lock      className="w-5 h-5" />,  label: "Dev+Safety", sub: x.dev ? short(x.dev.wallet) : "—",              color: "#22c55e" },
    { id: "buyers"    as Section, icon: <Users     className="w-5 h-5" />,  label: "Buyers",     sub: `${x.earlyBuyers?.length ?? 0} wallets`,        color: "#06b6d4" },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
      {cards.map(card => {
        const on = active === card.id;
        return (
          <button key={card.id} onClick={() => onChange(card.id)}
            className="flex-shrink-0 flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl transition-all duration-200 min-w-[90px] relative"
            style={{
              background: on ? `linear-gradient(145deg,${card.color}22,${card.color}0a)` : "rgba(255,255,255,0.03)",
              border: `1px solid ${on ? card.color+"55" : "rgba(255,255,255,0.07)"}`,
              boxShadow: on ? `0 4px 24px ${card.color}22, inset 0 1px 0 ${card.color}20` : "none",
              transform: on ? "translateY(-2px)" : "none",
            }}>
            <div style={{ color: on ? card.color : "rgba(255,255,255,0.35)" }}>{card.icon}</div>
            <div className="text-center">
              <div className="text-[11px] font-bold" style={{ color: on ? card.color : "rgba(255,255,255,0.65)" }}>{card.label}</div>
              <div className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>{card.sub}</div>
            </div>
            {on && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full"
              style={{ background: card.color, boxShadow: `0 0 8px ${card.color}` }} />}
          </button>
        );
      })}
    </div>
  );
}

// ── Overview ───────────────────────────────────────────────────────────
function OverviewSection({ x }: { x: XrayReport }) {
  const mainColor = x.tone === "red" ? "#ef4444" : x.tone === "green" ? "#22c55e" : "#f59e0b";

  return (
    <div className="space-y-4">
      {/* Verdict hero */}
      <div className="rounded-2xl p-6 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg,${mainColor}10 0%,rgba(0,0,0,0) 55%)`, border: `1px solid ${mainColor}28`, boxShadow: `0 0 40px ${mainColor}12` }}>
        {/* Animated scan line */}
        <style>{`@keyframes scanLine{0%{top:-2px}100%{top:102%}}`}</style>
        <div className="absolute inset-x-0 h-px pointer-events-none" style={{ background: `linear-gradient(90deg,transparent,${mainColor}60,transparent)`, animation: "scanLine 3s linear infinite", opacity: 0.4 }} />
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <RiskGauge score={x.score ?? 50} tone={x.tone} />
          <div className="flex-1 min-w-0">
            <div className="text-2xl sm:text-3xl font-extrabold mb-2" style={{ color: mainColor, textShadow: `0 0 28px ${mainColor}55` }}>{x.verdict}</div>
            <div className="text-sm text-white/50 leading-relaxed">{x.summary}</div>
            {x.note && (
              <div className="mt-3 flex items-start gap-2 text-xs text-white/40 rounded-lg p-2.5" style={{ background: "rgba(234,179,8,0.07)", border: "1px solid rgba(234,179,8,0.15)" }}>
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-yellow-400" />{x.note}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Primary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard icon={<Crosshair className="w-3 h-3"/>} label="Snipers %"  value={x.snipers.pct!=null?`${x.snipers.pct}%`:"—"} tone={pctTone(x.snipers.pct)} />
        <StatCard icon={<Boxes     className="w-3 h-3"/>} label="Bundled %"  value={x.bundles.pct!=null?`${x.bundles.pct}%`:"—"} tone={pctTone(x.bundles.pct,1,30)} />
        <StatCard icon={<Share2    className="w-3 h-3"/>} label="Insiders %" value={x.insiders?.pct!=null?`${x.insiders.pct}%`:"—"} tone={pctTone(x.insiders?.pct??null,1,40)} />
        <StatCard icon={<Users     className="w-3 h-3"/>} label="Top-10 hold" value={x.concentration.top10Pct!=null?`${x.concentration.top10Pct}%`:"—"} tone={pctTone(x.concentration.top10Pct,30,50)} />
        <StatCard icon={<Wallet    className="w-3 h-3"/>} label="Holders"    value={x.concentration.totalHolders??0} tone="cyan" />
      </div>

      {/* Count chips */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {[
          { label:"Early Buyers",    val:x.earlyBuyers?.length||0,  color:"#22d3ee" },
          { label:"Snipers",         val:x.snipers?.count||0,       color:"#eab308" },
          { label:"Bundle Clusters", val:x.bundles?.count||0,       color:"#f59e0b" },
          { label:"Insider Clusters",val:x.insiders?.count||0,      color:"#ef4444" },
          { label:"Whales",          val:x.concentration?.whales||0,color:"#a855f7" },
        ].map(item => (
          <div key={item.label} className="rounded-xl p-3 text-center" style={{ background:"rgba(255,255,255,0.02)", border:`1px solid ${item.color}18` }}>
            <div className="text-[10px] text-white/35 mb-1.5">{item.label}</div>
            <div className="text-2xl font-black tabular-nums" style={{ color:item.color, textShadow:`0 0 14px ${item.color}55` }}>
              <AnimNum value={item.val} />
            </div>
          </div>
        ))}
      </div>

      {/* Risk signals */}
      {(x.flags?.length??0) > 0 && (
        <div className="rounded-xl p-5" style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)" }}>
          <div className="text-[11px] font-black tracking-widest text-white/40 flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-cyan-400" /> RISK SIGNALS
          </div>
          <div className="space-y-2">
            {x.flags.map((f,i) => {
              const fc = f.level==="red"?"#ef4444":f.level==="yellow"?"#f59e0b":"#22c55e";
              const FI = f.level==="red"?XCircle:f.level==="yellow"?AlertTriangle:CheckCircle2;
              return (
                <div key={i} className="flex items-start gap-2.5 text-sm rounded-lg p-2.5" style={{ background:`${fc}07` }}>
                  <FI className="w-4 h-4 shrink-0 mt-0.5" style={{ color:fc }} />
                  <span className={f.level==="red"?"text-white/90":"text-white/55"}>{f.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Snipers ────────────────────────────────────────────────────────────
function SnipersSection({ x }: { x: XrayReport }) {
  const wallets = x.snipers?.wallets||[];
  const maxSol = Math.max(...wallets.map(w=>w.solSpent||0),0.001);
  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 flex items-center gap-4" style={{ background:"rgba(234,179,8,0.07)", border:"1px solid rgba(234,179,8,0.18)" }}>
        <Crosshair className="w-8 h-8 text-yellow-400 shrink-0" />
        <div>
          <div className="font-bold text-yellow-300">Sniper Detection</div>
          <div className="text-sm text-white/45">{wallets.length>0?`${wallets.length} wallets bought within 20s of launch`:x.traced?"No snipers detected.":"Trace unavailable."}</div>
        </div>
        {x.snipers.pct!=null && <div className="ml-auto text-3xl font-black text-yellow-300">{x.snipers.pct}%</div>}
      </div>
      <div className="space-y-2">
        {wallets.map((s,i) => {
          const bar = ((s.solSpent||0)/maxSol)*100;
          return (
            <div key={i} className="rounded-xl p-3 relative overflow-hidden group" style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)" }}>
              <div className="absolute inset-y-0 left-0 rounded-xl opacity-10 transition-all" style={{ width:`${bar}%`, background:"linear-gradient(90deg,#f59e0b,transparent)" }} />
              <div className="relative flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] text-white/25 font-mono w-5 shrink-0">#{i+1}</span>
                  <WalletLink address={s.wallet} />
                  {s.bundled && <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-red-500/15 text-red-400 font-bold">bundle</span>}
                </div>
                <div className="flex items-center gap-3 text-xs shrink-0">
                  {s.solSpent!=null && <span className="text-yellow-300 font-bold tabular-nums">{s.solSpent.toFixed(3)} SOL</span>}
                  {s.secondsAfterLaunch!=null && <span className="flex items-center gap-1 text-white/35"><Clock className="w-3 h-3"/>+{s.secondsAfterLaunch}s</span>}
                  {s.txHash && <Solscan kind="tx" id={s.txHash} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Bundles ────────────────────────────────────────────────────────────
function BundlesSection({ x }: { x: XrayReport }) {
  const clusters = x.bundles?.clusters||[];
  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 flex items-center gap-4" style={{ background:"rgba(245,158,11,0.07)", border:"1px solid rgba(245,158,11,0.18)" }}>
        <Boxes className="w-8 h-8 text-orange-400 shrink-0" />
        <div>
          <div className="font-bold text-orange-300">Same-Block Bundle Detection</div>
          <div className="text-sm text-white/45">{clusters.length>0?`${clusters.length} clusters — ≥3 wallets buying in same slot`:x.traced?"No bundles detected.":"Trace unavailable."}</div>
        </div>
        {x.bundles.pct!=null && <div className="ml-auto text-3xl font-black text-orange-300">{x.bundles.pct}%</div>}
      </div>
      <div className="space-y-3">
        {clusters.map((b,i) => (
          <div key={i} className="rounded-xl p-4" style={{ background:"rgba(245,158,11,0.05)", border:"1px solid rgba(245,158,11,0.14)" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-orange-300 font-bold">{b.size} wallets</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background:"rgba(245,158,11,0.12)", color:"#f59e0b" }}>slot {b.slot}</span>
              </div>
              <Flame className="w-4 h-4 text-orange-400" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {b.wallets.map(w => (
                <a key={w} href={`https://solscan.io/account/${w}`} target="_blank" rel="noreferrer"
                  className="text-[10px] font-mono px-2 py-1 rounded-lg transition-colors"
                  style={{ background:"rgba(245,158,11,0.07)", border:"1px solid rgba(245,158,11,0.15)", color:"rgba(255,255,255,0.45)" }}>
                  {short(w)}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Insiders ───────────────────────────────────────────────────────────
function InsidersSection({ x }: { x: XrayReport }) {
  const clusters = x.insiders?.clusters||[];
  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 flex items-center gap-4" style={{ background:"rgba(239,68,68,0.07)", border:"1px solid rgba(239,68,68,0.18)" }}>
        <Share2 className="w-8 h-8 text-red-400 shrink-0" />
        <div>
          <div className="font-bold text-red-300">Insider Cluster Detection</div>
          <div className="text-sm text-white/45">{clusters.length>0?`${clusters.length} clusters sharing a common funding wallet`:x.traced?"No insider clusters.":"Trace unavailable."}</div>
        </div>
        {x.insiders?.pct!=null && <div className="ml-auto text-3xl font-black text-red-300">{x.insiders.pct}%</div>}
      </div>
      {clusters.map((cl,i) => (
        <div key={i} className="rounded-xl p-4" style={{ background:"rgba(239,68,68,0.04)", border:"1px solid rgba(239,68,68,0.14)" }}>
          <div className="flex items-center gap-2 mb-3 pb-3" style={{ borderBottom:"1px solid rgba(239,68,68,0.12)" }}>
            <div className="w-2 h-2 rounded-full bg-red-500" style={{ boxShadow:"0 0 8px #ef4444" }} />
            <span className="text-xs text-white/35">Shared funder:</span>
            <Solscan kind="account" id={cl.funder} label={short(cl.funder)} />
            <span className="ml-auto text-[10px] text-white/25">{cl.size} wallets</span>
          </div>
          <div className="flex flex-wrap gap-1.5 pl-3" style={{ borderLeft:"1px solid rgba(239,68,68,0.18)" }}>
            {cl.wallets.map(w => (
              <a key={w} href={`https://solscan.io/account/${w}`} target="_blank" rel="noreferrer"
                className="text-[10px] font-mono px-2 py-1 rounded-lg transition-colors"
                style={{ background:"rgba(239,68,68,0.07)", border:"1px solid rgba(239,68,68,0.15)", color:"rgba(255,255,255,0.45)" }}>
                {short(w)}
              </a>
            ))}
          </div>
        </div>
      ))}
      {clusters.length>0 && (
        <div className="flex items-start gap-2 text-[11px] text-white/30 rounded-lg p-2.5" style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)" }}>
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-yellow-400" />
          A shared funder can also be a CEX/exchange withdrawal. Treat as a signal, not proof.
        </div>
      )}
    </div>
  );
}

// ── Dev + Safety ───────────────────────────────────────────────────────
function DevSafetySection({ x }: { x: XrayReport }) {
  const dev = x.dev, safety = x.safety;
  const safetyRows = [
    { label:"Mint Authority",   ok:safety?.mintRenounced,           good:"Renounced ✓",              bad:"NOT Renounced ⚠" },
    { label:"Freeze Authority", ok:safety?.freezeRenounced,         good:"Renounced ✓",              bad:"NOT Renounced ⚠" },
    { label:"LP Locked",        ok:safety?.lpLockedPct!=null?safety.lpLockedPct>80:null, good:`${safety?.lpLockedPct??"—"}% locked ✓`, bad:`${safety?.lpLockedPct??"—"}% locked ⚠` },
    { label:"Rug History",      ok:safety?.rugged===false?true:safety?.rugged===true?false:null, good:"No rug history ✓", bad:"RUGGED TOKEN ✗" },
    { label:"Risk Score",       ok:safety?.riskScore!=null?safety.riskScore<50:null, good:`Score: ${safety?.riskScore??'—'} (low)`, bad:`Score: ${safety?.riskScore??'—'} (high)` },
  ];
  return (
    <div className="space-y-5">
      {dev && (
        <div className="rounded-xl p-5" style={{ background:"rgba(34,211,238,0.04)", border:"1px solid rgba(34,211,238,0.13)" }}>
          <div className="text-[11px] font-black tracking-widest text-cyan-400/70 flex items-center gap-2 mb-4"><Code2 className="w-4 h-4"/>DEPLOYER WALLET</div>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background:"rgba(34,211,238,0.09)", border:"1px solid rgba(34,211,238,0.18)" }}>
              <Code2 className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <Solscan kind="account" id={dev.wallet} label={short(dev.wallet)} />
              <div className="text-[10px] text-white/25 mt-0.5">Deployer address</div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={<Database    className="w-3 h-3"/>} label="Tokens Created" value={dev.tokensCreated??0}   tone="cyan" />
            <StatCard icon={<BarChart3   className="w-3 h-3"/>} label="Dev Holdings"   value={dev.pct!=null?`${dev.pct}%`:"—"} tone={pctTone(dev.pct,5,15)} />
            <StatCard icon={<TrendingDown className="w-3 h-3"/>} label="Sold Tokens"   value={dev.sold===true?"YES":dev.sold===false?"No":"—"} tone={dev.sold?"red":dev.sold===false?"green":"cyan"} />
            <StatCard icon={<Zap         className="w-3 h-3"/>} label="Serial Launcher" value={dev.serial?"YES":"No"} tone={dev.serial?"red":"green"} />
          </div>
        </div>
      )}
      {safety && (
        <div className="rounded-xl p-5" style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)" }}>
          <div className="text-[11px] font-black tracking-widest text-white/40 flex items-center gap-2 mb-4"><Lock className="w-4 h-4 text-green-400"/>SAFETY CHECKS</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {safetyRows.map((row,i) => {
              const unknown = row.ok==null;
              const c = unknown?"#64748b":row.ok?"#22c55e":"#ef4444";
              const Icon = row.ok ? CheckCircle2 : XCircle;
              return (
                <div key={i} className="flex items-center gap-3 rounded-xl p-3" style={{ background:`${c}07`, border:`1px solid ${c}1a` }}>
                  {row.ok!==null && <Icon className="w-4 h-4 shrink-0" style={{ color:c }} />}
                  {row.ok===null && <Eye className="w-4 h-4 shrink-0 text-white/25" />}
                  <div>
                    <div className="text-[10px] text-white/35">{row.label}</div>
                    <div className="text-xs font-bold" style={{ color:c }}>{unknown?"Unknown":row.ok?row.good:row.bad}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── All Buyers ─────────────────────────────────────────────────────────
function BuyersSection({ x }: { x: XrayReport }) {
  const [filter, setFilter] = useState("all");
  const buyers = x.earlyBuyers||[];
  const filtered = filter==="all"?buyers:buyers.filter(b=>{
    if (filter==="sniper") return b.sniper;
    if (filter==="bundle") return b.bundled;
    if (filter==="insider") return b.insider;
    if (filter==="clean") return !b.sniper&&!b.bundled&&!b.insider;
    return true;
  });
  const tabs = [
    { id:"all",     label:"All",     color:"#22d3ee", n:buyers.length },
    { id:"sniper",  label:"Sniper",  color:"#eab308", n:buyers.filter(b=>b.sniper).length },
    { id:"bundle",  label:"Bundle",  color:"#f59e0b", n:buyers.filter(b=>b.bundled).length },
    { id:"insider", label:"Insider", color:"#ef4444", n:buyers.filter(b=>b.insider).length },
    { id:"clean",   label:"Clean",   color:"#22c55e", n:buyers.filter(b=>!b.sniper&&!b.bundled&&!b.insider).length },
  ];
  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={()=>setFilter(t.id)}
            className="text-[11px] px-3 py-1.5 rounded-full font-bold transition-all"
            style={{ background:filter===t.id?`${t.color}18`:"rgba(255,255,255,0.03)", border:`1px solid ${filter===t.id?t.color+"45":"rgba(255,255,255,0.07)"}`, color:filter===t.id?t.color:"rgba(255,255,255,0.35)", boxShadow:filter===t.id?`0 0 14px ${t.color}20`:"none" }}>
            {t.label} <span style={{ opacity:0.55 }}>({t.n})</span>
          </button>
        ))}
      </div>
      <div className="rounded-xl overflow-hidden" style={{ border:"1px solid rgba(255,255,255,0.06)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr style={{ background:"rgba(255,255,255,0.03)", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
                {["#","WALLET","SOL","WHEN","TAGS"].map((h,i) => (
                  <th key={h} className={`py-2.5 px-3 text-[10px] font-black tracking-wider text-white/30 ${i>1?"text-right":"text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.rank} className="transition-colors hover:bg-white/[0.025]" style={{ borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                  <td className="py-2 px-3 text-white/25 tabular-nums text-xs">{b.rank}</td>
                  <td className="py-2 px-3"><WalletLink address={b.wallet} /></td>
                  <td className="py-2 px-3 text-right tabular-nums font-bold text-white/65 text-xs">{b.solSpent?b.solSpent.toFixed(3):"—"}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-white/35 text-xs">{b.secondsAfterLaunch!=null?`+${b.secondsAfterLaunch}s`:"—"}</td>
                  <td className="py-2 px-3 text-right">
                    <div className="flex gap-1 justify-end flex-wrap">
                      {b.sniper  && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-yellow-400/12 text-yellow-300">sniper</span>}
                      {b.bundled && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-orange-400/12 text-orange-300">bundle</span>}
                      {b.insider && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-500/12 text-red-300">insider</span>}
                      {!b.sniper&&!b.bundled&&!b.insider && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-green-500/12 text-green-300">clean</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────
export default function RiskXray({ x, loading }: { x: XrayReport | null; loading: boolean }) {
  const [section, setSection] = useState<Section>("overview");

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-52 gap-4">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full" style={{ border:"2px solid rgba(34,211,238,0.12)" }} />
          <div className="absolute inset-0 rounded-full animate-spin" style={{ border:"2px solid transparent", borderTopColor:"#22d3ee", filter:"drop-shadow(0 0 6px #22d3ee)" }} />
          <div className="absolute inset-2 rounded-full animate-pulse" style={{ background:"rgba(34,211,238,0.07)" }} />
        </div>
        <div className="text-xs text-white/35 animate-pulse tracking-widest">SCANNING ON-CHAIN DATA…</div>
      </div>
    );
  }

  if (!x?.ok) return null;

  return (
    <div className="space-y-4">
      <SectionNav active={section} onChange={setSection} x={x} />
      <div>
        {section==="overview"  && <OverviewSection x={x} />}
        {section==="map"       && (x.traced&&(x.earlyBuyers?.length??0)>0
          ? <BubbleMap report={x} />
          : <div className="flex flex-col items-center justify-center h-40 text-white/30 text-sm gap-2"><Network className="w-8 h-8 opacity-25"/><span>No trace data available for this token.</span></div>
        )}
        {section==="snipers"   && <SnipersSection x={x} />}
        {section==="bundles"   && <BundlesSection x={x} />}
        {section==="insiders"  && <InsidersSection x={x} />}
        {section==="devsafety" && <DevSafetySection x={x} />}
        {section==="buyers"    && <BuyersSection x={x} />}
      </div>
    </div>
  );
}
