import { useEffect, useState } from "react";
import { getConfig, submitListing, AppConfig } from "../lib/api";
import { Copy, Check, Rocket, Clock, Zap, Share2, Globe, ShieldCheck, Send, BadgeCheck } from "lucide-react";
import Verified from "../components/Verified";

export default function Submit() {
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [tier, setTier] = useState("standard");
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState<any>({ contract_address: "", chain: "solana", project_name: "", banner_url: "", contact: "", links: { website: "", twitter: "", telegram: "" } });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<any>(null);
  const [err, setErr] = useState("");

  useEffect(() => { getConfig().then(setCfg); }, []);
  const wallet = cfg?.payWallet || "CicbPxARTDrwQ4XcxWsn6SYeG4FMJHirS633cZUJeQDh";
  const copy = () => { navigator.clipboard.writeText(wallet); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); if (!form.contract_address.trim()) { setErr("Contract address is required."); return; }
    setSubmitting(true);
    try {
      const r = await submitListing({ ...form, tier });
      if (r.ok) setDone(r.listing); else setErr(r.error || "Submission failed.");
    } catch (e: any) { setErr(String(e?.message || e)); } finally { setSubmitting(false); }
  };

  if (done) return (
    <div className="max-w-xl mx-auto card p-8 text-center mt-6">
      <div className="w-14 h-14 rounded-full bg-up/15 grid place-items-center mx-auto mb-4"><Check className="w-7 h-7 text-up" /></div>
      <h1 className="text-xl font-bold flex items-center justify-center gap-2">Submission received! <Verified size={18} /></h1>
      <p className="text-muted text-sm mt-2">We auto-scanned <span className="text-white font-mono">{done.symbol || done.contract_address.slice(0, 8)}…</span> and queued it for review. Once your payment is confirmed it will be permanently listed{tier === "express" ? " within 6 hours" : " within 24 hours"} with your <span className="text-accent font-semibold">Verified badge</span>.</p>
      <p className="text-muted text-xs mt-3">Questions? DM <a className="text-accent" href="https://t.me/ogscanofficial" target="_blank">@ogscanofficial</a> on Telegram.</p>
      <button onClick={() => { setDone(null); setForm({ contract_address: "", chain: "solana", project_name: "", banner_url: "", contact: "", links: {} }); }} className="btn bg-panel2 text-white mt-5">Submit another</button>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-1.5 pill bg-accent/15 text-accent mb-3"><Rocket className="w-3.5 h-3.5" /> Project Listing</div>
        <h1 className="text-3xl font-bold tracking-tight">Get your token listed on OG DEX</h1>
        <p className="text-muted mt-2 max-w-2xl mx-auto">Permanently listed and shared to our community every time new tokens drop. We post to our X community (200+) and Telegram. Visible to 55+ and growing users on OG Scan.</p>
      </div>

      {/* Verified incentive */}
      <div className="card p-5 mb-6 border-accent/40 glow relative overflow-hidden">
        <div className="absolute -right-6 -top-6 opacity-10"><Verified size={120} /></div>
        <div className="flex items-start gap-3 relative">
          <div className="w-10 h-10 rounded-full bg-accent/15 grid place-items-center shrink-0"><BadgeCheck className="w-5 h-5 text-accent" /></div>
          <div>
            <div className="font-semibold flex items-center gap-1.5">Every listing gets the OG DEX Verified badge <Verified size={16} /></div>
            <p className="text-sm text-muted mt-1">Listed projects display the blue verified checkmark <Verified size={12} className="inline align-[-1px]" /> across the screener and your token page. It signals to traders that your project is reviewed, on-chain-scanned, and officially listed, building instant trust and standing out from the thousands of unverified tokens.</p>
            <div className="flex flex-wrap gap-2 mt-3 text-xs">
              <span className="pill bg-up/10 text-up inline-flex items-center gap-1"><Check className="w-3 h-3" /> Trust signal in search results</span>
              <span className="pill bg-up/10 text-up inline-flex items-center gap-1"><Check className="w-3 h-3" /> Shared to X + Telegram on drop</span>
              <span className="pill bg-up/10 text-up inline-flex items-center gap-1"><Check className="w-3 h-3" /> Permanent placement</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        {(cfg?.pricing || [{ tier: "standard", price: 40, sla: "24 hours", label: "Standard listing" }, { tier: "express", price: 60, sla: "6 hours", label: "Express listing" }]).map((p) => (
          <button key={p.tier} onClick={() => setTier(p.tier)}
            className={`card p-5 text-left transition-all ${tier === p.tier ? "border-accent glow" : "hover:border-line"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">{p.tier === "express" ? <Zap className="w-4 h-4 text-accent" /> : <Clock className="w-4 h-4 text-muted" />}{p.label}</div>
              {tier === p.tier && <Check className="w-4 h-4 text-accent" />}
            </div>
            <div className="text-3xl font-bold mt-2">${p.price}</div>
            <div className="text-sm text-muted mt-1">Listed within <span className="text-white">{p.sla}</span></div>
            <div className="text-xs text-muted mt-3 flex items-center gap-1.5"><Share2 className="w-3 h-3" /> Permanent + shared on every new listing drop</div>
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Payment */}
        <div className="card p-5">
          <h2 className="font-semibold mb-1">How to pay</h2>
          <p className="text-sm text-muted mb-4">Send <span className="text-white font-semibold">${tier === "express" ? 60 : 40}</span> worth of <span className="text-white">SOL or USDC</span> to the wallet below, then submit your CA.</p>
          <div className="bg-white rounded-xl p-3 w-fit mx-auto">
            <img alt="Payment QR" width={200} height={200} src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=${encodeURIComponent(wallet)}`} />
          </div>
          <div className="mt-4">
            <div className="text-xs text-muted mb-1">Wallet address (SOL / USDC)</div>
            <button onClick={copy} className="w-full bg-panel2 border border-line rounded-lg px-3 py-2.5 text-xs font-mono break-all text-left hover:border-accent/50 flex items-center justify-between gap-2">
              <span>{wallet}</span>{copied ? <Check className="w-4 h-4 text-up shrink-0" /> : <Copy className="w-4 h-4 text-muted shrink-0" />}
            </button>
          </div>
          <ol className="text-sm text-muted mt-5 space-y-2 list-decimal list-inside">
            <li>Send ${tier === "express" ? 60 : 40} (SOL or USDC) to the wallet.</li>
            <li>Submit your Contract Address (CA) →</li>
            <li>Optional: add project name, banner and links.</li>
          </ol>
          <p className="text-xs text-muted mt-4">Our tech automatically scans your CA and pulls all metadata + on-chain data into our backend — no manual typing needed.</p>
          <div className="mt-4 pt-4 border-t border-line text-xs text-muted">
            <div className="flex items-center gap-1.5 font-semibold text-white mb-1"><ShieldCheck className="w-3.5 h-3.5 text-accent" /> Free updates anytime</div>
            Update links, banner, etc. for free. To verify you're the dev: DM <a className="text-accent" href="https://t.me/ogscanofficial" target="_blank">@ogscanofficial</a> and post on X: "I verify I am the developer of this project requesting to update our links on OG DEX".
          </div>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="card p-5 space-y-3 h-fit">
          <h2 className="font-semibold">Submit your project</h2>
          <Field label="Contract Address (CA) *">
            <input required value={form.contract_address} onChange={(e) => setForm({ ...form, contract_address: e.target.value })} placeholder="Paste your token mint / contract address" className={inp} />
          </Field>
          <Field label="Chain">
            <select value={form.chain} onChange={(e) => setForm({ ...form, chain: e.target.value })} className={inp}>
              {(cfg?.chains || ["solana", "ethereum", "base", "bsc", "other"]).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Project name (optional)"><input value={form.project_name} onChange={(e) => setForm({ ...form, project_name: e.target.value })} className={inp} /></Field>
          <Field label="Banner URL (optional)"><input value={form.banner_url} onChange={(e) => setForm({ ...form, banner_url: e.target.value })} placeholder="https://…" className={inp} /></Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Website"><input value={form.links.website} onChange={(e) => setForm({ ...form, links: { ...form.links, website: e.target.value } })} className={inp} /></Field>
            <Field label="X / Twitter"><input value={form.links.twitter} onChange={(e) => setForm({ ...form, links: { ...form.links, twitter: e.target.value } })} className={inp} /></Field>
            <Field label="Telegram"><input value={form.links.telegram} onChange={(e) => setForm({ ...form, links: { ...form.links, telegram: e.target.value } })} className={inp} /></Field>
          </div>
          <Field label="Your contact (TG / X handle)"><input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="@yourhandle" className={inp} /></Field>
          {err && <div className="text-down text-xs">{err}</div>}
          <button disabled={submitting} className="btn bg-accent text-black font-semibold w-full inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {submitting ? "Submitting…" : <>Submit project <Send className="w-3.5 h-3.5" /></>}
          </button>
          <p className="text-[11px] text-muted text-center flex items-center justify-center gap-1">Goes live with your Verified badge <Verified size={11} /> after payment is confirmed. Any chain supported.</p>
        </form>
      </div>
    </div>
  );
}
const inp = "w-full bg-panel2 border border-line rounded-lg px-2.5 py-2 text-sm outline-none focus:border-accent/60";
function Field({ label, children }: { label: string; children: any }) {
  return <label className="block"><span className="text-xs text-muted mb-1 block">{label}</span>{children}</label>;
}
