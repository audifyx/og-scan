// OrbitX Curve (EVM) — trade page. Buy/sell an existing curve token straight
// from the user's wallet against OrbitX's own bonding curve (keyless, no
// custody). Live pricing, slippage guard, and a trade ledger in Supabase.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowDownUp, Droplets, ExternalLink, Flame, Loader2, RefreshCw, ShieldCheck,
  TrendingUp, Wallet as WalletIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  CHAINS, chainById, explorerTxUrl, explorerAddressUrl, type ChainDef,
} from "@/lib/orbitx/chains";
import {
  ensureChain, shortAddr, waitForReceipt, type Eip1193Provider,
} from "@/lib/evm/wallet";
import {
  quoteBuy, quoteSell, encodeBuy, encodeSell, readMarketState, type MarketState,
} from "@/lib/evm/curve";
import { migrateCurve, getRouter } from "@/lib/evm/dex";
import CurvePriceChart from "@/components/orbitx/CurvePriceChart";
import CurveTradeFeed from "@/components/orbitx/CurveTradeFeed";
import CurveInfoPanel from "@/components/orbitx/CurveInfoPanel";
import type { CurveTradeRow } from "@/lib/orbitx/curveData";
import { useEvmWallet } from "@/hooks/useEvmWallet";

type Meta = { chain: string; name?: string; symbol?: string; creator_wallet?: string; creator_fee_bps?: number };

type Side = "buy" | "sell";

function parseUnits(v: string, dec = 18): bigint {
  const s = v.trim();
  if (!s || !/^\d+(\.\d+)?$/.test(s)) throw new Error("Invalid amount");
  const [int, frac = ""] = s.split(".");
  return BigInt(int) * 10n ** BigInt(dec) + BigInt((frac + "0".repeat(dec)).slice(0, dec) || "0");
}
function fmtUnits(v: bigint, dec = 18, places = 6): string {
  const neg = v < 0n; if (neg) v = -v;
  const base = 10n ** BigInt(dec);
  const int = v / base;
  const frac = (v % base).toString().padStart(dec, "0").slice(0, places).replace(/0+$/, "");
  return (neg ? "-" : "") + int.toString() + (frac ? "." + frac : "");
}

