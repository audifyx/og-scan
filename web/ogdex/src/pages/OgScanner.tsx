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

// Phase 8 — data-backed "why is this OG" evidence, derived from forensic scores.
const EVIDENCE: { key: keyof TokenForensicScores; label: string; good: string; weak: string }[] = [
  { key: "earliestMintBonusScore", label: "Original deployment",    good: "Earliest mint of this name on-chain",       weak: "A different mint predates this one" },
  { key: "firstTransactionScore",  label: "Historical tx evidence", good: "Earliest first on-chain transaction",        weak: "Later first activity than rivals" },
  { key: "earliestLiquidityScore", label: "First liquidity",        good: "First to seed real liquidity",               weak: "Liquidity seeded after competitors" },
  { key: "deployerTrustScore",     label: "Deployer evidence",      good: "Deployed by an authentic, trusted wallet",  weak: "Deployer authenticity is weak" },
  { key: "antiCloneConfidence",    label: "Earlier than copycats",  good: "Predates the detected clones",               weak: "Clone timeline is contested" },
  { key: "metadataStability",      label: "Metadata evidence",      good: "Original, stable metadata",                 weak: "Metadata changed or copied" },
  { key: "holderDistributionScore",label: "Wallet / holder evidence", good: "Healthy original holder base",             weak: "Concentrated or fresh-wallet holders" },
  { key: "dominanceScore",         label: "Dominance",              good: "Primary token by market dominance",         weak: "Not the dominant token in its cluster" },
];

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
  const c = score >= 70 ? "#00FFA3" : score >= 45 ? "#FFC53D" : "#FF5C5C";
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
      className={`group flex items-center gap-3 rounded-lg border p-3.5 transition hover:border-accent/50 ${isOg ? "border-up/40 bg-up/[0.05]" : rel.danger ? "border-down/25 bg-down/[0.03]" : "border-line bg-panel"}`}
      style={{ borderLeftWidth: 3, borderLeftColor: isOg ? "#00FFA3" : rel.danger ? "#FF5C5C" : "#1C2320" }}>
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
  return <div className="card px-3 py-2 text-center"><div className={`term text-lg font-black tabular ${tone}`}>{n}</div><div className="term-label mt-0.5">{label}</div></div>;
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
      <div className="term-panel bg-term-grid px-4 sm:px-5 py-4">
        <div className="term text-[11px]" style={{ color: "#66707E" }}>
          <span style={{ color: "#00FFA3" }}>orbitx@dex</span><span>:~$</span> ogscan --forensic --lineage --expose-clones
        </div>
        <div className="flex flex-wrap items-end gap-3 mt-1.5">
          <h1 className="font-display text-2xl font-black text-white flex items-center gap-2"><Crosshair className="h-5 w-5 text-accent" strokeWidth={2.2} /> OG_SCANNER</h1>
          <span className="rounded-md border border-accent/40 bg-accent/15 px-2 py-0.5 text-[9px] term font-black uppercase tracking-widest text-accent mb-1">FORENSIC MODE</span>
        </div>
        <p className="term text-[11px] leading-relaxed text-muted mt-1 max-w-lg">trace token lineage → identify the TRUE OG → expose clones, fake revivals and exploit copies. click any node for the full token page.</p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-lg border border-line bg-panel p-2 focus-within:border-accent/60 focus-within:shadow-glow-term">
        <span className="term text-xs pl-2 shrink-0 select-none text-accent">$ ogscan</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="$BONK · WIF · contract address…"
          className="min-w-0 flex-1 bg-transparent px-1 font-mono text-sm tracking-wide text-white outline-none placeholder:text-muted/50" style={{ caretColor: "#00FFA3" }} />
        {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent mr-2" /> : <Search className="h-4 w-4 shrink-0 text-faint mr-2" />}
      </div>

      {error && <div className="rounded-xl border border-down/30 bg-down/10 px-4 py-3 text-sm text-down">{error}</div>}

      {report && !loading && (
        <>
          {/* OG verdict */}
          {report.og ? (
            <div className="flex items-center gap-3 rounded-lg border border-up/30 bg-up/[0.06] p-4">
              <span className="term text-[11px] font-black text-up shrink-0">[OG✓]</span>
              <Crown className="h-5 w-5 shrink-0 text-up" />
              <div className="min-w-0 text-sm text-white term">
                TRUE_OG = <span className="font-bold">{report.og.name || report.og.symbol}</span> <span className="text-muted">${report.og.symbol}</span>
                <span className="ml-1 font-mono text-[11px] text-faint">{shortAddr(report.og.id, 4)}</span>
              </div>
              <Link to={`/token/${report.og.id}`} className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md bg-up/15 px-3 py-1.5 text-[12px] term font-bold text-up">OPEN <ExternalLink className="h-3.5 w-3.5" /></Link>
            </div>
          ) : (
            <div className="rounded-lg border border-gold/30 bg-gold/[0.06] p-4 text-sm text-gold term"><span className="font-black">[WARN]</span> no clear OG found — all candidates contested or low-trust. proceed with caution.</div>
          )}

          {/* OG Explanation — Phase 8: why is this the OG? */}
          {report.og && report.tokenScores[report.og.id] && (() => {
            const sc = report.tokenScores[report.og.id];
            return (
              <div className="rounded-lg border border-up/25 bg-up/[0.04] p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-up shrink-0" />
                  <h2 className="font-display text-sm font-black text-white">WHY IS THIS THE OG?</h2>
                  <span className="ml-auto term text-[11px] text-muted">TRUE_OG probability <span className="font-black text-up">{Math.round(sc.trueOgProbability ?? 0)}%</span></span>
                </div>
                <p className="term text-[11px] text-muted">Every claim below is derived from on-chain forensic scoring of {report.og.name || report.og.symbol}. Higher scores = stronger, data-backed originality evidence.</p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {EVIDENCE.map((e) => {
                    const v = Math.round(Number(sc[e.key] ?? 0));
                    const ok = v >= 60;
                    return (
                      <div key={e.key} className={`flex items-start gap-2 rounded-lg border p-2.5 ${ok ? "border-up/25 bg-up/[0.04]" : "border-gold/25 bg-gold/[0.04]"}`}>
                        {ok ? <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-up" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[12px] font-bold text-white">{e.label}</span>
                            <span className={`term text-[11px] font-black ${ok ? "text-up" : "text-gold"}`}>{v}</span>
                          </div>
                          <div className="text-[11px] text-muted">{ok ? e.good : e.weak}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Summary */}
          <div className="grid grid-cols-4 gap-2">
            <Chip n={report.summary.candidateCount} label="Candidates" tone="text-white" />
            <Chip n={report.summary.cloneCount} label="Clones" tone="text-gold" />
            <Chip n={report.summary.highRiskCount} label="Dangerous" tone="text-down" />
            <Chip n={report.summary.migrationCount} label="Migrations" tone="text-accent" />
          </div>

          {/* Lineage */}
          <div className="space-y-2">
            <div className="px-1 term-label term-prompt">LINEAGE_TREE · {nodes.length} NODES</div>
            {nodes.map((n) => <Node key={n.token.id} node={n} report={report} />)}
          </div>
        </>
      )}

      {q.trim().length < 2 && (
        <div className="term-panel p-8 text-sm text-muted term" style={{ minHeight: 260 }}>
          <div className="text-center"><span className="text-accent">$</span> awaiting input — type a token name, symbol or contract address<span className="term-cursor" /></div>
          <div className="mt-6 max-w-md mx-auto space-y-1.5 text-[11px]">
            <div className="term-label mb-2 text-center">EXAMPLE_QUERIES</div>
            {["$BONK — find the original BONK among clones", "WIF — trace dogwifhat lineage", "paste any CA — full forensic attribution"].map((ex) => (
              <div key={ex} className="flex items-start gap-2"><span className="text-accent shrink-0">›</span><span className="text-faint">{ex}</span></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
