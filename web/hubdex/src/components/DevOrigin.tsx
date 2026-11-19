import { Forensics, fmtUsd, compact, short } from "../lib/api";
import { timeAgo } from "../lib/format";
import WalletLink from "./WalletLink";
import { Wallet, Crown, BadgeCheck, ShieldCheck, ShieldAlert, ExternalLink, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

function Solscan({ kind, id, label }: { kind: "account" | "tx" | "token"; id: string; label?: string }) {
  return <a href={`https://solscan.io/${kind === "tx" ? "tx" : kind === "token" ? "token" : "account"}/${id}`} target="_blank" rel="noreferrer" className="text-[11px] text-accent/80 hover:text-accent inline-flex items-center gap-1">{label || "Solscan"} <ExternalLink className="w-3 h-3" /></a>;
}
const KIND_LABEL: Record<string, string> = { first_buy: "First market buy", first_transfer: "First transfer", creator_launch: "Creator launch buy" };

function YesNo({ v, goodWhen = true, yes = "Yes", no = "No" }: { v: boolean | null | undefined; goodWhen?: boolean; yes?: string; no?: string }) {
  if (v == null) return <span className="text-muted">—</span>;
  const good = v === goodWhen;
  return <span className={`inline-flex items-center gap-1 font-medium ${good ? "text-up" : "text-down"}`}>{good ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}{v ? yes : no}</span>;
}
function Row({ label, children }: { label: string; children: any }) {
  return <div className="flex items-center justify-between gap-3 py-2 border-b border-line/40 last:border-0 text-sm"><span className="text-muted shrink-0">{label}</span><span className="text-right min-w-0">{children}</span></div>;
}

export default function DevOrigin({ f, loading }: { f: Forensics | null; loading: boolean }) {
  if (loading) return <div className="card p-10 grid place-items-center text-muted"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  if (!f || !f.ok) return <div className="card p-8 text-center text-muted text-sm">Origin data unavailable for this token.</div>;
  const fb = f.firstBuyer;
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      {/* Dev / creator */}
      <div className="card p-5">
        <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Wallet className="w-4 h-4 text-accent" /> Developer / Creator</div>
        {f.dev ? (
          <>
            <Row label="Dev wallet">{f.dev.wallet ? <span className="inline-flex items-center gap-2"><WalletLink address={f.dev.wallet} /><Solscan kind="account" id={f.dev.wallet} /></span> : "—"}</Row>
            <Row label="Dev still holds">
              {f.dev.holding?.pct != null
                ? <span className={f.dev.sold ? "text-down font-medium" : "text-up font-medium"}>{f.dev.sold ? "Sold / exited" : `${f.dev.holding.pct.toFixed(2)}% held`}</span>
                : <span className="text-muted">Unknown</span>}
            </Row>
            {f.dev.rank != null && <Row label="Dev holder rank">#{f.dev.rank}</Row>}
            <Row label="Tokens created by dev">{f.dev.tokensCreated != null ? f.dev.tokensCreated : "—"}</Row>
            <Row label="Serial deployer"><YesNo v={f.dev.serial} goodWhen={false} /></Row>
          </>
        ) : <div className="text-muted text-sm">Creator wallet not available.</div>}
      </div>

      {/* First buyer + dex paid */}
      <div className="card p-5">
        <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Crown className="w-4 h-4 text-accent" /> Origin & Listing</div>
        <div className="mb-3">
          <div className="text-muted text-sm mb-1.5">First buyer</div>
          {fb?.traced && fb.wallet ? (
            <div className="rounded-lg bg-panel2 p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <WalletLink address={fb.wallet} />
                {fb.isDev && <span className="pill bg-yellow-400/15 text-yellow-300 text-[9px] inline-flex items-center gap-1"><BadgeCheck className="w-3 h-3" /> Dev</span>}
                {fb.kind && <span className="pill bg-accent/10 text-accent text-[9px]">{KIND_LABEL[fb.kind] || fb.kind}</span>}
              </div>
              {(fb.tokenAmount || fb.solSpent || fb.usd || fb.time) && (
                <div className="text-xs text-muted flex flex-wrap gap-x-3 gap-y-0.5">
                  {fb.tokenAmount ? <span>Bought <span className="text-white">{compact(fb.tokenAmount)}</span> tokens</span> : null}
                  {fb.solSpent ? <span>for <span className="text-white">{fb.solSpent.toFixed(3)} SOL</span></span> : null}
                  {fb.usd ? <span>(<span className="text-white">{fmtUsd(fb.usd, { compact: true })}</span>)</span> : null}
                  {fb.time ? <span>{timeAgo(fb.time)} ago</span> : null}
                </div>
              )}
              {fb.approximate && fb.note && <div className="text-[11px] text-muted/80">{fb.note}</div>}
              <div className="flex items-center gap-3 flex-wrap pt-0.5">
                <Solscan kind="account" id={fb.wallet} label="Wallet on Solscan" />
                {fb.txHash && <Solscan kind="tx" id={fb.txHash} label="View transaction" />}
              </div>
            </div>
          ) : <div className="text-xs text-muted">{fb?.note || "Not traced."}</div>}
        </div>
        <Row label="DexScreener paid">
          {f.dexPaid?.paid
            ? <span className="inline-flex items-center gap-1 text-up font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Paid {((f.dexPaid?.services) || []).filter((s:any) => s.status === "approved").map((s:any) => s.type).slice(0,3).join(", ")}</span>
            : <span className="inline-flex items-center gap-1 text-muted"><XCircle className="w-3.5 h-3.5" /> Not paid</span>}
        </Row>
        <Row label="Launchpad">{(f.launchpad && typeof f.launchpad === "object" ? (f.launchpad as any).name : f.launchpad) || "—"}</Row>
        <Row label="Top 10 holders">{f.concentration?.top10Pct != null ? <span className={f.concentration.top10Pct < 25 ? "text-up" : f.concentration.top10Pct < 40 ? "text-yellow-300" : "text-down"}>{f.concentration.top10Pct.toFixed(1)}%</span> : "—"}</Row>
        <Row label="Whales (≥1%)">{f.concentration?.whales ?? "—"}</Row>
        <Row label="Rugged"><YesNo v={f.safetyFlags?.rugged} goodWhen={false} /></Row>
      </div>
    </div>
  );
}
