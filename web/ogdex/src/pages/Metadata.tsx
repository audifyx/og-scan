import { useState } from "react";
import { useWallet } from "../lib/wallet";
import { launchStep, short } from "../lib/api";
import { updateTokenMetadata } from "../lib/metadataTx";
import {
  Wallet2, Loader2, Search, ShieldCheck, AlertTriangle, CheckCircle2, ExternalLink,
  Pencil, Image as ImageIcon, Info, Lock, XCircle,
} from "lucide-react";

interface MetaInfo {
  ok: boolean; mint: string; name?: string; symbol?: string; description?: string;
  image?: string; uri?: string; updateAuthority?: string; mutable?: boolean;
  tokenProgram?: string; isToken2022?: boolean; isPumpFun?: boolean; standard?: string;
  creators?: { address: string; share: number; verified: boolean }[];
  sellerFeeBasisPoints?: number; editableByAuthority?: boolean; reason?: string | null; error?: string;
}

const REASON_MSG: Record<string, string> = {
  pumpfun: "Not supported for pump.fun tokens — pump.fun controls the metadata and it can't be edited here.",
  immutable: "This token's metadata is locked (immutable). It can never be changed by anyone.",
  token2022: "Token-2022 metadata editing is being added. This token uses the Token-2022 program.",
  no_authority: "No update authority found for this token — its metadata can't be edited.",
  unsupported_program: "This token program isn't supported for metadata edits yet.",
};

function fileToB64(f: File): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(f); });
}

