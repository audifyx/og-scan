import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Rocket, Wallet, Upload, Globe, Twitter, Send, Loader2, CheckCircle,
  Copy, ExternalLink, AlertTriangle, Sparkles, Image as ImageIcon, Info,
} from "lucide-react";
import { getLaunchConfig, launchStep, LaunchConfig } from "../lib/api";
import {
  getProvider, connectWallet, payFee, newMintKeypair,
  signAndSendCreate, fileToBase64,
} from "../lib/solana";

const MAX_IMG = 5 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/gif", "image/webp"];

type Currency = "sol" | "usdc" | "usdt";

interface Result {
  mint: string;
  paymentTx: string;
  launchTx: string;
  links: { pumpfun: string; solscan: string; ogdex: string };
}

export default function Launch() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [cfg, setCfg] = useState<LaunchConfig | null>(null);
  const [currency, setCurrency] = useState<Currency>("sol");

  const [form, setForm] = useState({
    name: "", symbol: "", description: "",
    twitter: "", telegram: "", website: "", devBuySol: "0",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState("");
  const [solPrice, setSolPrice] = useState<number | null>(null);

  useEffect(() => {
    getLaunchConfig().then(setCfg).catch(() => {});
    const p = getProvider();
    if (p?.publicKey) setWallet(p.publicKey.toString());
  }, []);

  useEffect(() => {
    const SOL = "So11111111111111111111111111111111111111112";
    (async () => {
      try {
        const r = await fetch(`https://lite-api.jup.ag/price/v3?ids=${SOL}`);
        const d = await r.json();
        const p = Number(d?.[SOL]?.usdPrice);
        if (p > 0) { setSolPrice(p); return; }
      } catch {}
      try {
        const r = await fetch(`https://lite-api.jup.ag/price/v2?ids=${SOL}`);
        const d = await r.json();
        const p = Number(d?.data?.[SOL]?.price);
        if (p > 0) setSolPrice(p);
      } catch {}
    })();
  }, []);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const feeUsd = cfg?.feeUsd ?? 5;
  const effSolPrice = solPrice ?? cfg?.solPrice ?? null;
  const feeSol = effSolPrice ? feeUsd / effSolPrice : null;
  const feeDisplay = currency === "sol"
    ? (feeSol ? `${feeSol.toFixed(4)} SOL` : `$${feeUsd} in SOL`)
    : `${feeUsd} ${currency.toUpperCase()}`;

  const onConnect = async () => {
    setError("");
    try { setWallet(await connectWallet()); }
    catch (e: any) { setError(e.message || "Failed to connect wallet"); }
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
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label); setTimeout(() => setCopied(""), 1500);
    });
  };

  const validate = () => {
    if (!wallet) return "Connect your wallet first";
    if (!form.name.trim()) return "Token name is required";
    if (!form.symbol.trim()) return "Token symbol is required";
    if (!imageFile) return "Upload a token image";
    if (currency === "sol" && !effSolPrice) return "Could not load SOL price — try again";
    return "";
  };

  const recordWithRetry = async (payload: any, tries = 4): Promise<any> => {
    let last: any = null;
    for (let i = 0; i < tries; i++) {
      const r = await launchStep(payload);
      if (r?.ok) return r;
      last = r;
      if (/not found|confirmation/i.test(r?.error || "")) {
        await new Promise((res) => setTimeout(res, 2500));
        continue;
      }
      break;
    }
    throw new Error(last?.error || "Could not verify payment");
  };

  const launch = async () => {
    const v = validate();
    if (v) { setError(v); return; }
    setError(""); setBusy(true); setResult(null);
    try {
      setStatus(`Sending ${feeDisplay} launch fee…`);
      const paymentTx = await payFee({
        payWallet: cfg!.payWallet,
        currency,
        amountSol: currency === "sol" ? feeSol! : undefined,
        amountUsd: currency !== "sol" ? feeUsd : undefined,
        tokenMint: currency === "usdc" ? cfg!.usdcMint : currency === "usdt" ? cfg!.usdtMint : undefined,
      });

      setStatus("Uploading image & metadata to IPFS…");
      const imageBase64 = await fileToBase64(imageFile!);
      const ipfs = await launchStep({
        step: "ipfs", imageBase64, imageMimeType: imageFile!.type,
        name: form.name, symbol: form.symbol, description: form.description,
        twitter: form.twitter, telegram: form.telegram, website: form.website,
      });
      if (!ipfs?.ok) throw new Error(ipfs?.error || "IPFS upload failed");

      setStatus("Preparing your token…");
      const mintKp = newMintKeypair();
      const mint = mintKp.publicKey.toBase58();
      const created = await launchStep({
        step: "create", publicKey: wallet, metadataUri: ipfs.metadataUri,
        name: form.name, symbol: form.symbol, mintPublicKey: mint,
        devBuySol: parseFloat(form.devBuySol) || 0, slippage: 15,
      });
      if (!created?.ok) throw new Error(created?.error || "Failed to build transaction");

      setStatus("Confirm in your wallet to deploy…");
      const launchTx = await signAndSendCreate(created.transaction, mintKp);

      setStatus("Verifying payment & listing your token…");
      const rec = await recordWithRetry({
        step: "record", payment_tx: paymentTx, pay_currency: currency,
        creator_wallet: wallet, mint, name: form.name, symbol: form.symbol,
        description: form.description, icon: ipfs.metadata?.image || null,
        launch_tx: launchTx,
        links: { twitter: form.twitter, telegram: form.telegram, website: form.website },
      });

      setResult({ mint, paymentTx, launchTx, links: rec.links });
      setStatus("");
    } catch (e: any) {
      setError(e.message || "Launch failed");
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  if (result) return (
    <div className="max-w-lg mx-auto py-14 text-center space-y-5">
      <div className="w-16 h-16 rounded-full bg-up/15 grid place-items-center mx-auto">
        <CheckCircle className="w-9 h-9 text-up" />
      </div>
      <div>
        <h2 className="text-2xl font-black">Token Launched! 🚀</h2>
        <p className="text-muted text-sm mt-1">
          {form.name} (${form.symbol}) is live on pump.fun and added to <span className="text-white">Newly Listed</span>.
        </p>
      </div>

      <div className="card p-4 space-y-3 text-left">
        <div>
          <div className="text-xs text-muted mb-1">Contract address (CA)</div>
          <div className="flex items-center gap-2 bg-panel2 rounded-lg px-3 py-2">
            <span className="font-mono text-xs text-white/80 break-all flex-1">{result.mint}</span>
            <button onClick={() => copy(result.mint, "ca")} className="shrink-0 text-muted hover:text-white">
              {copied === "ca" ? <CheckCircle className="w-4 h-4 text-up" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <a href={result.links.pumpfun} target="_blank" rel="noreferrer" className="btn bg-panel2 text-white text-xs inline-flex items-center justify-center gap-1 py-2">pump.fun <ExternalLink className="w-3 h-3" /></a>
          <a href={result.links.solscan} target="_blank" rel="noreferrer" className="btn bg-panel2 text-white text-xs inline-flex items-center justify-center gap-1 py-2">Solscan <ExternalLink className="w-3 h-3" /></a>
          <Link to={result.links.ogdex} className="btn bg-accent/15 text-accent text-xs inline-flex items-center justify-center gap-1 py-2">OrbitX DEX <ExternalLink className="w-3 h-3" /></Link>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-muted">
        <Info className="w-3.5 h-3.5" /> Launched tokens are unverified and not boosted. Want featured placement?
        <Link to="/store" className="text-accent hover:underline">Boost or list it →</Link>
      </div>
      <div className="flex gap-2 justify-center pt-2">
        <Link to="/new" className="btn bg-accent text-black font-bold px-5 py-2.5">View Newly Listed</Link>
        <button onClick={() => { setResult(null); setImageFile(null); setImagePreview(""); setForm({ name: "", symbol: "", description: "", twitter: "", telegram: "", website: "", devBuySol: "0" }); }} className="btn bg-panel2 text-white px-5 py-2.5">Launch another</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ background: "linear-gradient(135deg, #1a0033 0%, #2d0052 50%, #1a0033 100%)" }}>
      {/* Modern Header */}
      <header className="sticky top-0 z-50 h-16 px-6 bg-white/[0.05] backdrop-blur-xl border-b border-violet-500/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
            <Rocket className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">Launchpad</div>
            <div className="text-[10px] text-white/40">Create Tokens</div>
          </div>
        </div>
        <div className="text-xs text-white/60">🟢 Connected</div>
      </header>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto py-8 px-4 space-y-6 flex-1">
        <div>
          <h1 className="text-3xl font-black text-white mb-2">Launch Your Token</h1>
          <p className="text-white/70 text-sm">
            Create a token on pump.fun with vanity "obx" addresses. Flat <span className="text-violet-300 font-semibold">${feeUsd}</span> launch fee. Your token appears in Newly Listed instantly.
          </p>
        </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-white/80 uppercase tracking-wider">
          <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-violet-300 text-xs font-bold">1</div>
          Connect wallet
        </div>
        {wallet ? (
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.02] backdrop-blur-sm p-4 flex items-center gap-3">
            <Wallet className="w-5 h-5 text-violet-400" />
            <span className="font-mono text-sm text-white/80 flex-1">{wallet.slice(0, 6)}…{wallet.slice(-4)}</span>
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-green-500/20 text-green-300">Connected</span>
          </div>
        ) : (
          <button onClick={onConnect} className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold py-3 rounded-xl inline-flex items-center justify-center gap-2 transition-all">
            <Wallet className="w-4 h-4" /> Connect Phantom
          </button>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-white/80 uppercase tracking-wider">
          <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-violet-300 text-xs font-bold">2</div>
          Token details
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Token name" maxLength={32}
            className="rounded-xl border border-violet-500/20 bg-violet-500/[0.02] backdrop-blur-sm p-3 text-sm text-white outline-none placeholder:text-white/40" />
          <input value={form.symbol} onChange={(e) => set("symbol", e.target.value.toUpperCase())} placeholder="SYMBOL" maxLength={10}
            className="rounded-xl border border-violet-500/20 bg-violet-500/[0.02] backdrop-blur-sm p-3 text-sm text-white outline-none placeholder:text-white/40 font-mono" />
        </div>
        <textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Description (optional)" rows={3}
          className="w-full rounded-xl border border-violet-500/20 bg-violet-500/[0.02] backdrop-blur-sm p-3 text-sm text-white outline-none placeholder:text-white/40 resize-none" />

        <div onClick={() => fileRef.current?.click()}
          className="rounded-xl border border-violet-500/20 bg-violet-500/[0.02] backdrop-blur-sm p-4 flex items-center gap-3 cursor-pointer hover:border-violet-500/40 transition-all">
          {imagePreview
            ? <img src={imagePreview} className="w-12 h-12 rounded-lg object-cover" />
            : <div className="w-12 h-12 rounded-lg bg-violet-500/10 grid place-items-center"><ImageIcon className="w-5 h-5 text-violet-400" /></div>}
          <div className="flex-1">
            <div className="text-sm font-medium text-white flex items-center gap-1.5"><Upload className="w-3.5 h-3.5 text-violet-400" /> {imageFile ? imageFile.name : "Upload token image"}</div>
            <div className="text-xs text-white/50">PNG, JPG, GIF or WEBP — max 5MB</div>
          </div>
          <input ref={fileRef} type="file" accept={ACCEPTED.join(",")} className="hidden"
            onChange={(e) => onPickImage(e.target.files?.[0] || null)} />
        </div>

        <div className="grid gap-2">
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.02] backdrop-blur-sm p-3 flex items-center gap-2"><Twitter className="w-4 h-4 text-violet-400 shrink-0" /><input value={form.twitter} onChange={(e) => set("twitter", e.target.value)} placeholder="Twitter / X (optional)" className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40" /></div>
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.02] backdrop-blur-sm p-3 flex items-center gap-2"><Send className="w-4 h-4 text-violet-400 shrink-0" /><input value={form.telegram} onChange={(e) => set("telegram", e.target.value)} placeholder="Telegram (optional)" className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40" /></div>
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.02] backdrop-blur-sm p-3 flex items-center gap-2"><Globe className="w-4 h-4 text-violet-400 shrink-0" /><input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="Website (optional)" className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40" /></div>
        </div>

        <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.02] backdrop-blur-sm p-4 flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-violet-400 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-white">Dev buy (optional)</div>
            <div className="text-xs text-white/50">Buy your own token at launch, in SOL</div>
          </div>
          <input type="number" min="0" step="0.01" value={form.devBuySol} onChange={(e) => set("devBuySol", e.target.value)}
            className="w-24 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 text-sm text-right text-white outline-none font-mono" />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-white/80 uppercase tracking-wider">
          <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-violet-300 text-xs font-bold">3</div>
          Launch fee
        </div>
        <div className="flex gap-2 rounded-xl border border-violet-500/20 bg-violet-500/[0.02] backdrop-blur-sm p-1 w-fit">
          {(["sol", "usdc", "usdt"] as Currency[]).map((c) => (
            <button key={c} onClick={() => setCurrency(c)}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${currency === c ? "bg-violet-600/40 text-white border border-violet-400/40" : "text-white/50 hover:text-white"}`}>
              {c === "sol" ? "SOL" : c.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.02] backdrop-blur-sm p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-violet-300" />
          </div>
          <div className="flex-1">
            <div className="text-xs text-white/50">Launch fee</div>
            <div className="text-2xl font-black text-white">{feeDisplay}</div>
            {currency === "sol" && <div className="text-xs text-white/40">${feeUsd} at current price</div>}
          </div>
          <div className="text-right text-xs text-white/50">
            <div className="font-semibold">+ ~0.02 SOL</div>
            <div>network fee</div>
          </div>
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-2 text-red-300 text-sm bg-red-500/10 rounded-xl p-3 border border-red-500/20">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
        </div>
      )}

      <button onClick={launch} disabled={busy || !wallet}
        className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-black py-3 text-base rounded-xl disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 transition-all">
        {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> {status || "Launching…"}</> : <><Rocket className="w-4 h-4" /> Launch token ({feeDisplay})</>}
      </button>

      <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.02] backdrop-blur-sm p-4 space-y-2 text-xs text-white/70">
        <div className="flex items-center gap-1.5 font-semibold text-white text-sm mb-2"><Info className="w-4 h-4 text-violet-400" /> How it works</div>
        <p>1. Connect wallet and fill token details + upload image.</p>
        <p>2. Pay ${feeUsd} fee (SOL/USDC/USDT) — verified on-chain.</p>
        <p>3. Sign the create tx; token deploys on pump.fun with custom "obx" address.</p>
        <p>4. Added to Newly Listed. Unverified tokens have no boost — upgrade for featured placement.</p>
      </div>
    </div>
  );
}
