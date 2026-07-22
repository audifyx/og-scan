// OrbitX Launchpad — THIRD LANE: API LAUNCH. Multi-chain launch console.
//
// Solana: PumpPortal (pump.fun) + Token-2022 custom lane — live, OBX vanity CA.
// EVM (11 chains): OrbitX Direct Deploy — connect any EIP-6963 wallet or
// WalletConnect (incl. Robinhood Wallet), auto switch/add network, deploy a
// fixed-supply ERC-20 from your own wallet, registered in orbitx_tokens.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight, CheckCircle2, Clock3, ExternalLink, FlaskConical, Globe2,
  Loader2, Plug, Rocket, ShieldCheck, Wallet as WalletIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  CHAINS, chainById, providersForChain, explorerTxUrl, explorerAddressUrl,
  type ChainDef, type RolloutStatus,
} from "@/lib/orbitx/chains";
import {
  discoverWallets, connectWallet, connectWalletConnect, ensureChain,
  sendDeployTransaction, waitForReceipt, shortAddr, WALLETCONNECT_PROJECT_ID,
  type DiscoveredWallet, type Eip1193Provider,
} from "@/lib/evm/wallet";
import { buildDeployData, toRawSupply } from "@/lib/evm/erc20";

const STATUS_META: Record<RolloutStatus, { label: string; cls: string; Icon: React.ComponentType<{ className?: string }> }> = {
  live: { label: "Live", cls: "border-[hsl(var(--og-lime))]/40 bg-[hsl(var(--og-lime))]/10 text-[hsl(var(--og-lime))]", Icon: CheckCircle2 },
  beta: { label: "Beta", cls: "border-[hsl(var(--og-cyan))]/40 bg-[hsl(var(--og-cyan))]/10 text-[hsl(var(--og-cyan))]", Icon: FlaskConical },
  soon: { label: "Soon", cls: "border-white/15 bg-white/5 text-muted-foreground", Icon: Clock3 },
};

