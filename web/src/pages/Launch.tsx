/**
 * Launch — Create & launch tokens on pump.fun directly from OG Scan.
 *
 * Flow:
 *  1. User fills form (name, ticker, description, logo, socials)
 *  2. User pays $3 SOL fee to OG Scan wallet
 *  3. Uploads image + metadata to IPFS via /api/pump-create?step=ipfs
 *  4. Generates mint keypair client-side
 *  5. Gets unsigned tx from PumpPortal via /api/pump-create?step=create
 *  6. Signs with Phantom (both user wallet + mint keypair)
 *  7. Sends to Solana
 *  8. Success screen with pump.fun link
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  Keypair, VersionedTransaction, Transaction,
  SystemProgram, PublicKey, LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { toast } from "sonner";
import {
  Rocket, Upload, Globe, Twitter, Send,
  Loader2, CheckCircle, Copy, ExternalLink, Wallet, AlertTriangle,
  Sparkles, Zap, ArrowRight, X, Info, DollarSign,
} from "lucide-react";

/* ─── Constants ──────────────────────────────────────────────────────── */

const MAX_IMG_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_IMG = ["image/png", "image/jpeg", "image/gif", "image/webp"];

/** OG Scan revenue wallet — receives the $3 launch fee */
const FEE_WALLET = new PublicKey("o3mh85BefXsTWwQhyYdm9VXWaNGxct1jXPe2tRX4MYi");

/** Launch fee in USD */
const LAUNCH_FEE_USD = 3;

interface FormData {
  name: string;
  symbol: string;
  description: string;
  twitter: string;
  telegram: string;
  website: string;
  devBuySol: string;
}

type LaunchStep = "form" | "paying" | "uploading" | "signing" | "sending" | "success" | "error";

const STEP_LABELS = ["Pay", "IPFS", "Sign", "Send"];

/* ─── Component ──────────────────────────────────────────────────────── */

