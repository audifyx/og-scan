import { useState, useEffect, useMemo } from "react";
import { XrayReport, short } from "../lib/api";
import WalletLink from "./WalletLink";
import BubbleMap from "./BubbleMap";
import {
  ShieldCheck, ShieldAlert, ShieldX,
  Crosshair, Boxes, Users, Wallet, ExternalLink,
  CheckCircle2, XCircle, AlertTriangle, Target,
  Network, Share2, Code2, Lock, Flame, Eye,
  TrendingDown, Clock, Activity, BarChart3,
  Zap, Database, Copy, ChevronRight,
} from "lucide-react";

// ── Tag colours ───────────────────────────────────────────────────────
type RiskTag = "insider" | "bundle" | "sniper" | "clean";
const TAG_COLOR: Record<RiskTag, string> = {
  insider: "#ef4444",
  bundle:  "#f59e0b",
  sniper:  "#eab308",
  clean:   "#22c55e",
};

// ── Solscan link helpers ──────────────────────────────────────────────
const SS_ACCOUNT = (addr: string) => `https://solscan.io/account/${addr}`;
const SS_TX      = (sig:  string) => `https://solscan.io/tx/${sig}`;
const SS_TOKEN   = (mint: string) => `https://solscan.io/token/${mint}`;

function SolscanLink({ kind, id, label, className = "" }: { kind:"account"|"tx"|"token"; id:string; label?:string; className?:string }) {
  const href = kind==="account" ? SS_ACCOUNT(id) : kind==="tx" ? SS_TX(id) : SS_TOKEN(id);
  return (
    <a href={href} target="_blank" rel="noreferrer"
       className={`inline-flex items-center gap-1 transition-opacity hover:opacity-100 opacity-70 ${className}`}
       style={{ color:"#22d3ee", fontSize:"11px" }}>
      {label || short(id)} <ExternalLink className="w-2.5 h-2.5" />
    </a>
  );
}

function CopyBtn({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(value); setDone(true); setTimeout(()=>setDone(false),1200); }}
      className="p-0.5 rounded opacity-30 hover:opacity-70 transition-opacity">
      <Copy className="w-3 h-3 text-white" />
      {done && <span className="absolute -top-5 left-0 text-[9px] text-green-400 bg-black/80 px-1 rounded">copied!</span>}
    </button>
  );
}

// ── Enrich early buyers with computed tags ────────────────────────────
interface RichBuyer {
  wallet: string;
  tokenAmount: number;
  solSpent: number;
  txHash: string | null;
  slot: number;
  time: number;
  rank: number;
  tag: RiskTag;
  sniper: boolean;
  bundled: boolean;
  insider: boolean;
  secondsAfterLaunch: number | null;
}

function enrichBuyers(x: XrayReport): RichBuyer[] {
  const sniperMap  = new Map((x.snipers?.wallets||[]).map(w => [w.wallet, w]));
  const bundleSet  = new Set((x.bundles?.clusters||[]).flatMap(c => c.wallets));
  const insiderSet = new Set((x.insiders?.clusters||[]).flatMap(c => c.wallets));

  const rawBuyers: any[] = x.earlyBuyers || [];
  const firstTime = rawBuyers.length
    ? Math.min(...rawBuyers.map((b:any) => b.time || Infinity))
    : 0;

  return rawBuyers.map((b: any, i) => {
    const insider = insiderSet.has(b.wallet);
    const bundled = bundleSet.has(b.wallet);
    const isSnipr = sniperMap.has(b.wallet);
    const tag: RiskTag = insider ? "insider" : bundled ? "bundle" : isSnipr ? "sniper" : "clean";
    const snap = sniperMap.get(b.wallet);
    const secs = snap?.secondsAfterLaunch
      ?? (b.time && firstTime && b.time !== firstTime
          ? Math.round((b.time - firstTime) / 1000)
          : 0);
    return {
      wallet: b.wallet,
      tokenAmount: b.tokenAmount ?? 0,
      solSpent: b.solSpent ?? snap?.solSpent ?? 0,
      txHash: b.txHash ?? snap?.txHash ?? null,
      slot: b.slot ?? 0,
      time: b.time ?? 0,
      rank: i + 1,
      tag, sniper: isSnipr, bundled, insider,
      secondsAfterLaunch: secs,
    };
  });
}

// ── Helpers ───────────────────────────────────────────────────────────
function fSol(n?: number|null) {
  if (n==null||n===0) return "—";
  if (n<0.0001) return "<0.0001 SOL";
  return n.toFixed(4)+" SOL";
}
function fTokens(n?: number|null) {
  if (n==null||n===0) return "—";
  if (n>=1e6) return (n/1e6).toFixed(2)+"M";
  if (n>=1e3) return (n/1e3).toFixed(1)+"K";
  if (n<0.001) return "<0.001";
  return n.toFixed(2);
}
function fTime(ts: number) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", second:"2-digit" });
}
function fSecs(s: number|null) {
  if (s==null) return "—";
  if (s===0) return "launch";
  if (s<60) return `+${s}s`;
  return `+${Math.floor(s/60)}m${s%60}s`;
}