function StatusChip({ status }: { status: RolloutStatus }) {
  const { label, cls, Icon } = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest ${cls}`}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

type Phase = "idle" | "deploying" | "confirming" | "done";

export default function LaunchpadApiLaunch() {
  const [chainId, setChainId] = useState("solana");
  const chain: ChainDef = chainById(chainId) ?? CHAINS[0];
  const providers = useMemo(() => providersForChain(chain.id), [chain.id]);

  // ── EVM wallet state ──
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);
  const [evmProvider, setEvmProvider] = useState<Eip1193Provider | null>(null);
  const [account, setAccount] = useState("");
  const [connecting, setConnecting] = useState("");

  // ── launch form ──
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [supply, setSupply] = useState("1000000000");
  const [phase, setPhase] = useState<Phase>("idle");
  const [txHash, setTxHash] = useState("");
  const [tokenAddr, setTokenAddr] = useState("");

  const isEvm = chain.family === "evm" && !!chain.evm;

  useEffect(() => {
    if (!isEvm) return;
    let on = true;
    discoverWallets().then((w) => { if (on) setWallets(w); });
    return () => { on = false; };
  }, [isEvm]);

  const pickInjected = async (w: DiscoveredWallet) => {
    setConnecting(w.info.uuid);
    try {
      const acct = await connectWallet(w.provider);
      setEvmProvider(w.provider);
      setAccount(acct);
      toast.success(`Connected ${w.info.name} · ${shortAddr(acct)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Wallet connection failed");
    } finally { setConnecting(""); }
  };

  const pickWalletConnect = async () => {
    setConnecting("walletconnect");
    try {
      const ids = CHAINS.filter((c) => c.evm).map((c) => parseInt(c.evm!.chainIdHex, 16));
      const { provider, account: acct } = await connectWalletConnect(WALLETCONNECT_PROJECT_ID, ids);
      setEvmProvider(provider);
      setAccount(acct);
      toast.success(`Connected via WalletConnect · ${shortAddr(acct)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "WalletConnect failed");
    } finally { setConnecting(""); }
  };

  const deploy = async () => {
    if (!evmProvider || !account || !chain.evm) return;
    const n = name.trim();
    const s = symbol.trim().toUpperCase();
    if (!n || n.length > 64) { toast.error("Name: 1-64 characters"); return; }
    if (!/^[A-Z0-9]{1,11}$/.test(s)) { toast.error("Symbol: 1-11 letters/numbers"); return; }
    let raw: bigint;
    try { raw = toRawSupply(supply); if (raw <= 0n) throw new Error(); } catch { toast.error("Invalid supply"); return; }

    try {
      setPhase("deploying");
      await ensureChain(evmProvider, chain.evm);
      const hash = await sendDeployTransaction(evmProvider, account, buildDeployData(n, s, raw));
      setTxHash(hash);
      setPhase("confirming");
      const receipt = await waitForReceipt(evmProvider, hash);
      if (receipt.status !== "0x1" || !receipt.contractAddress) throw new Error("Deploy reverted — check the tx in the explorer");
      setTokenAddr(receipt.contractAddress);
      setPhase("done");
      toast.success(`${s} is live on ${chain.name}`);
      try {
        await supabase.from("orbitx_tokens").insert({
          mint_address: receipt.contractAddress,
          name: n,
          ticker: s,
          name_normalized: n.toLowerCase(),
          ticker_normalized: s.toLowerCase(),
          creator_wallet: account,
          decimals: 18,
          supply: Number(supply.replace(/[,_\s]/g, "")),
          chain: chain.id,
          chain_tx_hash: hash,
          mint_signature: hash,
          launch_type: "evm-direct",
          cluster: "mainnet",
        });
      } catch { /* registry insert is best-effort */ }
    } catch (e) {
      setPhase(txHash ? "confirming" : "idle");
      setPhase("idle");
      toast.error(e instanceof Error ? e.message : "Launch failed");
    }
  };

  const resetLaunch = () => { setPhase("idle"); setTxHash(""); setTokenAddr(""); setName(""); setSymbol(""); };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.34em] text-[hsl(var(--og-gold))]">// third lane — api launch</div>
        <h1 className="mt-2 font-display text-3xl font-black tracking-tight">
          LAUNCH ON <span className="lpx-glow text-[hsl(var(--og-gold))]">{chain.name.toUpperCase()}</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Solana with <span className="text-[hsl(var(--og-gold))]">OBX vanity CA</span> · 11 EVM chains via direct in-wallet deploy · Robinhood Wallet supported through WalletConnect.
        </p>
      </div>

      {/* chain rail */}
      <div className="lpx-panel mb-6 p-4">
        <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <Globe2 className="h-3.5 w-3.5" /> Select chain · {CHAINS.length} registered
        </div>
        <div className="flex flex-wrap gap-2">
          {CHAINS.map((c) => (
            <button
              key={c.id}
              onClick={() => { setChainId(c.id); resetLaunch(); }}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-[11px] font-bold transition ${
                c.id === chain.id
                  ? "border-[hsl(var(--og-gold))]/60 bg-[hsl(var(--og-gold))]/10 text-foreground"
                  : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/25 hover:text-foreground"
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
              {c.name}
              <StatusChip status={c.status} />
            </button>
          ))}
        </div>
      </div>

      {/* ── SOLANA: the two live lanes ── */}
      {chain.id === "solana" && (
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <div className="lpx-panel flex flex-col p-6">
            <div className="mb-2 flex items-center gap-2"><Rocket className="h-4 w-4 text-[hsl(var(--og-cyan))]" /><span className="font-display text-base font-black">PUMP LANE</span><StatusChip status="live" /></div>
            <p className="mb-4 flex-1 text-sm text-muted-foreground">pump.fun bonding curve via PumpPortal — zero seeded liquidity, auto-graduation, OBX vanity CA, claim fees in-app.</p>
            <Link to="/orbitxlaunch/create/pump" className="lpx-btn w-full !border-[hsl(var(--og-cyan))]/50 !text-[hsl(var(--og-cyan))] hover:!bg-[hsl(var(--og-cyan))]/15">Deploy pump-style <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="lpx-panel flex flex-col p-6">
            <div className="mb-2 flex items-center gap-2"><Rocket className="h-4 w-4 text-[hsl(var(--og-lime))]" /><span className="font-display text-base font-black">CUSTOM LANE</span><StatusChip status="live" /></div>
            <p className="mb-4 flex-1 text-sm text-muted-foreground">Your own Token-2022 mint — on-chain 0.30% creator fee, revocable authorities, optional Raydium pool, OBX vanity grind.</p>
            <Link to="/orbitxlaunch/create/custom" className="lpx-btn w-full !border-[hsl(var(--og-lime))]/50 !text-[hsl(var(--og-lime))] hover:!bg-[hsl(var(--og-lime))]/15">Deploy custom <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      )}

      {/* ── EVM: direct-deploy console ── */}
      {isEvm && (
        <div className="lpx-panel mb-6 p-6">
          <div className="mb-4 flex items-center gap-2">
            <WalletIcon className="h-4 w-4 text-[hsl(var(--og-gold))]" />
            <span className="font-display text-base font-black">DIRECT DEPLOY · {chain.name.toUpperCase()}</span>
            <StatusChip status={chain.status} />
          </div>

          {!account ? (
            <div>
              <p className="mb-3 text-sm text-muted-foreground">Connect an EVM wallet — the network is added/switched automatically.</p>
              <div className="flex flex-wrap gap-2">
                {wallets.map((w) => (
                  <button key={w.info.uuid} onClick={() => pickInjected(w)} disabled={!!connecting}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[11px] font-bold text-foreground transition hover:border-white/25 disabled:opacity-50">
                    {connecting === w.info.uuid ? <Loader2 className="h-4 w-4 animate-spin" /> : w.info.icon ? <img src={w.info.icon} alt="" className="h-4 w-4 rounded" /> : <WalletIcon className="h-4 w-4" />}
                    {w.info.name}
                  </button>
                ))}
                {WALLETCONNECT_PROJECT_ID ? (
                  <button onClick={pickWalletConnect} disabled={!!connecting}
                    className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--og-cyan))]/40 bg-[hsl(var(--og-cyan))]/10 px-3 py-2 font-mono text-[11px] font-bold text-[hsl(var(--og-cyan))] transition hover:bg-[hsl(var(--og-cyan))]/20 disabled:opacity-50">
                    {connecting === "walletconnect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                    WalletConnect · Robinhood Wallet & mobile
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[10px] text-muted-foreground">
                    <Plug className="h-3.5 w-3.5" /> Robinhood Wallet / mobile: set VITE_WALLETCONNECT_PROJECT_ID (free at cloud.reown.com)
                  </span>
                )}
                {wallets.length === 0 && (
                  <span className="font-mono text-[11px] text-muted-foreground">No injected wallet found — install MetaMask / Rabby / Coinbase Wallet, or use WalletConnect.</span>
                )}
              </div>
            </div>
          ) : phase === "done" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[hsl(var(--og-lime))]"><CheckCircle2 className="h-5 w-5" /><span className="font-display text-lg font-black">{symbol.toUpperCase()} IS LIVE ON {chain.name.toUpperCase()}</span></div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 font-mono text-[12px]">
                <div className="mb-1 text-muted-foreground">Contract address</div>
                <div className="break-all text-foreground">{tokenAddr}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={explorerAddressUrl(chain, tokenAddr)} target="_blank" rel="noreferrer" className="lpx-btn !border-[hsl(var(--og-lime))]/50 !text-[hsl(var(--og-lime))]">View token <ExternalLink className="h-3.5 w-3.5" /></a>
                <a href={explorerTxUrl(chain, txHash)} target="_blank" rel="noreferrer" className="lpx-btn">Deploy tx <ExternalLink className="h-3.5 w-3.5" /></a>
                <button onClick={resetLaunch} className="lpx-btn">Launch another</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                <span>Connected: <span className="text-foreground">{shortAddr(account)}</span></span>
                <button onClick={() => { setAccount(""); setEvmProvider(null); }} className="underline hover:text-foreground">disconnect</button>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Token name</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={64} placeholder="OrbitX Coin"
                    className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-[hsl(var(--og-gold))]/50" />
                </label>
                <label className="block">
                  <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Symbol</span>
                  <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} maxLength={11} placeholder="OBX"
                    className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-[hsl(var(--og-gold))]/50" />
                </label>
                <label className="block">
                  <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Supply (18 decimals)</span>
                  <input value={supply} onChange={(e) => setSupply(e.target.value)} placeholder="1000000000"
                    className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-[hsl(var(--og-gold))]/50" />
                </label>
              </div>
              <button onClick={deploy} disabled={phase !== "idle"}
                className="lpx-btn w-full !border-[hsl(var(--og-gold))]/50 !text-[hsl(var(--og-gold))] hover:!bg-[hsl(var(--og-gold))]/15 disabled:opacity-60">
                {phase === "deploying" ? (<><Loader2 className="h-4 w-4 animate-spin" /> Confirm in wallet…</>)
                  : phase === "confirming" ? (<><Loader2 className="h-4 w-4 animate-spin" /> Confirming on {chain.name}…</>)
                  : (<><Rocket className="h-4 w-4" /> Deploy {symbol ? symbol.toUpperCase() : "token"} on {chain.name}</>)}
              </button>
              <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
                Fixed-supply ERC-20 · full supply to your wallet · no owner keys, no mint function, immutable.
                Gas is the only cost. Note: EVM addresses are hex-only, so an "obx" CA is physically impossible here —
                OBX vanity stays on Solana; CREATE2 hex-pattern vanity is next.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Robinhood Chain (and any chain without public params) ── */}
      {chain.family === "evm" && !chain.evm && (
        <div className="lpx-panel mb-6 p-6 text-center">
          <Clock3 className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{chain.note ?? `${chain.name} flips live when public network params ship.`}</p>
        </div>
      )}

      {/* providers for the selected chain */}
      <div className="space-y-4">
        {providers.map((p) => (
          <div key={p.id} className="lpx-panel relative flex flex-col gap-4 p-6 md:flex-row md:items-center">
            <div className="md:min-w-[240px]">
              <div className="mb-1 flex items-center gap-2">
                <Plug className="h-4 w-4 text-[hsl(var(--og-gold))]" />
                <span className="font-display text-base font-black">{p.name}</span>
              </div>
              <StatusChip status={p.status} />
            </div>
            <div className="flex-1">
              <p className="text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">API: {p.api}</p>
              {p.requires && p.requires.length > 0 && (
                <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[hsl(var(--og-gold))]/80">Goes live with: {p.requires.join(" · ")}</p>
              )}
            </div>
            {p.status === "live" && p.route && p.route !== "/orbitxlaunch/create/api" ? (
              <Link to={p.route} className="lpx-btn w-full !border-[hsl(var(--og-lime))]/50 !text-[hsl(var(--og-lime))] hover:!bg-[hsl(var(--og-lime))]/15 md:w-auto">Launch now <ArrowRight className="h-4 w-4" /></Link>
            ) : p.status === "live" ? (
              <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[hsl(var(--og-lime))]/30 bg-[hsl(var(--og-lime))]/5 px-5 py-3 font-display text-xs font-black uppercase tracking-wider text-[hsl(var(--og-lime))] md:w-auto"><CheckCircle2 className="h-4 w-4" /> Console above</span>
            ) : (
              <span className="inline-flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-5 py-3 font-display text-xs font-black uppercase tracking-wider text-muted-foreground md:w-auto"><Clock3 className="h-4 w-4" /> Coming online</span>
            )}
          </div>
        ))}
      </div>

      <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-[hsl(var(--og-lime))]" />
        every lane is non-custodial — transactions are signed only in your wallet · OrbitX never holds keys or funds
      </p>
    </div>
  );
}
