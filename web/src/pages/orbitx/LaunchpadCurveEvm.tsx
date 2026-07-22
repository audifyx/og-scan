// OrbitX Curve (EVM) — keyless pump-style bonding-curve launches from the user's
// wallet, using OrbitX's OWN factory (contracts/evm/OrbitXCurve.sol). No API,
// no server, no custody. Beta: the curve contract is unaudited.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight, CheckCircle2, Copy, ExternalLink, Loader2, QrCode, Rocket,
  ShieldCheck, Smartphone, TriangleAlert, Wallet as WalletIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { evmChains, chainById, explorerTxUrl, explorerAddressUrl, type ChainDef } from "@/lib/orbitx/chains";
import {
  discoverWallets, connectWallet, connectWalletConnect, ensureChain, shortAddr,
  mobileWalletDeepLinks, WALLETCONNECT_PROJECT_ID,
  type DiscoveredWallet, type Eip1193Provider,
} from "@/lib/evm/wallet";
import { launchCurveToken, DEFAULT_CURVE_CONFIG } from "@/lib/evm/curve";

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

  const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);
  const [provider, setProvider] = useState<Eip1193Provider | null>(null);
  const [account, setAccount] = useState("");
  const [connecting, setConnecting] = useState("");

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [firstBuy, setFirstBuy] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [txHash, setTxHash] = useState("");
  const [tokenAddr, setTokenAddr] = useState("");

  const feeConfigured = !!DEFAULT_CURVE_CONFIG.platform;

  useEffect(() => {
    let on = true;
    discoverWallets().then((w) => { if (on) setWallets(w); });
    return () => { on = false; };
  }, []);

  const pick = async (w: DiscoveredWallet) => {
    setConnecting(w.info.uuid);
    try {
      const acct = await connectWallet(w.provider);
      setProvider(w.provider);
      setAccount(acct);
      toast.success(`Connected ${w.info.name} · ${shortAddr(acct)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Wallet connection failed");
    } finally { setConnecting(""); }
  };

  const pickWalletConnect = async () => {
    if (!WALLETCONNECT_PROJECT_ID) { toast.error("WalletConnect needs VITE_WALLETCONNECT_PROJECT_ID"); return; }
    setConnecting("walletconnect");
    try {
      const ids = chains.map((c) => parseInt(c.evm!.chainIdHex, 16));
      const { provider: wc, account: acct } = await connectWalletConnect(WALLETCONNECT_PROJECT_ID, ids);
      setProvider(wc);
      setAccount(acct);
      toast.success(`Connected · ${shortAddr(acct)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "WalletConnect failed");
    } finally { setConnecting(""); }
  };

  const copyForRobinhood = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied — paste it in Robinhood Wallet's in-app browser");
    } catch { toast.error("Copy failed"); }
  };

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
        <div className="lpx-panel space-y-4 p-4">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <WalletIcon className="h-3.5 w-3.5" /> Connect a wallet — every EVM chain, any wallet
          </div>

          {/* Injected wallets (EIP-6963): MetaMask, Rabby, Coinbase, OKX, Brave, Robinhood extension… */}
          <div>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Browser wallets</div>
            {wallets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No injected wallet detected — use WalletConnect or a mobile option below.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {wallets.map((w) => (
                  <button key={w.info.uuid} onClick={() => pick(w)} disabled={!!connecting}
                    className="flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm hover:border-white/25 disabled:opacity-50">
                    {connecting === w.info.uuid
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : (w.info.icon ? <img src={w.info.icon} alt="" className="h-4 w-4 rounded" /> : <WalletIcon className="h-4 w-4" />)}
                    {w.info.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* WalletConnect — QR / mobile deep link for Rabby, Robinhood, MetaMask mobile & more */}
          <div>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Mobile & WalletConnect</div>
            <div className="flex flex-wrap gap-2">
              <button onClick={pickWalletConnect} disabled={connecting === "walletconnect"}
                className="flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm hover:border-white/25 disabled:opacity-50">
                {connecting === "walletconnect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                WalletConnect
              </button>
              <button onClick={copyForRobinhood}
                className="flex items-center gap-2 rounded-md border border-[#00C805]/30 bg-[#00C805]/5 px-3 py-2 text-sm text-[#00C805] hover:border-[#00C805]/60">
                <Copy className="h-4 w-4" /> Robinhood Wallet link
              </button>
              {mobileWalletDeepLinks().map((d) => (
                <a key={d.name} href={d.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm hover:border-white/25">
                  <Smartphone className="h-4 w-4" /> {d.name}
                </a>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground/70">
              On mobile, open this page inside your wallet's in-app browser (or paste the Robinhood link) for a fully keyless connect.
            </p>
          </div>
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
