// OrbitX Launchpad — creator dashboard. Wallet-native: connect = signed in.
// Every stat/chart here is computed from real registry + DexScreener data,
// the same sources every other launchpad page uses — nothing fabricated.
import { useMemo, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { listByCreator, getProfile, upsertProfile, type OrbitxProfile, type OrbitxToken } from "@/lib/orbitx/registry";
import { supabase } from "@/lib/supabase";
import { TokenCard, shortAddr, GRADUATION_MC_USD } from "./_shared";
import { useMarketMap, fmtCompactUsd } from "./lpx";
import {
  Wallet, Loader2, Rocket, Pencil, X, Check, Twitter, Globe, Camera, Copy,
  ExternalLink, Download, Trophy, ShieldCheck, Droplets, Coins, Flame,
  Award, Star, Gem, Crown, Users, ListChecks, Eye,
} from "lucide-react";

const goldBtn = "inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--og-gold))]/50 bg-[hsl(var(--og-gold))]/15 px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-[hsl(var(--og-gold))] transition hover:bg-[hsl(var(--og-gold))]/25";

function EditProfileModal({ wallet, profile, onClose, onSaved }: { wallet: string; profile: OrbitxProfile | null; onClose: () => void; onSaved: () => void }) {
  const [username, setUsername] = useState(profile?.username ?? "");
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [twitter, setTwitter] = useState(profile?.twitter ?? "");
  const [website, setWebsite] = useState(profile?.website ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadAvatar = async (file: File) => {
    setUploading(true); setErr(null);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `orbitxprofiles/${wallet}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("profile-media").upload(path, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      setAvatarUrl(supabase.storage.from("profile-media").getPublicUrl(path).data.publicUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Avatar upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      await upsertProfile({ wallet, username, display_name: displayName, bio, twitter, website, avatar_url: avatarUrl });
      onSaved(); onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed — the profiles table may not be set up yet.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="pf-card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-black text-[hsl(var(--pf-ink))]">Edit profile</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-[hsl(var(--pf-muted))] hover:text-[hsl(var(--pf-ink))]"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-[hsl(var(--pf-ink))] bg-[hsl(var(--pf-bg))]">
            {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[hsl(var(--pf-muted))]"><Camera className="h-6 w-6" /></div>}
          </div>
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="pf-btn-ghost text-xs">{uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />} Upload avatar</button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }} />
        </div>
        <div className="mt-4 space-y-3">
          {[["Username", username, setUsername, "yourhandle"], ["Display name", displayName, setDisplayName, "Your name"], ["X / Twitter", twitter, setTwitter, "https://x.com/…"], ["Website", website, setWebsite, "https://…"]].map(([label, val, setter, ph]) => (
            <div key={label as string}>
              <div className="mb-1 pf-mono text-[10px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">{label as string}</div>
              <input value={val as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)} placeholder={ph as string}
                className="w-full rounded-lg border border-[hsl(var(--pf-border))] bg-[hsl(var(--pf-bg))] px-3 py-2 text-sm text-[hsl(var(--pf-ink))] outline-none focus:border-[hsl(var(--pf-green))]" />
            </div>
          ))}
          <div>
            <div className="mb-1 pf-mono text-[10px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">Bio</div>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={280} placeholder="Tell traders who you are…"
              className="w-full resize-none rounded-lg border border-[hsl(var(--pf-border))] bg-[hsl(var(--pf-bg))] px-3 py-2 text-sm text-[hsl(var(--pf-ink))] outline-none focus:border-[hsl(var(--pf-green))]" />
          </div>
        </div>
        {err && <p className="mt-3 text-xs text-[hsl(var(--pf-red))]">{err}</p>}
        <button onClick={save} disabled={saving} className="pf-btn mt-4 w-full justify-center">{saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Check className="h-4 w-4" /> Save profile</>}</button>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: React.ReactNode; icon: React.ComponentType<{ className?: string }>; accent?: "gold" | "green" | "blue" }) {
  const color = accent === "gold" ? "text-[hsl(var(--pf-gold))]" : accent === "blue" ? "text-[hsl(var(--pf-blue))]" : "text-[hsl(var(--pf-green))]";
  return (
    <div className="pf-card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="pf-mono text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))]">{label}</span>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className="text-xl font-black text-[hsl(var(--pf-ink))] sm:text-2xl">{value}</div>
    </div>
  );
}

interface Achievement { id: string; label: string; icon: React.ComponentType<{ className?: string }>; unlocked: boolean; hint: string }

function AchievementBadge({ a }: { a: Achievement }) {
  return (
    <div title={a.hint} className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition ${
      a.unlocked ? "border-[hsl(var(--pf-gold))]/50 bg-[hsl(var(--pf-gold))]/10" : "border-[hsl(var(--pf-border))] bg-white/[0.02] opacity-40"
    }`}>
      <a.icon className={`h-6 w-6 ${a.unlocked ? "text-[hsl(var(--pf-gold))]" : "text-[hsl(var(--pf-muted))]"}`} />
      <span className="pf-mono text-[9px] font-bold uppercase leading-tight tracking-wide text-[hsl(var(--pf-ink))]">{a.label}</span>
    </div>
  );
}

function exportLaunchesCsv(tokens: OrbitxToken[], markets: Record<string, { mcap: number | null; vol24: number | null; liq: number | null }> | undefined) {
  const header = ["name", "ticker", "mint_address", "launch_type", "graduated", "market_cap_usd", "volume_24h_usd", "liquidity_usd", "created_at"];
  const rows = tokens.map((t) => [
    t.name, t.ticker, t.mint_address, t.launch_type,
    String(!!(t.lp_pool_address || t.graduated_at)),
    markets?.[t.mint_address]?.mcap ?? "",
    markets?.[t.mint_address]?.vol24 ?? "",
    markets?.[t.mint_address]?.liq ?? "",
    t.created_at,
  ]);
  const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `orbitx-launches-${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function LaunchpadProfile() {
  const { connected, publicKey } = useWallet();
  const addr = publicKey?.toBase58();
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ["orbitx-creator", addr], queryFn: () => listByCreator(addr!, 200), enabled: !!addr });
  const { data: profile, refetch: refetchProfile } = useQuery({ queryKey: ["orbitx-my-profile", addr], queryFn: () => getProfile(addr!), enabled: !!addr });

  const tokens = data ?? [];
  const mints = useMemo(() => tokens.map((t) => t.mint_address), [tokens]);
  const { data: markets } = useMarketMap(mints);

  const isGrad = (t: OrbitxToken) => !!t.lp_pool_address || !!t.graduated_at || (markets?.[t.mint_address]?.mcap ?? 0) >= GRADUATION_MC_USD;
  const graduated = tokens.filter(isGrad).length;
  const totalMcap = mints.reduce((a, m) => a + (markets?.[m]?.mcap ?? 0), 0);
  const bestMcap = mints.reduce((a, m) => Math.max(a, markets?.[m]?.mcap ?? 0), 0);
  const totalVol24 = mints.reduce((a, m) => a + (markets?.[m]?.vol24 ?? 0), 0);
  const gradRate = tokens.length ? Math.round((graduated / tokens.length) * 100) : 0;
  const originalCreator = tokens.length > 0 && tokens.every((t) => !t.is_vamp);
  const verified = graduated >= 3;

  const launchesOverTime = useMemo(() => {
    const sorted = [...tokens].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    let cum = 0;
    return sorted.map((t) => ({ date: new Date(t.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }), launches: ++cum }));
  }, [tokens]);

  const mcapByToken = useMemo(() => {
    return [...tokens]
      .map((t) => ({ name: t.ticker, mcap: markets?.[t.mint_address]?.mcap ?? 0 }))
      .sort((a, b) => b.mcap - a.mcap)
      .slice(0, 8);
  }, [tokens, markets]);

  const achievements: Achievement[] = useMemo(() => [
    { id: "first", label: "First Launch", icon: Rocket, unlocked: tokens.length >= 1, hint: "Launch your first token" },
    { id: "five", label: "5 Launches", icon: Flame, unlocked: tokens.length >= 5, hint: "Launch 5 tokens" },
    { id: "ten", label: "10 Launches", icon: Star, unlocked: tokens.length >= 10, hint: "Launch 10 tokens" },
    { id: "graduate", label: "First Graduate", icon: Droplets, unlocked: graduated >= 1, hint: "Get a token to graduation" },
    { id: "builder", label: "Verified Builder", icon: ShieldCheck, unlocked: verified, hint: "Graduate 3+ tokens" },
    { id: "million", label: "Million Dollar Cap", icon: Gem, unlocked: bestMcap >= 1_000_000, hint: "Reach a $1M market cap on any token" },
    { id: "original", label: "Original Creator", icon: Award, unlocked: originalCreator, hint: "Never flagged by Anti-Vamp" },
    { id: "og", label: "OrbitX OG", icon: Crown, unlocked: tokens.length >= 1, hint: "Launched through OrbitX" },
  ], [tokens, graduated, verified, bestMcap, originalCreator]);

  const copyAddr = () => { if (!addr) return; navigator.clipboard.writeText(addr); setCopied(true); setTimeout(() => setCopied(false), 1200); };

  if (!connected || !addr)
    return (
      <div className="og-glass-card mx-auto flex max-w-lg flex-col items-center gap-4 border-dashed py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/10 bg-white/5"><Wallet className="h-7 w-7 text-muted-foreground" /></div>
        <div>
          <div className="font-display text-lg font-bold text-foreground">Connect your wallet</div>
          <div className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Your wallet is your account. Connect on the top bar to see your creator dashboard.</div>
        </div>
        <Link to="/orbitxlaunch/create" className={goldBtn}><Rocket className="h-4 w-4" /> Go to Launch</Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-5xl">
      {editing && <EditProfileModal wallet={addr} profile={profile ?? null} onClose={() => setEditing(false)} onSaved={() => refetchProfile()} />}

      {/* Header */}
      <div className="pf-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 border-[hsl(var(--pf-ink))] bg-[hsl(var(--pf-bg))]">
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[hsl(var(--pf-green))]"><Wallet className="h-7 w-7" /></div>}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xl font-black tracking-tight text-[hsl(var(--pf-ink))]">{profile?.display_name || profile?.username || shortAddr(addr, 6)}</div>
                {verified && <span className="rounded-full border border-[hsl(var(--pf-green))] px-2 py-0.5 pf-mono text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--pf-green))]">Verified creator</span>}
              </div>
              {profile?.username && <div className="pf-mono text-xs text-[hsl(var(--pf-green))]">@{profile.username}</div>}
              <div className="pf-mono text-[10px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">{shortAddr(addr, 6)}</div>
              {profile?.bio && <p className="mt-2 max-w-md text-sm text-[hsl(var(--pf-muted))]">{profile.bio}</p>}
              <div className="mt-2 flex gap-2">
                {profile?.twitter && <a href={profile.twitter} target="_blank" rel="noreferrer" className="text-[hsl(var(--pf-muted))] hover:text-[hsl(var(--pf-green))]"><Twitter className="h-4 w-4" /></a>}
                {profile?.website && <a href={profile.website} target="_blank" rel="noreferrer" className="text-[hsl(var(--pf-muted))] hover:text-[hsl(var(--pf-green))]"><Globe className="h-4 w-4" /></a>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setEditing(true)} className="pf-btn-ghost text-xs"><Pencil className="h-3.5 w-3.5" /> Edit profile</button>
            <button onClick={copyAddr} className="pf-btn-ghost text-xs">{copied ? <Check className="h-3.5 w-3.5 text-[hsl(var(--pf-green))]" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy wallet"}</button>
            <a href={`https://solscan.io/account/${addr}`} target="_blank" rel="noreferrer" className="pf-btn-ghost text-xs"><ExternalLink className="h-3.5 w-3.5" /> Solscan</a>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Launched" value={isLoading ? "…" : tokens.length} icon={Rocket} accent="gold" />
        <StatCard label="Graduated" value={isLoading ? "…" : graduated} icon={Droplets} accent="green" />
        <StatCard label="Success rate" value={isLoading ? "…" : `${gradRate}%`} icon={Trophy} accent="gold" />
        <StatCard label="Total market cap" value={isLoading ? "…" : fmtCompactUsd(totalMcap)} icon={Coins} accent="blue" />
        <StatCard label="Best market cap" value={isLoading ? "…" : fmtCompactUsd(bestMcap)} icon={Gem} accent="gold" />
        <StatCard label="24h volume (all)" value={isLoading ? "…" : fmtCompactUsd(totalVol24)} icon={Users} accent="green" />
      </div>

      {/* Charts */}
      {tokens.length > 0 && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="pf-card p-4">
            <div className="mb-2 pf-mono text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))]">Launches over time</div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={launchesOverTime}>
                <defs>
                  <linearGradient id="launchGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--pf-green))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--pf-green))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--pf-border))" />
                <XAxis dataKey="date" tick={{ fill: "hsl(var(--pf-muted))", fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--pf-muted))", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--pf-bg-2))", border: "1px solid hsl(var(--pf-border))", color: "hsl(var(--pf-ink))", fontSize: 12 }} />
                <Area type="monotone" dataKey="launches" stroke="hsl(var(--pf-green))" fill="url(#launchGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="pf-card p-4">
            <div className="mb-2 pf-mono text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))]">Market cap by token</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={mcapByToken}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--pf-border))" />
                <XAxis dataKey="name" tick={{ fill: "hsl(var(--pf-muted))", fontSize: 10 }} />
                <YAxis tickFormatter={(v) => fmtCompactUsd(v)} tick={{ fill: "hsl(var(--pf-muted))", fontSize: 10 }} />
                <Tooltip formatter={(v: number) => fmtCompactUsd(v)} contentStyle={{ background: "hsl(var(--pf-bg-2))", border: "1px solid hsl(var(--pf-border))", color: "hsl(var(--pf-ink))", fontSize: 12 }} />
                <Bar dataKey="mcap" fill="hsl(var(--pf-gold))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Achievements */}
      <div className="mb-3 mt-6 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-[hsl(var(--pf-gold))]" />
        <h2 className="text-sm font-black uppercase tracking-wide text-[hsl(var(--pf-ink))]">Achievements</h2>
      </div>
      <div className="mb-6 grid grid-cols-4 gap-2 sm:grid-cols-8">
        {achievements.map((a) => <AchievementBadge key={a.id} a={a} />)}
      </div>

      {/* Profile tools */}
      <div className="mb-3 flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-[hsl(var(--pf-gold))]" />
        <h2 className="text-sm font-black uppercase tracking-wide text-[hsl(var(--pf-ink))]">Creator tools</h2>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button onClick={() => setEditing(true)} className="pf-card flex flex-col items-center gap-1.5 p-3 text-center hover:border-[hsl(var(--pf-green))]"><Pencil className="h-4 w-4 text-[hsl(var(--pf-green))]" /><span className="text-xs font-bold text-[hsl(var(--pf-ink))]">Edit profile</span></button>
        <button onClick={() => exportLaunchesCsv(tokens, markets)} disabled={!tokens.length} className="pf-card flex flex-col items-center gap-1.5 p-3 text-center hover:border-[hsl(var(--pf-green))] disabled:opacity-40"><Download className="h-4 w-4 text-[hsl(var(--pf-green))]" /><span className="text-xs font-bold text-[hsl(var(--pf-ink))]">Export launches (CSV)</span></button>
        <Link to="/orbitxlaunch/claim" className="pf-card flex flex-col items-center gap-1.5 p-3 text-center hover:border-[hsl(var(--pf-green))]"><Coins className="h-4 w-4 text-[hsl(var(--pf-green))]" /><span className="text-xs font-bold text-[hsl(var(--pf-ink))]">Claim fees</span></Link>
        <Link to="/orbitxlaunch/leaderboard" className="pf-card flex flex-col items-center gap-1.5 p-3 text-center hover:border-[hsl(var(--pf-green))]"><Trophy className="h-4 w-4 text-[hsl(var(--pf-green))]" /><span className="text-xs font-bold text-[hsl(var(--pf-ink))]">Leaderboard</span></Link>
        <Link to="/orbitxlaunch/portfolio" className="pf-card flex flex-col items-center gap-1.5 p-3 text-center hover:border-[hsl(var(--pf-green))]"><Eye className="h-4 w-4 text-[hsl(var(--pf-green))]" /><span className="text-xs font-bold text-[hsl(var(--pf-ink))]">Portfolio</span></Link>
        <a href={`https://solscan.io/account/${addr}`} target="_blank" rel="noreferrer" className="pf-card flex flex-col items-center gap-1.5 p-3 text-center hover:border-[hsl(var(--pf-green))]"><ExternalLink className="h-4 w-4 text-[hsl(var(--pf-green))]" /><span className="text-xs font-bold text-[hsl(var(--pf-ink))]">View on Solscan</span></a>
      </div>

      {/* Launches */}
      <div className="mb-3 flex items-center gap-2">
        <Rocket className="h-4 w-4 text-[hsl(var(--pf-gold))]" />
        <h2 className="text-sm font-black uppercase tracking-wide text-[hsl(var(--pf-ink))]">Your launches</h2>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-20 font-mono text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> loading your launches…</div>
      ) : tokens.length === 0 ? (
        <div className="og-glass-card flex flex-col items-center gap-4 border-dashed py-20 text-center">
          <div className="font-display text-lg font-bold text-foreground">No launches yet</div>
          <Link to="/orbitxlaunch/create" className={goldBtn}><Rocket className="h-4 w-4" /> Launch a token</Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{tokens.map((t) => <TokenCard key={t.id} t={t} mc={markets?.[t.mint_address]?.mcap ?? null} market={markets?.[t.mint_address] ?? null} />)}</div>
      )}
    </div>
  );
}
