import { useEffect, useState, useCallback, useRef } from "react";
import {
  Copy,
  RefreshCw,
  ExternalLink,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  AlertTriangle,
  Ban,
  Loader2,
} from "lucide-react";
import { authedFetch } from "@/components/agentos/api";
import { cn } from "@/lib/utils";

interface Follow {
  followId: string;
  wallet: string;
  label: string | null;
  mode: string;
  sizeValue: number;
  maxPerTradeUsd: number;
  createdAt: string | null;
}
interface TheirTrade {
  signature: string | null;
  side: string;
  mint: string;
  symbol: string;
  amount: number;
  theirUsd: number;
  priceUsd: number;
  at: string | null;
  followLabel: string | null;
}
interface OurFill {
  side: string;
  mint: string;
  symbol: string;
  usd: number;
  priceUsd: number;
  theirUsd: number;
  theirSig: string | null;
  sig: string | null;
  ok: boolean;
  pending: boolean;
  skipped: boolean;
  error: string | null;
  message: string | null;
  at: string | null;
}
interface TokenStat {
  mint: string;
  symbol: string;
  buys: number;
  sells: number;
  realizedPnl: number;
  wins: number;
  losses: number;
  openAmount: number;
  openValueUsd: number;
  unrealizedPnl: number;
}
interface Stats {
  perToken: TokenStat[];
  totalRealized: number;
  totalUnrealized: number;
  winRate: number;
  totalBuys: number;
  totalSells: number;
  wins: number;
  losses: number;
  openPositions: number;
}
interface DashData {
  follows: Follow[];
  theirTrades: TheirTrade[];
  ourFills: OurFill[];
  stats: Stats;
}

const POLL_MS = 10_000;

const fmtUsd = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(n)) return "—";
  const a = Math.abs(n);
  const s = n < 0 ? "-" : "";
  if (a >= 1_000_000) return `${s}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1_000) return `${s}$${(a / 1e3).toFixed(2)}K`;
  if (a >= 1) return `${s}$${a.toFixed(2)}`;
  return `${s}$${a.toFixed(a < 0.0001 ? 8 : a < 0.01 ? 6 : 4)}`;
};
const fmtNum = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return `${Math.round(n)}`;
};
const trunc = (s: string) => (s.length > 12 ? `${s.slice(0, 4)}…${s.slice(-4)}` : s);
const fmtTime = (at: string | null) => {
  if (!at) return "—";
  const t = new Date(at).getTime();
  if (!Number.isFinite(t)) return "—";
  const d = Date.now() - t;
  if (d < 60_000) return "just now";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return new Date(t).toLocaleDateString();
};
const txUrl = (sig: string | null) => (sig ? `https://solscan.io/tx/${sig}` : null);
const modeLabel = (f: Follow) => {
  if (f.mode === "percent_of_their_size") return `${f.sizeValue}% of his size`;
  if (f.mode === "fixed_usd") return `$${f.sizeValue} fixed per trade`;
  if (f.mode === "mirror_ratio") return `${f.sizeValue}× his size`;
  return f.mode;
};

function SideBadge({ side }: { side: string }) {
  const buy = side === "buy";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black uppercase tracking-wide",
        buy ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300",
      )}
    >
      {buy ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {side}
    </span>
  );
}

function FillStatus({ f }: { f: OurFill }) {
  if (f.ok && !f.pending)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-black text-emerald-300">
        <Check className="h-3 w-3" /> mirrored
      </span>
    );
  if (f.pending)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-black text-amber-300">
        <Loader2 className="h-3 w-3 animate-spin" /> pending
      </span>
    );
  if (f.skipped)
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-black text-white/50"
        title={f.message || f.error || ""}
      >
        <Ban className="h-3 w-3" /> skipped{f.error ? ` · ${f.error}` : ""}
      </span>
    );
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-black text-rose-300"
      title={f.message || ""}
    >
      <AlertTriangle className="h-3 w-3" /> failed{f.error ? ` · ${f.error}` : ""}
    </span>
  );
}

