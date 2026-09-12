import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowRight, Loader2, Rocket, Upload, X,
} from "lucide-react";
import { AuthSheet } from "@/components/launchpad/AuthSheet";
import { ModeRail } from "@/components/launchpad/ModeRail";
import { QuotePicker } from "@/components/launchpad/QuotePicker";
import { VanityGrind } from "@/components/launchpad/VanityGrind";
import { PreviewCard } from "@/components/launchpad/PreviewCard";
import { StylePicker } from "@/components/launchpad/StylePicker";
import { PredictPanel } from "@/components/launchpad/PredictPanel";
import { RewardsTrack } from "@/components/launchpad/RewardsTrack";
import { useLaunchpadIdentity } from "@/hooks/useLaunchpadIdentity";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { WalletPickerModal } from "@/components/WalletPickerModal";
import {
  CURATED_QUOTES, STOCK_LEGAL, applyLaunchType, clientPadFlags, countryFromTimezone,
  defaultIntent, deserializeCreateTx, feeSplitFor, isStockQuote, loadLaunchDraft,
  loadQuotes, mayhemAllowedForQuote, mintKeypairFromSecret, mintUnusedOnChain,
  needsQuoteHop, onChainCreateSupported, postPumpCreate, predictBlockedForCountry,
  quoteByMint, quoteToBuyPreview, saveLaunchDraft, validateLaunchIntent, vanityEta,
  vanityPatternLength, type LaunchIntent, type QuoteAsset,
} from "@/lib/launchpad";
import { grindMint } from "@/lib/launchpad/vanity";
import { indexPadLaunch, indexPadMarket } from "@/lib/launchpad/registry";
import { checkAntiVamp, registerToken, recordReferralEarning } from "@/lib/orbitx/registry";
import { ANTI_VAMP_ENFORCEMENT_ENABLED, PLATFORM_WALLET, LAUNCHPAD_FEE_USD } from "@/lib/platformFee";
import { TabHero } from "@/pages/orbitx/TabHero";

