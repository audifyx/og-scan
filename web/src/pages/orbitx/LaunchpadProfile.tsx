// OrbitX Launchpad — your profile. Wallet-native: connect = signed in. Shows your
// editable public profile (username, name, bio, avatar, socials) + your launches.
import { useMemo, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listByCreator, getProfile, upsertProfile, type OrbitxProfile } from "@/lib/orbitx/registry";
import { supabase } from "@/lib/supabase";
import { TokenCard, shortAddr, StatTile } from "./_shared";
import { Wallet, Loader2, Rocket, Pencil, X, Check, Twitter, Globe, Camera } from "lucide-react";

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

export default function LaunchpadProfile() {
  const { connected, publicKey } = useWallet();
  const addr = publicKey?.toBase58();
  const [editing, setEditing] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ["orbitx-creator", addr], queryFn: () => listByCreator(addr!), enabled: !!addr });
  const { data: profile, refetch: refetchProfile } = useQuery({ queryKey: ["orbitx-my-profile", addr], queryFn: () => getProfile(addr!), enabled: !!addr });

  const count = data?.length ?? 0;
  const graduated = useMemo(() => (data?.filter((t) => t.lp_pool_address || t.graduated_at).length ?? 0), [data]);

  if (!connected || !addr)
    return (
      <div className="og-glass-card mx-auto flex max-w-lg flex-col items-center gap-4 border-dashed py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/10 bg-white/5"><Wallet className="h-7 w-7 text-muted-foreground" /></div>
        <div>
          <div className="font-display text-lg font-bold text-foreground">Connect your wallet</div>
          <div className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Your wallet is your account. Connect on the top bar to set up your profile and see your launches.</div>
        </div>
        <Link to="/orbitxlaunch/create" className={goldBtn}><Rocket className="h-4 w-4" /> Go to Launch</Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-5xl">
      {editing && <EditProfileModal wallet={addr} profile={profile ?? null} onClose={() => setEditing(false)} onSaved={() => refetchProfile()} />}

      <div className="pf-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 border-[hsl(var(--pf-ink))] bg-[hsl(var(--pf-bg))]">
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[hsl(var(--pf-green))]"><Wallet className="h-7 w-7" /></div>}
            </div>
            <div>
              <div className="text-xl font-black tracking-tight text-[hsl(var(--pf-ink))]">{profile?.display_name || profile?.username || shortAddr(addr, 6)}</div>
              {profile?.username && <div className="pf-mono text-xs text-[hsl(var(--pf-green))]">@{profile.username}</div>}
              <div className="pf-mono text-[10px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">{shortAddr(addr, 6)}</div>
              {profile?.bio && <p className="mt-2 max-w-md text-sm text-[hsl(var(--pf-muted))]">{profile.bio}</p>}
              <div className="mt-2 flex gap-2">
                {profile?.twitter && <a href={profile.twitter} target="_blank" rel="noreferrer" className="text-[hsl(var(--pf-muted))] hover:text-[hsl(var(--pf-green))]"><Twitter className="h-4 w-4" /></a>}
                {profile?.website && <a href={profile.website} target="_blank" rel="noreferrer" className="text-[hsl(var(--pf-muted))] hover:text-[hsl(var(--pf-green))]"><Globe className="h-4 w-4" /></a>}
              </div>
            </div>
          </div>
          <button onClick={() => setEditing(true)} className="pf-btn-ghost self-start text-xs"><Pencil className="h-3.5 w-3.5" /> Edit profile</button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:w-96">
        <StatTile label="Launched" value={isLoading ? "…" : String(count)} accent="gold" />
        <StatTile label="Graduated" value={isLoading ? "…" : String(graduated)} accent="lime" />
      </div>

      <div className="mb-3 mt-6 text-sm font-black uppercase tracking-wide text-[hsl(var(--pf-ink))]">Your launches</div>
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-20 font-mono text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> loading your launches…</div>
      ) : count === 0 ? (
        <div className="og-glass-card flex flex-col items-center gap-4 border-dashed py-20 text-center">
          <div className="font-display text-lg font-bold text-foreground">No launches yet</div>
          <Link to="/orbitxlaunch/create" className={goldBtn}><Rocket className="h-4 w-4" /> Launch a token</Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data!.map((t) => <TokenCard key={t.id} t={t} />)}</div>
      )}
    </div>
  );
}
