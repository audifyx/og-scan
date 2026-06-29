import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Shield, Users, Droplets, Wallet2, Calculator, Search, Loader2, ArrowRight,
  Crosshair, ExternalLink, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
  Clock, TrendingUp, TrendingDown, Flame, Rocket, DollarSign,
} from "lucide-react";
import {
  isMint, tokenHolders, liquidityScan, walletProfile,
  type Holder, type Pool, type WalletProfile,
} from "../lib/scan";
import { getScreener, fmtUsd, type Row } from "../lib/api";

type ToolId = "sniper" | "holders" | "liquidity" | "wallet" | "staking" | "il";

const TOOLS: { id: ToolId; label: string; desc: string; Icon: typeof Shield; kind: "feed" | "mint" | "wallet" | "calc"; ph: string }[] = [
  { id: "sniper",   label: "Token Sniper",     desc: "Live pump.fun launches",     Icon: Crosshair,  kind: "feed",   ph: "" },
  { id: "holders",  label: "Holder Analysis",  desc: "Top holder distribution",    Icon: Users,      kind: "mint",   ph: "Paste a token contract address" },
  { id: "liquidity",label: "Liquidity Scanner",desc: "Pools & liquidity depth",    Icon: Droplets,   kind: "mint",   ph: "Paste a token contract address" },
  { id: "wallet",   label: "Wallet Profiler",  desc: "Holdings & activity",        Icon: Wallet2,    kind: "wallet", ph: "Paste a wallet address" },
  { id: "staking",  label: "Staking Calc",     desc: "Estimate staking rewards",   Icon: Calculator, kind: "calc",   ph: "" },
  { id: "il",       label: "Impermanent Loss", desc: "LP loss vs holding",         Icon: AlertTriangle, kind: "calc", ph: "" },
];

const fmt = (n: number | null | undefined, d = 2) =>
  n == null ? "—" : n >= 1e9 ? (n / 1e9).toFixed(d) + "B" : n >= 1e6 ? (n / 1e6).toFixed(d) + "M" : n >= 1e3 ? (n / 1e3).toFixed(d) + "K" : n.toFixed(d);
const short = (a: string) => (a && a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);

