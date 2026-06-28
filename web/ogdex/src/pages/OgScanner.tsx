import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Crosshair, Search, Loader2, Crown, ShieldCheck, ShieldAlert, AlertTriangle,
  ExternalLink, Users, Droplets, Copy, GitBranch, Skull, BadgeCheck,
} from "lucide-react";
import {
  forensicOgAttribution, tokenEffectiveLiquidityUsd, fmtUsd, fmtNum, shortAddr,
  type ForensicOgReport, type JupTokenInfo, type TokenLineageNode, type TokenForensicScores,
} from "../lib/og";

const num = (n: any) => (Number.isFinite(Number(n)) ? Number(n) : null);

// relationship → visual style
const REL: Record<TokenLineageNode["relationship"], { cls: string; Icon: typeof Crown; danger?: boolean }> = {
  "TRUE OG":        { cls: "text-up border-up/40 bg-up/10", Icon: Crown },
  "later official": { cls: "text-accent border-accent/40 bg-accent/10", Icon: BadgeCheck },
  "migration":      { cls: "text-accent border-accent/40 bg-accent/10", Icon: GitBranch },
  "revival":        { cls: "text-gold border-gold/40 bg-gold/10", Icon: BadgeCheck },
  "CTO":            { cls: "text-gold border-gold/40 bg-gold/10", Icon: Users },
  "community fork": { cls: "text-gold border-gold/40 bg-gold/10", Icon: GitBranch },
  "early clone":    { cls: "text-gold border-gold/40 bg-gold/10", Icon: Copy },
  "fake revival":   { cls: "text-down border-down/40 bg-down/10", Icon: Skull, danger: true },
  "exploit copy":   { cls: "text-down border-down/40 bg-down/10", Icon: Skull, danger: true },
};

function safety(sc?: TokenForensicScores) {
  const risk = sc?.riskScore ?? 0;
  if (risk >= 65) return { label: "Dangerous", cls: "text-down border-down/40 bg-down/10", Icon: ShieldAlert };
  if (risk >= 40) return { label: "Caution", cls: "text-gold border-gold/40 bg-gold/10", Icon: AlertTriangle };
  return { label: "Safe", cls: "text-up border-up/40 bg-up/10", Icon: ShieldCheck };
}

