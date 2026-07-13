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
import { generateVanityMint, VANITY_SUFFIX } from "../lib/vanity-mint";

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
    const p = getProvider();
    if (p?.publicKey) setWallet(p.publicKey.toString());
  }, []);

  // Refetch config whenever the connected wallet changes so we know if this
  // wallet still has its free first launch available.
  useEffect(() => {
    getLaunchConfig(wallet ?? undefined).then(setCfg).catch(() => {});
  }, [wallet]);

  // SOL price is fetched client-side (browser CORS works with Jupiter) so the
  // pay-in-SOL option always has a quote, regardless of server egress.
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

  const feeUsd = cfg?.feeUsd ?? 0;
  // Launches are free. Treat as free unless the server ever reports a real fee
  // again — defaults to free even if the config request hasn't loaded yet.
  const isFree = feeUsd <= 0 || !!cfg?.isFirstLaunch;
  const isFirstLaunch = isFree;
  const effSolPrice = solPrice ?? cfg?.solPrice ?? null;
  const feeSol = effSolPrice ? feeUsd / effSolPrice : null;
  const feeDisplay = isFree
    ? "FREE"
    : currency === "sol"
    ? (feeSol ? `${feeSol.toFixed(4)} SOL` : `${feeUsd} in SOL`)
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
      // fee tx may not be indexed yet — wait and retry
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
      /* 1. Launch fee — none; launching is free */
      let paymentTx = "";
      if (isFree) {
        setStatus("Launching is free — no fee…");
      } else {
        setStatus(`Sending ${feeDisplay} launch fee…`);
        paymentTx = await payFee({
          payWallet: cfg!.payWallet,
          currency,
          amountSol: currency === "sol" ? feeSol! : undefined,
          amountUsd: currency !== "sol" ? feeUsd : undefined,
          tokenMint: currency === "usdc" ? cfg!.usdcMint : currency === "usdt" ? cfg!.usdtMint : undefined,
        });
      }

      /* 2. Upload image + metadata to IPFS */
      setStatus("Uploading image & metadata to IPFS…");
      const imageBase64 = await fileToBase64(imageFile!);
      const ipfs = await launchStep({
        step: "ipfs", imageBase64, imageMimeType: imageFile!.type,
        name: form.name, symbol: form.symbol, description: form.description,
        twitter: form.twitter, telegram: form.telegram, website: form.website,
      });
      if (!ipfs?.ok) throw new Error(ipfs?.error || "IPFS upload failed");

      /* 3. Generate a custom vanity mint (CA ends in "orb"), then build the create tx */
      setStatus(`Generating your custom …${VANITY_SUFFIX} contract address…`);
      let mintKp;
      try {
        mintKp = (await generateVanityMint(VANITY_SUFFIX)).keypair;
      } catch (ve) {
        // Vanity search is probabilistic and bounded by the serverless time
        // budget. If it can't find one in time, fall back to a standard mint
        // so the launch never hard-fails.
        console.warn("[launchpad] vanity mint unavailable, using standard mint:", ve);
        mintKp = newMintKeypair();
      }
      const mint = mintKp.publicKey.toBase58();
      setStatus("Preparing your token…");
      const created = await launchStep({
        step: "create", publicKey: wallet, metadataUri: ipfs.metadataUri,
        name: form.name, symbol: form.symbol, mintPublicKey: mint,
        devBuySol: parseFloat(form.devBuySol) || 0, slippage: 15,
      });
      if (!created?.ok) throw new Error(created?.error || "Failed to build transaction");

      /* 4. Sign + broadcast (mint keypair + Phantom) */
      setStatus("Confirm in your wallet to deploy…");
      const launchTx = await signAndSendCreate(created.transaction, mintKp);

      /* 5. Verify fee on-chain + record into Newly Listed */
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

  /* ── Success screen ── */
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

  /* ── Launcher form ── */
  return (
    <div className="max-w-xl mx-auto py-8 px-4 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Rocket className="w-5 h-5 text-accent" />
          <h1 className="text-2xl font-black">Launch a Token</h1>
        </div>
        <p className="text-muted text-sm">
          <>Create a token on pump.fun directly from the OrbitX Launchpad. <span className="text-up font-semibold">Launching is free</span> — you only pay the standard Solana network fee, and every coin gets a <span className="text-accent font-semibold">custom …{VANITY_SUFFIX} contract address</span>. Your token appears in the Launchpad feed instantly.</>
        </p>
      </div>

      {/* 1. Wallet */}
      <section className="space-y-2">
        <label className="text-xs font-semibold text-muted uppercase tracking-wide">1. Connect wallet</label>
        {wallet ? (
          <div className="card p-3 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-up" />
            <span className="font-mono text-sm text-white/80">{wallet.slice(0, 6)}…{wallet.slice(-4)}</span>
            <span className="ml-auto pill bg-up/15 text-up text-[10px]">Connected</span>
          </div>
        ) : (
          <button onClick={onConnect} className="w-full btn bg-accent text-black font-bold py-3 inline-flex items-center justify-center gap-2">
            <Wallet className="w-4 h-4" /> Connect Phantom
          </button>
        )}
      </section>

      {/* 2. Token details */}
      <section className="space-y-3">
        <label className="text-xs font-semibold text-muted uppercase tracking-wide">2. Token details</label>
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
            <div className="text-xs text-muted">PNG, JPG, GIF or WEBP — max 5MB</div>
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

        {/* Optional dev buy */}
        <div className="card p-3 flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-accent shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium">Dev buy (optional)</div>
            <div className="text-xs text-muted">Buy your own token at launch, in SOL</div>
          </div>
          <input type="number" min="0" step="0.01" value={form.devBuySol} onChange={(e) => set("devBuySol", e.target.value)}
            className="w-24 bg-panel2 rounded-lg px-3 py-1.5 text-sm text-right outline-none font-mono" />
        </div>
      </section>

      {/* 3. Fee */}
      <section className="space-y-3">
        <label className="text-xs font-semibold text-muted uppercase tracking-wide">3. Launch fee</label>
        {!isFirstLaunch && (
          <div className="flex gap-1 bg-panel2 rounded-lg p-1 w-fit">
            {(["sol", "usdc", "usdt"] as Currency[]).map((c) => (
              <button key={c} onClick={() => setCurrency(c)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${currency === c ? "bg-panel text-white" : "text-muted hover:text-white"}`}>
                {c === "sol" ? "Pay in SOL" : c.toUpperCase()}
              </button>
            ))}
          </div>
        )}
        <div className={`card p-4 flex items-center gap-3 ${isFirstLaunch ? "border-up/30 bg-up/5" : ""}`}>
          <Wallet className={`w-5 h-5 shrink-0 ${isFirstLaunch ? "text-up" : "text-accent"}`} />
          <div>
            <div className="text-xs text-muted">Launch fee</div>
            <div className={`text-2xl font-black ${isFree ? "text-up" : ""}`}>{feeDisplay}</div>
            {isFree
              ? <div className="text-xs text-muted">Launching is free</div>
              : currency === "sol" && <div className="text-xs text-muted">(${feeUsd} at current SOL price)</div>}
          </div>
          <div className="ml-auto text-right text-xs text-muted">
            <div>+ ~0.02 SOL</div>
            <div>network fee</div>
          </div>
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-2 text-down text-sm bg-down/10 rounded-lg p-3 border border-down/20">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
        </div>
      )}

      <button onClick={launch} disabled={busy || !wallet}
        className="w-full btn bg-accent text-black font-bold py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2">
        {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> {status || "Launching…"}</> : <><Rocket className="w-4 h-4" /> Launch token ({feeDisplay})</>}
      </button>

      <div className="card p-4 space-y-2 text-xs text-muted border-line">
        <div className="flex items-center gap-1.5 font-semibold text-white text-sm mb-1"><Info className="w-4 h-4 text-accent" /> How it works</div>
        <p>1. Connect your wallet and fill in your token details + image.</p>
        <p>2. {isFree ? "Launching is free — no launch fee, just the standard Solana network fee." : `Pay the ${feeUsd} launch fee (SOL or USDC/USDT) — verified on-chain automatically.`}</p>
        <p>3. Confirm the create transaction; your token deploys on pump.fun and you get the link + CA.</p>
        <p>4. It's added to <strong className="text-white">Newly Listed</strong>. Launched tokens are unverified with no boost — boost or list separately for featured placement.</p>
      </div>
    </div>
  );
}
