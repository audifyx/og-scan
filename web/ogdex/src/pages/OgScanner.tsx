import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Crosshair, Search, Loader2, Crown, Fingerprint, ShieldCheck, ShieldAlert, AlertTriangle, ExternalLink, Users, Droplets, Clock } from "lucide-react";
import { ogScan, type OgCandidate, type OgReport } from "../lib/scan";

const fmt = (n: number | null | undefined, d = 2) =>
  n == null ? "—" : n >= 1e9 ? (n / 1e9).toFixed(d) + "B" : n >= 1e6 ? (n / 1e6).toFixed(d) + "M" : n >= 1e3 ? (n / 1e3).toFixed(d) + "K" : n.toFixed(d);
const price = (n: number | null) => n == null ? "—" : "$" + (n < 0.01 ? n.toExponential(2) : n.toFixed(4));
const age = (d: number | null) => d == null ? "—" : d < 1 ? "<1d" : d < 30 ? d + "d" : d < 365 ? Math.floor(d / 30) + "mo" : (d / 365).toFixed(1) + "y";

const VERDICT: Record<OgCandidate["verdict"], { cls: string; Icon: typeof Crown; label: string }> = {
  OG:         { cls: "text-up border-up/40 bg-up/10",       Icon: Crown,       label: "OG · Original" },
  Clone:      { cls: "text-gold border-gold/40 bg-gold/10", Icon: Fingerprint, label: "Clone / Copycat" },
  Risky:      { cls: "text-down border-down/40 bg-down/10", Icon: ShieldAlert, label: "Risky" },
  Unverified: { cls: "text-muted border-line bg-white/5",   Icon: AlertTriangle, label: "Unverified" },
};

function ScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? "#14F195" : score >= 45 ? "#FFC53D" : "#FF4D6D";
  return (
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${color} ${score * 3.6}deg, rgba(255,255,255,0.08) 0)` }}>
      <div className="grid h-8 w-8 place-items-center rounded-full bg-bg"><span className="text-[12px] font-black" style={{ color }}>{score}</span></div>
    </div>
  );
}

function Card({ t }: { t: OgCandidate }) {
  const v = VERDICT[t.verdict];
  return (
    <Link to={`/token/${t.mint}`}
      className={`group flex items-center gap-3 rounded-2xl border p-3.5 transition hover:border-accent/50 ${t.isOG ? "border-up/40 bg-up/[0.05]" : "border-line bg-panel2/60"}`}>
      <ScoreRing score={t.riskScore} />
      {t.icon ? <img src={t.icon} alt="" className="h-9 w-9 rounded-full object-cover" onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")} /> : <div className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-[11px] font-bold text-muted">{t.symbol.slice(0, 3)}</div>}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-[15px] font-bold text-white">{t.name}</span>
          <span className="text-[12px] text-muted">${t.symbol}</span>
          {t.isOG && <Crown className="h-3.5 w-3.5 text-up" />}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-muted">
          <span>{price(t.price)}</span>
          <span className="flex items-center gap-1"><Droplets className="h-3 w-3" />${fmt(t.liquidity)}</span>
          <span>MC ${fmt(t.mcap)}</span>
          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{t.holderCount != null ? fmt(t.holderCount, 0) : "—"}</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{age(t.ageDays)}</span>
          {t.launchpad && <span className="text-muted/70">{t.launchpad}</span>}
        </div>
      </div>
      <span className={`hidden shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[10.5px] font-bold sm:inline-flex ${v.cls}`}>
        <v.Icon className="h-3 w-3" />{v.label}
      </span>
      <ExternalLink className="h-4 w-4 shrink-0 text-muted opacity-0 transition group-hover:opacity-100" />
    </Link>
  );
}

export default function OgScanner() {
  const [q, setQ] = useState("");
  const [report, setReport] = useState<OgReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<any>(null);

  const run = (query: string) => {
    const v = query.trim();
    if (v.length < 2) { setReport(null); setError(""); return; }
    setLoading(true); setError("");
    ogScan(v)
      .then((r) => { setReport(r); setLoading(false); })
      .catch(() => { setError("Scan failed. Try again."); setLoading(false); });
  };

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length >= 2) timer.current = setTimeout(() => run(q), 350);
    else setReport(null);
    return () => clearTimeout(timer.current);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-[960px] space-y-4 px-4 py-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl border border-accent/20 bg-glass p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent2 shadow-glow-blue">
            <Crosshair className="h-6 w-6 text-white" strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl font-black text-white">OG Scanner</h1>
              <span className="rounded-full border border-accent/40 bg-accent/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-accent">Forensic</span>
            </div>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-muted">Forensic origin attribution for any token. Search the chain, verify the OG, expose clones, audit liquidity, holders &amp; risk.</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-2xl border border-accent/25 bg-bg/70 p-2 backdrop-blur focus-within:border-accent/60">
        <Search className="ml-2 h-5 w-5 shrink-0 text-accent" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="$BONK · WIF · paste a contract address"
          className="min-w-0 flex-1 bg-transparent px-1 font-mono text-sm tracking-wide text-white outline-none placeholder:text-muted/50"
        />
        {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" />}
        <span className="hidden pr-2 text-[10px] uppercase tracking-widest text-muted sm:inline">
          {report ? `${report.candidates.length} hits` : "ready"}
        </span>
      </div>

      {error && <div className="rounded-xl border border-down/30 bg-down/10 px-4 py-3 text-sm text-down">{error}</div>}

      {/* OG verdict banner */}
      {report?.og && (
        <div className="flex items-center gap-3 rounded-2xl border border-up/30 bg-up/[0.06] p-4">
          <ShieldCheck className="h-5 w-5 shrink-0 text-up" />
          <div className="text-sm text-white">
            OG identified: <span className="font-bold">{report.og.name}</span> <span className="text-muted">${report.og.symbol}</span>
            {report.candidates.filter((c) => c.verdict === "Clone").length > 0 &&
              <span className="text-muted"> · {report.candidates.filter((c) => c.verdict === "Clone").length} clone(s) flagged</span>}
          </div>
        </div>
      )}

      {/* Results */}
      <div className="space-y-2">
        {report?.candidates.map((t) => <Card key={t.mint} t={t} />)}
      </div>

      {!loading && q.trim().length >= 2 && report && report.candidates.length === 0 && (
        <div className="rounded-xl border border-line bg-panel2/60 p-8 text-center text-sm text-muted">No tokens found for “{q}”.</div>
      )}
      {q.trim().length < 2 && (
        <div className="rounded-xl border border-line bg-panel2/40 p-8 text-center text-sm text-muted">
          Type a token name, symbol or contract address to scan the chain.
        </div>
      )}
    </div>
  );
}
