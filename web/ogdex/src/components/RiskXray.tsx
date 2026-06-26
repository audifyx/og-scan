import { XrayReport, short } from "../lib/api";
import WalletLink from "./WalletLink";
import { ShieldCheck, ShieldAlert, ShieldX, Crosshair, Boxes, Users, Wallet, ExternalLink, Loader2, CheckCircle2, XCircle, AlertTriangle, Target, Network, Share2 } from "lucide-react";
import BubbleMap from "./BubbleMap";

function Solscan({ kind, id, label }: { kind: "account" | "tx" | "token"; id: string; label?: string }) {
  return <a href={`https://solscan.io/${kind}/${id}`} target="_blank" rel="noreferrer" className="text-[11px] text-accent/80 hover:text-accent inline-flex items-center gap-1">{label || "Solscan"} <ExternalLink className="w-3 h-3" /></a>;
}

const TONE = {
  red: { ring: "ring-down/40", bg: "bg-down/10", text: "text-down", Icon: ShieldX },
  yellow: { ring: "ring-yellow-400/40", bg: "bg-yellow-400/10", text: "text-yellow-300", Icon: ShieldAlert },
  green: { ring: "ring-up/40", bg: "bg-up/10", text: "text-up", Icon: ShieldCheck },
};

function FlagIcon({ level }: { level: "red" | "yellow" | "green" }) {
  if (level === "red") return <XCircle className="w-4 h-4 text-down shrink-0" />;
  if (level === "yellow") return <AlertTriangle className="w-4 h-4 text-yellow-300 shrink-0" />;
  return <CheckCircle2 className="w-4 h-4 text-up shrink-0" />;
}

function Stat({ icon, label, value, tone }: { icon: any; label: string; value: any; tone?: string }) {
  return (
    <div className="rounded-lg bg-panel2 p-3">
      <div className="text-[11px] text-muted flex items-center gap-1.5 mb-1">{icon}{label}</div>
      <div className={`text-lg font-bold tabular-nums ${tone || ""}`}>{value}</div>
    </div>
  );
}

function pctTone(p: number | null, warn = 30, bad = 60) {
  if (p == null) return "";
  return p >= bad ? "text-down" : p >= warn ? "text-yellow-300" : "text-up";
}