// ── Count-up animation ────────────────────────────────────────────────
function useCountUp(target: number, ms = 1200) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const s = performance.now();
    const step = (now: number) => {
      const p = Math.min((now-s)/ms, 1);
      setV(target * (1-Math.pow(1-p,3)));
      if (p<1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, ms]);
  return v;
}

// ── Risk Gauge ────────────────────────────────────────────────────────
function RiskGauge({ score, tone }: { score: number; tone: "red"|"yellow"|"green" }) {
  const v = useCountUp(score, 1500);
  const color = tone==="red"?"#ef4444":tone==="green"?"#22c55e":"#f59e0b";
  const R = 72, CX = 90, CY = 90, circ = 2*Math.PI*R;
  const filled = (v/100)*circ;

  return (
    <div className="relative shrink-0 flex items-center justify-center" style={{ width:180, height:180 }}>
      <svg width={180} height={180} className="absolute">
        {/* Track ticks */}
        {Array.from({length:30}).map((_,i) => {
          const a = (i/30)*360-90, rad = a*Math.PI/180;
          const big = i%5===0;
          const x1=CX+(R-14)*Math.cos(rad), y1=CY+(R-14)*Math.sin(rad);
          const x2=CX+(R-(big?5:9))*Math.cos(rad), y2=CY+(R-(big?5:9))*Math.sin(rad);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.1)" strokeWidth={big?2:1} />;
        })}
        {/* BG track */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} />
        {/* Filled arc */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round"
          strokeDasharray={`${filled} ${circ-filled}`}
          style={{ transform:`rotate(-90deg)`, transformOrigin:`${CX}px ${CY}px`, filter:`drop-shadow(0 0 12px ${color})` }} />
      </svg>
      <div className="absolute flex flex-col items-center justify-center gap-0.5">
        <div className="text-4xl font-black tabular-nums" style={{ color, textShadow:`0 0 28px ${color}70` }}>
          {Math.round(v)}
        </div>
        <div className="text-[8px] font-black tracking-[0.22em] uppercase" style={{ color, opacity:.7 }}>
          {score<=30?"HIGH RISK":score<=60?"MODERATE":"LOW RISK"}
        </div>
      </div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────
function Stat({ icon, label, value, tone, sub }: { icon:React.ReactNode; label:string; value:React.ReactNode; tone?:"red"|"yellow"|"green"|"cyan"; sub?:string }) {
  const c = tone==="red"?"#ef4444":tone==="yellow"?"#f59e0b":tone==="green"?"#22c55e":"#22d3ee";
  return (
    <div className="rounded-xl p-3.5 relative overflow-hidden" style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)" }}>
      <div className="absolute top-0 right-0 w-12 h-12 rounded-full opacity-15 blur-xl" style={{ background:c }} />
      <div className="text-[10px] text-white/35 flex items-center gap-1.5 mb-1.5">{icon}{label}</div>
      <div className="text-xl font-black tabular-nums" style={{ color:c, textShadow:`0 0 16px ${c}50` }}>{value}</div>
      {sub && <div className="text-[9px] text-white/20 mt-0.5">{sub}</div>}
    </div>
  );
}

function pctTone(p:number|null, warn=30, bad=60): "red"|"yellow"|"green" {
  if (p==null) return "cyan" as any;
  return p>=bad?"red":p>=warn?"yellow":"green";
}

// ── Section Nav ───────────────────────────────────────────────────────
type Section = "overview"|"timeline"|"map"|"snipers"|"bundles"|"insiders"|"devsafety"|"buyers";

interface NavCard { id:Section; icon:React.ReactNode; label:string; sub:string; color:string; }

function SectionNav({ active, onChange, x, buyers }: { active:Section; onChange:(s:Section)=>void; x:XrayReport; buyers:RichBuyer[] }) {
  const cards: NavCard[] = [
    { id:"overview",  icon:<Activity  className="w-4.5 h-4.5"/>, label:"Overview",    sub:`Score ${x.score??"-"}`,                        color:"#22d3ee" },
    { id:"timeline",  icon:<Clock     className="w-4.5 h-4.5"/>, label:"Timeline",    sub:`${buyers.length} events`,                       color:"#a855f7" },
    { id:"map",       icon:<Network   className="w-4.5 h-4.5"/>, label:"Graph",       sub:`${buyers.length} nodes`,                        color:"#06b6d4" },
    { id:"snipers",   icon:<Crosshair className="w-4.5 h-4.5"/>, label:"Snipers",     sub:`${x.snipers.count??0} · ${x.snipers.pct??0}%`,  color:"#eab308" },
    { id:"bundles",   icon:<Boxes     className="w-4.5 h-4.5"/>, label:"Bundles",     sub:`${x.bundles.count??0} clusters`,                color:"#f59e0b" },
    { id:"insiders",  icon:<Share2    className="w-4.5 h-4.5"/>, label:"Insiders",    sub:`${x.insiders?.count??0} · ${x.insiders?.pct??0}%`, color:"#ef4444" },
    { id:"devsafety", icon:<Lock      className="w-4.5 h-4.5"/>, label:"Dev+Safety",  sub:x.dev?short(x.dev.wallet):"—",                   color:"#22c55e" },
    { id:"buyers",    icon:<Users     className="w-4.5 h-4.5"/>, label:"All Buyers",  sub:`${buyers.length} wallets`,                      color:"#8b5cf6" },
  ];

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth:"none" }}>
      {cards.map(card => {
        const on = active===card.id;
        return (
          <button key={card.id} onClick={()=>onChange(card.id)}
            className="flex-shrink-0 flex flex-col items-center gap-1.5 px-3.5 py-2.5 rounded-xl transition-all duration-200 min-w-[80px] relative"
            style={{
              background: on ? `linear-gradient(145deg,${card.color}22,${card.color}08)` : "rgba(255,255,255,0.025)",
              border: `1px solid ${on ? card.color+"50" : "rgba(255,255,255,0.06)"}`,
              boxShadow: on ? `0 4px 20px ${card.color}1a, inset 0 1px 0 ${card.color}18` : "none",
              transform: on ? "translateY(-1px)" : "none",
            }}>
            <div style={{ color: on ? card.color : "rgba(255,255,255,0.3)" }}>{card.icon}</div>
            <div className="text-center">
              <div className="text-[10px] font-bold" style={{ color: on?card.color:"rgba(255,255,255,0.55)" }}>{card.label}</div>
              <div className="text-[9px] mt-0.5" style={{ color:"rgba(255,255,255,0.2)" }}>{card.sub}</div>
            </div>
            {on && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-full" style={{ background:card.color, boxShadow:`0 0 8px ${card.color}` }} />}
          </button>
        );
      })}
    </div>
  );
}

