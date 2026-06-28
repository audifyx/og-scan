import { useState, useEffect, useRef } from "react";
import { adminGet, adminAction, fmtNum, short } from "../lib/api";
import {
  Lock, Eye, Users, CheckCircle2, XCircle, Star, Trash2, Loader2,
  BarChart3, Clock, DollarSign, BadgeCheck, Rocket, Sparkles, Radio,
  Zap, Activity, Plus, ExternalLink, Shield, Bell, Settings, Megaphone,
  ShieldOff, Download, RefreshCw, TrendingUp, AlertTriangle, ChevronRight,
  Globe, ToggleLeft, ToggleRight, Search, Filter, Copy, Flag, Ban,
  CheckSquare, XSquare, Wallet, LayoutDashboard, List, Mail, MessageSquare, LifeBuoy, Link2, Mic,
} from "lucide-react";

const LS_KEY = "ogdex_admin_pass";

// ─── Tab type ─────────────────────────────────────────────────────────────────
type Tab =
  | "overview"
  | "listings"
  | "kols"
  | "nominations"
  | "pro"
  | "config"
  | "banners"
  | "banned"
  | "alerts"
  | "waitlist"
  | "users"
  | "reports"
  | "audit"
  | "spaces"
  | "chat"
  | "support"
  | "affiliates"
  | "communities"
  | "notifications";