export default function RiskXray({ x, loading }: { x: XrayReport | null; loading: boolean }) {
  if (loading) return <div className="card p-10 grid place-items-center text-muted"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  if (!x || !x.ok) return <div className="card p-8 text-center text-muted text-sm">Risk X-ray unavailable</div>;

  return (
    <div className="space-y-4">
      {/* Verdict banner */}
      <div className={`card p-5 ring-1 ${t.ring} ${t.bg}`}>
        <div className="flex items-center gap-3">
          <t.Icon className={`w-9 h-9 ${t.text} shrink-0`} />
          <div className="min-w-0">
            <div className={`text-xl font-extrabold ${t.text}`}>{x.verdict}</div>
            <div className="text-sm text-muted">{x.summary}</div>
          </div>
        </div>
        {x.note && <div className="text-[11px] text-muted/80 mt-3 flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{x.note}</div>}
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat icon={<Crosshair className="w-3.5 h-3.5" />} label="Snipers" value={x.snipers.pct != null ? `${x.snipers.pct}%` : "—"} tone={pctTone(x.snipers.pct)} />
        <Stat icon={<Boxes className="w-3.5 h-3.5" />} label="Bundled" value={x.bundles.pct != null ? `${x.bundles.pct}%` : "—"} tone={pctTone(x.bundles.pct, 1, 30)} />
        <Stat icon={<Share2 className="w-3.5 h-3.5" />} label="Insiders" value={x.insiders?.pct != null ? `${x.insiders.pct}%` : "—"} tone={pctTone(x.insiders?.pct ?? null, 1, 40)} />
        <Stat icon={<Users className="w-3.5 h-3.5" />} label="Top 10 hold" value={x.concentration.top10Pct != null ? `${x.concentration.top10Pct}%` : "—"} tone={pctTone(x.concentration.top10Pct, 30, 50)} />
        <Stat icon={<Wallet className="w-3.5 h-3.5" />} label="Holders" value={x.concentration.totalHolders ?? "—"} />
      </div>

      {/* Flags */}
      {(x.flags?.length ?? 0) > 0 && (
        <div className="card p-5">
          <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Target className="w-4 h-4 text-accent" /> Signals</div>
          <ul className="space-y-2">
            {(x.flags || []).map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm"><FlagIcon level={f.level} /><span className={f.level === "red" ? "text-white" : "text-muted"}>{f.text}</span></li>
            ))}
          </ul>
        </div>
      )}

      {x.traced && (x.earlyBuyers?.length ?? 0) > 0 && <BubbleMap report={x} />}

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Snipers */}
        <div className="card p-5">
          <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Crosshair className="w-4 h-4 text-accent" /> Snipers <span className="text-muted font-normal">— bought at launch or within 20s</span></div>
          {(x.snipers?.wallets?.length ?? 0) ? (
            <div className="space-y-1.5 max-h-80 overflow-auto pr-1">
              {(x.snipers?.wallets || []).map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-panel2 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <WalletLink address={s.wallet} />
                    {s.bundled && <span className="pill bg-down/15 text-down text-[9px]">bundle</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-muted">
                    {s.solSpent ? <span className="text-white tabular-nums">{s.solSpent.toFixed(2)} SOL</span> : null}
                    {s.secondsAfterLaunch != null && <span className="tabular-nums">+{s.secondsAfterLaunch}s</span>}
                    {s.txHash && <Solscan kind="tx" id={s.txHash} label="" />}
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="text-xs text-muted">{x.traced ? "No snipers detected at launch." : "Trace unavailable."}</div>}
        </div>

        {/* Bundles */}
        <div className="card p-5">
          <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Boxes className="w-4 h-4 text-accent" /> Same-block bundles <span className="text-muted font-normal">— ≥3 wallets in one slot</span></div>
          {(x.bundles?.clusters?.length ?? 0) ? (
            <div className="space-y-2 max-h-80 overflow-auto pr-1">
              {(x.bundles?.clusters || []).map((b, i) => (
                <div key={i} className="rounded-lg bg-panel2 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-down">{b.size} wallets bundled</span>
                    <span className="text-[10px] text-muted">slot {b.slot}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {b.wallets.map((w) => (
                      <a key={w} href={`https://solscan.io/account/${w}`} target="_blank" rel="noreferrer" className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-panel text-muted hover:text-accent">{short(w)}</a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="text-xs text-muted">{x.traced ? "No same-block bundles detected." : "Trace unavailable."}</div>}
        </div>
      </div>

      {/* Insider clusters */}
      {x.insiders?.clusters && x.insiders.clusters.length > 0 && (
        <div className="card p-5">
          <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Network className="w-4 h-4 text-accent" /> Insider clusters <span className="text-muted font-normal">— early buyers funded by one wallet</span></div>
          <div className="space-y-2 max-h-80 overflow-auto pr-1">
            {x.insiders.clusters.map((cl, i) => (
              <div key={i} className="rounded-lg bg-panel2 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-down">{cl.size} wallets · shared funder</span>
                  <a href={`https://solscan.io/account/${cl.funder}`} target="_blank" rel="noreferrer" className="text-[10px] text-accent/80 hover:text-accent inline-flex items-center gap-1">{short(cl.funder)} <ExternalLink className="w-3 h-3" /></a>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {cl.wallets.map((w) => (
                    <a key={w} href={`https://solscan.io/account/${w}`} target="_blank" rel="noreferrer" className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-panel text-muted hover:text-accent">{short(w)}</a>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-muted/70">A shared funding wallet can also be a CEX/exchange withdrawal. Treat as a signal, not proof.</div>
        </div>
      )}

      {/* Early buyers */}
      {(x.earlyBuyers?.length ?? 0) > 0 && (
        <div className="card p-5">
          <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-accent" /> Early buyers</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead><tr className="text-muted text-xs border-b border-line/40"><th className="text-left py-1.5">#</th><th className="text-left">Wallet</th><th className="text-right">SOL</th><th className="text-right">When</th><th className="text-right">Tag</th></tr></thead>
              <tbody>
                {(x.earlyBuyers || []).map((b) => (
                  <tr key={b.rank} className="border-b border-line/20 last:border-0">
                    <td className="py-1.5 text-muted tabular-nums">{b.rank}</td>
                    <td><WalletLink address={b.wallet} /></td>
                    <td className="text-right tabular-nums">{b.solSpent ? b.solSpent.toFixed(2) : "—"}</td>
                    <td className="text-right tabular-nums text-muted">{b.secondsAfterLaunch != null ? `+${b.secondsAfterLaunch}s` : "—"}</td>
                    <td className="text-right">
                      {b.sniper && <span className="pill bg-yellow-400/15 text-yellow-300 text-[9px] mr-1">sniper</span>}
                      {b.bundled && <span className="pill bg-down/15 text-down text-[9px] mr-1">bundle</span>}
                      {b.insider && <span className="pill bg-down/15 text-down text-[9px]">insider</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
