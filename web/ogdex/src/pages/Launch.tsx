import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Rocket, Wallet, Upload, Globe, Twitter, Send, Loader2, CheckCircle,
  Copy, ExternalLink, AlertTriangle, Sparkles, Image as ImageIcon, Info,
  ChevronDown, Settings2, Flame, Coins, ShieldCheck,
} from "lucide-react";
import {
  SUPPORTED_CHAINS, getChain, ChainConfig, Launchpad,
} from "../lib/chains";
import { getProvider, connectWallet } from "../lib/solana";
import { connectEvm, getEvmAddress, hasEvmWallet } from "../lib/launch/evm";
import { launchToken, LaunchOutcome, LaunchForm } from "../lib/launch";
import { VANITY_SUFFIX } from "../lib/vanity-mint";

const MAX_IMG = 5 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export default function Launch() {
  const [chainId, setChainId] = useState("solana");
  const chain = getChain(chainId);
  const [lpId, setLpId] = useState(chain.launchpads[0].id);
  const lp: Launchpad = useMemo(
    () => chain.launchpads.find((l) => l.id === lpId) || chain.launchpads[0],
    [chain, lpId]
  );
  const isEvm = chain.isEvm;
  const isErc20 = lp.kind === "erc20" || lp.kind === "bondingcurve";
  const isPump = lp.kind === "pumpfun";

  const [chainOpen, setChainOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [solWallet, setSolWallet] = useState<string | null>(null);
  const [evmWallet, setEvmWallet] = useState<string | null>(null);
  const wallet = isEvm ? evmWallet : solWallet;

  const [form, setForm] = useState({
    name: "", symbol: "", description: "",
    twitter: "", telegram: "", website: "",
    devBuySol: "0", vanity: true,
    supply: "1000000000", decimals: "18", renounce: false,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<LaunchOutcome | null>(null);
  const [copied, setCopied] = useState("");

  // When the chain changes, pick its first launchpad + close the picker.
  useEffect(() => { setLpId(getChain(chainId).launchpads[0].id); setChainOpen(false); setError(""); }, [chainId]);

  // Detect an already-connected wallet on mount / chain switch.
  useEffect(() => {
    const p = getProvider();
    if (p?.publicKey) setSolWallet(p.publicKey.toString());
    const a = getEvmAddress();
    if (a) setEvmWallet(a);
  }, []);

  const set = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const onConnect = async () => {
    setError("");
    try {
      if (isEvm) setEvmWallet(await connectEvm());
      else setSolWallet(await connectWallet());
    } catch (e: any) { setError(e.message || "Failed to connect wallet"); }
  };

  const onPickImage = (f: File | null) => {
    if (!f) return;
    if (!ACCEPTED.includes(f.type)) { setError("Image must be PNG, JPG, GIF or WEBP"); return; }
    if (f.size > MAX_IMG) { setError("Image must be under 5MB"); return; }
    setError("");
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(label); setTimeout(() => setCopied(""), 1500); });
  };

  const validate = () => {
    if (!wallet) return isEvm ? "Connect your EVM wallet first" : "Connect your Solana wallet first";
    if (!form.name.trim()) return "Token name is required";
    if (!form.symbol.trim()) return "Token symbol is required";
    if (isPump && !imageFile) return "Upload a token image";
    if (isErc20) {
      const s = Number(form.supply);
      if (!(s > 0)) return "Total supply must be greater than 0";
      const d = Number(form.decimals);
      if (!(d >= 0 && d <= 18)) return "Decimals must be between 0 and 18";
    }
    return "";
  };

  const launch = async () => {
    const v = validate();
    if (v) { setError(v); return; }
    setError(""); setBusy(true); setResult(null);
    try {
      const payload: LaunchForm = {
        name: form.name, symbol: form.symbol, description: form.description,
        twitter: form.twitter, telegram: form.telegram, website: form.website,
        imageFile,
        devBuySol: form.devBuySol, vanity: form.vanity,
        supply: form.supply, decimals: form.decimals, renounce: form.renounce,
      };
      const outcome = await launchToken(chain, lp, payload, wallet, setStatus);
      setResult(outcome);
      setStatus("");
    } catch (e: any) {
      setError(e.message || "Launch failed");
      setStatus("");
    } finally { setBusy(false); }
  };

  /* ── Success screen ── */
  if (result) return (
    <div className="max-w-lg mx-auto py-14 text-center space-y-5">
      <div className="w-16 h-16 rounded-full bg-up/15 grid place-items-center mx-auto">
        <CheckCircle className="w-9 h-9 text-up" />
      </div>
      <div>
        <h2 className="text-2xl font-black">Token Launched! 🚀</h2>
        <p className="text-muted text-sm mt-1">
          {form.name} (${form.symbol}) is live on <span className="text-white">{lp.name}</span> ({chain.name}) and added to the Launchpad feed.
        </p>
      </div>

      <div className="card p-4 space-y-3 text-left">
        <div>
          <div className="text-xs text-muted mb-1">Contract address (CA)</div>
          <div className="flex items-center gap-2 bg-panel2 rounded-lg px-3 py-2">
            <span className="font-mono text-xs text-white/80 break-all flex-1">{result.address}</span>
            <button onClick={() => copy(result.address, "ca")} className="shrink-0 text-muted hover:text-white">
              {copied === "ca" ? <CheckCircle className="w-4 h-4 text-up" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {result.links.external.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="btn bg-panel2 text-white text-xs inline-flex items-center justify-center gap-1 py-2">{l.label} <ExternalLink className="w-3 h-3" /></a>
          ))}
          <Link to={result.links.ogdex} className="btn bg-accent/15 text-accent text-xs inline-flex items-center justify-center gap-1 py-2">View data <ExternalLink className="w-3 h-3" /></Link>
        </div>
      </div>

      <div className="flex gap-2 justify-center pt-2">
        <Link to="/launchpad" className="btn bg-accent text-black font-bold px-5 py-2.5">Back to Launchpad</Link>
        <button onClick={() => { setResult(null); setImageFile(null); setImagePreview(""); setForm((f) => ({ ...f, name: "", symbol: "", description: "", twitter: "", telegram: "", website: "" })); }} className="btn bg-panel2 text-white px-5 py-2.5">Launch another</button>
      </div>
    </div>
  );

  /* ── Launcher form ── */
  return (
    <div className="max-w-xl mx-auto py-8 px-4 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Rocket className="w-5 h-5 text-accent" />
          <h1 className="text-2xl font-black">Launch a Token</h1>
        </div>
        <p className="text-muted text-sm">
          Launch across chains from one place — Solana via pump.fun, or any EVM chain. Pick your chain and launchpad below.
        </p>
      </div>

      {/* 1. Chain + launchpad */}
      <section className="space-y-3">
        <label className="text-xs font-semibold text-muted uppercase tracking-wide">1. Chain &amp; launchpad</label>

        {/* Chain dropdown */}
        <div className="relative">
          <button onClick={() => setChainOpen((o) => !o)}
            className="w-full card p-3 flex items-center gap-3 hover:border-accent/40 transition-colors">
            <span className="text-xl">{chain.emoji}</span>
            <div className="text-left flex-1">
              <div className="text-sm font-bold">{chain.name}</div>
              <div className="text-[11px] text-muted">Native: {chain.nativeCurrency}</div>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted transition-transform ${chainOpen ? "rotate-180" : ""}`} />
          </button>
          {chainOpen && (
            <div className="absolute z-20 mt-1 w-full max-h-72 overflow-auto card p-1 shadow-xl border-line">
              {SUPPORTED_CHAINS.map((c) => (
                <button key={c.id} onClick={() => setChainId(c.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-panel2 transition-colors ${c.id === chainId ? "bg-panel2" : ""}`}>
                  <span className="text-lg">{c.emoji}</span>
                  <span className="text-sm font-medium flex-1">{c.name}</span>
                  <span className="text-[10px] text-muted font-mono">{c.shortName}</span>
                  {c.id === chainId && <CheckCircle className="w-3.5 h-3.5 text-accent" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Launchpad picker */}
        <div className="grid gap-2">
          {chain.launchpads.map((l) => (
            <button key={l.id} onClick={() => setLpId(l.id)}
              className={`card p-3 flex items-center gap-3 text-left transition-colors ${l.id === lpId ? "border-accent/50 bg-accent/5" : "hover:border-line"}`}>
              <span className="text-xl">{l.emoji}</span>
              <div className="flex-1">
                <div className="text-sm font-bold flex items-center gap-2">
                  {l.name}
                  {l.status === "soon"
                    ? <span className="pill bg-yellow-400/15 text-yellow-400 text-[9px]">SOON</span>
                    : <span className="pill bg-up/15 text-up text-[9px]">LIVE</span>}
                </div>
                <div className="text-[11px] text-muted">{l.description}</div>
              </div>
              {l.id === lpId && <CheckCircle className="w-4 h-4 text-accent shrink-0" />}
            </button>
          ))}
        </div>

        {lp.status === "soon" && (
          <div className="flex items-start gap-2 text-[11px] text-yellow-400/90 bg-yellow-400/5 rounded-lg p-2.5 border border-yellow-400/20">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {lp.name} integration is being wired up next. For now you can launch a real token on {chain.name} with <strong>Standard Token</strong>, or launch on Solana via pump.fun.
          </div>
        )}
      </section>

      {/* 2. Wallet */}
      <section className="space-y-2">
        <label className="text-xs font-semibold text-muted uppercase tracking-wide">2. Connect {isEvm ? "EVM" : "Solana"} wallet</label>
        {wallet ? (
          <div className="card p-3 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-up" />
            <span className="font-mono text-sm text-white/80">{wallet.slice(0, 6)}…{wallet.slice(-4)}</span>
            <span className="ml-auto pill bg-up/15 text-up text-[10px]">Connected</span>
          </div>
        ) : (
          <button onClick={onConnect} className="w-full btn bg-accent text-black font-bold py-3 inline-flex items-center justify-center gap-2">
            <Wallet className="w-4 h-4" /> {isEvm ? "Connect EVM wallet" : "Connect Phantom"}
          </button>
        )}
        {isEvm && !hasEvmWallet() && !wallet && (
          <div className="text-[11px] text-muted">No EVM wallet detected — install MetaMask (or Rabby / Phantom-EVM) to launch on {chain.name}.</div>
        )}
      </section>

      {/* 3. Token details */}
      <section className="space-y-3">
        <label className="text-xs font-semibold text-muted uppercase tracking-wide">3. Token details</label>
        <div className="grid grid-cols-2 gap-3">
          <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Token name" maxLength={32}
            className="card p-3 text-sm bg-transparent outline-none placeholder:text-muted/40" />
          <input value={form.symbol} onChange={(e) => set("symbol", e.target.value.toUpperCase())} placeholder="SYMBOL" maxLength={10}
            className="card p-3 text-sm bg-transparent outline-none placeholder:text-muted/40 font-mono" />
        </div>
        <textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Description (optional)" rows={3}
          className="card w-full p-3 text-sm bg-transparent outline-none placeholder:text-muted/40 resize-none" />

        {/* Image */}
        <div onClick={() => fileRef.current?.click()}
          className="card p-4 flex items-center gap-3 cursor-pointer hover:border-accent/40 transition-colors">
          {imagePreview
            ? <img src={imagePreview} className="w-12 h-12 rounded-lg object-cover" />
            : <div className="w-12 h-12 rounded-lg bg-panel2 grid place-items-center"><ImageIcon className="w-5 h-5 text-muted" /></div>}
          <div className="flex-1">
            <div className="text-sm font-medium flex items-center gap-1.5"><Upload className="w-3.5 h-3.5 text-accent" /> {imageFile ? imageFile.name : "Upload token image"}</div>
            <div className="text-xs text-muted">PNG, JPG, GIF or WEBP — max 5MB{isErc20 ? " (optional)" : ""}</div>
          </div>
          <input ref={fileRef} type="file" accept={ACCEPTED.join(",")} className="hidden"
            onChange={(e) => onPickImage(e.target.files?.[0] || null)} />
        </div>

        {/* Socials */}
        <div className="grid gap-2">
          <div className="card p-2.5 flex items-center gap-2"><Twitter className="w-4 h-4 text-muted shrink-0" /><input value={form.twitter} onChange={(e) => set("twitter", e.target.value)} placeholder="Twitter / X (optional)" className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted/40" /></div>
          <div className="card p-2.5 flex items-center gap-2"><Send className="w-4 h-4 text-muted shrink-0" /><input value={form.telegram} onChange={(e) => set("telegram", e.target.value)} placeholder="Telegram (optional)" className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted/40" /></div>
          <div className="card p-2.5 flex items-center gap-2"><Globe className="w-4 h-4 text-muted shrink-0" /><input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="Website (optional)" className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted/40" /></div>
        </div>
      </section>

      {/* 4. Advanced / customization */}
      <section className="space-y-3">
        <button onClick={() => setShowAdvanced((s) => !s)} className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wide hover:text-white transition-colors">
          <Settings2 className="w-3.5 h-3.5" /> 4. Advanced options
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
        </button>

        {showAdvanced && (
          <div className="space-y-2.5">
            {isPump && (
              <>
                <div className="card p-3 flex items-center gap-3">
                  <Sparkles className="w-4 h-4 text-accent shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Dev buy (optional)</div>
                    <div className="text-xs text-muted">Buy your own token at launch, in SOL</div>
                  </div>
                  <input type="number" min="0" step="0.01" value={form.devBuySol} onChange={(e) => set("devBuySol", e.target.value)}
                    className="w-24 bg-panel2 rounded-lg px-3 py-1.5 text-sm text-right outline-none font-mono" />
                </div>
                <label className="card p-3 flex items-center gap-3 cursor-pointer">
                  <Coins className="w-4 h-4 text-accent shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Custom vanity CA</div>
                    <div className="text-xs text-muted">Contract address ends in …{VANITY_SUFFIX}</div>
                  </div>
                  <input type="checkbox" checked={form.vanity} onChange={(e) => set("vanity", e.target.checked)} className="w-4 h-4 accent-[color:var(--accent,#00FFA3)]" />
                </label>
              </>
            )}

            {isErc20 && (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="card p-3">
                    <div className="text-xs text-muted mb-1">Total supply</div>
                    <input type="number" min="1" value={form.supply} onChange={(e) => set("supply", e.target.value)}
                      className="w-full bg-transparent text-sm outline-none font-mono" />
                  </div>
                  <div className="card p-3">
                    <div className="text-xs text-muted mb-1">Decimals</div>
                    <input type="number" min="0" max="18" value={form.decimals} onChange={(e) => set("decimals", e.target.value)}
                      className="w-full bg-transparent text-sm outline-none font-mono" />
                  </div>
                </div>
                <label className="card p-3 flex items-center gap-3 cursor-pointer">
                  <Flame className="w-4 h-4 text-accent shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Renounce ownership on launch</div>
                    <div className="text-xs text-muted">Locks supply permanently — no future minting (trustless)</div>
                  </div>
                  <input type="checkbox" checked={form.renounce} onChange={(e) => set("renounce", e.target.checked)} className="w-4 h-4" />
                </label>
                <div className="flex items-start gap-2 text-[11px] text-muted">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-accent" />
                  Deploys a real ERC-20 (holder burn + optional owner mint). Add liquidity on {chain.name}'s DEX after launch to make it tradable.
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {error && (
        <div className="flex items-start gap-2 text-down text-sm bg-down/10 rounded-lg p-3 border border-down/20">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
        </div>
      )}

      <button onClick={launch} disabled={busy}
        className="w-full btn bg-accent text-black font-bold py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2">
        {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> {status || "Launching…"}</> : <><Rocket className="w-4 h-4" /> Launch on {lp.name}</>}
      </button>

      <div className="card p-4 space-y-2 text-xs text-muted border-line">
        <div className="flex items-center gap-1.5 font-semibold text-white text-sm mb-1"><Info className="w-4 h-4 text-accent" /> How it works</div>
        <p>1. Pick your chain + launchpad, connect the matching wallet, fill in token details.</p>
        <p>2. {isEvm ? `You pay only ${chain.nativeCurrency} network gas — no launch fee.` : "Launching is free — just the standard Solana network fee."}</p>
        <p>3. Confirm the transaction in your wallet; your token deploys and you get the CA + links.</p>
        <p>4. It's added to the <strong className="text-white">Launchpad feed</strong> and opens in the full token page.</p>
      </div>
    </div>
  );
}