// ── OVERVIEW section ──────────────────────────────────────────────────
function OverviewSection({ x, buyers }: { x:XrayReport; buyers:RichBuyer[] }) {
  const mc = x.tone==="red"?"#ef4444":x.tone==="green"?"#22c55e":"#f59e0b";
  const VIcon = x.tone==="green"?ShieldCheck:x.tone==="red"?ShieldX:ShieldAlert;

  const safetyOk = x.safety
    ? [x.safety.mintRenounced, x.safety.freezeRenounced, (x.safety.lpLockedPct??0)>=80, !x.safety.rugged].filter(Boolean).length
    : 0;

  return (
    <div className="space-y-4">
      {/* Verdict hero */}
      <div className="rounded-2xl p-5 relative overflow-hidden"
        style={{ background:`linear-gradient(135deg,${mc}0e 0%,rgba(0,0,0,0) 60%)`, border:`1px solid ${mc}25`, boxShadow:`0 0 40px ${mc}0e` }}>
        <style>{`@keyframes scan{0%{top:-2px}100%{top:102%}}`}</style>
        <div className="absolute inset-x-0 h-px pointer-events-none"
          style={{ background:`linear-gradient(90deg,transparent,${mc}55,transparent)`, animation:"scan 3.5s linear infinite", opacity:.4 }} />

        <div className="flex flex-col sm:flex-row items-center gap-5">
          <RiskGauge score={x.score??50} tone={x.tone} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <VIcon className="w-6 h-6 shrink-0" style={{ color:mc }} />
              <div className="text-2xl font-extrabold" style={{ color:mc, textShadow:`0 0 24px ${mc}55` }}>{x.verdict}</div>
            </div>
            <div className="text-sm text-white/50 leading-relaxed mb-3">{x.summary}</div>
            {/* Safety quick chips */}
            {x.safety && (
              <div className="flex flex-wrap gap-1.5">
                <SafeChip ok={x.safety.mintRenounced}   label="Mint renounced" />
                <SafeChip ok={x.safety.freezeRenounced} label="Freeze renounced" />
                <SafeChip ok={(x.safety.lpLockedPct??0)>=80} label={`LP ${x.safety.lpLockedPct??0}% locked`} />
                <SafeChip ok={!x.safety.rugged} label="No rug" />
              </div>
            )}
          </div>
        </div>

        {x.note && (
          <div className="mt-3 flex items-start gap-2 text-xs text-white/40 rounded-lg p-2.5" style={{ background:"rgba(234,179,8,0.07)", border:"1px solid rgba(234,179,8,0.15)" }}>
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-yellow-400" />{x.note}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <Stat icon={<Crosshair className="w-3 h-3"/>} label="Snipers"     value={x.snipers.pct!=null?`${x.snipers.pct}%`:"—"} tone={pctTone(x.snipers.pct)} sub={`${x.snipers.count??0} wallets`} />
        <Stat icon={<Boxes     className="w-3 h-3"/>} label="Bundled"     value={x.bundles.pct!=null?`${x.bundles.pct}%`:"—"} tone={pctTone(x.bundles.pct,1,30)} sub={`${x.bundles.count??0} clusters`} />
        <Stat icon={<Share2    className="w-3 h-3"/>} label="Insiders"    value={x.insiders?.pct!=null?`${x.insiders.pct}%`:"—"} tone={pctTone(x.insiders?.pct??null,1,40)} sub={`${x.insiders?.count??0} clusters`} />
        <Stat icon={<Users className="w-3 h-3"/>} label="Top-10 wallets"
          value={x.concentration.top10Pct!=null?`${x.concentration.top10Pct}%`:"—"}
          tone={pctTone(x.concentration.top10Pct,30,50)}
          sub={(x.concentration as any).lpSupplyPct!=null
            ? `excl. LP (${(x.concentration as any).lpSupplyPct}% in pool)`
            : `${x.concentration.whales} whales`}
        />
        <Stat icon={<Wallet className="w-3 h-3"/>} label="Holders" value={x.concentration.totalHolders||"—"} tone="cyan"
          sub={(x.concentration as any).lpSupplyPct!=null ? "LP excluded" : undefined}
        />
      </div>

      {/* Flags */}
      {(x.flags?.length??0)>0 && (
        <div className="rounded-xl p-4" style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)" }}>
          <div className="text-[10px] font-black tracking-widest text-white/35 flex items-center gap-1.5 mb-3">
            <Target className="w-3.5 h-3.5 text-cyan-400"/>RISK SIGNALS
          </div>
          <div className="space-y-2">
            {x.flags.map((f,i) => {
              const fc = f.level==="red"?"#ef4444":f.level==="yellow"?"#f59e0b":"#22c55e";
              const FI = f.level==="red"?XCircle:f.level==="yellow"?AlertTriangle:CheckCircle2;
              return (
                <div key={i} className="flex items-start gap-2.5 text-sm rounded-lg p-2.5" style={{ background:`${fc}09` }}>
                  <FI className="w-4 h-4 shrink-0 mt-0.5" style={{ color:fc }} />
                  <span className={f.level==="red"?"text-white/90":"text-white/55"}>{f.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Token Solscan link */}
      <div className="flex items-center gap-2 text-xs text-white/30">
        <Database className="w-3 h-3"/>
        <SolscanLink kind="token" id={x.mint} label={`View token on Solscan: ${short(x.mint)}`} />
      </div>
    </div>
  );
}

function SafeChip({ ok, label }: { ok:boolean|null; label:string }) {
  const c = ok==null?"#64748b":ok?"#22c55e":"#ef4444";
  const I = ok==null?Eye:ok?CheckCircle2:XCircle;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg font-bold"
      style={{ background:`${c}12`, border:`1px solid ${c}28`, color:c }}>
      <I className="w-3 h-3"/>{label}
    </span>
  );
}

// ── TIMELINE section (WOW factor) ─────────────────────────────────────
function TimelineSection({ x, buyers }: { x:XrayReport; buyers:RichBuyer[] }) {
  if (!buyers.length) return <EmptyState msg="No timeline data available." />;

  const sorted = [...buyers].sort((a,b) => a.slot-b.slot);
  const firstSlot = sorted[0].slot;
  const lastSlot  = sorted[sorted.length-1].slot;
  const span      = Math.max(lastSlot-firstSlot, 1);

  const maxSol  = Math.max(...sorted.map(b=>b.solSpent),  0.001);
  const maxTok  = Math.max(...sorted.map(b=>b.tokenAmount), 0.001);

  // Bundle slot highlights
  const bundleSlots = new Set((x.bundles?.clusters||[]).map(c=>c.slot));

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-bold text-white/80">Launch Attack Timeline</div>
        <div className="text-[11px] text-white/30 mt-0.5">
          Each row = one early buyer · position on x-axis = slot · bar width = SOL spent or token amount
        </div>
      </div>

      {/* Slot range header */}
      <div className="flex items-center justify-between text-[10px] text-white/20 font-mono px-1">
        <span>slot {firstSlot}</span>
        <span className="text-white/15">← {sorted.length} buys over {lastSlot-firstSlot} slots →</span>
        <span>slot {lastSlot}</span>
      </div>

      {/* Timeline rows */}
      <div className="space-y-1.5 relative">
        {/* Axis line */}
        <div className="absolute left-0 right-0 top-0 bottom-0 pointer-events-none">
          {[0,.25,.5,.75,1].map(p => (
            <div key={p} className="absolute top-0 bottom-0 w-px" style={{ left:`${p*100}%`, background:`rgba(255,255,255,0.04)` }} />
          ))}
        </div>

        {sorted.map((b, i) => {
          const xPct   = ((b.slot-firstSlot)/span)*100;
          const barPct = Math.max(b.solSpent/maxSol, b.tokenAmount/maxTok) * 28;
          const col    = TAG_COLOR[b.tag];
          const isBundleSlot = bundleSlots.has(String(b.slot));
          return (
            <div key={i} className="relative h-8 rounded-lg overflow-hidden group cursor-pointer"
              style={{ background:`rgba(255,255,255,0.025)`, border:`1px solid ${isBundleSlot?col+"30":"rgba(255,255,255,0.05)"}` }}
              onClick={() => window.open(SS_ACCOUNT(b.wallet), "_blank")}>

              {/* Background bar (position = slot) */}
              <div className="absolute top-0 bottom-0 rounded-r-lg" style={{
                left: `${Math.min(xPct, 68)}%`,
                width: `${Math.max(barPct, 1.5)}%`,
                background: `${col}28`,
                borderLeft: `2px solid ${col}`,
              }} />

              {/* Row content */}
              <div className="absolute inset-0 flex items-center px-2.5 gap-2.5">
                {/* Rank */}
                <span className="text-[10px] text-white/20 font-mono w-4 shrink-0">{b.rank}</span>
                {/* Tag dot */}
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background:col, boxShadow:`0 0 5px ${col}` }} />
                {/* Wallet */}
                <span className="text-[11px] font-mono text-white/60 truncate flex-1">{short(b.wallet)}</span>
                {/* Data chips */}
                <div className="flex items-center gap-2 shrink-0 text-[10px]">
                  {isBundleSlot && <span className="px-1.5 py-0.5 rounded-full font-bold" style={{ background:"rgba(245,158,11,0.15)", color:"#f59e0b", fontSize:"9px" }}>BUNDLE</span>}
                  {b.solSpent > 0 && <span className="text-white/50 font-bold tabular-nums">{b.solSpent.toFixed(3)} SOL</span>}
                  {b.secondsAfterLaunch !== null && <span className="text-white/30">{fSecs(b.secondsAfterLaunch)}</span>}
                  <span className="text-white/20 font-mono">s{b.slot}</span>
                  {b.txHash && (
                    <a href={SS_TX(b.txHash)} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
                      className="opacity-0 group-hover:opacity-70 transition-opacity">
                      <ExternalLink className="w-3 h-3 text-cyan-400" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Timeline legend */}
      <div className="flex flex-wrap gap-3 text-[10px] text-white/35 pt-1">
        {(["insider","bundle","sniper","clean"] as RiskTag[]).map(tag => (
          <span key={tag} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background:TAG_COLOR[tag] }} />
            {tag} ({buyers.filter(b=>b.tag===tag).length})
          </span>
        ))}
      </div>
    </div>
  );
}

// ── SNIPERS section ───────────────────────────────────────────────────
function SnipersSection({ x, buyers }: { x:XrayReport; buyers:RichBuyer[] }) {
  const snipers = buyers.filter(b=>b.sniper);
  const maxSol  = Math.max(...snipers.map(b=>b.solSpent), 0.001);

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 flex items-center gap-4"
        style={{ background:"rgba(234,179,8,0.07)", border:"1px solid rgba(234,179,8,0.18)" }}>
        <Crosshair className="w-8 h-8 text-yellow-400 shrink-0" />
        <div className="flex-1">
          <div className="font-bold text-yellow-300 mb-0.5">Sniper Detection</div>
          <div className="text-sm text-white/45">
            {snipers.length>0
              ? `${snipers.length} wallets sniped this token at launch or within the first few blocks`
              : x.traced ? "No snipers detected." : "Trace unavailable."}
          </div>
        </div>
        {x.snipers.pct!=null && <div className="text-3xl font-black text-yellow-300 shrink-0">{x.snipers.pct}%</div>}
      </div>

      <div className="space-y-2">
        {snipers.map((b, i) => {
          const bar = (b.solSpent/maxSol)*100;
          return (
            <div key={i} className="rounded-xl p-3 relative overflow-hidden group" style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(234,179,8,0.1)" }}>
              <div className="absolute inset-y-0 left-0 rounded-xl opacity-10 transition-all" style={{ width:`${bar}%`, background:"linear-gradient(90deg,#eab308,transparent)" }} />
              <div className="relative flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] text-white/20 font-mono w-5 shrink-0">#{b.rank}</span>
                  <WalletLink address={b.wallet} />
                  {b.bundled && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ background:"rgba(245,158,11,0.15)", color:"#f59e0b" }}>bundle</span>}
                </div>
                <div className="flex items-center gap-3 text-xs shrink-0">
                  <span className="text-white/35 tabular-nums">slot {b.slot}</span>
                  {b.solSpent>0 && <span className="text-yellow-300 font-bold tabular-nums">{b.solSpent.toFixed(4)} SOL</span>}
                  {b.secondsAfterLaunch!==null && <span className="flex items-center gap-1 text-white/35"><Clock className="w-3 h-3"/>{fSecs(b.secondsAfterLaunch)}</span>}
                  {b.txHash && <SolscanLink kind="tx" id={b.txHash} label="tx" />}
                </div>
              </div>
            </div>
          );
        })}
        {snipers.length===0 && <div className="text-sm text-white/30 text-center py-8">{x.traced?"No snipers found.":"Trace data unavailable for this token."}</div>}
      </div>
    </div>
  );
}

// ── BUNDLES section ───────────────────────────────────────────────────
function BundlesSection({ x, buyers }: { x:XrayReport; buyers:RichBuyer[] }) {
  const clusters = x.bundles?.clusters||[];
  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 flex items-center gap-4"
        style={{ background:"rgba(245,158,11,0.07)", border:"1px solid rgba(245,158,11,0.18)" }}>
        <Boxes className="w-8 h-8 text-orange-400 shrink-0" />
        <div className="flex-1">
          <div className="font-bold text-orange-300 mb-0.5">Same-Block Bundle Detection</div>
          <div className="text-sm text-white/45">
            {clusters.length>0
              ? `${clusters.length} bundle cluster${clusters.length>1?"s":""} — ≥3 wallets buying in the same block slot`
              : x.traced?"No bundles detected.":"Trace unavailable."}
          </div>
        </div>
        {x.bundles.pct!=null && <div className="text-3xl font-black text-orange-300 shrink-0">{x.bundles.pct}%</div>}
      </div>

      <div className="space-y-3">
        {clusters.map((cl, i) => {
          // Deduplicate wallets (API sometimes sends same wallet twice in a bundle)
          const uniqueWallets = [...new Set(cl.wallets)];
          return (
            <div key={i} className="rounded-xl p-4" style={{ background:"rgba(245,158,11,0.05)", border:"1px solid rgba(245,158,11,0.15)" }}>
              <div className="flex items-center gap-3 mb-3 pb-3" style={{ borderBottom:"1px solid rgba(245,158,11,0.12)" }}>
                <Flame className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-bold text-orange-300">{uniqueWallets.length} wallets</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                  style={{ background:"rgba(245,158,11,0.12)", color:"#f59e0b" }}>
                  slot {cl.slot}
                </span>
                <SolscanLink kind="tx" id={buyers.find(b=>cl.wallets.includes(b.wallet)&&b.txHash)?.txHash||""} label="view slot txs" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {uniqueWallets.map(w => (
                  <a key={w} href={SS_ACCOUNT(w)} target="_blank" rel="noreferrer"
                    className="text-[10px] font-mono px-2 py-1 rounded-lg transition-all hover:opacity-100 opacity-60 flex items-center gap-1"
                    style={{ background:"rgba(245,158,11,0.07)", border:"1px solid rgba(245,158,11,0.15)", color:"rgba(255,255,255,0.7)" }}>
                    {short(w)} <ExternalLink className="w-2.5 h-2.5 text-cyan-400" />
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── INSIDERS section ──────────────────────────────────────────────────
function InsidersSection({ x }: { x:XrayReport }) {
  const clusters = x.insiders?.clusters||[];
  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 flex items-center gap-4"
        style={{ background:"rgba(239,68,68,0.07)", border:"1px solid rgba(239,68,68,0.18)" }}>
        <Share2 className="w-8 h-8 text-red-400 shrink-0" />
        <div className="flex-1">
          <div className="font-bold text-red-300 mb-0.5">Insider Cluster Detection</div>
          <div className="text-sm text-white/45">
            {clusters.length>0
              ? `${clusters.length} cluster${clusters.length>1?"s":""} sharing a common funding wallet — early buyers funded from same source`
              : x.traced?"No insider clusters detected.":"Trace unavailable."}
          </div>
        </div>
        {x.insiders?.pct!=null && <div className="text-3xl font-black text-red-300 shrink-0">{x.insiders.pct}%</div>}
      </div>

      {clusters.map((cl, i) => (
        <div key={i} className="rounded-xl p-4" style={{ background:"rgba(239,68,68,0.04)", border:"1px solid rgba(239,68,68,0.14)" }}>
          <div className="flex items-center gap-2 mb-3 pb-3" style={{ borderBottom:"1px solid rgba(239,68,68,0.12)" }}>
            <div className="w-2 h-2 rounded-full bg-red-500" style={{ boxShadow:"0 0 6px #ef4444" }} />
            <span className="text-xs text-white/35">Shared funder:</span>
            <SolscanLink kind="account" id={cl.funder} label={short(cl.funder)} />
            <span className="ml-auto text-[10px] text-white/25">{cl.size} wallets</span>
          </div>
          <div className="flex flex-wrap gap-1.5 pl-3" style={{ borderLeft:"2px solid rgba(239,68,68,0.2)" }}>
            {cl.wallets.map(w => (
              <a key={w} href={SS_ACCOUNT(w)} target="_blank" rel="noreferrer"
                className="text-[10px] font-mono px-2 py-1 rounded-lg flex items-center gap-1 opacity-60 hover:opacity-100 transition-all"
                style={{ background:"rgba(239,68,68,0.07)", border:"1px solid rgba(239,68,68,0.15)", color:"rgba(255,255,255,0.7)" }}>
                {short(w)} <ExternalLink className="w-2.5 h-2.5 text-cyan-400" />
              </a>
            ))}
          </div>
        </div>
      ))}

      {clusters.length===0 && (
        <div className="flex flex-col items-center justify-center py-10 text-white/25 gap-2">
          <CheckCircle2 className="w-8 h-8 text-green-500/40" />
          <div className="text-sm">No insider clusters detected{x.traced?" for this token":""}</div>
          {x.insiders?.pct!=null && <div className="text-xs text-white/20">Insider ≈ {x.insiders.pct}% — within normal range</div>}
        </div>
      )}

      <div className="flex items-start gap-2 text-[10px] text-white/25 rounded-lg p-2.5" style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)" }}>
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-yellow-400/60" />
        A shared funder can also be a CEX/exchange withdrawal. Treat as a signal, not proof of manipulation.
      </div>
    </div>
  );
}

// ── DEV + SAFETY section ──────────────────────────────────────────────
function DevSafetySection({ x }: { x:XrayReport }) {
  const dev    = x.dev;
  const safety = x.safety;

  const safetyRows: { label:string; ok:boolean|null; good:string; bad:string }[] = safety ? [
    { label:"Mint Authority",    ok:safety.mintRenounced,                      good:"Renounced ✓",           bad:"ACTIVE ⚠ — devs can mint more" },
    { label:"Freeze Authority",  ok:safety.freezeRenounced,                    good:"Renounced ✓",           bad:"ACTIVE ⚠ — accounts can be frozen" },
    { label:"LP Locked",         ok:(safety.lpLockedPct??0)>=80,               good:`${safety.lpLockedPct}% locked ✓`,   bad:`Only ${safety.lpLockedPct??0}% locked ⚠` },
    { label:"Rug History",       ok:safety.rugged===true?false:safety.rugged===false?true:null, good:"No rug history ✓", bad:"KNOWN RUG ✗" },
    { label:"Risk Score",        ok:(safety.riskScore??50)<30,                 good:`${safety.riskScore}/100 (low) ✓`, bad:`${safety.riskScore}/100 (elevated) ⚠` },
  ] : [];

  return (
    <div className="space-y-5">
      {/* Deployer wallet */}
      {dev && (
        <div className="rounded-xl p-5" style={{ background:"rgba(34,211,238,0.04)", border:"1px solid rgba(34,211,238,0.12)" }}>
          <div className="text-[10px] font-black tracking-widest text-cyan-400/60 flex items-center gap-2 mb-4">
            <Code2 className="w-3.5 h-3.5"/>DEPLOYER WALLET
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background:"rgba(34,211,238,0.08)", border:"1px solid rgba(34,211,238,0.15)" }}>
              <Code2 className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <SolscanLink kind="account" id={dev.wallet} label={dev.wallet} className="font-mono text-[11px] break-all" />
              <div className="text-[10px] text-white/25 mt-0.5">Deployer / creator wallet</div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <Stat icon={<Database     className="w-3 h-3"/>} label="Tokens Created"  value={dev.tokensCreated!=null?String(dev.tokensCreated):"—"} tone="cyan" />
            <Stat icon={<BarChart3    className="w-3 h-3"/>} label="Dev Holdings"    value={dev.pct!=null?`${dev.pct}%`:"—"}   tone={dev.pct!=null&&dev.pct>0?pctTone(dev.pct,5,15):"green"} />
            <Stat icon={<TrendingDown className="w-3 h-3"/>} label="Position Exited" value={dev.sold===true?"YES":dev.sold===false?"NO":"—"} tone={dev.sold?"red":dev.sold===false?"green":"cyan"} sub={dev.sold?"dev has sold tokens":undefined} />
            <Stat icon={<Zap          className="w-3 h-3"/>} label="Serial Launcher" value={dev.serial?"YES":"NO"} tone={dev.serial?"red":"green"} sub={dev.serial?"repeated deployer":undefined} />
          </div>
        </div>
      )}

      {/* Safety checks */}
      {safety && (
        <div className="rounded-xl p-5" style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)" }}>
          <div className="text-[10px] font-black tracking-widest text-white/35 flex items-center gap-2 mb-4">
            <Lock className="w-3.5 h-3.5 text-green-400"/>CONTRACT SAFETY
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {safetyRows.map((row, i) => {
              const c = row.ok==null?"#64748b":row.ok?"#22c55e":"#ef4444";
              const I = row.ok==null?Eye:row.ok?CheckCircle2:XCircle;
              return (
                <div key={i} className="flex items-center gap-3 rounded-xl p-3"
                  style={{ background:`${c}07`, border:`1px solid ${c}18` }}>
                  <I className="w-4 h-4 shrink-0" style={{ color:c }} />
                  <div>
                    <div className="text-[10px] text-white/30">{row.label}</div>
                    <div className="text-xs font-bold" style={{ color:c }}>{row.ok==null?"Unknown":row.ok?row.good:row.bad}</div>
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

// ── ALL BUYERS section ────────────────────────────────────────────────
function BuyersSection({ x, buyers }: { x:XrayReport; buyers:RichBuyer[] }) {
  const [activeTag, setActiveTag] = useState<RiskTag|"all">("all");
  const shown = activeTag==="all" ? buyers : buyers.filter(b=>b.tag===activeTag);

  const tabs: { id:RiskTag|"all"; label:string; color:string; n:number }[] = [
    { id:"all",     label:"All",     color:"#22d3ee", n:buyers.length },
    { id:"sniper",  label:"Sniper",  color:"#eab308", n:buyers.filter(b=>b.sniper).length },
    { id:"bundle",  label:"Bundle",  color:"#f59e0b", n:buyers.filter(b=>b.bundled).length },
    { id:"insider", label:"Insider", color:"#ef4444", n:buyers.filter(b=>b.insider).length },
    { id:"clean",   label:"Clean",   color:"#22c55e", n:buyers.filter(b=>b.tag==="clean").length },
  ];

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={()=>setActiveTag(t.id)}
            className="text-[11px] px-3 py-1.5 rounded-full font-bold transition-all"
            style={{
              background: activeTag===t.id?`${t.color}18`:"rgba(255,255,255,0.03)",
              border: `1px solid ${activeTag===t.id?t.color+"45":"rgba(255,255,255,0.07)"}`,
              color: activeTag===t.id?t.color:"rgba(255,255,255,0.3)",
              boxShadow: activeTag===t.id?`0 0 12px ${t.color}20`:"none",
            }}>
            {t.label} <span style={{ opacity:.55 }}>({t.n})</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border:"1px solid rgba(255,255,255,0.06)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr style={{ background:"rgba(255,255,255,0.03)", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                {["#","WALLET","TOKENS","SOL","SLOT","TIME","TAGS","TX"].map((h,i) => (
                  <th key={h} className={`py-2.5 px-3 text-[9px] font-black tracking-wider text-white/25 ${i>1?"text-right":"text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map(b => (
                <tr key={b.wallet} className="transition-colors hover:bg-white/[0.02]" style={{ borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                  <td className="py-2 px-3 text-white/20 tabular-nums text-xs">{b.rank}</td>
                  <td className="py-2 px-3"><WalletLink address={b.wallet} /></td>
                  <td className="py-2 px-3 text-right tabular-nums text-white/55 text-xs">{fTokens(b.tokenAmount)}</td>
                  <td className="py-2 px-3 text-right tabular-nums font-bold text-xs" style={{ color: b.solSpent>0?"rgba(255,255,255,0.7)":"rgba(255,255,255,0.25)" }}>{fSol(b.solSpent)}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-white/25 text-xs font-mono">{b.slot||"—"}</td>
                  <td className="py-2 px-3 text-right text-white/25 text-xs">{b.time?fTime(b.time):"—"}</td>
                  <td className="py-2 px-3 text-right">
                    <div className="flex gap-1 justify-end flex-wrap">
                      {b.sniper  && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ background:"rgba(234,179,8,0.12)", color:"#eab308" }}>sniper</span>}
                      {b.bundled && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ background:"rgba(245,158,11,0.12)", color:"#f59e0b" }}>bundle</span>}
                      {b.insider && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ background:"rgba(239,68,68,0.12)", color:"#ef4444" }}>insider</span>}
                      {b.tag==="clean" && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ background:"rgba(34,197,94,0.12)", color:"#22c55e" }}>clean</span>}
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right">
                    {b.txHash && <SolscanLink kind="tx" id={b.txHash} label="tx" />}
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

// ── Empty state ───────────────────────────────────────────────────────
function EmptyState({ msg }: { msg:string }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 text-white/25 gap-2">
      <Eye className="w-8 h-8 opacity-30" />
      <span className="text-sm">{msg}</span>
    </div>
  );
}

// ── Loading state ─────────────────────────────────────────────────────
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-52 gap-4">
      <div className="relative w-14 h-14">
        <div className="absolute inset-0 rounded-full" style={{ border:"2px solid rgba(34,211,238,0.1)" }} />
        <div className="absolute inset-0 rounded-full animate-spin" style={{ border:"2px solid transparent", borderTopColor:"#22d3ee", filter:"drop-shadow(0 0 6px #22d3ee)" }} />
        <div className="absolute inset-3 rounded-full animate-pulse" style={{ background:"rgba(34,211,238,0.07)" }} />
      </div>
      <div className="text-xs text-white/30 tracking-widest animate-pulse">SCANNING ON-CHAIN DATA…</div>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────
export default function RiskXray({ x, loading }: { x: XrayReport | null; loading: boolean }) {
  const [section, setSection] = useState<Section>("overview");

  const buyers = useMemo(() => x?.ok ? enrichBuyers(x) : [], [x]);

  if (loading) return <LoadingState />;
  if (!x?.ok) return null;

  return (
    <div className="space-y-4">
      <SectionNav active={section} onChange={setSection} x={x} buyers={buyers} />

      <div>
        {section==="overview"  && <OverviewSection x={x} buyers={buyers} />}
        {section==="timeline"  && <TimelineSection x={x} buyers={buyers} />}
        {section==="map"       && (
          x.traced && buyers.length > 0
            ? <BubbleMap report={x} />
            : <EmptyState msg="No trace data available for this token." />
        )}
        {section==="snipers"   && <SnipersSection   x={x} buyers={buyers} />}
        {section==="bundles"   && <BundlesSection   x={x} buyers={buyers} />}
        {section==="insiders"  && <InsidersSection  x={x} />}
        {section==="devsafety" && <DevSafetySection x={x} />}
        {section==="buyers"    && <BuyersSection    x={x} buyers={buyers} />}
      </div>
    </div>
  );
}