const ACCEPTED = ["image/png", "image/jpeg", "image/gif", "image/webp"];

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export default function LaunchpadRouter() {
  const nav = useNavigate();
  const { connection } = useConnection();
  const { publicKey, connected, signTransaction } = useWallet();
  const { identity, ready, conflict } = useLaunchpadIdentity();
  const { pickable, signInWith, busy } = useWalletSignIn();
  const [picker, setPicker] = useState(false);
  const [quotes, setQuotes] = useState<QuoteAsset[]>(CURATED_QUOTES);
  const flags = useMemo(() => clientPadFlags(), []);
  const [intent, setIntent] = useState<LaunchIntent>(() => {
    const draft = typeof window !== "undefined" ? loadLaunchDraft() : null;
    return defaultIntent({
      ...draft,
      twitter: identity.x_handle ? `https://x.com/${identity.x_handle}` : draft?.twitter || "",
      geoCountry: draft?.geoCountry || countryFromTimezone(),
    });
  });
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [grinding, setGrinding] = useState(false);
  const [foundMint, setFoundMint] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const foundKp = useRef<Keypair | null>(null);
  const grindStop = useRef(false);
  const [status, setStatus] = useState("");
  const [launching, setLaunching] = useState(false);
  const [hop, setHop] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadQuotes().then(setQuotes);
  }, []);

  useEffect(() => {
    if (identity.x_handle && !intent.twitter) {
      setIntent((p) => ({ ...p, twitter: `https://x.com/${identity.x_handle}` }));
    }
  }, [identity.x_handle, intent.twitter]);

  useEffect(() => {
    saveLaunchDraft(intent);
  }, [intent]);

  const quote = quoteByMint(intent.quoteMint, quotes) || quotes.find((q) => q.mint === intent.quoteMint);
  const issues = useMemo(
    () => validateLaunchIntent(intent, { flags, country: intent.geoCountry }),
    [intent, flags],
  );
  const live = onChainCreateSupported(intent);
  const split = feeSplitFor(intent);
  const stock = quote ? isStockQuote(quote.mint) : false;
  const hidePredict = !flags.predict_markets || predictBlockedForCountry(intent.geoCountry, flags);

  useEffect(() => {
    if (hidePredict && intent.type === "predict") {
      setIntent((p) => applyLaunchType({ ...p, market: undefined }, "normal"));
    }
  }, [hidePredict, intent.type]);

  useEffect(() => {
    if (!needsQuoteHop(intent.quoteMint) || intent.firstBuySol <= 0) {
      setHop(null);
      return;
    }
    let alive = true;
    void quoteToBuyPreview(
      "So11111111111111111111111111111111111111112",
      intent.quoteMint,
      Math.round(intent.firstBuySol * 1e9),
      quote?.decimals ?? 6,
    )
      .then((p) => {
        if (alive) setHop(`You will spend ${p.inUi.toFixed(4)} SOL → ${p.outUi.toPrecision(4)} ${intent.quoteSymbol} → TOKEN`);
      })
      .catch(() => {
        if (alive) setHop("Jupiter hop preview unavailable");
      });
    return () => {
      alive = false;
    };
  }, [intent.firstBuySol, intent.quoteMint, intent.quoteSymbol, quote?.decimals]);

  const patch = (p: Partial<LaunchIntent>) => setIntent((prev) => ({ ...prev, ...p }));

  const runClientGrind = useCallback(() => {
    const prefix = intent.vanityPrefix.trim();
    const suffix = intent.vanitySuffix.trim();
    const chars = vanityPatternLength(intent);
    const eta = vanityEta(chars);
    if (eta.disabled) {
      toast.error(eta.label);
      return;
    }
    grindStop.current = false;
    foundKp.current = null;
    setFoundMint(null);
    setGrinding(true);
    setAttempts(0);
    const started = performance.now();
    let count = 0;
    const pre = prefix.toLowerCase();
    const suf = suffix.toLowerCase();
    const step = () => {
      if (grindStop.current) {
        setGrinding(false);
        return;
      }
      for (let i = 0; i < 800; i++) {
        const kp = Keypair.generate();
        count++;
        const addr = intent.vanityCaseInsensitive ? kp.publicKey.toBase58().toLowerCase() : kp.publicKey.toBase58();
        const ok =
          (!pre || addr.startsWith(intent.vanityCaseInsensitive ? pre : prefix)) &&
          (!suf || addr.endsWith(intent.vanityCaseInsensitive ? suf : suffix));
        if (ok) {
          foundKp.current = kp;
          setFoundMint(kp.publicKey.toBase58());
          setAttempts(count);
          setGrinding(false);
          toast.success(`Found ${kp.publicKey.toBase58()}`);
          return;
        }
      }
      setAttempts(count);
      if (performance.now() - started > 45_000) {
        setGrinding(false);
        toast.message("Client grind timed out — trying the vanity worker");
        void grindMint({ prefix, suffix, caseInsensitive: intent.vanityCaseInsensitive })
          .then((r) => {
            const kp = mintKeypairFromSecret(r.secretKey);
            foundKp.current = kp;
            setFoundMint(r.publicKey);
          })
          .catch((e) => toast.error(e instanceof Error ? e.message : "Grind failed"));
        return;
      }
      setTimeout(step, 0);
    };
    setTimeout(step, 0);
  }, [intent]);

  const onPickWallet = async (name: string) => {
    try {
      await signInWith(name);
      setPicker(false);
      toast.success("Wallet proved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign-in failed");
    }
  };

  const launch = async () => {
    if (!ready) {
      toast.error("X + wallet required");
      return;
    }
    if (conflict) {
      toast.error(conflict);
      return;
    }
    if (!publicKey || !signTransaction || !image) return;
    if (issues.length) {
      toast.error(issues[0].message);
      return;
    }
    if (!live) {
      toast.error(issues[0]?.message || "Quote not live for create_v2 yet");
      return;
    }
    setLaunching(true);
    try {
      if (ANTI_VAMP_ENFORCEMENT_ENABLED) {
        setStatus("Anti-vamp…");
        const vamp = await checkAntiVamp(intent.name, intent.symbol);
        if (vamp.blocked) throw new Error(vamp.message || "Name blocked by anti-vamp");
      }
      if (LAUNCHPAD_FEE_USD > 0) {
        setStatus("Paying launch fee…");
        const feeLamports = Math.ceil((LAUNCHPAD_FEE_USD / 150) * LAMPORTS_PER_SOL);
        const feeTx = new Transaction().add(
          SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: new PublicKey(PLATFORM_WALLET), lamports: feeLamports }),
        );
        feeTx.feePayer = publicKey;
        feeTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        const signedFee = await signTransaction(feeTx);
        await connection.sendRawTransaction(signedFee.serialize());
      }

      setStatus("Uploading metadata…");
      const ipfsRes = await fetch("/api/pump-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "ipfs",
          imageBase64: await fileToBase64(image),
          imageMimeType: image.type,
          name: intent.name.trim(),
          symbol: intent.symbol.trim().toUpperCase(),
          description: intent.description.trim(),
          twitter: intent.twitter.trim(),
          telegram: intent.telegram.trim(),
          website: intent.website.trim(),
        }),
      });
      if (!ipfsRes.ok) throw new Error((await ipfsRes.json().catch(() => ({}))).error || "IPFS failed");
      const { metadataUri } = await ipfsRes.json();

      let mintKeypair: Keypair;
      if (intent.type === "custom_ca") {
        if (!intent.customMintSecret) throw new Error("Paste a mint secret");
        mintKeypair = mintKeypairFromSecret(intent.customMintSecret);
        const unused = await mintUnusedOnChain(connection, mintKeypair.publicKey.toBase58());
        if (!unused) throw new Error("That mint is already on-chain");
      } else if (foundKp.current) {
        mintKeypair = foundKp.current;
      } else if (intent.type === "vanity") {
        setStatus("Grinding vanity…");
        const r = await grindMint({
          prefix: intent.vanityPrefix,
          suffix: intent.vanitySuffix || "obx",
          caseInsensitive: intent.vanityCaseInsensitive,
        });
        mintKeypair = mintKeypairFromSecret(r.secretKey);
      } else {
        mintKeypair = Keypair.generate();
      }

      setStatus("Building create tx…");
      const txBase64 = await postPumpCreate({
        publicKey: publicKey.toBase58(),
        metadataUri,
        name: intent.name.trim(),
        symbol: intent.symbol.trim().toUpperCase(),
        mintPublicKey: mintKeypair.publicKey.toBase58(),
        devBuySol: intent.firstBuySol || 0,
        quoteMint: intent.quoteMint,
        holderReward: intent.holderRewards || intent.rewards.track === "pump_holder",
      });
      setStatus("Sign in wallet…");
      const tx = deserializeCreateTx(txBase64, mintKeypair);
      const signed = await signTransaction(tx);
      signed.sign([mintKeypair]);
      setStatus("Broadcasting…");
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
      const conf = await connection.confirmTransaction(sig, "confirmed");
      if (conf.value.err) throw new Error("On-chain error");

      const mint = mintKeypair.publicKey.toBase58();
      foundKp.current = null;
      patch({ customMintSecret: undefined });

      try {
        await registerToken({
          mint_address: mint,
          name: intent.name.trim(),
          ticker: intent.symbol.trim().toUpperCase(),
          creator_wallet: publicKey.toBase58(),
          decimals: 6,
          supply: 1_000_000_000,
          dex: "pumpfun",
          mint_signature: sig,
          metadata_uri: metadataUri,
          logo_url: preview,
          cluster: "mainnet-beta",
          launch_type: "pump",
          quote_mint: intent.quoteMint,
          quote_symbol: intent.quoteSymbol,
          pad_mode: intent.type,
          holder_rewards: intent.holderRewards || intent.rewards.track === "pump_holder",
          bagwork: intent.bagwork,
          graduation_dest: intent.graduationDest,
        });
        await recordReferralEarning(publicKey.toBase58(), mint, LAUNCHPAD_FEE_USD);
      } catch (e) {
        console.warn("[launchpad] registry", e);
      }
      await indexPadLaunch({
        mint,
        creator_wallet: publicKey.toBase58(),
        creator_x: identity.x_handle,
        launch_type: intent.type,
        quote_mint: intent.quoteMint,
        quote_symbol: intent.quoteSymbol,
        graduation_dest: intent.graduationDest,
        name: intent.name.trim(),
        symbol: intent.symbol.trim().toUpperCase(),
        uri: metadataUri,
        holder_rewards: intent.holderRewards || intent.rewards.track === "pump_holder",
        bagwork: intent.bagwork,
        created_sig: sig,
        launch_style: intent.style,
        rewards_track: intent.rewards.track,
        delay_open_unix: intent.delayOpenUnix ?? null,
        anti_snipe_blocks: intent.antiSnipeBlocks,
      });
      if (intent.market && intent.type === "predict" && !hidePredict) {
        await indexPadMarket({
          mint,
          question: intent.market.question,
          deadline_unix: intent.market.deadlineUnix,
          resolver: intent.market.resolver,
          feed_id: intent.market.feedId ?? null,
          threshold: intent.market.threshold ?? null,
          amm: intent.market.amm,
          quote_mint: intent.quoteMint,
          status: "open",
        });
      }
      toast.success(`Launched ${intent.symbol}`);
      nav(`/orbitxlaunch/token/${mint}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Launch failed");
    } finally {
      setLaunching(false);
      setStatus("");
    }
  };

  const launchDisabled =
    launching || grinding || !ready || !image || !connected || !live || issues.length > 0 || !signTransaction || !!conflict;

  return (
    <div className="lp-create">
      <TabHero
        icon={Rocket}
        accent="gold"
        eyebrow="Create router · one pad, many modes"
        title="Launch"
        subtitle="Pick a mode and a quote. Pairing is permanent. Fees never die with the dev."
      />

      <AuthSheet
        identity={identity}
        connectingWallet={!!busy}
        onConnectWallet={() => setPicker(true)}
      />
      {conflict && (
        <p className="lp-preview-warn">
          <AlertTriangle className="mr-1 inline h-3.5 w-3.5" /> {conflict}
        </p>
      )}

      <div className="lp-create-grid">
        <div className="lp-create-col">
          <ModeRail
            value={intent.type}
            hidePredict={hidePredict}
            onChange={(t) => setIntent((p) => applyLaunchType(p, t))}
          />
          <QuotePicker
            quotes={quotes}
            value={intent.quoteMint}
            onChange={(q) =>
              patch({
                quoteMint: q.mint,
                quoteSymbol: q.symbol,
                mayhem: mayhemAllowedForQuote(q.mint) ? intent.mayhem : false,
              })
            }
          />

          <div className="lp-id-block">
            <div className="lp-field-label">Identity</div>
            <div className="lp-id-row">
              <button type="button" className="lp-img" onClick={() => fileRef.current?.click()}>
                {preview ? <img src={preview} alt="" /> : <Upload className="h-5 w-5" />}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED.join(",")}
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (!ACCEPTED.includes(f.type) || f.size > 5 * 1024 * 1024) {
                    toast.error("PNG/JPG/GIF/WebP · max 5MB");
                    return;
                  }
                  setImage(f);
                  const r = new FileReader();
                  r.onload = () => setPreview(String(r.result));
                  r.readAsDataURL(f);
                }}
              />
              <input className="lp-input" placeholder="Name" value={intent.name} onChange={(e) => patch({ name: e.target.value })} />
              <input className="lp-input lp-input--tick" placeholder="TICKER" value={intent.symbol} onChange={(e) => patch({ symbol: e.target.value.toUpperCase() })} />
            </div>
            {preview && (
              <button type="button" className="lp-auth-copy" onClick={() => { setImage(null); setPreview(null); }}>
                <X className="mr-1 inline h-3 w-3" /> Remove image
              </button>
            )}
            <textarea className="lp-input lp-textarea" placeholder="Description" value={intent.description} onChange={(e) => patch({ description: e.target.value })} />
            <div className="lp-id-links">
              <input className="lp-input" placeholder="X / twitter" value={intent.twitter} onChange={(e) => patch({ twitter: e.target.value })} />
              <input className="lp-input" placeholder="Telegram" value={intent.telegram} onChange={(e) => patch({ telegram: e.target.value })} />
              <input className="lp-input" placeholder="Website" value={intent.website} onChange={(e) => patch({ website: e.target.value })} />
            </div>
          </div>

          {intent.type === "normal" && <p className="lp-auth-copy">Random mint · instant.</p>}
          {intent.type === "vanity" && (
            <VanityGrind
              intent={intent}
              grinding={grinding}
              found={foundMint}
              attempts={attempts}
              onChange={patch}
              onGrind={runClientGrind}
              onStop={() => { grindStop.current = true; setGrinding(false); }}
            />
          )}
          {intent.type === "custom_ca" && (
            <div className="lp-mint-block">
              <div className="lp-field-label">Custom CA · never uploaded</div>
              <textarea
                className="lp-input lp-textarea"
                placeholder="Base58 secret or JSON byte array"
                value={intent.customMintSecret || ""}
                onChange={(e) => {
                  const secret = e.target.value;
                  try {
                    const kp = mintKeypairFromSecret(secret);
                    patch({ customMintSecret: secret, customMintPubkey: kp.publicKey.toBase58() });
                    setFoundMint(kp.publicKey.toBase58());
                  } catch {
                    patch({ customMintSecret: secret, customMintPubkey: undefined });
                    setFoundMint(null);
                  }
                }}
              />
              <button
                type="button"
                className="lp-auth-btn"
                onClick={() => {
                  const kp = Keypair.generate();
                  const secret = JSON.stringify(Array.from(kp.secretKey));
                  foundKp.current = kp;
                  patch({ customMintSecret: secret, customMintPubkey: kp.publicKey.toBase58() });
                  setFoundMint(kp.publicKey.toBase58());
                }}
              >
                Generate in browser
              </button>
              {foundMint && <div className="lp-mint-preview">{foundMint}</div>}
            </div>
          )}

          <div className="lp-value">
            <div className="lp-field-label">Value</div>
            <label>
              First buy (SOL)
              <input
                className="lp-input"
                type="number"
                min={0}
                step="0.01"
                value={intent.firstBuySol || ""}
                onChange={(e) => patch({ firstBuySol: Number(e.target.value) || 0 })}
              />
            </label>
            {hop && <p className="lp-auth-copy">{hop}</p>}
            <p className="lp-auth-copy">{split.label}</p>
            <div className="lp-grad">
              {(["pumpswap", "raydium", "meteora", "none"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`lp-mode ${intent.graduationDest === d ? "lp-mode--on" : ""}`}
                  onClick={() => patch({ graduationDest: d })}
                >
                  {d === "pumpswap" ? "PumpSwap" : d === "raydium" ? "Raydium" : d === "meteora" ? "Meteora" : "Forever curve"}
                </button>
              ))}
            </div>
            <label className="lp-check">
              <input
                type="checkbox"
                checked={intent.mayhem}
                disabled={!mayhemAllowedForQuote(intent.quoteMint)}
                onChange={(e) => patch({ mayhem: e.target.checked })}
              />
              Mayhem {mayhemAllowedForQuote(intent.quoteMint) ? "(SOL/USDC)" : "off for this quote"}
            </label>
            {stock && <p className="lp-legal">{STOCK_LEGAL}</p>}
          </div>

          <StylePicker intent={intent} onChange={patch} />
          <RewardsTrack intent={intent} flags={flags} onChange={patch} />
          {(intent.type === "predict" || intent.market) && !hidePredict && (
            <PredictPanel intent={intent} flags={flags} onChange={patch} />
          )}

          <button type="button" className="lp-launch-btn" disabled={launchDisabled} onClick={() => void launch()}>
            {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            {launching ? status || "Launching…" : ready ? (intent.market ? "Launch (one or two signatures)" : "Launch") : "X + wallet required"}
          </button>
          {issues.length > 0 && <p className="lp-preview-warn">{issues[0].message}</p>}

          <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-widest">
            Other lanes{" "}
            <Link to="/orbitxlaunch/create/lanes" className="text-[#E8C547]">
              custom / API / curve <ArrowRight className="inline h-3 w-3" />
            </Link>
          </p>
        </div>
        <PreviewCard intent={intent} quote={quote} image={preview} mintPreview={foundMint} />
      </div>
      <WalletPickerModal open={picker} onClose={() => setPicker(false)} wallets={pickable} onPick={onPickWallet} busy={busy} />
    </div>
  );
}