function ScoreRing({ score }: { score: number }) {
  const c = score >= 70 ? "#14F195" : score >= 45 ? "#FFC53D" : "#FF4D6D";
  return (
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${c} ${score * 3.6}deg, rgba(255,255,255,0.08) 0)` }}>
      <div className="grid h-8 w-8 place-items-center rounded-full bg-bg"><span className="text-[12px] font-black" style={{ color: c }}>{score}</span></div>
    </div>
  );
}

function Node({ node, report }: { node: TokenLineageNode; report: ForensicOgReport }) {
  const t = node.token;
  const sc = report.tokenScores[t.id];
  const rel = REL[node.relationship] || REL["early clone"];
  const sf = safety(sc);
  const liq = tokenEffectiveLiquidityUsd(t);
  const isOg = node.relationship === "TRUE OG" || (report.og && report.og.id === t.id);
  return (
    <Link to={`/token/${t.id}`}
      className={`group flex items-center gap-3 rounded-2xl border p-3.5 transition hover:border-accent/50 ${isOg ? "border-up/40 bg-up/[0.05]" : rel.danger ? "border-down/25 bg-down/[0.03]" : "border-line bg-panel2/60"}`}>
      <ScoreRing score={Math.round(node.score ?? sc?.trueOgProbability ?? 0)} />
      {t.icon ? <img src={t.icon} alt="" className="h-9 w-9 rounded-full object-cover" onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")} />
               : <div className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-[11px] font-bold text-muted">{(t.symbol || "?").slice(0, 3)}</div>}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-[15px] font-bold text-white">{t.name || t.symbol}</span>
          <span className="text-[12px] text-muted">${t.symbol}</span>
          {isOg && <Crown className="h-3.5 w-3.5 text-up" />}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-muted">
          <span className="flex items-center gap-1"><Droplets className="h-3 w-3" />{liq ? fmtUsd(liq) : "—"}</span>
          <span>MC {t.mcap != null ? fmtUsd(t.mcap) : t.fdv != null ? fmtUsd(t.fdv) : "—"}</span>
          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{t.holderCount != null ? fmtNum(t.holderCount) : "—"}</span>
          <span className="font-mono text-muted/70">{shortAddr(t.id, 4)}</span>
        </div>
        {sc?.warnings?.length ? <div className="mt-1 truncate text-[11px] text-down/80">⚠ {sc.warnings[0]}</div> : null}
      </div>
      <div className="hidden flex-col items-end gap-1 sm:flex">
        <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold ${rel.cls}`}><rel.Icon className="h-3 w-3" />{node.relationship}</span>
        <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold ${sf.cls}`}><sf.Icon className="h-3 w-3" />{sf.label}</span>
      </div>
      <ExternalLink className="h-4 w-4 shrink-0 text-muted opacity-0 transition group-hover:opacity-100" />
    </Link>
  );
}

function Chip({ n, label, tone }: { n: number; label: string; tone: string }) {
  return <div className="rounded-xl border border-line bg-panel2/60 px-3 py-2 text-center"><div className={`text-lg font-black ${tone}`}>{n}</div><div className="text-[10px] uppercase tracking-wider text-muted">{label}</div></div>;
}

export default function OgScanner() {
  const [q, setQ] = useState("");
  const [report, setReport] = useState<ForensicOgReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<any>(null);
  const seq = useRef(0);

  const run = (query: string) => {
    const v = query.trim();
    if (v.length < 2) { setReport(null); setError(""); return; }
    const id = ++seq.current;
    setLoading(true); setError("");
    forensicOgAttribution(v)
      .then((r) => { if (id === seq.current) { setReport(r); setLoading(false); } })
      .catch(() => { if (id === seq.current) { setError("Scan failed. Try again."); setLoading(false); } });
  };

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length >= 2) timer.current = setTimeout(() => run(q), 450);
    else setReport(null);
    return () => clearTimeout(timer.current);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build the ordered lineage: familyTree if present, else candidates with synthetic relationship.
  const nodes: TokenLineageNode[] = report
    ? (report.familyTree?.length
        ? report.familyTree
        : report.candidates.map((t: JupTokenInfo): TokenLineageNode => {
            const sc = report.tokenScores[t.id];
            const isOg = report.og?.id === t.id;
            return { token: t, relationship: isOg ? "TRUE OG" : (sc?.cloneScore ?? 0) >= 60 ? "early clone" : "later official", score: sc?.trueOgProbability ?? 0 };
          }))
    : [];

  return (
    <div className="mx-auto max-w-[980px] space-y-4 px-4 py-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl border border-accent/20 bg-glass p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent2 shadow-glow-blue"><Crosshair className="h-6 w-6 text-white" strokeWidth={2.2} /></div>
          <div>
            <div className="flex items-center gap-2"><h1 className="font-display text-xl font-black text-white">OG Scanner</h1><span className="rounded-full border border-accent/40 bg-accent/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-accent">Forensic</span></div>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-muted">Forensic origin attribution. Search the chain, find the real OG, expose every clone and flag the dangerous ones. Click any token to view its full page.</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-2xl border border-accent/25 bg-bg/70 p-2 backdrop-blur focus-within:border-accent/60">
        <Search className="ml-2 h-5 w-5 shrink-0 text-accent" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="$BONK · WIF · paste a contract address"
          className="min-w-0 flex-1 bg-transparent px-1 font-mono text-sm tracking-wide text-white outline-none placeholder:text-muted/50" />
        {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" />}
      </div>

      {error && <div className="rounded-xl border border-down/30 bg-down/10 px-4 py-3 text-sm text-down">{error}</div>}

      {report && !loading && (
        <>
          {/* OG verdict */}
          {report.og ? (
            <div className="flex items-center gap-3 rounded-2xl border border-up/30 bg-up/[0.06] p-4">
              <Crown className="h-5 w-5 shrink-0 text-up" />
              <div className="min-w-0 text-sm text-white">
                Real OG: <span className="font-bold">{report.og.name || report.og.symbol}</span> <span className="text-muted">${report.og.symbol}</span>
                <span className="ml-1 font-mono text-[11px] text-muted">{shortAddr(report.og.id, 4)}</span>
              </div>
              <Link to={`/token/${report.og.id}`} className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-xl bg-up/15 px-3 py-1.5 text-[12px] font-bold text-up">View token <ExternalLink className="h-3.5 w-3.5" /></Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-gold/30 bg-gold/[0.06] p-4 text-sm text-gold">No clear OG found — all candidates look contested or low-trust. Treat with caution.</div>
          )}

          {/* Summary */}
          <div className="grid grid-cols-4 gap-2">
            <Chip n={report.summary.candidateCount} label="Candidates" tone="text-white" />
            <Chip n={report.summary.cloneCount} label="Clones" tone="text-gold" />
            <Chip n={report.summary.highRiskCount} label="Dangerous" tone="text-down" />
            <Chip n={report.summary.migrationCount} label="Migrations" tone="text-accent" />
          </div>

          {/* Lineage */}
          <div className="space-y-2">
            <div className="px-1 text-[11px] font-bold uppercase tracking-widest text-muted">Lineage · {nodes.length} tokens</div>
            {nodes.map((n) => <Node key={n.token.id} node={n} report={report} />)}
          </div>
        </>
      )}

      {q.trim().length < 2 && (
        <div className="rounded-xl border border-line bg-panel2/40 p-8 text-center text-sm text-muted">Type a token name, symbol or contract address to run a forensic scan.</div>
      )}
    </div>
  );
}