export default function Tools() {
  const [tool, setTool] = useState<ToolId>("sniper");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);

  const active = TOOLS.find((t) => t.id === tool)!;

  const run = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(""); setResult(null);
    const v = input.trim();
    if (active.kind === "mint" || active.kind === "wallet") {
      if (!isMint(v)) { setError(active.kind === "wallet" ? "Enter a valid wallet address" : "Enter a valid contract address"); return; }
    }
    setLoading(true);
    try {
      if (tool === "holders") setResult(await tokenHolders(v));
      else if (tool === "liquidity") setResult(await liquidityScan(v));
      else if (tool === "wallet") setResult(await walletProfile(v));
    } catch (err: any) {
      setError(err?.message || "Lookup failed. Try again.");
    } finally { setLoading(false); }
  };

  const pickTool = (id: ToolId) => { setTool(id); setResult(null); setError(""); setInput(""); };

  return (
    <div className="mx-auto max-w-[1080px] space-y-6 px-4 py-6">
      <div className="flex items-center gap-2">
        <Crosshair className="h-5 w-5 text-accent" />
        <h1 className="font-display text-2xl font-black text-white">OrbitX Tools</h1>
        <span className="pill bg-accent/15 text-accent text-[10px] font-bold ml-1">6 tools</span>
      </div>

      {/* Tool selector */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {TOOLS.map((t) => (
          <button key={t.id} onClick={() => pickTool(t.id)}
            className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${tool === t.id ? "border-accent/60 bg-accent/10" : "border-line bg-panel2/60 hover:border-accent/30"}`}>
            <t.Icon className={`h-4 w-4 ${tool === t.id ? "text-accent" : "text-muted"}`} />
            <span className="text-[12.5px] font-bold text-white">{t.label}</span>
            <span className="text-[10.5px] text-muted leading-tight">{t.desc}</span>
          </button>
        ))}
      </div>

      {/* ── Tool body ── */}
      {tool === "sniper" ? <TokenSniper /> : tool === "staking" ? <StakingCalc /> : tool === "il" ? <ImpermanentLoss /> : (
        <>
          <form onSubmit={run} className="flex items-center gap-2 rounded-2xl border border-line bg-bg/70 p-2 focus-within:border-accent/60">
            <Search className="ml-2 h-4 w-4 shrink-0 text-muted" />
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={active.ph}
              className="flex-1 bg-transparent px-1 py-2 text-sm text-white outline-none placeholder:text-muted/60" />
            <button type="submit" disabled={loading}
              className="rounded-xl bg-accent px-5 py-2 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-60">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Run"}
            </button>
          </form>

          {error && <div className="rounded-xl border border-down/30 bg-down/10 px-4 py-3 text-sm text-down">{error}</div>}
          {loading && <div className="grid place-items-center py-12 text-muted"><Loader2 className="h-5 w-5 animate-spin" /></div>}

          {!loading && result && tool === "holders" && <HoldersResult r={result} />}
          {!loading && result && tool === "liquidity" && <LiquidityResult r={result} />}
          {!loading && result && tool === "wallet" && <WalletResult r={result as WalletProfile} input={input.trim()} />}
        </>
      )}

      {/* Related live feeds */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/new" className="flex items-center gap-3 rounded-2xl border border-line bg-panel2/60 p-4 transition hover:border-accent/40">
          <Rocket className="h-5 w-5 text-accent" />
          <div><div className="text-sm font-bold text-white">Newly Listed</div><div className="text-[12px] text-muted">Fresh launches on OrbitX</div></div>
          <ArrowRight className="ml-auto h-4 w-4 text-muted" />
        </Link>
        <Link to="/pulse" className="flex items-center gap-3 rounded-2xl border border-line bg-panel2/60 p-4 transition hover:border-accent/40">
          <Flame className="h-5 w-5 text-accent" />
          <div><div className="text-sm font-bold text-white">Market Pulse</div><div className="text-[12px] text-muted">Trending pairs & signals</div></div>
          <ArrowRight className="ml-auto h-4 w-4 text-muted" />
        </Link>
      </div>
    </div>
  );
}

/* ─────────────────────────── Token Sniper (live pump.fun feed) ─────────────── */
function timeAgo(iso?: string | null): string {
  if (!iso) return "new";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (isNaN(s)) return "new";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function TokenSniper() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState<number>(0);
  const [auto, setAuto] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await getScreener("newpairs", "24h", 40);
      setRows(d.rows || []);
      setUpdated(Date.now());
    } catch {
      /* keep prior rows on transient failure */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (auto) timer.current = setInterval(load, 12000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [auto, load]);

  return (
    <div className="space-y-3">
      {/* Sniper header */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-panel2/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className={`absolute inline-flex h-full w-full rounded-full ${auto ? "animate-ping bg-up/70" : "bg-muted/40"}`} />
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${auto ? "bg-up" : "bg-muted"}`} />
          </span>
          <span className="text-sm font-bold text-white">Live · Brand-new pump.fun launches</span>
          {updated > 0 && <span className="hidden sm:inline text-[11px] text-muted">updated {timeAgo(new Date(updated).toISOString())} ago</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAuto((a) => !a)}
            className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition ${auto ? "border-up/40 bg-up/10 text-up" : "border-line bg-panel2 text-muted hover:text-white"}`}>
            {auto ? "Auto-refresh on" : "Auto-refresh off"}
          </button>
          <button onClick={load} className="rounded-lg border border-line bg-panel2 p-1.5 text-muted transition hover:text-white">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <div className="grid place-items-center py-16 text-muted"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-line bg-panel2/60 p-10 text-center text-sm text-muted">No fresh launches right now. They appear here the moment they are created.</div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => {
            const change = r.change5m ?? r.change1h ?? r.change24h ?? null;
            const up = (change ?? 0) >= 0;
            return (
              <div key={r.mint} className="space-y-2.5 rounded-2xl border border-line bg-panel2/50 p-3.5 transition hover:border-accent/40">
                <div className="flex items-center gap-3">
                  {r.icon
                    ? <img src={r.icon} alt={r.symbol || ""} className="h-10 w-10 rounded-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                    : <div className="grid h-10 w-10 place-items-center rounded-full bg-bg text-[12px] font-bold text-accent">{(r.symbol || "?").slice(0, 2)}</div>}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-white">{r.name || short(r.mint)}</div>
                    <div className="font-mono text-[11px] text-muted">${r.symbol || "—"}</div>
                  </div>
                  {change != null && (
                    <span className={`pill text-[10px] font-bold ${up ? "bg-up/15 text-up" : "bg-down/15 text-down"}`}>
                      {up ? "+" : ""}{change.toFixed(0)}%
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                  <Stat label="Price" value={r.priceUsd != null ? "$" + (r.priceUsd < 0.01 ? r.priceUsd.toExponential(1) : r.priceUsd.toFixed(4)) : "—"} />
                  <Stat label="Liq" value={r.liquidity != null ? fmtUsd(r.liquidity, { compact: true }) : "—"} />
                  <Stat label="MCap" value={r.mcap != null ? fmtUsd(r.mcap, { compact: true }) : "—"} />
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[11px] text-muted"><Clock className="h-3 w-3" /> {timeAgo(r.createdAt)} old</span>
                  <div className="flex items-center gap-1.5">
                    <Link to={`/token/${r.mint}`} className="btn bg-accent/15 text-accent text-[10.5px] inline-flex items-center gap-1 px-2 py-1">Scan</Link>
                    <a href={`https://pump.fun/${r.mint}`} target="_blank" rel="noreferrer" className="btn bg-panel2 text-white text-[10.5px] inline-flex items-center gap-1 px-2 py-1">pump <ExternalLink className="h-3 w-3" /></a>
                    <a href={`https://solscan.io/token/${r.mint}`} target="_blank" rel="noreferrer" className="btn bg-panel2 text-white text-[10.5px] inline-flex items-center gap-1 px-2 py-1">scan <ExternalLink className="h-3 w-3" /></a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[11px] text-muted/80">Live feed of the freshest coins being created on pump.fun. Unverified and high-risk — always do your own research. OrbitX never auto-executes trades.</p>
    </div>
  );
}

/* ─────────────────────────── Result blocks ─────────────────────────── */
function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-line bg-panel2/60 p-3"><div className="text-[10px] uppercase tracking-wider text-muted">{label}</div><div className="mt-0.5 text-sm font-bold text-white">{value}</div></div>;
}

function HoldersResult({ r }: { r: { holders: Holder[]; supply: number | null } }) {
  if (!r.holders.length) return <Empty text="No holder data available." />;
  return (
    <div className="rounded-2xl border border-line bg-panel2/40 p-4">
      <div className="mb-3 text-sm font-bold text-white">Top {r.holders.length} holders</div>
      <div className="space-y-1.5">
        {r.holders.map((h) => (
          <div key={h.address} className="flex items-center gap-3 text-[13px]">
            <span className="w-6 text-right text-muted">{h.rank}</span>
            <span className="font-mono text-white/80">{short(h.address)}</span>
            <div className="ml-auto flex w-40 items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-accent" style={{ width: `${Math.min(100, h.pct || 0)}%` }} /></div>
              <span className="w-12 text-right font-bold text-white">{h.pct != null ? h.pct.toFixed(1) + "%" : "—"}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LiquidityResult({ r }: { r: { totalLiquidity: number | null; pools: Pool[]; launchpad: string | null } }) {
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-panel2/40 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-white">Total liquidity</div>
        <div className="text-lg font-black text-accent">{r.totalLiquidity != null ? "$" + fmt(r.totalLiquidity) : "—"}</div>
      </div>
      {r.pools.length ? r.pools.map((p, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-line bg-bg/50 p-3 text-[13px]">
          <span className="font-bold text-white">{p.dex}</span>
          <span className="text-muted">{p.pair}</span>
          <div className="ml-auto flex items-center gap-4">
            <span className="text-white">${fmt(p.liquidity)}</span>
            {p.volume24h != null && <span className="text-muted">vol ${fmt(p.volume24h)}</span>}
            {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="text-accent"><ExternalLink className="h-3.5 w-3.5" /></a>}
          </div>
        </div>
      )) : <Empty text="No pools found." />}
    </div>
  );
}

function WalletResult({ r, input }: { r: WalletProfile; input: string }) {
  return (
    <div className="space-y-4 rounded-2xl border border-line bg-panel2/40 p-5">
      <div className="flex items-center gap-2"><Wallet2 className="h-4 w-4 text-accent" /><span className="font-mono text-sm text-white">{short(input)}</span>
        <Link to={`/wallet/${input}`} className="ml-auto inline-flex items-center gap-1 text-[12px] font-bold text-accent">Full profile <ExternalLink className="h-3.5 w-3.5" /></Link></div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="SOL balance" value={r.sol != null ? r.sol.toFixed(3) : "—"} />
        <Stat label="Tokens held" value={String(r.tokenCount)} />
        <Stat label="Recent txns" value={String(r.recentTx)} />
      </div>
      {r.topTokens.length > 0 && (
        <div><div className="mb-2 text-[11px] uppercase tracking-wider text-muted">Top holdings</div>
          <div className="space-y-1">{r.topTokens.map((t) => (
            <div key={t.mint} className="flex items-center justify-between text-[12.5px]"><Link to={`/token/${t.mint}`} className="font-mono text-white/80 hover:text-accent">{short(t.mint)}</Link><span className="text-muted">{fmt(t.amount, 2)}</span></div>
          ))}</div>
        </div>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-line bg-panel2/60 p-6 text-center text-sm text-muted">{text}</div>;
}

/* ─────────────────────────── Staking calculator ─────────────────────────── */
function StakingCalc() {
  const [amount, setAmount] = useState("100");
  const [apy, setApy] = useState("8");
  const [days, setDays] = useState("365");
  const p = Number(amount) || 0, a = (Number(apy) || 0) / 100, d = Number(days) || 0;
  const reward = p * a * (d / 365);
  const total = p + reward;
  return (
    <div className="space-y-4 rounded-2xl border border-line bg-panel2/40 p-5">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Amount" value={amount} onChange={setAmount} suffix="tokens" />
        <Field label="APY %" value={apy} onChange={setApy} suffix="%" />
        <Field label="Duration" value={days} onChange={setDays} suffix="days" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-line bg-bg/50 p-4"><div className="text-[11px] uppercase tracking-wider text-muted">Est. rewards</div><div className="mt-1 text-xl font-black text-up">+{reward.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div></div>
        <div className="rounded-xl border border-line bg-bg/50 p-4"><div className="text-[11px] uppercase tracking-wider text-muted">Total after period</div><div className="mt-1 text-xl font-black text-white">{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div></div>
      </div>
      <p className="text-[11px] text-muted">Simple linear estimate. Actual staking rewards vary with rate changes and compounding.</p>
    </div>
  );
}

/* ─────────────────────────── Impermanent loss calculator ─────────────────── */
function ImpermanentLoss() {
  const [investment, setInvestment] = useState("1000");
  const [priceChange, setPriceChange] = useState(50);

  const inv = parseFloat(investment) || 0;
  const ratio = 1 + priceChange / 100;
  const ilPercent = ratio > 0 ? (2 * Math.sqrt(ratio) / (1 + ratio) - 1) * 100 : -100;
  const holdValue = inv * (0.5 + 0.5 * ratio);
  const lpValue = holdValue * (1 + ilPercent / 100);
  const actualLoss = holdValue - lpValue;

  return (
    <div className="space-y-5 rounded-2xl border border-line bg-panel2/40 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wider text-muted">Initial LP investment (USD)</div>
          <div className="flex items-center rounded-xl border border-line bg-bg/70 px-3 focus-within:border-accent/60">
            <DollarSign className="h-4 w-4 text-muted" />
            <input value={investment} onChange={(e) => setInvestment(e.target.value)} inputMode="decimal" className="w-full bg-transparent px-2 py-2.5 text-sm text-white outline-none" />
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted">
            <span>Price change</span>
            <span className={priceChange >= 0 ? "text-up" : "text-down"}>{priceChange >= 0 ? "+" : ""}{priceChange}%</span>
          </div>
          <input type="range" min={-90} max={500} step={5} value={priceChange} onChange={(e) => setPriceChange(Number(e.target.value))} className="w-full accent-[#2F80FF]" />
          <div className="flex justify-between text-[10px] text-muted/70"><span>-90%</span><span>0%</span><span>+500%</span></div>
        </div>
      </div>

      <div className="rounded-xl border border-down/25 bg-down/10 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/85">Impermanent loss</span>
          <span className="text-xl font-black text-down">{Math.abs(ilPercent).toFixed(2)}%</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-line bg-bg/50 p-4">
          <div className="mb-1 flex items-center gap-2 text-muted"><TrendingUp className="h-4 w-4" /><span className="text-[11px] uppercase tracking-wider">If holding</span></div>
          <div className="text-lg font-black text-white">${holdValue.toFixed(2)}</div>
        </div>
        <div className="rounded-xl border border-line bg-bg/50 p-4">
          <div className="mb-1 flex items-center gap-2 text-muted"><TrendingDown className="h-4 w-4" /><span className="text-[11px] uppercase tracking-wider">LP value</span></div>
          <div className="text-lg font-black text-white">${lpValue.toFixed(2)}</div>
        </div>
      </div>

      <div className="rounded-xl border border-gold/25 bg-gold/10 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/85">Dollar loss vs holding</span>
          <span className="font-black text-gold">-${Math.abs(actualLoss).toFixed(2)}</span>
        </div>
      </div>
      <p className="text-[11px] text-muted">Note: this does not account for trading fees earned, which can offset impermanent loss.</p>
    </div>
  );
}

function Field({ label, value, onChange, suffix }: { label: string; value: string; onChange: (v: string) => void; suffix: string }) {
  return (
    <div><div className="mb-1 text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className="flex items-center rounded-xl border border-line bg-bg/70 px-3 focus-within:border-accent/60">
        <input value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" className="w-full bg-transparent py-2.5 text-sm text-white outline-none" />
        <span className="text-[11px] text-muted">{suffix}</span>
      </div>
    </div>
  );
}