type Cat = "dex" | "social";
const TABS: { id: Tab; label: string; icon: any; cat: Cat }[] = [
  { id: "overview",     label: "Overview",      icon: LayoutDashboard, cat: "dex" },
  { id: "listings",     label: "Listings",       icon: List,           cat: "dex" },
  { id: "kols",         label: "KOLs",           icon: Radio,          cat: "dex" },
  { id: "nominations",  label: "Nominations",    icon: Star,           cat: "dex" },
  { id: "pro",          label: "Pro Wallets",    icon: Shield,         cat: "dex" },
  { id: "banners",      label: "Banners",        icon: Megaphone,      cat: "dex" },
  { id: "config",       label: "Config",         icon: Settings,       cat: "dex" },
  { id: "banned",       label: "Banned",         icon: Ban,            cat: "dex" },
  { id: "alerts",       label: "Alerts",         icon: Bell,           cat: "dex" },
  // ── Social ──
  { id: "users",        label: "Users",          icon: Users,          cat: "social" },
  { id: "reports",      label: "Reports",        icon: Flag,           cat: "social" },
  { id: "audit",        label: "Audit Log",      icon: Activity,       cat: "social" },
  { id: "waitlist",     label: "Waitlist",       icon: Mail,           cat: "social" },
  { id: "spaces",       label: "Spaces",         icon: Mic,            cat: "social" },
  { id: "chat",         label: "Chat",           icon: MessageSquare,  cat: "social" },
  { id: "support",      label: "Support",        icon: LifeBuoy,       cat: "social" },
  { id: "affiliates",   label: "Affiliates",     icon: Link2,          cat: "social" },
  { id: "communities",  label: "Communities",    icon: Globe,          cat: "social" },
  { id: "notifications",label: "Notifications",   icon: Bell,           cat: "social" },
];
const CAT_LABEL: Record<Cat, string> = { dex: "OG Dex", social: "Social" };

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function Admin() {
  const [pass, setPass]       = useState(localStorage.getItem(LS_KEY) || "");
  const [authed, setAuthed]   = useState(false);
  const [input, setInput]     = useState("");
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");
  const [tab, setTab]         = useState<Tab>("overview");
  const [health, setHealth]   = useState<any>(null);

  const load = async (p: string) => {
    setLoading(true); setErr("");
    const d = await adminGet(p);
    if (d.ok) {
      setData(d); setAuthed(true); setPass(p);
      localStorage.setItem(LS_KEY, p);
      fetch("/api/ogdex/health").then(r => r.json()).then(setHealth).catch(() => {});
    } else {
      setErr("Wrong password."); setAuthed(false);
    }
    setLoading(false);
  };

  useEffect(() => { if (pass) load(pass); }, []);

  const act = async (action: string, id?: string, extra?: any) => {
    const r = await adminAction(pass, action, id, extra);
    await load(pass);
    return r;
  };

  if (!authed) return (
    <div className="max-w-sm mx-auto card p-6 mt-16">
      <div className="flex items-center gap-2 font-semibold mb-4">
        <Lock className="w-4 h-4 text-accent" /> Admin access
      </div>
      <form onSubmit={(e) => { e.preventDefault(); load(input); }}>
        <input type="password" value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="Enter password"
          className="w-full bg-panel2 border border-line rounded-lg px-3 py-2.5 text-sm outline-none focus:border-accent/60"
          autoFocus />
        {err && <div className="text-down text-xs mt-2">{err}</div>}
        <button className="btn bg-accent text-black font-semibold w-full mt-3">
          {loading ? "Checking…" : "Enter"}
        </button>
      </form>
    </div>
  );

  const s = data?.stats || {};

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-black flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-accent" /> Admin Dashboard
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={() => load(pass)} disabled={loading}
            className="btn bg-panel2 text-muted hover:text-white inline-flex items-center gap-1.5 text-xs">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button
            onClick={() => { localStorage.removeItem(LS_KEY); setAuthed(false); setPass(""); }}
            className="btn bg-panel2 text-muted hover:text-white text-xs">
            Lock
          </button>
        </div>
      </div>

      {/* Tabs — grouped by category */}
      <div className="space-y-2 mb-5">
        {(["dex", "social"] as Cat[]).map((c) => (
          <div key={c}>
            <div className="px-1 mb-1 text-[10px] font-bold uppercase tracking-widest text-muted">{CAT_LABEL[c]}</div>
            <div className="flex gap-0.5 flex-wrap bg-panel2 p-1 rounded-xl border border-line">
              {TABS.filter((t) => t.cat === c).map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    tab === t.id ? "bg-accent/15 text-accent" : "text-muted hover:text-white"
                  }`}>
                  <t.icon className="w-3.5 h-3.5" /> {t.label}
                  {t.id === "nominations" && (data?.nominations?.filter((n: any) => n.status === "pending")?.length || 0) > 0 &&
                    <span className="ml-0.5 bg-down text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      {data.nominations.filter((n: any) => n.status === "pending").length}
                    </span>}
                  {t.id === "listings" && (data?.pending?.length || 0) > 0 &&
                    <span className="ml-0.5 bg-accent text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      {data.pending.length}
                    </span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────────── */}
      {tab === "overview" && <OverviewTab s={s} health={health} data={data} act={act} pass={pass} />}
      {tab === "listings" && <ListingsTab data={data} act={act} pass={pass} />}
      {tab === "kols"      && <KolsTab data={data} act={act} pass={pass} />}
      {tab === "nominations" && <NominationsTab data={data} act={act} pass={pass} />}
      {tab === "pro"       && <ProTab data={data} act={act} pass={pass} />}
      {tab === "banners"   && <BannersTab data={data} act={act} pass={pass} />}
      {tab === "config"    && <ConfigTab data={data} act={act} pass={pass} />}
      {tab === "banned"    && <BannedTab data={data} act={act} pass={pass} />}
      {tab === "alerts"    && <AlertsTab data={data} act={act} pass={pass} />}
      {tab === "waitlist"  && <WaitlistTab data={data} />}
      {tab === "users"     && <UsersTab data={data} act={act} />}
      {tab === "reports"   && <ReportsTab data={data} act={act} />}
      {tab === "audit"     && <AuditTab data={data} />}
      {tab === "spaces"    && <SpacesTab data={data} act={act} />}
      {tab === "chat"      && <ChatTab data={data} act={act} />}
      {tab === "support"   && <SupportTab data={data} act={act} />}
      {tab === "affiliates" && <AffiliatesTab data={data} act={act} />}
      {tab === "communities" && <CommunitiesTab data={data} act={act} />}
      {tab === "notifications" && <NotificationsTab data={data} />}
    </div>
  );
}

// ─── Overview ────────────────────────────────────────────────────────────────
function OverviewTab({ s, health, data, act, pass }: any) {
  const maxDay = Math.max(1, ...(s.series || []).map((x: any) => x.count));

  return (
    <div className="space-y-5">
      {/* Stat grids */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat icon={Eye}          label="Views 24h"      value={fmtNum(s.views24)} />
        <Stat icon={Users}        label="Views 7d"       value={fmtNum(s.views7)} />
        <Stat icon={Clock}        label="Pending"        value={fmtNum(s.pending)} accent />
        <Stat icon={CheckCircle2} label="Approved"       value={fmtNum(s.approved)} />
        <Stat icon={BarChart3}    label="Total events"   value={fmtNum(s.totalEvents)} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat icon={DollarSign}  label="Est. revenue"   value={"$" + fmtNum(s.revenue)} accent />
        <Stat icon={BadgeCheck}  label="Total listings" value={fmtNum(s.totalListings)} />
        <Stat icon={Star}        label="Featured"       value={fmtNum(s.featured)} />
        <Stat icon={Rocket}      label="Subs 24h"       value={fmtNum(s.subs24)} />
        <Stat icon={XCircle}     label="Rejected"       value={fmtNum(s.rejected)} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat icon={Radio}        label="KOLs tracked"   value={fmtNum(s.kols)} />
        <Stat icon={Zap}          label="Active boosts"  value={fmtNum(s.activeBoosts)} accent />
        <Stat icon={DollarSign}   label="Boost revenue"  value={"$" + fmtNum(s.boostRevenue)} />
        <Stat icon={Shield}       label="Pro wallets"    value={fmtNum(s.proWallets ?? 0)} />
        <Stat icon={Activity}     label="API health"     value={health ? (health.ok ? "Healthy" : "Issues") : "—"} accent={health && !health.ok} />
      </div>

      {/* System health */}
      <Section title="System health">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(health?.checks || []).map((c: any) => (
            <div key={c.name} className="card p-3">
              <div className="flex items-center gap-2 text-sm font-semibold capitalize">
                <span className={`h-2 w-2 rounded-full ${c.ok ? "bg-up" : "bg-down"}`} /> {c.name}
              </div>
              <div className="text-xs text-muted mt-1">{c.ok ? "OK" : "Down"} · {c.ms}ms</div>
            </div>
          ))}
          {!health && <div className="text-muted text-sm">Checking…</div>}
        </div>
      </Section>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-4 lg:col-span-2">
          <div className="text-sm font-semibold mb-3">Daily activity (30d)</div>
          <div className="flex items-end gap-1 h-32">
            {(s.series || []).map((d: any) => (
              <div key={d.day} className="flex-1 group relative" title={`${d.day}: ${d.count}`}>
                <div className="bg-accent/70 hover:bg-accent rounded-t transition-all"
                  style={{ height: `${(d.count / maxDay) * 100}%`, minHeight: 2 }} />
              </div>
            ))}
            {!s.series?.length && <div className="text-muted text-sm">No data yet.</div>}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-sm font-semibold mb-3">Top viewed tokens</div>
          <div className="space-y-1.5 text-sm">
            {(s.topTokens || []).slice(0, 8).map((t: any) => (
              <div key={t.ref} className="flex justify-between">
                <a href={`/OGDEX/token/${t.ref}`} target="_blank" rel="noreferrer"
                  className="text-muted truncate hover:text-accent text-xs font-mono">{t.ref.slice(0, 8)}…</a>
                <span className="text-xs">{t.views}</span>
              </div>
            ))}
            {!s.topTokens?.length && <div className="text-muted text-sm">No views yet.</div>}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Breakdown title="Listings by chain" data={s.byChain} />
        <Breakdown title="Listings by tier"  data={s.byTier} />
        <Breakdown title="Events by type"    data={s.byType} />
        <PathList  title="Top pages"         rows={s.topPaths} />
      </div>

      {/* Revenue breakdown */}
      <Section title="Revenue">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card p-3 text-center">
            <div className="text-lg font-black text-up">${fmtNum(s.revenue || 0)}</div>
            <div className="text-[10px] text-muted">Listing revenue (est.)</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-lg font-black text-accent">${fmtNum(s.boostRevenue || 0)}</div>
            <div className="text-[10px] text-muted">Boost revenue</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-lg font-black text-white">${fmtNum((s.revenue || 0) + (s.boostRevenue || 0))}</div>
            <div className="text-[10px] text-muted">Total (est.)</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-lg font-black text-white">{fmtNum(s.approved || 0)}</div>
            <div className="text-[10px] text-muted">Paid listings</div>
          </div>
        </div>
      </Section>

      {/* Quick-add featured */}
      <QuickAddFeatured pass={pass} onDone={() => {}} />
    </div>
  );
}

// ─── Listings ────────────────────────────────────────────────────────────────
function ListingsTab({ data, act }: any) {
  const [view, setView] = useState<"pending"|"approved"|"rejected">("pending");
  const [search, setSearch] = useState("");

  const items = (data?.[view] || []).filter((l: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (l.project_name || "").toLowerCase().includes(q) ||
           (l.symbol || "").toLowerCase().includes(q) ||
           (l.contract_address || "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex gap-1.5 bg-panel2 rounded-xl p-1 border border-line">
          {(["pending","approved","rejected"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
                view === v ? "bg-accent/15 text-accent" : "text-muted hover:text-white"
              }`}>
              {v} ({data?.[v]?.length || 0})
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search listings…" className="inp pl-8 text-sm" />
        </div>
      </div>

      <div className="space-y-2">
        {items.map((l: any) => (
          <ListingRow key={l.id} l={l} actions={
            view === "pending" ? <>
              <button onClick={() => act("approve", l.id)}
                className="btn bg-up/15 text-up inline-flex items-center gap-1 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5" /> Approve
              </button>
              <button onClick={() => act("reject", l.id)}
                className="btn bg-down/15 text-down inline-flex items-center gap-1 text-xs">
                <XCircle className="w-3.5 h-3.5" /> Reject
              </button>
            </> : view === "approved" ? <>
              {l.featured
                ? <button onClick={() => act("unfeature", l.id)}
                    className="btn bg-accent/15 text-accent text-xs">Unfeature</button>
                : <button onClick={() => act("feature", l.id, { featured_rank: 1 })}
                    className="btn bg-panel2 text-muted hover:text-white text-xs">Feature</button>
              }
              <button onClick={() => { if (confirm("Delete?")) act("delete", l.id); }}
                className="btn bg-panel2 text-down hover:bg-down/10">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </> : <>
              <button onClick={() => act("approve", l.id)}
                className="btn bg-up/15 text-up text-xs">Re-approve</button>
              <button onClick={() => { if (confirm("Delete?")) act("delete", l.id); }}
                className="btn bg-panel2 text-down hover:bg-down/10">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          } />
        ))}
        {!items.length && <Empty text={`No ${view} listings.`} />}
      </div>
    </div>
  );
}

// ─── KOLs ────────────────────────────────────────────────────────────────────
function KolsTab({ data, act }: any) {
  const [kolAddr, setKolAddr] = useState("");
  const [kolName, setKolName] = useState("");
  const [kolTw, setKolTw]     = useState("");
  const [kolMsg, setKolMsg]   = useState("");
  const [search, setSearch]   = useState("");

  const addKol = async () => {
    if (!kolAddr.trim()) { setKolMsg("Paste a wallet address."); return; }
    setKolMsg("Adding…");
    const r = await act("add_kol", "noop", {
      address: kolAddr.trim(), name: kolName.trim() || undefined, twitter: kolTw.trim() || undefined
    });
    if (r?.ok === false) { setKolMsg("Error: " + (r.error || "failed")); return; }
    setKolMsg("KOL added."); setKolAddr(""); setKolName(""); setKolTw("");
  };

  const kols = (data?.kols || []).filter((k: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (k.name || "").toLowerCase().includes(q) ||
           (k.address || "").toLowerCase().includes(q) ||
           (k.x_handle || "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Add KOL */}
      <div className="card p-4">
        <div className="text-sm font-semibold mb-3">Add KOL to directory</div>
        <div className="grid sm:grid-cols-4 gap-2 mb-2">
          <input value={kolAddr} onChange={e => setKolAddr(e.target.value)}
            placeholder="Wallet address" className="inp font-mono sm:col-span-2" />
          <input value={kolName} onChange={e => setKolName(e.target.value)} placeholder="Name" className="inp" />
          <input value={kolTw} onChange={e => setKolTw(e.target.value)} placeholder="@twitter" className="inp" />
        </div>
        <button onClick={addKol}
          className="btn bg-accent text-black font-semibold inline-flex items-center gap-1.5 text-sm">
          <Plus className="w-4 h-4" /> Add KOL
        </button>
        {kolMsg && <span className={`ml-3 text-xs ${kolMsg.startsWith("Error") ? "text-down" : "text-up"}`}>{kolMsg}</span>}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search KOLs…" className="inp pl-8" />
      </div>

      {/* List */}
      <div className="grid sm:grid-cols-2 gap-2">
        {kols.map((k: any) => (
          <div key={k.address} className="card p-3 flex items-center gap-2.5">
            <BadgeCheck className="w-4 h-4 text-accent shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold truncate text-sm">
                {k.name}
                {k.x_handle && <span className="text-muted text-xs ml-1">@{String(k.x_handle).replace(/^@/, "")}</span>}
              </div>
              <div className="text-[11px] text-muted font-mono truncate">{short(k.address)}</div>
            </div>
            {k.status === "disputed" && <span className="pill bg-down/15 text-down text-[9px]">disputed</span>}
            <button
              onClick={() => { if (confirm("Remove KOL?")) act("remove_kol", "noop", { kol_id: k.kol_id, address: k.address }); }}
              className="btn bg-panel2 text-down hover:bg-down/10 shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {!kols.length && <Empty text="No KOLs found." />}
      </div>

      {/* Export */}
      <button
        onClick={() => {
          const csv = ["address,name,twitter", ...(data?.kols || []).map((k: any) =>
            `${k.address},"${k.name || ""}","${k.x_handle || ""}"`
          )].join("\n");
          const a = document.createElement("a");
          a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
          a.download = "og-kols.csv"; a.click();
        }}
        className="btn bg-panel2 text-muted hover:text-white inline-flex items-center gap-1.5 text-xs">
        <Download className="w-3.5 h-3.5" /> Export KOLs CSV
      </button>
    </div>
  );
}

// ─── Nominations ─────────────────────────────────────────────────────────────
function NominationsTab({ data, act }: any) {
  const nominations = data?.nominations || [];
  const pending = nominations.filter((n: any) => n.status === "pending");
  const reviewed = nominations.filter((n: any) => n.status !== "pending");

  const approve = async (n: any) => {
    await act("approve_nomination", "noop", { address: n.address, label: n.label });
  };
  const reject = async (n: any) => {
    await act("reject_nomination", "noop", { address: n.address });
  };

  return (
    <div className="space-y-5">
      {/* Pending */}
      <Section title={`Pending nominations (${pending.length})`}>
        {pending.length === 0 && <Empty text="No pending nominations." />}
        {pending.map((n: any) => (
          <div key={n.address} className="card p-3 flex items-center gap-3">
            <Star className="w-4 h-4 text-yellow-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-mono text-sm truncate">{n.address}</div>
              {n.label && <div className="text-xs text-muted">{n.label}</div>}
              <div className="text-[10px] text-muted/60">{n.votes} vote{n.votes !== 1 ? "s" : ""} · submitted {new Date(n.submittedAt).toLocaleDateString()}</div>
            </div>
            <a href={`https://solscan.io/account/${n.address}`} target="_blank" rel="noreferrer"
              className="btn bg-panel2 text-muted hover:text-white shrink-0">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button onClick={() => approve(n)} className="btn bg-up/15 text-up text-xs inline-flex items-center gap-1 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" /> Approve as KOL
            </button>
            <button onClick={() => reject(n)} className="btn bg-down/15 text-down text-xs shrink-0">
              <XCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </Section>

      {/* Reviewed */}
      {reviewed.length > 0 && (
        <Section title="Recently reviewed">
          <div className="space-y-1.5">
            {reviewed.map((n: any) => (
              <div key={n.address} className="card p-2.5 flex items-center gap-3">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  n.status === "approved" ? "bg-up/15 text-up" : "bg-down/15 text-down"}`}>
                  {n.status}
                </span>
                <span className="font-mono text-xs text-muted truncate">{n.address}</span>
                {n.label && <span className="text-xs text-muted/60 truncate">{n.label}</span>}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ─── Pro Wallets ─────────────────────────────────────────────────────────────
function ProTab({ data, act }: any) {
  const [addr, setAddr]   = useState("");
  const [note, setNote]   = useState("");
  const [msg, setMsg]     = useState("");
  const [adding, setAdding] = useState(false);

  const proWallets = data?.proWallets || [];

  const grant = async () => {
    if (!addr.trim()) { setMsg("Enter a wallet address."); return; }
    setAdding(true); setMsg("");
    const r = await act("grant_pro", "noop", { address: addr.trim(), note: note.trim() || undefined });
    setMsg(r?.ok === false ? "Error: " + r.error : "Pro access granted.");
    setAddr(""); setNote("");
    setAdding(false);
  };

  return (
    <div className="space-y-4">
      <div className="card p-4 border border-accent/20 bg-accent/5">
        <div className="text-sm font-bold mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-accent" /> Grant manual Pro access
        </div>
        <p className="text-xs text-muted mb-3">
          Wallets listed here get Pro access regardless of OG token balance (manual override).
          OG token: <code className="text-accent text-[10px]">EfnZmcFKMXofKA5V5ujvjqtSorvuQD2MzJPz3dxXpump</code> · Threshold: 10,000 OG
        </p>
        <div className="flex gap-2 mb-2">
          <input value={addr} onChange={e => setAddr(e.target.value)}
            placeholder="Wallet address" className="inp flex-1 font-mono" />
          <input value={note} onChange={e => setNote(e.target.value)}
            placeholder="Note (e.g. team, partner)" className="inp w-44" />
        </div>
        <button onClick={grant} disabled={adding}
          className="btn bg-accent text-black font-bold inline-flex items-center gap-1.5 text-sm disabled:opacity-60">
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
          Grant Pro
        </button>
        {msg && <span className={`ml-3 text-xs ${msg.startsWith("Error") ? "text-down" : "text-up"}`}>{msg}</span>}
      </div>

      <Section title={`Pro wallets — manual grants (${proWallets.length})`}>
        {proWallets.length === 0 && <Empty text="No manual Pro grants yet. OG token holders auto-qualify." />}
        {proWallets.map((w: any) => (
          <div key={w.address} className="card p-3 flex items-center gap-3">
            <Shield className="w-4 h-4 text-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-mono text-sm truncate">{w.address}</div>
              {w.note && <div className="text-xs text-muted">{w.note}</div>}
              <div className="text-[10px] text-muted/60">
                Granted {w.grantedAt ? new Date(w.grantedAt).toLocaleDateString() : "—"}
              </div>
            </div>
            <a href={`https://solscan.io/account/${w.address}`} target="_blank" rel="noreferrer"
              className="btn bg-panel2 text-muted hover:text-white shrink-0">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button onClick={() => { if (confirm("Revoke Pro?")) act("revoke_pro", "noop", { address: w.address }); }}
              className="btn bg-panel2 text-down hover:bg-down/10 shrink-0 text-xs">
              Revoke
            </button>
          </div>
        ))}
      </Section>

      <div className="card p-4 text-xs text-muted">
        <div className="font-semibold text-white mb-1">How Pro works</div>
        <ul className="space-y-1 list-disc list-inside">
          <li>Wallets holding ≥ 10,000 OG token automatically get Pro (checked at login)</li>
          <li>Wallets listed above get Pro regardless of OG balance (manual override)</li>
          <li>Pro features: higher API limits, extended chart history, full holder export, early feature access</li>
        </ul>
      </div>
    </div>
  );
}

// ─── Banners ─────────────────────────────────────────────────────────────────
function BannersTab({ data, act }: any) {
  const [text, setText]   = useState("");
  const [type, setType]   = useState<"info"|"warning"|"promo"|"urgent">("info");
  const [link, setLink]   = useState("");
  const [msg, setMsg]     = useState("");
  const [saving, setSaving] = useState(false);

  const banner = data?.config?.banner;

  const save = async () => {
    if (!text.trim()) { setMsg("Banner text required."); return; }
    setSaving(true); setMsg("");
    const r = await act("set_banner", "noop", {
      text: text.trim(), type, link: link.trim() || null, active: true
    });
    setMsg(r?.ok === false ? "Error: " + r.error : "Banner set.");
    setSaving(false);
  };

  const clear = async () => {
    const r = await act("set_banner", "noop", { active: false });
    setMsg(r?.ok === false ? "Error" : "Banner cleared.");
  };

  const TYPES = [
    { id: "info",    label: "Info",    color: "bg-blue-500/15 text-blue-400" },
    { id: "warning", label: "Warning", color: "bg-yellow-500/15 text-yellow-400" },
    { id: "promo",   label: "Promo",   color: "bg-accent/15 text-accent" },
    { id: "urgent",  label: "Urgent",  color: "bg-down/15 text-down" },
  ];

  return (
    <div className="space-y-4">
      {/* Active banner preview */}
      {banner?.active && (
        <div className={`rounded-xl border p-3 flex items-center gap-3 ${
          banner.type === "urgent" ? "bg-down/10 border-down/30" :
          banner.type === "warning" ? "bg-yellow-500/10 border-yellow-500/30" :
          banner.type === "promo" ? "bg-accent/10 border-accent/30" :
          "bg-blue-500/10 border-blue-500/30"
        }`}>
          <Megaphone className="w-4 h-4 shrink-0" />
          <div className="flex-1 text-sm">{banner.text}</div>
          {banner.link && <a href={banner.link} className="text-xs text-accent underline shrink-0">Link</a>}
          <span className="text-[10px] text-muted">LIVE</span>
          <button onClick={clear} className="btn bg-panel2 text-down hover:bg-down/10 text-xs shrink-0">Clear</button>
        </div>
      )}
      {!banner?.active && (
        <div className="card p-3 text-center text-muted text-sm">No active banner.</div>
      )}

      {/* Banner form */}
      <div className="card p-4">
        <div className="text-sm font-bold mb-3">Set new banner</div>
        <div className="space-y-3">
          <textarea value={text} onChange={e => setText(e.target.value)}
            placeholder="Banner message — appears site-wide at the top of OG DEX…"
            rows={2} className="inp w-full resize-none" />
          <div className="flex gap-1.5 flex-wrap">
            {TYPES.map((t) => (
              <button key={t.id} onClick={() => setType(t.id as any)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  type === t.id ? t.color + " border-current" : "bg-panel2 text-muted border-line"
                }`}>{t.label}</button>
            ))}
          </div>
          <input value={link} onChange={e => setLink(e.target.value)}
            placeholder="Optional link URL (e.g. https://t.me/OrbitXupdates)" className="inp" />
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="btn bg-accent text-black font-bold text-sm inline-flex items-center gap-1.5 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
              Publish Banner
            </button>
            <button onClick={clear} className="btn bg-panel2 text-muted hover:text-white text-sm">Clear</button>
          </div>
          {msg && <span className={`text-xs ${msg.startsWith("Error") ? "text-down" : "text-up"}`}>{msg}</span>}
        </div>
      </div>

      <div className="text-xs text-muted">
        The banner renders at the top of OG DEX for all visitors. Use Urgent sparingly — it's red and catches attention immediately.
      </div>
    </div>
  );
}

// ─── Config ───────────────────────────────────────────────────────────────────
function ConfigTab({ data, act }: any) {
  const cfg = data?.config || {};
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState("");
  const [proThreshold, setProThreshold] = useState(String(cfg.pro_threshold ?? 10000));
  const [proEnabled, setProEnabled]     = useState(cfg.pro_gate_enabled !== false);
  const [maintenanceMode, setMaintenanceMode] = useState(cfg.maintenance_mode || false);
  const [maintenanceMsg, setMaintenanceMsg]   = useState(cfg.maintenance_message || "");
  const [screenerEnabled, setScreenerEnabled] = useState(cfg.screener_enabled !== false);
  const [mcpEnabled, setMcpEnabled]           = useState(cfg.mcp_enabled !== false);
  const [widgetEnabled, setWidgetEnabled]     = useState(cfg.widget_enabled !== false);
  const [spacesAutoEnd, setSpacesAutoEnd]     = useState(cfg.spaces_auto_end !== false);

  const save = async (key: string, val: any) => {
    setSaving(true); setSaved("");
    const r = await act("set_config", "noop", { key, value: val });
    setSaved(r?.ok === false ? "Error: " + r.error : "Saved.");
    setTimeout(() => setSaved(""), 2000);
    setSaving(false);
  };

  const toggles: { key: string; label: string; desc: string; val: boolean; set: (v: boolean) => void }[] = [
    { key: "pro_gate_enabled",  label: "Pro Gate",    desc: "Require 10K OG for Pro features",       val: proEnabled,      set: setProEnabled },
    { key: "screener_enabled",  label: "Screener",    desc: "Token screener visible to all users",   val: screenerEnabled, set: setScreenerEnabled },
    { key: "mcp_enabled",       label: "MCP API",     desc: "Public AI/MCP endpoint at /api/mcp",    val: mcpEnabled,      set: setMcpEnabled },
    { key: "widget_enabled",    label: "Widget",      desc: "Embeddable token widget (widget.js)",   val: widgetEnabled,   set: setWidgetEnabled },
    { key: "maintenance_mode",  label: "Maintenance", desc: "Show maintenance page to all visitors", val: maintenanceMode, set: setMaintenanceMode },
    { key: "spaces_auto_end",   label: "Auto-end Spaces", desc: "End a live Space if the host is gone 20 min", val: spacesAutoEnd, set: setSpacesAutoEnd },
  ];

  return (
    <div className="space-y-5">
      <Section title="Feature flags">
        <div className="space-y-2">
          {toggles.map((t) => (
            <div key={t.key} className="card p-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="text-sm font-semibold">{t.label}</div>
                <div className="text-xs text-muted">{t.desc}</div>
              </div>
              <button
                onClick={() => {
                  t.set(!t.val);
                  save(t.key, !t.val);
                }}
                className={`shrink-0 transition-colors ${t.val ? "text-accent" : "text-muted"}`}>
                {t.val ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
              </button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Thresholds">
        <div className="card p-4 space-y-3">
          <div>
            <label className="text-xs text-muted block mb-1">Pro OG token threshold</label>
            <div className="flex gap-2 items-center">
              <input value={proThreshold} onChange={e => setProThreshold(e.target.value)}
                className="inp w-40" placeholder="10000" />
              <span className="text-xs text-muted">OG tokens required for Pro</span>
              <button onClick={() => save("pro_threshold", Number(proThreshold))}
                className="btn bg-accent text-black font-semibold text-xs">Save</button>
            </div>
          </div>
        </div>
      </Section>

      {maintenanceMode && (
        <Section title="Maintenance message">
          <div className="card p-4 space-y-2">
            <textarea value={maintenanceMsg} onChange={e => setMaintenanceMsg(e.target.value)}
              rows={2} className="inp w-full resize-none"
              placeholder="Message shown to users during maintenance…" />
            <button onClick={() => save("maintenance_message", maintenanceMsg)}
              className="btn bg-accent text-black font-semibold text-xs">Save message</button>
          </div>
        </Section>
      )}

      {saved && <div className={`text-xs ${saved.startsWith("Error") ? "text-down" : "text-up"}`}>{saved}</div>}
    </div>
  );
}

// ─── Banned wallets ───────────────────────────────────────────────────────────
function BannedTab({ data, act }: any) {
  const [addr, setAddr] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");

  const ban = async () => {
    if (!addr.trim()) { setMsg("Enter a wallet address."); return; }
    setMsg("Banning…");
    const r = await act("ban_wallet", "noop", { address: addr.trim(), reason: reason.trim() || undefined });
    setMsg(r?.ok === false ? "Error: " + r.error : "Wallet banned.");
    setAddr(""); setReason("");
  };

  const banned = data?.banned || [];

  return (
    <div className="space-y-4">
      <div className="card p-4 border border-down/20 bg-down/5">
        <div className="text-sm font-bold mb-3 flex items-center gap-2 text-down">
          <Ban className="w-4 h-4" /> Ban wallet address
        </div>
        <p className="text-xs text-muted mb-3">
          Banned wallets cannot submit nominations, use copy tracking, or interact with community features.
        </p>
        <div className="flex gap-2 mb-2">
          <input value={addr} onChange={e => setAddr(e.target.value)}
            placeholder="Wallet address" className="inp flex-1 font-mono" />
          <input value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Reason (optional)" className="inp w-48" />
        </div>
        <button onClick={ban}
          className="btn bg-down/15 text-down font-bold inline-flex items-center gap-1.5 text-sm">
          <Ban className="w-4 h-4" /> Ban wallet
        </button>
        {msg && <span className={`ml-3 text-xs ${msg.startsWith("Error") ? "text-down" : "text-up"}`}>{msg}</span>}
      </div>

      <Section title={`Banned wallets (${banned.length})`}>
        {banned.length === 0 && <Empty text="No banned wallets." />}
        {banned.map((b: any) => (
          <div key={b.address} className="card p-3 flex items-center gap-3">
            <ShieldOff className="w-4 h-4 text-down shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-mono text-sm truncate">{b.address}</div>
              {b.reason && <div className="text-xs text-muted">{b.reason}</div>}
            </div>
            <button onClick={() => act("unban_wallet", "noop", { address: b.address })}
              className="btn bg-panel2 text-up hover:bg-up/10 text-xs shrink-0">Unban</button>
          </div>
        ))}
      </Section>
    </div>
  );
}

// ─── Alerts ───────────────────────────────────────────────────────────────────
function AlertsTab({ data }: any) {
  const alerts = data?.alerts || [];
  const active  = alerts.filter((a: any) => a.enabled);
  const byType: Record<string, number> = {};
  for (const a of alerts) { byType[a.type || "unknown"] = (byType[a.type || "unknown"] || 0) + 1; }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Bell}         label="Total alerts"   value={fmtNum(alerts.length)} />
        <Stat icon={Activity}     label="Active"         value={fmtNum(active.length)} accent />
        <Stat icon={Zap}          label="Fired today"    value={fmtNum(data?.stats?.alertsFiredToday ?? 0)} />
        <Stat icon={Users}        label="Alert users"    value={fmtNum(data?.stats?.alertUsers ?? 0)} />
      </div>

      <Section title="Alerts by type">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(byType).map(([type, count]) => (
            <div key={type} className="card p-3 text-center">
              <div className="text-lg font-black text-white">{count}</div>
              <div className="text-[10px] text-muted capitalize">{type.replace(/_/g, " ")}</div>
            </div>
          ))}
          {!Object.keys(byType).length && <div className="text-muted text-sm">No alert data.</div>}
        </div>
      </Section>

      <Section title="Recent alerts (most recent 50)">
        {alerts.slice(0, 50).map((a: any, i: number) => (
          <div key={i} className="card p-2.5 flex items-center gap-3 text-xs">
            <Bell className={`w-3.5 h-3.5 shrink-0 ${a.enabled ? "text-accent" : "text-muted"}`} />
            <span className="font-mono text-muted truncate w-24">{a.wallet ? short(a.wallet) : "—"}</span>
            <span className="capitalize text-muted">{(a.type || "").replace(/_/g, " ")}</span>
            <span className="text-muted/60 ml-auto">
              {a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}
            </span>
          </div>
        ))}
        {!alerts.length && <Empty text="No alerts configured yet." />}
      </Section>
    </div>
  );
}

// ─── Quick-add featured (shared) ─────────────────────────────────────────────
function QuickAddFeatured({ pass, onDone }: { pass: string; onDone: () => void }) {
  const [ca, setCa]             = useState("");
  const [token, setToken]       = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState("");

  const scan = async (addr: string) => {
    setCa(addr); setToken(null); setMsg("");
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr.trim())) return;
    setScanning(true);
    try {
      const d = await fetch(`/api/ogdex/token?mint=${addr.trim()}`).then(r => r.json());
      if (d?.token?.mint) setToken(d.token); else setMsg("Token not found.");
    } catch { setMsg("Scan failed."); } finally { setScanning(false); }
  };

  const add = async () => {
    if (!ca.trim()) { setMsg("Paste a contract address."); return; }
    setLoading(true); setMsg("");
    const t = token || {};
    await adminAction(pass, "add_featured", "noop", {
      mint: ca.trim(), symbol: t.symbol || "", project_name: t.name || t.symbol || "",
      logo_url: t.icon || "", description: t.description || "", chain: "solana",
    });
    setMsg("Added to featured!"); setCa(""); setToken(null);
    setLoading(false); onDone();
  };

  return (
    <Section title="Quick-Add to Featured">
      <div className="card p-4 space-y-3">
        <div className="relative">
          <input value={ca} onChange={e => scan(e.target.value)}
            placeholder="Paste token contract address — metadata loads automatically"
            className="inp w-full font-mono pr-8" />
          {scanning && <Loader2 className="w-4 h-4 animate-spin text-accent absolute right-3 top-1/2 -translate-y-1/2" />}
        </div>
        {token && (
          <div className="card p-3 flex items-center gap-3 border-accent/30 bg-accent/5">
            {token.icon
              ? <img src={token.icon} className="w-10 h-10 rounded-full object-cover border border-line shrink-0" />
              : <div className="w-10 h-10 rounded-full bg-panel2 grid place-items-center text-xs text-muted shrink-0">{(token.symbol||"?").slice(0,2)}</div>}
            <div className="flex-1 min-w-0">
              <div className="font-bold">{token.symbol} <span className="text-muted font-normal text-sm">{token.name}</span></div>
              {token.mcap && <div className="text-xs text-muted">MC ${Number(token.mcap).toLocaleString()}</div>}
            </div>
            <CheckCircle2 className="w-5 h-5 text-up shrink-0" />
          </div>
        )}
        <div className="flex items-center gap-3">
          <button onClick={add} disabled={loading || scanning || !ca.trim()}
            className="btn bg-accent text-black font-bold inline-flex items-center gap-1.5 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Add to Featured
          </button>
          {msg && <span className={`text-xs ${msg.startsWith("Add") ? "text-up" : "text-down"}`}>{msg}</span>}
        </div>
      </div>
    </Section>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
function Stat({ icon: Icon, label, value, accent }: any) {
  return (
    <div className={`card p-4 ${accent ? "border-accent/40" : ""}`}>
      <div className="text-xs text-muted flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" /> {label}</div>
      <div className="text-2xl font-bold mt-1">{value ?? "—"}</div>
    </div>
  );
}



function UsersTab({ data, act }: { data: any; act: any }) {
  const rows: any[] = data?.users || [];
  return (
    <div className="space-y-4">
      <div className="text-lg font-black text-white">Users <span className="text-xs font-normal text-muted">· {rows.length}</span></div>
      {rows.length === 0 ? <div className="rounded-xl border border-line bg-panel2/60 p-8 text-center text-sm text-muted">No users.</div> : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead><tr className="bg-panel2 text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="px-3 py-2.5">User</th><th className="px-3 py-2.5">Wallet</th><th className="px-3 py-2.5 text-right">Followers</th><th className="px-3 py-2.5 text-right">Trades</th><th className="px-3 py-2.5 text-right">Joined</th><th className="px-3 py-2.5"></th>
            </tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-t border-line/60">
                  <td className="px-3 py-2.5"><div className="flex items-center gap-2">
                    {u.avatar_url ? <img src={u.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" /> : <div className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-[10px] text-muted">{(u.username||"?").slice(0,2)}</div>}
                    <span className="font-semibold text-white">{u.username || "—"}</span>
                    {u.badge && <span className="pill bg-accent/15 text-accent text-[9px]">{u.badge}</span>}
                  </div></td>
                  <td className="px-3 py-2.5 font-mono text-muted">{u.wallet_address ? short(u.wallet_address) : "—"}</td>
                  <td className="px-3 py-2.5 text-right text-white">{fmtNum(u.followers_count || 0)}</td>
                  <td className="px-3 py-2.5 text-right text-white">{fmtNum(u.trades_count || 0)}</td>
                  <td className="px-3 py-2.5 text-right text-muted">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                  <td className="px-3 py-2.5 text-right">{u.wallet_address && <button onClick={() => act("ban_wallet", "noop", { address: u.wallet_address, reason: "admin" })} className="rounded-lg border border-down/40 bg-down/10 px-2 py-1 text-[11px] font-bold text-down hover:bg-down/20">Ban</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ReportsTab({ data, act }: { data: any; act: any }) {
  const rows: any[] = data?.reports || [];
  const tone = (s: string) => s === "resolved" ? "bg-up/15 text-up" : s === "dismissed" ? "bg-panel2 text-muted" : "bg-gold/15 text-gold";
  return (
    <div className="space-y-4">
      <div className="text-lg font-black text-white">Moderation reports <span className="text-xs font-normal text-muted">· {data?.stats?.reportsPending ?? 0} open</span></div>
      {rows.length === 0 ? <div className="rounded-xl border border-line bg-panel2/60 p-8 text-center text-sm text-muted">No reports.</div> : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-xl border border-line bg-panel2/60 p-3 text-sm">
              <span className="pill bg-panel2 text-muted text-[10px]">{r.target_type || "?"}</span>
              <div className="min-w-0 flex-1"><div className="truncate text-white">{r.reason || "—"}</div><div className="text-[11px] text-muted">{r.created_at ? new Date(r.created_at).toLocaleString() : ""}{r.priority ? ` · ${r.priority}` : ""}</div></div>
              <span className={`pill text-[10px] ${tone(r.status)}`}>{r.status || "open"}</span>
              {r.status !== "resolved" && <button onClick={() => act("resolve_report", r.id, { status: "resolved" })} className="rounded-lg border border-up/40 bg-up/10 px-2.5 py-1 text-[11px] font-bold text-up hover:bg-up/20">Resolve</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AuditTab({ data }: { data: any }) {
  const rows: any[] = data?.auditLog || [];
  return (
    <div className="space-y-4">
      <div className="text-lg font-black text-white">Security audit log <span className="text-xs font-normal text-muted">· {rows.length}</span></div>
      {rows.length === 0 ? <div className="rounded-xl border border-line bg-panel2/60 p-8 text-center text-sm text-muted">No entries.</div> : (
        <div className="space-y-1.5">
          {rows.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg border border-line/60 bg-panel2/40 px-3 py-2 text-[13px]">
              <span className="font-mono text-white">{a.action}</span>
              <span className="text-muted">{a.created_at ? new Date(a.created_at).toLocaleString() : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



function CommunitiesTab({ data, act }: { data: any; act: any }) {
  const rows: any[] = data?.communities || [];
  return (
    <div className="space-y-2">
      <div className="text-lg font-black text-white">Communities <span className="text-xs font-normal text-muted">· {rows.length}</span></div>
      {rows.length === 0 ? <div className="rounded-xl border border-line bg-panel2/60 p-8 text-center text-sm text-muted">No communities.</div> : rows.map((c) => (
        <div key={c.id} className="flex items-center gap-3 rounded-xl border border-line bg-panel2/60 p-3 text-sm">
          <div className="min-w-0 flex-1"><div className="truncate font-semibold text-white">{c.name || "Untitled"}</div><div className="text-[11px] text-muted">{fmtNum(c.member_count || 0)} members · {c.privacy || "public"} · {c.created_at ? new Date(c.created_at).toLocaleDateString() : ""}</div></div>
          <span className={`pill text-[10px] ${c.is_active ? "bg-up/15 text-up" : "bg-panel2 text-muted"}`}>{c.is_active ? "active" : "hidden"}</span>
          <button onClick={() => act("toggle_community", c.id, { is_active: !c.is_active })} className="rounded-lg border border-line bg-panel2 px-2.5 py-1 text-[11px] font-bold text-muted hover:text-white">{c.is_active ? "Hide" : "Show"}</button>
          <button onClick={() => { if (confirm("Delete community?")) act("delete_community", c.id); }} className="rounded-lg border border-down/40 bg-down/10 px-2 py-1 text-[11px] font-bold text-down hover:bg-down/20"><Trash2 className="h-3 w-3" /></button>
        </div>
      ))}
    </div>
  );
}

function NotificationsTab({ data }: { data: any }) {
  const rows: any[] = data?.notifs || [];
  return (
    <div className="space-y-2">
      <div className="text-lg font-black text-white">Notifications <span className="text-xs font-normal text-muted">· {rows.length}</span></div>
      <p className="text-[12px] text-muted">Recent admin notifications. Use the Banners tab to broadcast a site-wide message to all users.</p>
      {rows.length === 0 ? <div className="rounded-xl border border-line bg-panel2/60 p-8 text-center text-sm text-muted">No notifications.</div> : rows.map((n) => (
        <div key={n.id} className="rounded-xl border border-line/60 bg-panel2/40 p-3 text-sm">
          <div className="flex items-center gap-2"><span className="font-semibold text-white">{n.title || "(untitled)"}</span>{n.notification_type && <span className="pill bg-panel2 text-muted text-[9px]">{n.notification_type}</span>}<span className="ml-auto text-[10px] text-muted">{n.created_at ? new Date(n.created_at).toLocaleString() : ""}</span></div>
          {n.message && <div className="mt-0.5 text-white/75">{n.message}</div>}
        </div>
      ))}
    </div>
  );
}

function SpacesTab({ data, act }: { data: any; act: any }) {
  const rows: any[] = data?.spaces || [];
  return (
    <div className="space-y-3">
      <div className="text-lg font-black text-white">Spaces <span className="text-xs font-normal text-muted">· {data?.stats?.spacesLive ?? 0} live</span></div>
      {rows.length === 0 ? <div className="rounded-xl border border-line bg-panel2/60 p-8 text-center text-sm text-muted">No spaces.</div> : rows.map((sp) => (
        <div key={sp.id} className="flex items-center gap-3 rounded-xl border border-line bg-panel2/60 p-3 text-sm">
          {sp.is_live ? <span className="pill bg-down/15 text-down text-[10px]">● LIVE</span> : <span className="pill bg-panel2 text-muted text-[10px]">ended</span>}
          <div className="min-w-0 flex-1"><div className="truncate font-semibold text-white">{sp.title || "Untitled"}</div><div className="text-[11px] text-muted">@{sp.host_username || "?"} · {sp.listener_count || 0} listeners · {sp.speaker_count || 0} speakers</div></div>
          {sp.is_private && <span className="pill bg-panel2 text-muted text-[10px]">private</span>}
          {sp.is_live && <button onClick={() => act("end_space", sp.id)} className="rounded-lg border border-down/40 bg-down/10 px-2.5 py-1 text-[11px] font-bold text-down hover:bg-down/20">End</button>}
        </div>
      ))}
    </div>
  );
}

function ChatTab({ data, act }: { data: any; act: any }) {
  const rows: any[] = data?.chat || [];
  return (
    <div className="space-y-2">
      <div className="text-lg font-black text-white">Community chat <span className="text-xs font-normal text-muted">· latest {rows.length}</span></div>
      {rows.length === 0 ? <div className="rounded-xl border border-line bg-panel2/60 p-8 text-center text-sm text-muted">No messages.</div> : rows.map((m) => (
        <div key={m.id} className="flex items-start gap-3 rounded-xl border border-line/60 bg-panel2/40 p-3 text-sm">
          <div className="min-w-0 flex-1"><span className="font-semibold text-white">{m.username || "anon"}</span> <span className="text-[10px] text-muted">{m.created_at ? new Date(m.created_at).toLocaleString() : ""}</span><div className="break-words text-white/80">{m.content}</div></div>
          <button onClick={() => act("delete_message", m.id)} className="shrink-0 rounded-lg border border-down/40 bg-down/10 px-2 py-1 text-[11px] font-bold text-down hover:bg-down/20"><Trash2 className="h-3 w-3" /></button>
        </div>
      ))}
    </div>
  );
}

function SupportTab({ data, act }: { data: any; act: any }) {
  const rows: any[] = data?.support || [];
  const tone = (st: string) => st === "closed" || st === "resolved" ? "bg-up/15 text-up" : st === "open" ? "bg-gold/15 text-gold" : "bg-panel2 text-muted";
  return (
    <div className="space-y-2">
      <div className="text-lg font-black text-white">Support tickets <span className="text-xs font-normal text-muted">· {data?.stats?.supportOpen ?? 0} open</span></div>
      {rows.length === 0 ? <div className="rounded-xl border border-line bg-panel2/60 p-8 text-center text-sm text-muted">No tickets.</div> : rows.map((t) => (
        <div key={t.id} className="flex items-center gap-3 rounded-xl border border-line bg-panel2/60 p-3 text-sm">
          <div className="min-w-0 flex-1"><div className="truncate font-semibold text-white">{t.subject || "(no subject)"}</div><div className="text-[11px] text-muted">@{t.username || "?"}{t.priority ? ` · ${t.priority}` : ""} · {t.last_message_at ? new Date(t.last_message_at).toLocaleString() : (t.created_at ? new Date(t.created_at).toLocaleDateString() : "")}</div></div>
          <span className={`pill text-[10px] ${tone(t.status)}`}>{t.status || "open"}</span>
          {t.status !== "closed" && <button onClick={() => act("close_ticket", t.id)} className="rounded-lg border border-up/40 bg-up/10 px-2.5 py-1 text-[11px] font-bold text-up hover:bg-up/20">Close</button>}
        </div>
      ))}
    </div>
  );
}

function AffiliatesTab({ data, act }: { data: any; act: any }) {
  const rows: any[] = data?.affiliates || [];
  return (
    <div className="space-y-3">
      <div className="text-lg font-black text-white">Affiliates <span className="text-xs font-normal text-muted">· {rows.length}</span></div>
      {rows.length === 0 ? <div className="rounded-xl border border-line bg-panel2/60 p-8 text-center text-sm text-muted">No affiliates.</div> : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead><tr className="bg-panel2 text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="px-3 py-2.5">Name</th><th className="px-3 py-2.5">Code</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5 text-right">Clicks</th><th className="px-3 py-2.5 text-right">Signups</th><th className="px-3 py-2.5 text-right">Earnings</th><th></th>
            </tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-t border-line/60">
                  <td className="px-3 py-2.5 font-semibold text-white">{a.name || "—"}</td>
                  <td className="px-3 py-2.5 font-mono text-muted">{a.referral_code || "—"}</td>
                  <td className="px-3 py-2.5"><span className={`pill text-[10px] ${a.status === "approved" ? "bg-up/15 text-up" : "bg-gold/15 text-gold"}`}>{a.status || "pending"}</span></td>
                  <td className="px-3 py-2.5 text-right text-white">{fmtNum(a.clicks || 0)}</td>
                  <td className="px-3 py-2.5 text-right text-white">{fmtNum(a.signups || 0)}</td>
                  <td className="px-3 py-2.5 text-right text-white">${fmtNum(a.total_earnings || 0)}</td>
                  <td className="px-3 py-2.5 text-right">{a.status !== "approved" && <button onClick={() => act("set_affiliate_status", a.id, { status: "approved" })} className="rounded-lg border border-up/40 bg-up/10 px-2 py-1 text-[11px] font-bold text-up hover:bg-up/20">Approve</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function WaitlistTab({ data }: { data: any }) {
  const rows: { id: any; email: string; created_at: string }[] = data?.waitlist || [];
  const exportCsv = () => {
    const csv = "email,created_at\n" + rows.map((r) => `${r.email},${r.created_at}`).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "waitlist.csv"; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-black text-white">Waitlist</div>
          <div className="text-xs text-muted">{rows.length} signups · {data?.stats?.waitlist24 ?? 0} in last 24h</div>
        </div>
        <button onClick={exportCsv} disabled={!rows.length}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-panel2 px-3 py-2 text-xs font-bold text-white hover:border-accent/40 disabled:opacity-50">
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-line bg-panel2/60 p-8 text-center text-sm text-muted">No signups yet.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead><tr className="bg-panel2 text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="px-4 py-2.5">#</th><th className="px-4 py-2.5">Email</th><th className="px-4 py-2.5 text-right">Joined</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id ?? r.email} className="border-t border-line/60">
                  <td className="px-4 py-2.5 text-muted">{i + 1}</td>
                  <td className="px-4 py-2.5 font-mono text-white">{r.email}</td>
                  <td className="px-4 py-2.5 text-right text-muted">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: any }) {
  return (
    <div className="mb-5">
      <div className="text-sm font-semibold mb-2">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="card p-6 text-center text-muted text-sm">{text}</div>;
}

function Breakdown({ title, data }: { title: string; data?: Record<string, number> }) {
  const entries = Object.entries(data || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = Math.max(1, ...entries.map(e => e[1]));
  return (
    <div className="card p-4">
      <div className="text-sm font-semibold mb-3">{title}</div>
      <div className="space-y-2">
        {entries.length ? entries.map(([k, v]) => (
          <div key={k} className="text-xs">
            <div className="flex justify-between mb-0.5">
              <span className="text-muted capitalize truncate">{k}</span>
              <span>{v}</span>
            </div>
            <div className="h-1.5 bg-panel2 rounded-full overflow-hidden">
              <div className="h-full bg-accent" style={{ width: `${(v / max) * 100}%` }} />
            </div>
          </div>
        )) : <div className="text-muted text-xs">No data.</div>}
      </div>
    </div>
  );
}

function PathList({ title, rows }: { title: string; rows?: { path: string; count: number }[] }) {
  return (
    <div className="card p-4">
      <div className="text-sm font-semibold mb-3">{title}</div>
      <div className="space-y-1.5 text-xs">
        {(rows || []).length
          ? rows!.map(r => (
              <div key={r.path} className="flex justify-between">
                <span className="text-muted truncate max-w-[140px]">{r.path}</span>
                <span>{r.count}</span>
              </div>
            ))
          : <div className="text-muted">No data.</div>}
      </div>
    </div>
  );
}

function ListingRow({ l, actions }: { l: any; actions: any }) {
  return (
    <div className="card p-3 flex items-center gap-3">
      {l.logo_url
        ? <img src={l.logo_url} className="w-10 h-10 rounded-full object-cover border border-line shrink-0" />
        : <div className="w-10 h-10 rounded-full bg-panel2 grid place-items-center text-[10px] text-muted shrink-0">
            {(l.symbol || "?").slice(0, 3)}
          </div>}
      <div className="min-w-0 flex-1">
        <div className="font-semibold truncate flex items-center gap-1.5">
          {l.project_name || l.symbol || "Project"}
          <span className="pill bg-panel2 text-muted text-[10px] uppercase">{l.chain}</span>
          <span className={`pill text-[10px] ${l.tier === "express" ? "bg-accent/15 text-accent" : "bg-panel2 text-muted"}`}>{l.tier}</span>
        </div>
        <div className="text-xs text-muted font-mono truncate">
          {short(l.contract_address)}{l.contact ? ` · ${l.contact}` : ""}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">{actions}</div>
    </div>
  );
}