export default function Launch() {
  const { publicKey, signTransaction, sendTransaction, connected, connect, wallets, select } = useWallet();
  const { connection } = useConnection();

  const [form, setForm] = useState<FormData>({
    name: "",
    symbol: "",
    description: "",
    twitter: "",
    telegram: "",
    website: "",
    devBuySol: "0",
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [step, setStep] = useState<LaunchStep>("form");
  const [statusMsg, setStatusMsg] = useState("");
  const [txSignature, setTxSignature] = useState("");
  const [mintAddress, setMintAddress] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ─── Fetch SOL price ──────────────────────────────────────────────── */

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch("https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112");
        const data = await res.json();
        const price = parseFloat(data?.data?.["So11111111111111111111111111111111111111112"]?.price);
        if (price && price > 0) setSolPrice(price);
      } catch {
        // Fallback: try CoinGecko
        try {
          const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
          const data = await res.json();
          if (data?.solana?.usd) setSolPrice(data.solana.usd);
        } catch {
          // Will show "calculating..." in UI
        }
      }
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, 60_000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const feeSol = solPrice ? LAUNCH_FEE_USD / solPrice : null;

  /* ─── Image handling ───────────────────────────────────────────────── */

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_IMG.includes(file.type)) {
      toast.error("Invalid format — use PNG, JPG, GIF, or WebP");
      return;
    }
    if (file.size > MAX_IMG_SIZE) {
      toast.error("Image too large — max 5 MB");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* ─── Form helpers ─────────────────────────────────────────────────── */

  const updateField = (field: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const canLaunch =
    connected &&
    publicKey &&
    signTransaction &&
    sendTransaction &&
    form.name.trim().length > 0 &&
    form.symbol.trim().length > 0 &&
    imageFile &&
    solPrice !== null;

  /* ─── Launch flow ──────────────────────────────────────────────────── */

  const handleLaunch = async () => {
    if (!canLaunch || !publicKey || !signTransaction || !sendTransaction || !imageFile || !solPrice) return;

    try {
      /* Step 0 — Pay $3 SOL fee */
      setStep("paying");
      setStatusMsg("Preparing payment…");

      const feeLamports = Math.ceil((LAUNCH_FEE_USD / solPrice) * LAMPORTS_PER_SOL);

      const feeTx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: FEE_WALLET,
          lamports: feeLamports,
        })
      );
      feeTx.feePayer = publicKey;
      feeTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      setStatusMsg(`Pay $${LAUNCH_FEE_USD} launch fee (${(feeLamports / LAMPORTS_PER_SOL).toFixed(4)} SOL)…`);

      const feeSig = await sendTransaction(feeTx, connection);

      setStatusMsg("Confirming payment…");
      const feeConf = await connection.confirmTransaction(feeSig, "confirmed");
      if (feeConf.value.err) {
        throw new Error("Fee payment failed on-chain");
      }
      toast.success("Payment confirmed ✓");

      /* Step 1 — Upload to IPFS */
      setStep("uploading");
      setStatusMsg("Uploading image & metadata to IPFS…");

      const base64 = await fileToBase64(imageFile);

      const ipfsRes = await fetch("/api/pump-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "ipfs",
          imageBase64: base64,
          imageMimeType: imageFile.type,
          name: form.name.trim(),
          symbol: form.symbol.trim().toUpperCase(),
          description: form.description.trim(),
          twitter: form.twitter.trim(),
          telegram: form.telegram.trim(),
          website: form.website.trim(),
        }),
      });

      if (!ipfsRes.ok) {
        const err = await ipfsRes.json().catch(() => ({ error: "IPFS upload failed" }));
        throw new Error(err.error || "IPFS upload failed");
      }

      const { metadataUri } = await ipfsRes.json();

      /* Step 2 — Generate mint keypair */
      setStatusMsg("Generating token address…");
      const mintKeypair = Keypair.generate();
      setMintAddress(mintKeypair.publicKey.toBase58());

      /* Step 3 — Get unsigned transaction from PumpPortal */
      setStatusMsg("Building launch transaction…");
      const devBuy = parseFloat(form.devBuySol) || 0;

      const createRes = await fetch("/api/pump-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "create",
          publicKey: publicKey.toBase58(),
          metadataUri,
          name: form.name.trim(),
          symbol: form.symbol.trim().toUpperCase(),
          mintPublicKey: mintKeypair.publicKey.toBase58(),
          devBuySol: devBuy,
          slippage: 15,
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({ error: "Transaction build failed" }));
        throw new Error(err.error || "Transaction build failed");
      }

      const { transaction: txBase64 } = await createRes.json();

      /* Step 4 — Deserialize + sign */
      setStep("signing");
      setStatusMsg("Sign the token creation transaction…");

      const txBytes = Uint8Array.from(atob(txBase64), (c) => c.charCodeAt(0));
      const tx = VersionedTransaction.deserialize(txBytes);

      // The mint keypair must also sign
      tx.sign([mintKeypair]);

      // Phantom signs for the user's wallet
      const signedTx = await signTransaction(tx);

      /* Step 5 — Send */
      setStep("sending");
      setStatusMsg("Broadcasting to Solana…");

      const sig = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });

      setStatusMsg("Confirming…");
      const confirmation = await connection.confirmTransaction(sig, "confirmed");

      if (confirmation.value.err) {
        throw new Error("Transaction failed on-chain: " + JSON.stringify(confirmation.value.err));
      }

      setTxSignature(sig);
      setStep("success");
      toast.success("Token launched! 🚀");
    } catch (err: any) {
      console.error("Launch error:", err);
      if (err.message?.includes("User rejected")) {
        setStep("form");
        toast.error("Transaction cancelled");
        return;
      }
      setErrorMsg(err.message || "Unknown error");
      setStep("error");
      toast.error("Launch failed");
    }
  };

  const resetForm = () => {
    setStep("form");
    setStatusMsg("");
    setTxSignature("");
    setMintAddress("");
    setErrorMsg("");
    setForm({ name: "", symbol: "", description: "", twitter: "", telegram: "", website: "", devBuySol: "0" });
    removeImage();
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  /* ─── Wallet connect ───────────────────────────────────────────────── */

  const handleConnectWallet = () => {
    const available = wallets.filter((w) => w.readyState === "Installed" || w.readyState === "Loadable");
    if (available.length === 1) {
      select(available[0].adapter.name);
      setTimeout(() => connect().catch(() => {}), 100);
    } else if (available.length > 1) {
      setShowWalletPicker(true);
    } else {
      window.open("https://phantom.app/download", "_blank");
    }
  };

  /* ─── Step index helper ────────────────────────────────────────────── */

  const getStepIndex = (): number => {
    switch (step) {
      case "paying": return 0;
      case "uploading": return 1;
      case "signing": return 2;
      case "sending": return 3;
      default: return -1;
    }
  };

  /* ─── Render ───────────────────────────────────────────────────────── */

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f] px-4 py-6 md:py-10">
        <div className="mx-auto max-w-2xl">

          {/* Header */}
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#ab9ff2]/20 bg-[#ab9ff2]/5 px-4 py-1.5 mb-4">
              <Rocket className="h-4 w-4 text-[#ab9ff2]" />
              <span className="text-xs font-bold text-[#ab9ff2] uppercase tracking-widest">Token Launcher</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white mb-2">
              Launch on Pump.fun
            </h1>
            <p className="text-sm text-white/40 max-w-md mx-auto">
              Create and deploy your token in seconds. Fill in the details, pay the launch fee, and you're live.
            </p>
          </div>

          {/* ─── Success Screen ────────────────────────────────── */}
          {step === "success" && (
            <Card className="border-green-500/30 bg-green-500/[0.03] backdrop-blur-sm">
              <CardContent className="p-8 text-center">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 border border-green-500/20">
                  <CheckCircle className="h-10 w-10 text-green-400" />
                </div>
                <h2 className="text-2xl font-black text-white mb-2">Token Launched! 🚀</h2>
                <p className="text-sm text-white/50 mb-6">Your token is now live on pump.fun</p>

                {/* Token address */}
                <div className="mb-4 rounded-lg bg-white/[0.03] border border-white/[0.06] p-4">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Contract Address</p>
                  <div className="flex items-center gap-2 justify-center">
                    <code className="text-sm text-[#ab9ff2] font-mono break-all">{mintAddress}</code>
                    <button onClick={() => copyToClipboard(mintAddress, "Address")} className="text-white/30 hover:text-white transition-colors">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Tx signature */}
                <div className="mb-6 rounded-lg bg-white/[0.03] border border-white/[0.06] p-4">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Transaction</p>
                  <div className="flex items-center gap-2 justify-center">
                    <code className="text-xs text-white/60 font-mono">{txSignature.slice(0, 20)}…{txSignature.slice(-8)}</code>
                    <button onClick={() => copyToClipboard(txSignature, "Signature")} className="text-white/30 hover:text-white transition-colors">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <a
                    href={`https://pump.fun/${mintAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#ab9ff2] px-6 py-3 text-sm font-bold text-black hover:bg-[#b8aef5] transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" /> View on Pump.fun
                  </a>
                  <a
                    href={`https://solscan.io/tx/${txSignature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-6 py-3 text-sm font-bold text-white/60 hover:text-white hover:border-white/20 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" /> Solscan
                  </a>
                  <button
                    onClick={resetForm}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-6 py-3 text-sm font-bold text-white/60 hover:text-white hover:border-white/20 transition-colors"
                  >
                    <Rocket className="h-4 w-4" /> Launch Another
                  </button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── Error Screen ──────────────────────────────────── */}
          {step === "error" && (
            <Card className="border-red-500/30 bg-red-500/[0.03] backdrop-blur-sm">
              <CardContent className="p-8 text-center">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
                  <AlertTriangle className="h-10 w-10 text-red-400" />
                </div>
                <h2 className="text-xl font-black text-white mb-2">Launch Failed</h2>
                <p className="text-sm text-red-400/80 mb-6 font-mono break-all max-w-md mx-auto">{errorMsg}</p>
                <Button onClick={() => setStep("form")} variant="outline" className="border-white/10 text-white/60 hover:text-white">
                  ← Try Again
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ─── Loading / In-Progress ─────────────────────────── */}
          {(step === "paying" || step === "uploading" || step === "signing" || step === "sending") && (
            <Card className="border-[#ab9ff2]/20 bg-[#ab9ff2]/[0.02] backdrop-blur-sm">
              <CardContent className="p-12 text-center">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#ab9ff2]/10 border border-[#ab9ff2]/20 animate-pulse">
                  <Loader2 className="h-10 w-10 text-[#ab9ff2] animate-spin" />
                </div>
                <h2 className="text-xl font-black text-white mb-2">
                  {step === "paying" ? "Pay Launch Fee" :
                   step === "uploading" ? "Uploading…" :
                   step === "signing" ? "Sign Transaction" :
                   "Broadcasting…"}
                </h2>
                <p className="text-sm text-white/50">{statusMsg}</p>

                {/* Progress steps */}
                <div className="mt-8 flex items-center justify-center gap-2">
                  {STEP_LABELS.map((label, i) => {
                    const currentIdx = getStepIndex();
                    const isActive = i === currentIdx;
                    const isDone = i < currentIdx;
                    return (
                      <div key={label} className="flex items-center gap-2">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${
                          isDone ? "bg-green-500/20 text-green-400 border border-green-500/30" :
                          isActive ? "bg-[#ab9ff2]/20 text-[#ab9ff2] border border-[#ab9ff2]/30 animate-pulse" :
                          "bg-white/[0.03] text-white/20 border border-white/[0.06]"
                        }`}>
                          {isDone ? "✓" : i + 1}
                        </div>
                        <span className={`text-[10px] uppercase tracking-widest ${isDone ? "text-green-400/60" : isActive ? "text-[#ab9ff2]/80" : "text-white/20"}`}>
                          {label}
                        </span>
                        {i < STEP_LABELS.length - 1 && (
                          <ArrowRight className={`h-3 w-3 ${i < currentIdx ? "text-green-500/30" : "text-white/10"}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── Form ──────────────────────────────────────────── */}
          {step === "form" && (
            <div className="space-y-5">

              {/* Token Info Card */}
              <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
                <CardContent className="p-5 md:p-6 space-y-5">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="h-4 w-4 text-[#ab9ff2]" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Token Info</h3>
                  </div>

                  {/* Image upload */}
                  <div>
                    <Label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">Logo *</Label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp"
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                    {imagePreview ? (
                      <div className="relative inline-block">
                        <img
                          src={imagePreview}
                          alt="Token logo"
                          className="h-24 w-24 rounded-xl border-2 border-[#ab9ff2]/30 object-cover"
                        />
                        <button
                          onClick={removeImage}
                          className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500/80 text-white hover:bg-red-500 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex h-24 w-24 items-center justify-center rounded-xl border-2 border-dashed border-white/10 bg-white/[0.02] text-white/20 hover:border-[#ab9ff2]/30 hover:text-[#ab9ff2]/60 transition-all"
                      >
                        <div className="text-center">
                          <Upload className="h-5 w-5 mx-auto mb-1" />
                          <span className="text-[9px] uppercase tracking-widest">Upload</span>
                        </div>
                      </button>
                    )}
                    <p className="text-[10px] text-white/20 mt-1.5">PNG, JPG, GIF, or WebP · Max 5 MB</p>
                  </div>

                  {/* Name + Symbol in row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">Token Name *</Label>
                      <Input
                        placeholder="e.g. Doge Coin"
                        value={form.name}
                        onChange={(e) => updateField("name", e.target.value)}
                        maxLength={32}
                        className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/15 focus:border-[#ab9ff2]/40"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">Ticker *</Label>
                      <Input
                        placeholder="e.g. DOGE"
                        value={form.symbol}
                        onChange={(e) => updateField("symbol", e.target.value.toUpperCase())}
                        maxLength={10}
                        className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/15 focus:border-[#ab9ff2]/40 uppercase"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <Label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">Description</Label>
                    <Textarea
                      placeholder="What's your token about? (optional)"
                      value={form.description}
                      onChange={(e) => updateField("description", e.target.value)}
                      maxLength={500}
                      rows={3}
                      className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/15 focus:border-[#ab9ff2]/40 resize-none"
                    />
                    <p className="text-[10px] text-white/15 text-right mt-1">{form.description.length}/500</p>
                  </div>
                </CardContent>
              </Card>

              {/* Socials Card */}
              <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
                <CardContent className="p-5 md:p-6 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Globe className="h-4 w-4 text-[#ab9ff2]" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Socials</h3>
                    <Badge className="bg-white/[0.04] text-white/25 border-white/[0.06] text-[9px]">Optional</Badge>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Twitter className="h-4 w-4 text-white/20 shrink-0" />
                      <Input
                        placeholder="https://x.com/yourtoken"
                        value={form.twitter}
                        onChange={(e) => updateField("twitter", e.target.value)}
                        className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/15 focus:border-[#ab9ff2]/40"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Send className="h-4 w-4 text-white/20 shrink-0" />
                      <Input
                        placeholder="https://t.me/yourgroup"
                        value={form.telegram}
                        onChange={(e) => updateField("telegram", e.target.value)}
                        className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/15 focus:border-[#ab9ff2]/40"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Globe className="h-4 w-4 text-white/20 shrink-0" />
                      <Input
                        placeholder="https://yourtoken.com"
                        value={form.website}
                        onChange={(e) => updateField("website", e.target.value)}
                        className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/15 focus:border-[#ab9ff2]/40"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Dev Buy Card */}
              <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
                <CardContent className="p-5 md:p-6 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="h-4 w-4 text-[#ab9ff2]" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Initial Buy</h3>
                    <Badge className="bg-white/[0.04] text-white/25 border-white/[0.06] text-[9px]">Optional</Badge>
                  </div>

                  <div>
                    <Label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">Dev Buy (SOL)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0"
                      value={form.devBuySol}
                      onChange={(e) => updateField("devBuySol", e.target.value)}
                      className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/15 focus:border-[#ab9ff2]/40 max-w-[200px]"
                    />
                    <p className="text-[10px] text-white/20 mt-1.5 flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      Buy your own token at launch. Set 0 for no initial buy.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Cost breakdown */}
              <div className="rounded-lg border border-[#ab9ff2]/10 bg-[#ab9ff2]/[0.02] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-4 w-4 text-[#ab9ff2]" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Cost Breakdown</span>
                </div>
                <div className="flex justify-between text-xs text-white/40 mb-1.5">
                  <span>Launch fee</span>
                  <span className="text-[#ab9ff2] font-bold">
                    ${LAUNCH_FEE_USD}.00{feeSol ? ` (${feeSol.toFixed(4)} SOL)` : ""}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-white/40 mb-1.5">
                  <span>Network fee</span>
                  <span>~0.02 SOL</span>
                </div>
                {parseFloat(form.devBuySol) > 0 && (
                  <div className="flex justify-between text-xs text-white/40 mb-1.5">
                    <span>Dev buy</span>
                    <span>{form.devBuySol} SOL</span>
                  </div>
                )}
                <div className="mt-2 pt-2 border-t border-white/[0.06] flex justify-between text-xs text-white/60 font-bold">
                  <span>Total</span>
                  <span>
                    ~{((feeSol || 0) + 0.02 + (parseFloat(form.devBuySol) || 0)).toFixed(4)} SOL
                    {solPrice ? ` (~$${((feeSol || 0) * solPrice + 0.02 * solPrice + (parseFloat(form.devBuySol) || 0) * solPrice).toFixed(2)})` : ""}
                  </span>
                </div>
              </div>

              {/* Connect wallet / Launch button */}
              {!connected ? (
                <>
                  <button
                    onClick={handleConnectWallet}
                    className="w-full flex items-center justify-center gap-3 rounded-xl border border-[#ab9ff2]/20 bg-[#ab9ff2]/5 px-6 py-4 text-[#ab9ff2] font-bold hover:bg-[#ab9ff2]/10 transition-all"
                  >
                    <Wallet className="h-5 w-5" />
                    Connect Wallet to Launch
                  </button>

                  {/* Wallet picker modal */}
                  {showWalletPicker && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowWalletPicker(false)}>
                      <div className="bg-[#12121a] border border-white/10 rounded-2xl p-6 w-[320px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-sm font-bold text-white mb-4">Select Wallet</h3>
                        <div className="space-y-2">
                          {wallets
                            .filter((w) => w.readyState === "Installed" || w.readyState === "Loadable")
                            .map((w) => (
                              <button
                                key={w.adapter.name}
                                onClick={() => {
                                  select(w.adapter.name);
                                  setShowWalletPicker(false);
                                  setTimeout(() => connect().catch(() => {}), 100);
                                }}
                                className="w-full flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-white/70 hover:bg-white/[0.05] hover:text-white transition-all"
                              >
                                <img src={w.adapter.icon} alt="" className="h-6 w-6 rounded" />
                                <span className="text-sm font-medium">{w.adapter.name}</span>
                              </button>
                            ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <button
                  onClick={handleLaunch}
                  disabled={!canLaunch}
                  className={`w-full flex items-center justify-center gap-3 rounded-xl px-6 py-4 text-base font-black transition-all ${
                    canLaunch
                      ? "bg-gradient-to-r from-[#ab9ff2] to-[#6c63ff] text-black hover:from-[#b8aef5] hover:to-[#7b73ff] shadow-lg shadow-[#ab9ff2]/20"
                      : "bg-white/[0.04] text-white/20 cursor-not-allowed"
                  }`}
                >
                  <Rocket className="h-5 w-5" />
                  {!form.name.trim() || !form.symbol.trim()
                    ? "Fill in token details"
                    : !imageFile
                    ? "Upload a logo"
                    : !solPrice
                    ? "Loading SOL price…"
                    : `Pay $${LAUNCH_FEE_USD} & Launch ${form.symbol.trim()}`}
                </button>
              )}

              {/* Disclaimer */}
              <p className="text-center text-[10px] text-white/15 leading-relaxed">
                By launching, you agree to pump.fun's terms. Tokens are deployed on Solana mainnet.
                <br />A ${LAUNCH_FEE_USD} SOL launch fee is charged per token creation.
              </p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data:image/...;base64, prefix
      resolve(result.split(",")[1] || result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