function Section({
  title,
  sub,
  right,
  children,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03]">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div>
          <h2 className="text-[15px] font-black text-white">{title}</h2>
          {sub && <p className="text-[12px] text-white/40">{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export default function CopyTrading() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const mounted = useRef(true);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError("");
    try {
      const res = await authedFetch("/api/orbitx/copy-dashboard", { cache: "no-store" } as RequestInit);
      const json = (await res.json().catch(() => ({}))) as DashData & { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) throw new Error(json.error || `API ${res.status}`);
      if (mounted.current) setData(json as DashData);
    } catch (e: unknown) {
      if (mounted.current) setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    const t = setInterval(() => load(), POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(t);
    };
  }, [load]);

  const copyAddr = async (addr: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(addr);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const s = data?.stats;

  return (
    <div className="min-h-screen bg-[#05070c] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-[#9945FF]/10 blur-[130px]" />
        <div className="absolute -bottom-40 right-1/4 h-96 w-96 rounded-full bg-[#F97316]/10 blur-[130px]" />
      </div>
      <div className="relative mx-auto max-w-6xl px-4 py-6">
        {/* header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#9945FF] to-[#5b2bb8] text-[22px] shadow-[0_10px_30px_-8px_rgba(153,69,255,0.55)]">
              <Copy className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-[26px] font-black leading-none tracking-tight">Copy Trading</h1>
              <p className="mt-1 text-[13px] text-white/45">Live mirror of followed wallets — his trades, our fills, PnL.</p>
            </div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-[13px] font-bold text-white/70 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-60"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-rose-500/10 px-4 py-3 text-[13px] font-semibold text-rose-300">
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="mt-10 flex items-center justify-center gap-2 text-white/40">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading mirror…
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {/* (a) followed wallets */}
            <Section title="Followed wallets" sub={data?.follows.length ? `${data.follows.length} active` : "none active"}>
              {!data?.follows.length ? (
                <p className="px-4 py-6 text-center text-[13px] text-white/40">
                  No active follows. Use orbitx_app_copy_follow to start mirroring a wallet.
                </p>
              ) : (
                <div className="grid gap-3 p-4 sm:grid-cols-2">
                  {data.follows.map((f) => (
                    <div key={f.followId} className="rounded-xl border border-white/[0.08] bg-black/30 p-4">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-[#9945FF]" />
                        <span className="text-[15px] font-black">{f.label || "Wallet"}</span>
                        <span className="ml-auto rounded-full bg-[#9945FF]/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#c4a6ff]">
                          live mirror
                        </span>
                      </div>
                      <button
                        onClick={() => copyAddr(f.wallet)}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-2.5 py-1.5 font-mono text-[12px] text-white/70 transition hover:bg-white/[0.1] hover:text-white"
                        title="Copy full address"
                      >
                        {trunc(f.wallet)}
                        {copied === f.wallet ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-white/50">
                        <span>
                          Sizing: <span className="font-bold text-white/85">{modeLabel(f)}</span>
                        </span>
                        <span>
                          Cap: <span className="font-bold text-white/85">${f.maxPerTradeUsd}/trade</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* (d) wins/losses — summary cards */}
            <Section title="Wins / losses" sub="Average-cost PnL on our mirrored fills">
              {!s ? (
                <p className="px-4 py-6 text-center text-[13px] text-white/40">No data yet.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
                    {[
                      {
                        k: "Realized PnL",
                        v: fmtUsd(s.totalRealized),
                        c: s.totalRealized >= 0 ? "text-emerald-300" : "text-rose-300",
                      },
                      { k: "Win rate", v: `${(s.winRate * 100).toFixed(1)}%`, c: "text-white" },
                      {
                        k: "Wins / losses",
                        v: `${s.wins} / ${s.losses}`,
                        c: "text-white",
                      },
                      { k: "Open positions", v: String(s.openPositions), c: "text-white" },
                    ].map((c) => (
                      <div key={c.k} className="rounded-xl border border-white/[0.08] bg-black/30 p-3.5">
                        <div className="text-[11px] font-bold uppercase tracking-widest text-white/35">{c.k}</div>
                        <div className={cn("mt-1 text-[22px] font-black", c.c)}>{c.v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="overflow-x-auto px-4 pb-4">
                    <table className="w-full min-w-[720px] text-left text-[13px]">
                      <thead>
                        <tr className="text-[11px] uppercase tracking-widest text-white/35">
                          <th className="pb-2 pr-3 font-bold">Token</th>
                          <th className="pb-2 pr-3 font-bold">Buys</th>
                          <th className="pb-2 pr-3 font-bold">Sells</th>
                          <th className="pb-2 pr-3 font-bold">Realized</th>
                          <th className="pb-2 pr-3 font-bold">Unrealized</th>
                          <th className="pb-2 pr-3 font-bold">Open value</th>
                          <th className="pb-2 font-bold">Open amt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.perToken.map((t) => (
                          <tr key={t.mint} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                            <td className="py-2.5 pr-3">
                              <span className="font-black text-white">${t.symbol}</span>
                              <span className="ml-2 font-mono text-[11px] text-white/35">{trunc(t.mint)}</span>
                            </td>
                            <td className="py-2.5 pr-3 text-emerald-300">{t.buys}</td>
                            <td className="py-2.5 pr-3 text-rose-300">{t.sells}</td>
                            <td className={cn("py-2.5 pr-3 font-bold", t.realizedPnl >= 0 ? "text-emerald-300" : "text-rose-300")}>
                              {fmtUsd(t.realizedPnl)}
                            </td>
                            <td className={cn("py-2.5 pr-3 font-bold", t.unrealizedPnl >= 0 ? "text-emerald-300" : "text-rose-300")}>
                              {fmtUsd(t.unrealizedPnl)}
                            </td>
                            <td className="py-2.5 pr-3 text-white/80">{fmtUsd(t.openValueUsd)}</td>
                            <td className="py-2.5 text-white/60">{fmtNum(t.openAmount)}</td>
                          </tr>
                        ))}
                        {!s.perToken.length && (
                          <tr>
                            <td colSpan={7} className="py-6 text-center text-white/40">
                              No mirrored fills yet — PnL appears after the first mirror.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Section>

            {/* (b) his live trades */}
            <Section title="His live trades" sub={data ? `${data.theirTrades.length} swaps seen` : ""}>
              <div className="overflow-x-auto p-4">
                <table className="w-full min-w-[760px] text-left text-[13px]">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-widest text-white/35">
                      <th className="pb-2 pr-3 font-bold">Time</th>
                      <th className="pb-2 pr-3 font-bold">Side</th>
                      <th className="pb-2 pr-3 font-bold">Token</th>
                      <th className="pb-2 pr-3 font-bold">Amount</th>
                      <th className="pb-2 pr-3 font-bold">USD</th>
                      <th className="pb-2 font-bold">Signature</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.theirTrades.map((t, i) => (
                      <tr key={`${t.signature || "x"}-${i}`} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                        <td className="py-2.5 pr-3 text-white/50" title={t.at || ""}>
                          {fmtTime(t.at)}
                        </td>
                        <td className="py-2.5 pr-3">
                          <SideBadge side={t.side} />
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="font-bold text-white">${t.symbol}</span>
                          <span className="ml-2 font-mono text-[11px] text-white/35">{trunc(t.mint)}</span>
                        </td>
                        <td className="py-2.5 pr-3 text-white/80">{fmtNum(t.amount)}</td>
                        <td className="py-2.5 pr-3 text-white/80">{fmtUsd(t.theirUsd)}</td>
                        <td className="py-2.5">
                          {txUrl(t.signature) ? (
                            <a
                              href={txUrl(t.signature)!}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-[12px] text-[#c4a6ff] hover:text-white"
                            >
                              {trunc(t.signature!)} <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-white/30">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!data?.theirTrades.length && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-white/40">
                          No swaps seen yet from followed wallets.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* (c) our mirrored trades */}
            <Section title="Our mirrored trades" sub={data ? `${data.ourFills.length} mirror attempts` : ""}>
              <div className="overflow-x-auto p-4">
                <table className="w-full min-w-[860px] text-left text-[13px]">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-widest text-white/35">
                      <th className="pb-2 pr-3 font-bold">Time</th>
                      <th className="pb-2 pr-3 font-bold">Side</th>
                      <th className="pb-2 pr-3 font-bold">Token</th>
                      <th className="pb-2 pr-3 font-bold">USD</th>
                      <th className="pb-2 pr-3 font-bold">Our sig</th>
                      <th className="pb-2 pr-3 font-bold">His sig</th>
                      <th className="pb-2 font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.ourFills.map((f, i) => (
                      <tr key={`${f.sig || f.theirSig || "x"}-${i}`} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                        <td className="py-2.5 pr-3 text-white/50" title={f.at || ""}>
                          {fmtTime(f.at)}
                        </td>
                        <td className="py-2.5 pr-3">
                          <SideBadge side={f.side} />
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="font-bold text-white">${f.symbol}</span>
                          <span className="ml-2 font-mono text-[11px] text-white/35">{trunc(f.mint)}</span>
                        </td>
                        <td className="py-2.5 pr-3 text-white/80">{f.usd ? fmtUsd(f.usd) : "—"}</td>
                        <td className="py-2.5 pr-3">
                          {txUrl(f.sig) ? (
                            <a
                              href={txUrl(f.sig)!}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-[12px] text-[#c4a6ff] hover:text-white"
                            >
                              {trunc(f.sig!)} <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-white/30">—</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3">
                          {txUrl(f.theirSig) ? (
                            <a
                              href={txUrl(f.theirSig)!}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-[12px] text-white/50 hover:text-white"
                            >
                              {trunc(f.theirSig!)} <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-white/30">—</span>
                          )}
                        </td>
                        <td className="py-2.5">
                          <FillStatus f={f} />
                        </td>
                      </tr>
                    ))}
                    {!data?.ourFills.length && (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-white/40">
                          No mirror attempts yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}
