import { Link } from "react-router-dom";
import { LucideIcon, Copy, Check, RefreshCw, Loader2 } from "lucide-react";
import { useState } from "react";
import { PLATFORM_PAY_WALLET } from "../lib/constants";

/* ── Command deck hero ── */
export function CommandHero({
  kicker,
  title,
  sub,
  icon: Icon,
  children,
  actions,
}: {
  kicker?: string;
  title: string;
  sub?: string;
  icon?: LucideIcon;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--ox-silver-dim)] bg-gradient-to-br from-[#0c0c0c] via-[#080808] to-[#050505] p-5 sm:p-6 mb-5">
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[var(--ox-blue)]/10 blur-[80px]" />
      <div className="pointer-events-none absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-[var(--ox-gold)]/8 blur-[60px]" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {kicker && (
            <div className="term-label mb-2 text-[var(--ox-gold-hi)]">{kicker}</div>
          )}
          <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
            {Icon && <Icon className="h-7 w-7 text-[var(--ox-gold-hi)] shrink-0" strokeWidth={2.2} />}
            {title}
          </h1>
          {sub && <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-white/70 font-medium">{sub}</p>}
          {children}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

/* ── Stat tile grid ── */
export function StatDeck({ items }: { items: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "up" | "down" | "gold" | "blue" | "plain" }[] }) {
  const toneCls = (t?: string) =>
    t === "up" ? "text-up" : t === "down" ? "text-down" : t === "gold" ? "text-[var(--ox-gold-hi)]" : t === "blue" ? "text-[var(--ox-blue-hi)]" : "text-white";
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 mb-4">
      {items.map((s) => (
        <div key={s.label} className="rounded-xl border border-line bg-panel/80 px-3 py-2.5 backdrop-blur-sm">
          <div className="term-label mb-0.5 truncate">{s.label}</div>
          <div className={`term text-lg font-bold tabular leading-none ${toneCls(s.tone)}`}>{s.value}</div>
          {s.sub != null && <div className="term text-[9px] text-white/45 mt-1 truncate">{s.sub}</div>}
        </div>
      ))}
    </div>
  );
}

/* ── Segmented control ── */
export function SegTabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="dex-tab-segment-wrap inline-flex flex-wrap gap-0.5">
      {tabs.map((t) => (
        <button key={t.id} type="button" onClick={() => onChange(t.id)} className={`dex-tab-segment ${value === t.id ? "dex-tab-segment--on" : ""}`}>
          {t.label}
          {t.count != null && t.count > 0 && <span className="ml-1 opacity-60">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ── Quick tool links grid ── */
export function QuickToolGrid({ links }: { links: { to: string; label: string; desc: string; Icon: LucideIcon }[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-4">
      {links.map(({ to, label, desc, Icon }) => (
        <Link key={to} to={to} className="group flex items-center gap-3 rounded-xl border border-line bg-panel/60 p-3 transition hover:border-[var(--ox-gold)]/40 hover:bg-[var(--ox-gold)]/[0.04]">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--ox-blue)]/10 text-[var(--ox-blue-hi)] group-hover:bg-[var(--ox-blue)]/20">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-white truncate">{label}</div>
            <div className="text-[10px] text-muted truncate">{desc}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

/* ── Live refresh button ── */
export function LiveRefresh({ onClick, loading, label = "Refresh" }: { onClick: () => void; loading?: boolean; label?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={loading} className="dex-btn dex-btn--ghost !py-2 !text-xs inline-flex items-center gap-1.5">
      <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> {label}
    </button>
  );
}

/* ── Payment wallet bar (store / checkout) ── */
export function PayWalletBar({ wallet = PLATFORM_PAY_WALLET }: { wallet?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(wallet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="rounded-xl border border-[var(--ox-gold)]/30 bg-[var(--ox-gold)]/[0.06] p-4 mb-5">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--ox-gold-hi)] mb-2">Official payment wallet (SOL / USDC / USDT)</div>
      <div className="flex flex-wrap items-center gap-2">
        <code className="flex-1 min-w-0 break-all font-mono text-[12px] text-white/90">{wallet}</code>
        <button type="button" onClick={copy} className="dex-btn dex-btn--blue !py-1.5 !text-xs inline-flex items-center gap-1 shrink-0">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-muted">Send payment here, then submit your transaction hash on the listing or boost form. We verify on-chain.</p>
    </div>
  );
}

/* ── Empty / loading states ── */
export function DeckLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="term-panel grid place-items-center py-20 text-muted min-h-[200px]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
        <span className="term text-[11px] text-faint">{label}</span>
      </div>
    </div>
  );
}

export function ViewToggle({ mode, onChange }: { mode: "grid" | "list"; onChange: (m: "grid" | "list") => void }) {
  return (
    <div className="dex-tab-segment-wrap !inline-flex">
      <button type="button" onClick={() => onChange("grid")} className={`dex-tab-segment text-[11px] ${mode === "grid" ? "dex-tab-segment--on" : ""}`}>Grid</button>
      <button type="button" onClick={() => onChange("list")} className={`dex-tab-segment text-[11px] ${mode === "list" ? "dex-tab-segment--on" : ""}`}>List</button>
    </div>
  );
}
