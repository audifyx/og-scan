import { useState, useEffect } from "react";
import { adminGet, adminAction, fmtNum, short } from "../lib/api";
import { Lock, Eye, Users, CheckCircle2, XCircle, Star, Trash2, Loader2, BarChart3, Clock, DollarSign, BadgeCheck, Rocket, Sparkles } from "lucide-react";

const LS_KEY = "ogdex_admin_pass";

export default function Admin() {
  const [pass, setPass] = useState(localStorage.getItem(LS_KEY) || "");
  const [authed, setAuthed] = useState(false);
  const [input, setInput] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [featCa, setFeatCa] = useState("");
  const [featToken, setFeatToken] = useState<any>(null);
  const [featScanLoading, setFeatScanLoading] = useState(false);
  const [featLoading, setFeatLoading] = useState(false);
  const [featMsg, setFeatMsg] = useState("");

  const load = async (p: string) => {
    setLoading(true); setErr("");
    const d = await adminGet(p);
    if (d.ok) { setData(d); setAuthed(true); setPass(p); localStorage.setItem(LS_KEY, p); }
    else { setErr("Wrong password."); setAuthed(false); }
    setLoading(false);
  };
  useEffect(() => { if (pass) load(pass); /* eslint-disable-next-line */ }, []);

  const act = async (action: string, id?: string, extra?: any) => {
    await adminAction(pass, action, id, extra);
    load(pass);
  };

  if (!authed) return (
    <div className="max-w-sm mx-auto card p-6 mt-16">
      <div className="flex items-center gap-2 font-semibold mb-4"><Lock className="w-4 h-4 text-accent" /> Admin access</div>
      <form onSubmit={(e) => { e.preventDefault(); load(input); }}>
        <input type="password" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Enter password"
          className="w-full bg-panel2 border border-line rounded-lg px-3 py-2.5 text-sm outline-none focus:border-accent/60" autoFocus />
        {err && <div className="text-down text-xs mt-2">{err}</div>}
        <button className="btn bg-accent text-black font-semibold w-full mt-3">{loading ? "Checking…" : "Enter"}</button>
      </form>
    </div>
  );

  // Auto-scan token metadata when CA is pasted
  const scanFeatToken = async (ca: string) => {
    setFeatCa(ca); setFeatToken(null); setFeatMsg("");
    const v = ca.trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)) return;
    setFeatScanLoading(true);
    try {
      const d = await fetch(`/api/ogdex/token?mint=${v}`).then(r => r.json());
      if (d?.token?.mint) setFeatToken(d.token);
      else setFeatMsg("Token not found — check the address.");
    } catch { setFeatMsg("Scan failed. Check the address."); }
    finally { setFeatScanLoading(false); }
  };

  const addFeatured = async () => {
    if (!featCa.trim()) { setFeatMsg("Paste a contract address first."); return; }
    setFeatLoading(true); setFeatMsg("");
    try {
      const t = featToken || {};
      const r = await adminAction(pass, "add_featured", "noop", {
        mint: featCa.trim(),
        symbol: t.symbol || "",
        project_name: t.name || t.symbol || "",
        logo_url: t.icon || "",
        description: t.description || "",
        chain: "solana",
      });
      if (r && r.ok === false) throw new Error(r.error || "Failed");
      setFeatMsg("Added to featured!");
      setFeatCa(""); setFeatToken(null);
      setTimeout(() => load(pass), 800);
    } catch (e: any) { setFeatMsg("Error: " + (e.message || "unknown")); }
    finally { setFeatLoading(false); }
  };

  const s = data?.stats || {};
  const maxDay = Math.max(1, ...(s.series || []).map((x: any) => x.count));

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-5 h-5 text-accent" /> Admin Dashboard</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => load(pass)} className="btn bg-panel2 text-muted hover:text-white">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}</button>
          <button onClick={() => { localStorage.removeItem(LS_KEY); setAuthed(false); setPass(""); }} className="btn bg-panel2 text-muted hover:text-white">Lock</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <Stat icon={Eye} label="Views 24h" value={fmtNum(s.views24)} />
        <Stat icon={Users} label="Views 7d" value={fmtNum(s.views7)} />
        <Stat icon={Clock} label="Pending" value={fmtNum(s.pending)} accent />
        <Stat icon={CheckCircle2} label="Approved" value={fmtNum(s.approved)} />
        <Stat icon={BarChart3} label="Total events" value={fmtNum(s.totalEvents)} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <Stat icon={DollarSign} label="Est. revenue" value={"$" + fmtNum(s.revenue)} accent />
        <Stat icon={BadgeCheck} label="Total listings" value={fmtNum(s.totalListings)} />
        <Stat icon={Star} label="Featured" value={fmtNum(s.featured)} />
        <Stat icon={Rocket} label="Submissions 24h" value={fmtNum(s.subs24)} />
        <Stat icon={XCircle} label="Rejected" value={fmtNum(s.rejected)} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-5">
        <div className="card p-4 lg:col-span-2">
          <div className="text-sm font-semibold mb-3">Daily activity (30d)</div>
          <div className="flex items-end gap-1 h-32">
            {(s.series || []).map((d: any) => (
              <div key={d.day} className="flex-1 group relative" title={`${d.day}: ${d.count}`}>
                <div className="bg-accent/70 hover:bg-accent rounded-t" style={{ height: `${(d.count / maxDay) * 100}%`, minHeight: 2 }} />
              </div>
            ))}
            {(!s.series || !s.series.length) && <div className="text-muted text-sm">No data yet.</div>}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-sm font-semibold mb-3">Top viewed tokens</div>
          <div className="space-y-1.5 text-sm">
            {(s.topTokens || []).slice(0, 8).map((t: any) => (
              <div key={t.ref} className="flex justify-between"><span className="text-muted truncate">{t.ref}</span><span>{t.views}</span></div>
            ))}
            {(!s.topTokens || !s.topTokens.length) && <div className="text-muted text-sm">No views yet.</div>}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4 mb-5">
        <Breakdown title="Listings by chain" data={s.byChain} />
        <Breakdown title="Listings by tier" data={s.byTier} />
        <Breakdown title="Events by type" data={s.byType} />
        <PathList title="Top pages" rows={s.topPaths} />
      </div>

      {/* Quick-Add Featured */}
      <Section title="Quick-Add to Featured Daily">
        <div className="space-y-3">
          {/* CA input — auto-scans on change */}
          <div className="relative">
            <input
              value={featCa}
              onChange={e => scanFeatToken(e.target.value)}
              placeholder="Paste token contract address — metadata loads automatically"
              className="card w-full p-3 text-sm bg-transparent outline-none placeholder:text-muted/40 font-mono pr-10"
            />
            {featScanLoading && (
              <Loader2 className="w-4 h-4 animate-spin text-accent absolute right-3 top-1/2 -translate-y-1/2" />
            )}
          </div>
          {/* Token preview card */}
          {featToken && (
            <div className="card p-3 flex items-center gap-3 border-accent/30 bg-accent/5">
              {featToken.icon
                ? <img src={featToken.icon} className="w-10 h-10 rounded-full border border-line object-cover shrink-0" />
                : <div className="w-10 h-10 rounded-full bg-panel2 grid place-items-center text-sm font-bold text-muted shrink-0">{(featToken.symbol||"?").slice(0,2)}</div>
              }
              <div className="flex-1 min-w-0">
                <div className="font-bold text-white">{featToken.symbol} <span className="text-muted font-normal text-sm">{featToken.name}</span></div>
                {featToken.mcap && <div className="text-xs text-muted">MC ${Number(featToken.mcap).toLocaleString()}</div>}
                <div className="text-[10px] text-muted/50 font-mono truncate">{featCa.trim()}</div>
              </div>
              <CheckCircle2 className="w-5 h-5 text-up shrink-0" />
            </div>
          )}
          {/* Action row */}
          <div className="flex items-center gap-3">
            <button
              onClick={addFeatured}
              disabled={featLoading || featScanLoading || !featCa.trim()}
              className="btn bg-accent text-black font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {featLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Add to Featured
            </button>
            {featMsg && (
              <span className={featMsg.startsWith("Added") ? "text-up text-sm" : "text-down text-sm"}>
                {featMsg}
              </span>
            )}
          </div>
        </div>
      </Section>

      <Section title={`Pending listings (${data?.pending?.length || 0})`}>
        {(data?.pending || []).map((l: any) => (
          <ListingRow key={l.id} l={l} actions={
            <>
              <button onClick={() => act("approve", l.id)} className="btn bg-up/15 text-up inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Approve</button>
              <button onClick={() => act("reject", l.id)} className="btn bg-down/15 text-down inline-flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Reject</button>
            </>
          } />
        ))}
        {!data?.pending?.length && <Empty text="No pending submissions." />}
      </Section>

      <Section title={`Approved listings (${data?.approved?.length || 0})`}>
        {(data?.approved || []).map((l: any) => (
          <ListingRow key={l.id} l={l} actions={
            <>
              {l.featured
                ? <button onClick={() => act("unfeature", l.id)} className="btn bg-accent2/20 text-accent2 inline-flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-current" /> Featured</button>
                : <button onClick={() => act("feature", l.id, { featured_rank: 1 })} className="btn bg-panel2 text-muted hover:text-white inline-flex items-center gap-1"><Star className="w-3.5 h-3.5" /> Feature</button>}
              <button onClick={() => { if (confirm("Delete listing?")) act("delete", l.id); }} className="btn bg-panel2 text-down hover:bg-down/10"><Trash2 className="w-3.5 h-3.5" /></button>
            </>
          } />
        ))}
        {!data?.approved?.length && <Empty text="No approved listings yet." />}
      </Section>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: any) {
  return <div className={`card p-4 ${accent ? "border-accent/40" : ""}`}>
    <div className="text-xs text-muted flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" /> {label}</div>
    <div className="text-2xl font-bold mt-1">{value}</div>
  </div>;
}
function Section({ title, children }: { title: string; children: any }) {
  return <div className="mb-5"><div className="text-sm font-semibold mb-2">{title}</div><div className="space-y-2">{children}</div></div>;
}
function Empty({ text }: { text: string }) { return <div className="card p-6 text-center text-muted text-sm">{text}</div>; }
function Breakdown({ title, data }: { title: string; data?: Record<string, number> }) {
  const entries = Object.entries(data || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = Math.max(1, ...entries.map((e) => e[1]));
  return <div className="card p-4"><div className="text-sm font-semibold mb-3">{title}</div><div className="space-y-2">
    {entries.length ? entries.map(([k, v]) => (
      <div key={k} className="text-xs"><div className="flex justify-between mb-0.5"><span className="text-muted capitalize truncate">{k}</span><span>{v}</span></div>
        <div className="h-1.5 bg-panel2 rounded-full overflow-hidden"><div className="h-full bg-accent" style={{ width: `${(v / max) * 100}%` }} /></div></div>
    )) : <div className="text-muted text-xs">No data.</div>}
  </div></div>;
}
function PathList({ title, rows }: { title: string; rows?: { path: string; count: number }[] }) {
  return <div className="card p-4"><div className="text-sm font-semibold mb-3">{title}</div><div className="space-y-1.5 text-xs">
    {(rows || []).length ? rows!.map((r) => <div key={r.path} className="flex justify-between"><span className="text-muted truncate max-w-[140px]">{r.path}</span><span>{r.count}</span></div>) : <div className="text-muted">No data.</div>}
  </div></div>;
}
function ListingRow({ l, actions }: { l: any; actions: any }) {
  return (
    <div className="card p-3 flex items-center gap-3">
      {l.logo_url ? <img src={l.logo_url} className="w-10 h-10 rounded-full object-cover border border-line shrink-0" />
        : <div className="w-10 h-10 rounded-full bg-panel2 grid place-items-center text-[10px] text-muted shrink-0">{(l.symbol || "?").slice(0, 3)}</div>}
      <div className="min-w-0 flex-1">
        <div className="font-semibold truncate flex items-center gap-1.5">{l.project_name || l.symbol || "Project"}
          <span className="pill bg-panel2 text-muted text-[10px] uppercase">{l.chain}</span>
          <span className={`pill text-[10px] ${l.tier === "express" ? "bg-accent/15 text-accent" : "bg-panel2 text-muted"}`}>{l.tier}</span>
        </div>
        <div className="text-xs text-muted font-mono truncate">{short(l.contract_address)}{l.contact ? ` · ${l.contact}` : ""}</div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">{actions}</div>
    </div>
  );
}