export default function LaunchpadCurveTrade() {
  const { token = "" } = useParams();
  const [meta, setMeta] = useState<Meta | null>(null);
  const chain: ChainDef = chainById(meta?.chain ?? "robinhood") ?? CHAINS[0];

  const { account, provider, openConnect } = useEvmWallet();

  const [state, setState] = useState<MarketState | null>(null);
  const [side, setSide] = useState<Side>("buy");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("1");
  const [quoteOut, setQuoteOut] = useState<bigint | null>(null);
  const [busy, setBusy] = useState(false);
  const [trades, setTrades] = useState<CurveTradeRow[]>([]);
  const [migrating, setMigrating] = useState(false);

  // load token meta (chain/name/symbol) from the curve registry
  useEffect(() => {
    let on = true;
    supabase.from("orbitx_curve_markets").select("chain,name,symbol,creator_wallet,creator_fee_bps").eq("token_address", token).maybeSingle()
      .then(({ data }) => { if (on && data) setMeta(data as Meta); })
      .catch(() => {});
    return () => { on = false; };
  }, [token]);

  const refreshState = useCallback(async (p: Eip1193Provider | null) => {
    if (!p) return;
    try { setState(await readMarketState(p, token)); } catch { /* ignore */ }
  }, [token]);

  useEffect(() => { if (provider) refreshState(provider); }, [provider, refreshState]);

  // live quote as the user types
  useEffect(() => {
    let on = true;
    if (!provider || !amount) { setQuoteOut(null); return; }
    (async () => {
      try {
        const amt = parseUnits(amount);
        const q = side === "buy"
          ? (await quoteBuy(provider, token, amt)).tokensOut
          : (await quoteSell(provider, token, amt)).nativeOut;
        if (on) setQuoteOut(q);
      } catch { if (on) setQuoteOut(null); }
    })();
    return () => { on = false; };
  }, [provider, token, amount, side]);

  const slipMinOut = (out: bigint): bigint => {
    const bps = Math.max(0, Math.min(5000, Math.round(parseFloat(slippage || "1") * 100)));
    return (out * BigInt(10000 - bps)) / 10000n;
  };

  const trade = async () => {
    if (!provider || !account || !chain.evm) return;
    let amt: bigint;
    try { amt = parseUnits(amount); if (amt <= 0n) throw new Error(); } catch { toast.error("Invalid amount"); return; }
    if (quoteOut == null || quoteOut <= 0n) { toast.error("No quote available"); return; }
    setBusy(true);
    try {
      await ensureChain(provider, chain.evm);
      const minOut = slipMinOut(quoteOut);
      const tx: { from: string; to: string; data: string; value?: string } =
        side === "buy"
          ? { from: account, to: token, data: encodeBuy(minOut), value: "0x" + amt.toString(16) }
          : { from: account, to: token, data: encodeSell(amt, minOut) };
      const hash = (await provider.request({ method: "eth_sendTransaction", params: [tx] })) as string;
      toast.message("Submitted — waiting for confirmation…");
      const receipt = await waitForReceipt(provider, hash);
      if (receipt.status !== "0x1") throw new Error("Trade reverted — check the tx in the explorer");

      const st = await readMarketState(provider, token).catch(() => null);
      setState(st);
      const nativeAmount = side === "buy" ? amt : quoteOut;
      const tokenAmount = side === "buy" ? quoteOut : amt;
      // ledger + market snapshot (best-effort)
      try {
        await supabase.from("orbitx_curve_trades").insert({
          token_address: token, chain: chain.id, trader_wallet: account, side,
          native_amount: nativeAmount.toString(), token_amount: tokenAmount.toString(),
          price_x1e18: (st?.priceX1e18 ?? 0n).toString(), tx_hash: hash,
        });
        if (st) {
          await supabase.from("orbitx_curve_markets").update({
            real_native: st.realNative.toString(), token_reserve: st.tokenReserve.toString(),
            price_x1e18: st.priceX1e18.toString(), graduated: st.graduated, updated_at: new Date().toISOString(),
          }).eq("token_address", token);
        }
      } catch { /* ledger is best-effort */ }

      setAmount(""); setQuoteOut(null);
      toast.success(`${side === "buy" ? "Bought" : "Sold"} — ${chain.name}`);
      if (st?.graduated) toast.message("This curve has graduated — trading is now closed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Trade failed");
    } finally { setBusy(false); }
  };

  const gradPct = useMemo(() => {
    if (!state || state.graduationNative === 0n) return 0;
    return Math.min(100, Number((state.realNative * 10000n) / state.graduationNative) / 100);
  }, [state]);

  const chainDec = chain.evm ? parseInt(chain.evm.chainIdHex, 16) : 0;
  const routerReady = !!getRouter(chainDec);
  const handleMigrate = async () => {
    if (!provider || !account || !chain.evm) return;
    setMigrating(true);
    try {
      await ensureChain(provider, chain.evm);
      await migrateCurve(provider, account, token, chainDec);
      toast.success("Liquidity seeded on the DEX");
      await refreshState(provider);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Migration failed");
    } finally { setMigrating(false); }
  };

  const title = meta?.symbol ? `$${meta.symbol}` : shortAddr(token);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.34em] text-[hsl(var(--og-gold))]">// orbitx curve · trade · keyless</div>
          <h1 className="mt-1 font-display text-2xl font-black tracking-tight">
            {title} <span className="text-muted-foreground">on {chain.name}</span>
          </h1>
          <a className="inline-flex items-center gap-1 text-xs text-muted-foreground" href={explorerAddressUrl(chain, token)} target="_blank" rel="noreferrer">
            {shortAddr(token)} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <Link to="/orbitxlaunch/create/curve" className="rounded-md border border-white/10 px-3 py-1.5 text-xs hover:border-white/25">Launch new</Link>
      </div>

      {state && (
        <div className="lpx-panel mb-4 space-y-3 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground"><TrendingUp className="h-4 w-4" /> Price</span>
            <span className="font-mono">{fmtUnits(state.priceX1e18, 18, 12)} {chain.symbol}</span>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Flame className="h-3.5 w-3.5 text-[hsl(var(--og-gold))]" /> Graduation</span>
              <span>{fmtUnits(state.realNative, 18, 4)} / {fmtUnits(state.graduationNative, 18, 4)} {chain.symbol}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-[hsl(var(--og-gold))]" style={{ width: `${gradPct}%` }} />
            </div>
          </div>
          {state.graduated && <div className="rounded-md border border-[hsl(var(--og-lime))]/30 bg-[hsl(var(--og-lime))]/5 px-3 py-2 text-xs text-[hsl(var(--og-lime))]">Graduated — curve trading is closed.</div>}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
      {!account ? (
        <div className="lpx-panel p-4">
          <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <WalletIcon className="h-3.5 w-3.5" /> Connect to trade
          </div>
          <p className="mb-3 text-sm text-muted-foreground">Link your EVM wallet to trade on {chain.name}. Your Solana login stays your account.</p>
          <button onClick={openConnect} className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--og-gold))] px-4 py-2 text-sm font-bold text-black">
            <WalletIcon className="h-4 w-4" /> Link EVM wallet
          </button>
        </div>
      ) : (
        <div className="lpx-panel space-y-3 p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-[hsl(var(--og-lime))]" /> {shortAddr(account)}</span>
            <button onClick={() => refreshState(provider)} className="inline-flex items-center gap-1 hover:text-foreground"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>
          </div>

          <div className="flex rounded-lg border border-white/10 p-1">
            {(["buy", "sell"] as Side[]).map((sd) => (
              <button key={sd} onClick={() => { setSide(sd); setAmount(""); setQuoteOut(null); }}
                className={`flex-1 rounded-md py-1.5 text-sm font-bold capitalize ${side === sd ? (sd === "buy" ? "bg-[hsl(var(--og-lime))]/15 text-[hsl(var(--og-lime))]" : "bg-red-500/15 text-red-400") : "text-muted-foreground"}`}>
                {sd}
              </button>
            ))}
          </div>

          <input value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder={side === "buy" ? `Amount in ${chain.symbol}` : `${meta?.symbol ?? "tokens"} to sell`}
            className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-[hsl(var(--og-gold))]" />

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><ArrowDownUp className="h-3.5 w-3.5" /> Est. receive</span>
            <span className="font-mono">
              {quoteOut != null ? `${fmtUnits(quoteOut)} ${side === "buy" ? (meta?.symbol ?? "tokens") : chain.symbol}` : "—"}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Slippage %</span>
            <input value={slippage} onChange={(e) => setSlippage(e.target.value)}
              className="w-16 rounded-md border border-white/10 bg-transparent px-2 py-1 text-right outline-none focus:border-[hsl(var(--og-gold))]" />
          </div>

          <button onClick={trade} disabled={busy || state?.graduated}
            className={`flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold text-black disabled:opacity-60 ${side === "buy" ? "bg-[hsl(var(--og-lime))]" : "bg-red-400"}`}>
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</> : <span className="capitalize">{side} {meta?.symbol ?? "token"}</span>}
          </button>
          {state?.graduated && <p className="text-center text-xs text-muted-foreground">Curve closed — trade this token on its graduated DEX pool.</p>}
        </div>
      )}

      <div className="space-y-4">
        <div className="lpx-panel p-4">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Price chart</div>
          <CurvePriceChart trades={trades} symbol={meta?.symbol} />
        </div>
        {state?.graduated && (
          <div className="lpx-panel space-y-2 p-4">
            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"><Droplets className="h-3.5 w-3.5 text-[hsl(var(--og-cyan))]" /> Graduation</div>
            <p className="text-xs text-muted-foreground">This curve graduated. Seed a DEX pool with the raised {chain.symbol} and reserved tokens — LP is burned (liquidity locked). Permissionless.</p>
            {account ? (
              <button onClick={handleMigrate} disabled={migrating || !routerReady}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-[hsl(var(--og-cyan))] px-4 py-2 text-sm font-bold text-black disabled:opacity-60">
                {migrating ? <><Loader2 className="h-4 w-4 animate-spin" /> Seeding…</> : <><Droplets className="h-4 w-4" /> Seed DEX liquidity</>}
              </button>
            ) : <p className="text-xs text-muted-foreground">Connect a wallet to seed liquidity.</p>}
            {!routerReady && <p className="text-[10px] text-[hsl(var(--og-gold))]">No DEX router set for {chain.name} (VITE_DEX_ROUTER_{chainDec}).</p>}
          </div>
        )}
        <CurveInfoPanel trades={trades} chain={chain} symbol={meta?.symbol} creatorFeeBps={meta?.creator_fee_bps ?? 50} creatorWallet={meta?.creator_wallet} />
      </div>
      </div>

      <div className="mt-4">
        <CurveTradeFeed token={token} chain={chain} symbol={meta?.symbol} onTrades={setTrades} />
      </div>
    </div>
  );
}
