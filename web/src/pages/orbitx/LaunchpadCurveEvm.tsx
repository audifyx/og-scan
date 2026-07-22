// OrbitX Curve (EVM) — keyless pump-style bonding-curve launches from the user's
// wallet, using OrbitX's OWN factory (contracts/evm/OrbitXCurve.sol). No API,
// no server, no custody. Beta: the curve contract is unaudited.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight, CheckCircle2, ExternalLink, Loader2, Rocket,
  ShieldCheck, TriangleAlert, Wallet as WalletIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { evmChains, chainById, explorerTxUrl, explorerAddressUrl, type ChainDef } from "@/lib/orbitx/chains";
import { ensureChain, shortAddr } from "@/lib/evm/wallet";
import { launchCurveToken, readMarketState, DEFAULT_CURVE_CONFIG } from "@/lib/evm/curve";
import { useEvmWallet } from "@/hooks/useEvmWallet";

type Phase = "idle" | "deploying" | "done";

function parseNative(v: string): bigint {
  const s = v.trim();
  if (!s) return 0n;
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error("Invalid amount");
  const [int, frac = ""] = s.split(".");
  return BigInt(int) * 10n ** 18n + BigInt((frac + "0".repeat(18)).slice(0, 18) || "0");
}

export default function LaunchpadCurveEvm() {
  const chains = useMemo(() => evmChains(), []);
  const [chainId, setChainId] = useState("robinhood");
  const chain: ChainDef = chainById(chainId) ?? chains[0];

  const { account, provider, openConnect } = useEvmWallet();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [firstBuy, setFirstBuy] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [txHash, setTxHash] = useState("");
  const [tokenAddr, setTokenAddr] = useState("");

  const feeConfigured = !!DEFAULT_CURVE_CONFIG.platform;

  const launch = async () => {
    if (!provider || !account || !chain.evm) return;
    const n = name.trim();
    const s = symbol.trim().toUpperCase();
    if (!n || n.length > 64) { toast.error("Name: 1-64 characters"); return; }
    if (!/^[A-Z0-9]{1,11}$/.test(s)) { toast.error("Symbol: 1-11 letters/numbers"); return; }
    if (!feeConfigured) { toast.error("Platform fee wallet not configured (VITE_ORBITX_FEE_WALLET)"); return; }
    let initialBuyWei: bigint;
    try { initialBuyWei = parseNative(firstBuy); } catch { toast.error("Invalid first-buy amount"); return; }

    try {
      setPhase("deploying");
      await ensureChain(provider, chain.evm);
      const res = await launchCurveToken(provider, account, n, s, initialBuyWei);
      setTxHash(res.txHash);
      setTokenAddr(res.token);
      setPhase("done");
      toast.success(`${s} curve is live on ${chain.name}`);
      try {
        await supabase.from("orbitx_tokens").insert({
          mint_address: res.token,
          name: n,
          ticker: s,
          name_normalized: n.toLowerCase(),
          ticker_normalized: s.toLowerCase(),
          creator_wallet: account,
          decimals: 18,
          supply: Number(DEFAULT_CURVE_CONFIG.totalSupply / 10n ** 18n),
          chain: chain.id,
          chain_tx_hash: res.txHash,
          mint_signature: res.txHash,
          launch_type: "evm-curve",
          cluster: "mainnet",
        });
      } catch { /* registry insert is best-effort */ }
      try {
        const cfg = DEFAULT_CURVE_CONFIG;
        const st = await readMarketState(provider, res.token).catch(() => null);
        await supabase.from("orbitx_curve_markets").insert({
          token_address: res.token,
          chain: chain.id,
          factory_address: res.factory,
          creator_wallet: account,
          name: n,
          symbol: s,
          fee_bps: cfg.feeBps,
          creator_fee_bps: cfg.creatorFeeBps,
          virtual_native: cfg.virtualNative.toString(),
          graduation_native: cfg.graduationNative.toString(),
          real_native: (st?.realNative ?? 0n).toString(),
          token_reserve: (st?.tokenReserve ?? cfg.curveSupply).toString(),
          price_x1e18: (st?.priceX1e18 ?? 0n).toString(),
          graduated: st?.graduated ?? false,
          launch_tx: res.txHash,
        });
      } catch { /* curve market insert is best-effort */ }
    } catch (e) {
      setPhase("idle");
      toast.error(e instanceof Error ? e.message : "Launch failed");
    }
  };

  const reset = () => { setPhase("idle"); setTxHash(""); setTokenAddr(""); setName(""); setSymbol(""); setFirstBuy(""); };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.34em] text-[hsl(var(--og-gold))]">
          // orbitx curve · pump economics · keyless · beta
        </div>
        <h1 className="mt-2 font-display text-3xl font-black tracking-tight">
          CURVE LAUNCH ON <span className="text-[hsl(var(--og-gold))]">{chain.name.toUpperCase()}</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          OrbitX's own bonding-curve factory: virtual reserves, on-chain creator fees, auto-graduation.
          Deployed straight from your wallet — no API, no keys, no custody.
        </p>
        <Link to="/orbitxlaunch/curves" className="mt-2 inline-block text-xs text-[hsl(var(--og-gold))] underline">Browse live curves</Link>
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-[hsl(var(--og-gold))]/30 bg-[hsl(var(--og-gold))]/5 p-3 text-xs text-muted-foreground">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--og-gold))]" />
        <span>
          Beta. This is OrbitX's own MIT-licensed curve contract (not a copy of any other launchpad).
          It is unaudited — treat mainnet launches as experimental until the factory is audited.
        </span>
      </div>

      <div className="lpx-panel mb-4 p-4">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Chain</div>
        <div className="flex flex-wrap gap-2">
          {chains.map((c) => (
            <button
              key={c.id}
              onClick={() => setChainId(c.id)}
              className={`rounded-md border px-3 py-1.5 text-sm ${c.id === chainId ? "border-[hsl(var(--og-gold))] bg-[hsl(var(--og-gold))]/10" : "border-white/10 hover:border-white/25"}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {!account ? (
        <div className="lpx-panel space-y-3 p-4">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <WalletIcon className="h-3.5 w-3.5" /> Link an EVM wallet to launch
          </div>
          <p className="text-sm text-muted-foreground">
            Your Solana wallet is your login. Link an EVM wallet (MetaMask, Rabby, Robinhood, WalletConnect) to deploy on {chain.name} — it's remembered across the app.
          </p>
          <button onClick={openConnect} className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--og-gold))] px-4 py-2 text-sm font-bold text-black">
            <WalletIcon className="h-4 w-4" /> Link EVM wallet
          </button>
        </div>
      ) : phase === "done" ? (
        <div className="lpx-panel p-6 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-[hsl(var(--og-lime))]" />
          <div className="font-display text-xl font-bold">{symbol} is live</div>
          <div className="mt-3 space-y-1 text-sm">
            <a className="inline-flex items-center gap-1 text-[hsl(var(--og-gold))]" href={explorerAddressUrl(chain, tokenAddr)} target="_blank" rel="noreferrer">
              {shortAddr(tokenAddr)} <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <div>
              <a className="inline-flex items-center gap-1 text-muted-foreground" href={explorerTxUrl(chain, txHash)} target="_blank" rel="noreferrer">
                launch tx <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
          <div className="mt-4 flex justify-center gap-2">
            <Link to={`/orbitxlaunch/curve/${tokenAddr}`} className="rounded-md bg-[hsl(var(--og-gold))] px-4 py-2 text-sm font-bold text-black">Trade it</Link>
            <button onClick={reset} className="rounded-md border border-white/10 px-4 py-2 text-sm hover:border-white/25">Launch another</button>
            <Link to="/orbitxlaunch" className="rounded-md border border-white/10 px-4 py-2 text-sm hover:border-white/25">Back to launchpad</Link>
          </div>
        </div>
      ) : (
        <div className="lpx-panel space-y-3 p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-[hsl(var(--og-lime))]" /> {shortAddr(account)}</span>
            <span>{DEFAULT_CURVE_CONFIG.feeBps / 100}% fee · grad at {Number(DEFAULT_CURVE_CONFIG.graduationNative) / 1e18} {chain.symbol}</span>
          </div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Token name" maxLength={64}
            className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-[hsl(var(--og-gold))]" />
          <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="TICKER" maxLength={11}
            className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm uppercase outline-none focus:border-[hsl(var(--og-gold))]" />
          <input value={firstBuy} onChange={(e) => setFirstBuy(e.target.value)} placeholder={`Optional first buy (${chain.symbol})`}
            className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-[hsl(var(--og-gold))]" />
          {!feeConfigured && (
            <p className="text-xs text-[hsl(var(--og-gold))]">Set VITE_ORBITX_FEE_WALLET before launching so the shared factory address is fixed.</p>
          )}
          <button onClick={launch} disabled={phase === "deploying"}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-[hsl(var(--og-gold))] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-60">
            {phase === "deploying" ? <><Loader2 className="h-4 w-4 animate-spin" /> Launching…</> : <><Rocket className="h-4 w-4" /> Launch curve <ArrowRight className="h-4 w-4" /></>}
          </button>
        </div>
      )}
    </div>
  );
}
