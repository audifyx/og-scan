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
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd")
      .then((r) => r.json())
      .then((d) => setSolPrice(d.solana.usd))
      .catch(() => {});
  }, []);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const onConnect = () => {
    const p = getProvider();
    if (!p) return alert("Phantom not found");
    connectWallet(p).then((pk) => setWallet(pk)).catch((e) => alert(e.message));
  };

  const onPickImage = async (file: File | null) => {
    if (!file) {
      setImageFile(null);
      setImagePreview("");
      return;
    }
    if (file.size > MAX_IMG) return alert("Image too large (max 5MB)");
    if (!ACCEPTED.includes(file.type)) return alert("Only PNG/JPG/GIF/WEBP allowed");
    setImageFile(file);
    try {
      const data = await fileToBase64(file);
      setImagePreview(data);
    } catch (e) {
      alert("Failed to read image");
    }
  };

  const feeUsd = cfg?.fee_usd || 5;
  const feeSol = solPrice ? (feeUsd / solPrice).toFixed(4) : "?";
  const feeDisplay = currency === "sol" ? `${feeSol} SOL` : `${feeUsd} ${currency.toUpperCase()}`;

  const launch = async () => {
    if (!wallet || !form.name || !form.symbol) return alert("Fill required fields");
    if (!imageFile) return alert("Upload token image");

    setBusy(true);
    setError("");
    setStatus("");
    setResult(null);

    try {
      const p = getProvider();
      if (!p) throw new Error("Wallet not available");

      // Step 1: Pay fee
      setStatus("Paying fee...");
      const paymentTx = await payFee(p, currency, feeUsd);

      // Step 2: Generate mint
      setStatus("Generating mint...");
      const { publicKey: mintPk, secretKey: mintSk } = newMintKeypair();

      // Step 3: Upload metadata
      setStatus("Uploading metadata...");
      const imageData = await fileToBase64(imageFile);
      const metadata = {
        name: form.name,
        symbol: form.symbol,
        description: form.description,
        image: imageData,
        twitter: form.twitter,
        telegram: form.telegram,
        website: form.website,
      };

      const metaRes = await fetch("/api/upload-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metadata),
      });
      const { uri: metaUri } = await metaRes.json();

      // Step 4: Create token
      setStatus("Creating token...");
      const createRes = await fetch("/api/create-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mint: mintPk.toBase58(),
          mintSecret: mintSk,
          name: form.name,
          symbol: form.symbol,
          metadataUri: metaUri,
          devBuySol: parseFloat(form.devBuySol) || 0,
        }),
      });
      const { signature: launchTx } = await createRes.json();

      setResult({
        mint: mintPk.toBase58(),
        paymentTx,
        launchTx,
        links: {
          pumpfun: `https://pump.fun/${mintPk.toBase58()}`,
          solscan: `https://solscan.io/token/${mintPk.toBase58()}`,
          ogdex: `/token/${mintPk.toBase58()}`,
        },
      });
    } catch (e: any) {
      setError(e.message || "Launch failed");
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="min-h-screen w-full flex flex-col" style={{ background: "linear-gradient(135deg, #1a0033 0%, #2d0052 50%, #1a0033 100%)" }}>
        <header className="sticky top-0 z-50 h-16 px-6 bg-white/[0.05] backdrop-blur-xl border-b border-violet-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Success!</div>
              <div className="text-[10px] text-white/40">Token Launched</div>
            </div>
          </div>
        </header>

        <div className="max-w-2xl mx-auto py-8 px-4 space-y-6 flex-1">
          <div className="rounded-xl border border-green-500/20 bg-green-500/[0.02] backdrop-blur-sm p-6 space-y-4">
            <div>
              <div className="text-xs text-white/60 mb-1">Contract Address</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono text-white/80 break-all">{result.mint}</code>
                <button onClick={() => { navigator.clipboard.writeText(result.mint); setCopied("mint"); setTimeout(() => setCopied(""), 2000); }}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <Copy className="w-4 h-4 text-white/60" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <a href={result.links.pumpfun} target="_blank" rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold transition-all">
                View on pump.fun <ExternalLink className="w-4 h-4" />
              </a>
              <a href={result.links.solscan} target="_blank" rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold transition-all">
                View on Solscan <ExternalLink className="w-4 h-4" />
              </a>
              <Link to={result.links.ogdex}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold transition-all">
                View on OrbitX DEX <ExternalLink className="w-4 h-4" />
              </Link>
            </div>

            <div className="pt-4 border-t border-white/10 space-y-2 text-xs text-white/70">
              <div>Payment TX: <code className="font-mono text-white/50">{result.paymentTx.slice(0, 20)}...</code></div>
              <div>Launch TX: <code className="font-mono text-white/50">{result.launchTx.slice(0, 20)}...</code></div>
            </div>
          </div>

          <button onClick={() => { setResult(null); setForm({ name: "", symbol: "", description: "", twitter: "", telegram: "", website: "", devBuySol: "0" }); setImageFile(null); setImagePreview(""); }}
            className="w-full px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold transition-all">
            Launch Another Token
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ background: "linear-gradient(135deg, #1a0033 0%, #2d0052 50%, #1a0033 100%)" }}>
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
        <div className="text-xs text-white/60">{wallet ? "🟢 Connected" : "⚪ Disconnected"}</div>
      </header>

      <div className="max-w-2xl mx-auto py-8 px-4 space-y-6 flex-1">
        <div>
          <h1 className="text-3xl font-black text-white mb-2">Launch Your Token</h1>
          <p className="text-white/70 text-sm">Create a token on pump.fun with vanity addresses ending in "obx". ${feeUsd} fee. Your token appears in Newly Listed.</p>
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
            {imagePreview ? <img src={imagePreview} className="w-12 h-12 rounded-lg object-cover" /> : <div className="w-12 h-12 rounded-lg bg-violet-500/10 grid place-items-center"><ImageIcon className="w-5 h-5 text-violet-400" /></div>}
            <div className="flex-1">
              <div className="text-sm font-medium text-white flex items-center gap-1.5"><Upload className="w-3.5 h-3.5 text-violet-400" /> {imageFile ? imageFile.name : "Upload token image"}</div>
              <div className="text-xs text-white/50">PNG, JPG, GIF or WEBP — max 5MB</div>
            </div>
            <input ref={fileRef} type="file" accept={ACCEPTED.join(",")} className="hidden" onChange={(e) => onPickImage(e.target.files?.[0] || null)} />
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
    </div>
  );
}