export default function Metadata() {
  const { address, connect, connecting } = useWallet();
  const [mint, setMint] = useState("");
  const [info, setInfo] = useState<MetaInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", symbol: "", description: "", website: "", twitter: "", telegram: "" });
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sig, setSig] = useState("");

  const load = async () => {
    setErr(""); setSig(""); setInfo(null);
    const m = mint.trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(m)) { setErr("Enter a valid Solana mint address"); return; }
    setLoading(true);
    try {
      const r = await fetch(`/api/ogdex/metadata?mint=${m}`);
      const d: MetaInfo = await r.json();
      if (!d.ok) { setErr(d.error || "Could not read this token"); setLoading(false); return; }
      setInfo(d);
      setForm({ name: d.name || "", symbol: d.symbol || "", description: d.description || "", website: "", twitter: "", telegram: "" });
    } catch (e: any) { setErr(e?.message || "Failed to load token"); }
    finally { setLoading(false); }
  };

  const isAuthority = !!info?.updateAuthority && !!address && info.updateAuthority === address;
  const canEdit = !!info?.editableByAuthority && isAuthority;

  const save = async () => {
    if (!info || !canEdit) return;
    setErr(""); setSig("");
    if (!form.name.trim() || !form.symbol.trim()) { setErr("Name and symbol are required"); return; }
    setBusy(true);
    try {
      // 1) pin updated image + metadata JSON to IPFS (reuses launcher pipeline)
      let imageBase64 = ""; let imageMimeType = "";
      if (imgFile) { imageBase64 = await fileToB64(imgFile); imageMimeType = imgFile.type; }
      const ipfs = await launchStep({
        step: "ipfs", imageBase64, imageMimeType,
        name: form.name, symbol: form.symbol, description: form.description,
        twitter: form.twitter, telegram: form.telegram, website: form.website,
      });
      const uri = ipfs?.metadataUri || info.uri;
      if (!uri) throw new Error("Could not pin new metadata to IPFS");
      // 2) build + sign UpdateMetadataAccountV2 in Phantom
      const signature = await updateTokenMetadata({
        mint: info.mint, name: form.name, symbol: form.symbol, uri,
        sellerFeeBasisPoints: info.sellerFeeBasisPoints || 0, creators: info.creators || [],
      });
      setSig(signature);
    } catch (e: any) {
      setErr(e?.message?.includes("User rejected") ? "Cancelled in Phantom" : (e?.message || "Update failed"));
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl border border-accent/20 bg-accent/10">
          <Pencil className="h-7 w-7 text-accent" />
        </div>
        <h1 className="text-2xl font-black tracking-tight">Edit Token Metadata</h1>
        <p className="mt-2 text-sm text-muted">Update your token's name, symbol, image and socials — free, self-serve. Verified from your dev wallet, signed in Phantom. ORBITX_DEX never holds your funds or keys.</p>
      </div>

      {/* wallet */}
      <div className="card mb-4 flex items-center justify-between p-3">
        <div className="flex items-center gap-2 text-sm">
          <Wallet2 className="h-4 w-4 text-accent" />
          {address ? <span className="font-mono text-white">{short(address)}</span> : <span className="text-muted">Connect your dev wallet to verify ownership</span>}
        </div>
        {!address && <button onClick={connect} disabled={connecting} className="btn bg-accent text-black font-semibold">{connecting ? "Connecting…" : "Connect Phantom"}</button>}
      </div>

      {/* mint input */}
      <div className="card mb-4 p-4">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted">Token mint address</label>
        <div className="flex gap-2">
          <input value={mint} onChange={(e) => setMint(e.target.value)} placeholder="Paste your token's mint…"
            className="flex-1 rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-accent/60" />
          <button onClick={load} disabled={loading} className="btn bg-accent/15 text-accent font-semibold inline-flex items-center gap-1.5">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Load
          </button>
        </div>
        {err && <div className="mt-2 flex items-center gap-2 text-xs text-down"><AlertTriangle className="h-3.5 w-3.5" /> {err}</div>}
      </div>

      {/* current + eligibility */}
      {info && (
        <div className="card mb-4 p-4">
          <div className="flex items-center gap-3">
            {info.image ? <img src={info.image} className="h-12 w-12 rounded-xl border border-line object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-xl border border-line bg-panel2 text-muted"><ImageIcon className="h-5 w-5" /></div>}
            <div className="min-w-0">
              <div className="font-bold text-white">{info.name || "—"} <span className="text-muted">{info.symbol ? `($${info.symbol})` : ""}</span></div>
              <div className="text-[11px] text-muted">Update authority: {info.updateAuthority ? short(info.updateAuthority) : "none"} · {info.mutable ? "mutable" : "immutable"} · {info.isToken2022 ? "Token-2022" : "SPL"}</div>
            </div>
          </div>

          {/* eligibility banners */}
          {info.reason ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-down/25 bg-down/10 p-3 text-xs text-down">
              <Lock className="h-4 w-4 shrink-0" /> {REASON_MSG[info.reason] || "This token can't be edited."}
            </div>
          ) : !address ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-yellow-400/25 bg-yellow-400/10 p-3 text-xs text-yellow-300">
              <Info className="h-4 w-4 shrink-0" /> Connect your wallet to verify you're the developer.
            </div>
          ) : !isAuthority ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-down/25 bg-down/10 p-3 text-xs text-down">
              <XCircle className="h-4 w-4 shrink-0" /> Connected wallet isn't this token's update authority. Connect the dev wallet ({short(info.updateAuthority || "")}) to edit.
            </div>
          ) : (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-up/25 bg-up/10 p-3 text-xs text-up">
              <ShieldCheck className="h-4 w-4 shrink-0" /> Verified — you're the update authority. You can edit this token's metadata below.
            </div>
          )}
        </div>
      )}

      {/* edit form */}
      {canEdit && (
        <div className="card mb-4 p-4">
          <div className="mb-3 text-sm font-bold text-white">New metadata</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name"><input value={form.name} maxLength={32} onChange={(e) => setForm({ ...form, name: e.target.value })} className="inp" /></Field>
            <Field label="Symbol"><input value={form.symbol} maxLength={10} onChange={(e) => setForm({ ...form, symbol: e.target.value })} className="inp" /></Field>
            <Field label="Description" full><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="inp" /></Field>
            <Field label="New image (optional)" full>
              <input type="file" accept="image/*" onChange={(e) => setImgFile(e.target.files?.[0] || null)} className="text-xs text-muted file:mr-2 file:rounded file:border-0 file:bg-accent/15 file:px-2 file:py-1 file:text-accent" />
            </Field>
            <Field label="Website"><input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="inp" placeholder="https://" /></Field>
            <Field label="Twitter / X"><input value={form.twitter} onChange={(e) => setForm({ ...form, twitter: e.target.value })} className="inp" placeholder="https://x.com/…" /></Field>
            <Field label="Telegram"><input value={form.telegram} onChange={(e) => setForm({ ...form, telegram: e.target.value })} className="inp" placeholder="https://t.me/…" /></Field>
          </div>
          <button onClick={save} disabled={busy} className="mt-4 w-full rounded-xl bg-accent py-2.5 text-sm font-bold text-black hover:bg-accent/90 disabled:opacity-60">
            {busy ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Pinning & confirming in Phantom…</span> : "Update metadata on-chain"}
          </button>
          {sig && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-up/25 bg-up/10 px-3 py-2 text-xs text-up">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> Metadata updated. It may take a minute to refresh.
              <a href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 font-semibold hover:underline">View <ExternalLink className="h-3 w-3" /></a>
            </div>
          )}
          <p className="mt-2 text-center text-[10px] text-muted/70">Non-custodial — Phantom signs the on-chain update. ORBITX_DEX never holds your keys.</p>
        </div>
      )}

      {/* supported types */}
      <div className="card p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold text-white"><Info className="h-4 w-4 text-accent" /> What's supported</div>
        <div className="grid gap-3 sm:grid-cols-2 text-xs">
          <div>
            <div className="mb-1 font-semibold text-up">✓ Supported</div>
            <ul className="space-y-1 text-muted">
              <li>• Standard SPL tokens with <span className="text-white">mutable</span> Metaplex metadata</li>
              <li>• You must connect the token's <span className="text-white">update-authority (dev) wallet</span></li>
              <li>• Examples: tokens minted via standard SPL/Metaplex, most Raydium/Orca-launched tokens, custom mints</li>
            </ul>
          </div>
          <div>
            <div className="mb-1 font-semibold text-down">✕ Not supported</div>
            <ul className="space-y-1 text-muted">
              <li>• <span className="text-white">pump.fun tokens</span> — metadata is pump-controlled / immutable</li>
              <li>• Tokens with metadata set to <span className="text-white">immutable</span> (locked forever)</li>
              <li>• Token-2022 metadata (being added)</li>
              <li>• Tokens where you don't hold the update authority</li>
            </ul>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-muted/80">Planning a launch and want full control of your branding later? Launch a <span className="text-white">standard SPL token</span> (or use ORBITX_DEX's launcher) rather than a locked/pump.fun mint, and keep your metadata mutable.</p>
      </div>
    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}
