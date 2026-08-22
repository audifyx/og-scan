import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import {
  Rocket, Flame, Megaphone, Coins, Gift, BookOpen, ArrowRight, Loader2,
  Twitter, ExternalLink, Pause, Play, CheckCircle2,
} from "lucide-react";
import { TabHero } from "./TabHero";
import { useAuth } from "@/hooks/useAuth";
import { xStartLogin } from "@/lib/xAuth";
import { defaultFlywheel, kindFromSearch, launchpadV2, type FlywheelAlloc, type LaunchKind } from "@/lib/orbitx/launchpadV2";
import { validateFlywheel } from "../../../shared/launchpad-v2.js";

const KINDS: { id: LaunchKind; title: string; blurb: string; points: string[] }[] = [
  {
    id: "standard",
    title: "Standard Launch",
    blurb: "Normal OrbitX Pump.fun launch — name, ticker, art, socials, sign, confirm.",
    points: ["Pump.fun bonding curve", "1B supply · 6 decimals (locked by Pump)", "Creator fees claimable in-app"],
  },
  {
    id: "flywheel",
    title: "Flywheel Launch",
    blurb: "Same on-chain create, plus a 100% allocation that routes activity back into the token.",
    points: ["Configurable Community / Buy-Burn / Creator / Rewards", "Allocations must total 100%", "Fee jobs flag buy/burn when vault ≥ $25"],
  },
  {
    id: "bagworking",
    title: "Bagworking Launch",
    blurb: "Registers the confirmed mint for X-post campaigns the moment the launch tx confirms.",
    points: ["Auto-creates a draft campaign", "Short $1.50 · Long $3.00", "10 posts / user / day, budget-capped"],
  },
];

export function FlywheelEditor({
  value,
  onChange,
}: {
  value: FlywheelAlloc;
  onChange: (next: FlywheelAlloc) => void;
}) {
  const rows: { key: keyof FlywheelAlloc; label: string }[] = [
    { key: "community", label: "Community" },
    { key: "buyBurn", label: "Buy / Burn" },
    { key: "creator", label: "Creator" },
    { key: "rewards", label: "Rewards" },
  ];
  const checked = validateFlywheel(value);
  const total = (value.community || 0) + (value.buyBurn || 0) + (value.creator || 0) + (value.rewards || 0);
  return (
    <div className="ox-panel pf-card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div className="pf-mono text-[10px] uppercase tracking-[0.24em] text-[#F0C75E]">Flywheel allocation</div>
        <div className={`pf-mono text-xs font-bold ${checked.ok ? "text-[#60A5FA]" : "text-[#ff4d6d]"}`}>
          {total.toFixed(0)}% {checked.ok ? "balanced" : "must equal 100%"}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <label key={r.key} className="block">
            <div className="mb-1 flex justify-between text-xs text-white/70">
              <span>{r.label}</span>
              <span className="pf-mono text-[#F0C75E]">{value[r.key]}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={value[r.key]}
              onChange={(e) => onChange({ ...value, [r.key]: Number(e.target.value) })}
              className="w-full accent-[#F0C75E]"
            />
          </label>
        ))}
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-white/10">
        {rows.map((r) => (
          <div
            key={r.key}
            style={{ width: `${Math.max(0, value[r.key])}%` }}
            className={
              r.key === "community" ? "bg-[#60A5FA]" :
              r.key === "buyBurn" ? "bg-[#F0C75E]" :
              r.key === "creator" ? "bg-white/70" : "bg-[#3B82F6]"
            }
          />
        ))}
      </div>
      {!checked.ok && <p className="text-xs text-[#ff4d6d]">{checked.error}</p>}
    </div>
  );
}

export function LaunchpadV2Launch() {
  return (
    <div className="lp-v2 mx-auto max-w-5xl">
      <TabHero
        icon={Rocket}
        accent="gold"
        eyebrow="OrbitX Launch · V2"
        title="Create → Launch → Promote → Earn"
        subtitle="Three real launch kinds on the existing Pump.fun and custom lanes. No mock buttons — every launch still signs on-chain."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {KINDS.map((k) => (
          <div key={k.id} className="ox-panel pf-card flex flex-col p-5">
            <div className="pf-mono text-[10px] uppercase tracking-[0.24em] text-[#F0C75E]">{k.id}</div>
            <h2 className="mt-1 font-display text-xl font-black text-white">{k.title}</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-white/65">{k.blurb}</p>
            <ul className="mt-3 space-y-1 text-xs text-white/70">
              {k.points.map((p) => <li key={p}>· {p}</li>)}
            </ul>
            <Link to={`/orbitxlaunch/create/pump?kind=${k.id}`} className="ox-btn ox-btn--blue mt-5 inline-flex items-center justify-center gap-2">
              Launch {k.title.split(" ")[0]} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to={`/orbitxlaunch/create/custom?kind=${k.id}`} className="mt-2 text-center text-[11px] text-white/50 hover:text-white">
              or use custom Token-22 lane
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LaunchpadV2Types() {
  return (
    <div className="lp-v2 mx-auto max-w-4xl">
      <TabHero
        icon={Flame}
        accent="gold"
        eyebrow="Mechanics"
        title="Launch types are not themes"
        subtitle="Each kind writes different backend config after the same Pump.fun or custom mint confirms."
      />
      <div className="space-y-4">
        {KINDS.map((k) => (
          <section key={k.id} className="ox-panel pf-card p-5">
            <h2 className="font-display text-lg font-black text-white">{k.title}</h2>
            <p className="mt-1 text-sm text-white/65">{k.blurb}</p>
            <ul className="mt-3 grid gap-1 text-sm text-white/75 sm:grid-cols-3">
              {k.points.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

export function LaunchpadHow() {
  return (
    <div className="lp-v2 mx-auto max-w-3xl space-y-4">
      <TabHero
        icon={BookOpen}
        accent="blue"
        eyebrow="How it works"
        title="Create → Trade → Promote → Buy/Burn"
        subtitle="OrbitX Launch V2 is wired to the existing Pump.fun create, X OAuth, claim desk, and $ORBITX burn path."
      />
      {[
        ["1. Launch", "Fill identity, connect wallet, sign the existing Pump.fun or custom mint. V2 registers the confirmed signature — it never fakes a CA."],
        ["2. Flywheel", "Allocations must sum to 100%. When creator fees hit $25, a backend cron opens a job. You still sign collectCreatorFee — OrbitX does not hold keys."],
        ["3. Bagworking", "Eligible coins appear in the marketplace. Connect X (existing OrbitX OAuth). Submit a live tweet URL. The API verifies author, text, duplicates, and daily cap."],
        ["4. Rewards", "Short $1.50 / long $3.00, max 10 posts/day ($30). Credits land on ox_lp_balances as pending — not a fake wallet number."],
        ["5. Burns", "Claimed fees are recorded with Solscan links. Platform buy/burn of $ORBITX only happens when proceeds actually reach the platform wallet."],
      ].map(([t, d]) => (
        <div key={t} className="ox-panel pf-card p-5">
          <h3 className="font-display text-base font-black text-[#F0C75E]">{t}</h3>
          <p className="mt-1 text-sm leading-relaxed text-white/70">{d}</p>
        </div>
      ))}
    </div>
  );
}

export function LaunchpadBagworking() {
  const { campaignId } = useParams();
  const { session } = useAuth();
  const qc = useQueryClient();
  const eligible = useQuery({
    queryKey: ["lpv2-eligible"],
    queryFn: () => launchpadV2<{ coins: Array<Record<string, unknown>> }>("eligible"),
    refetchInterval: 20_000,
  });
  const me = useQuery({
    queryKey: ["lpv2-me"],
    queryFn: () => launchpadV2("me"),
    enabled: !!session,
  });
  const campaign = useQuery({
    queryKey: ["lpv2-campaign", campaignId],
    queryFn: () => launchpadV2("campaign", { query: { campaign_id: campaignId! } }),
    enabled: !!campaignId,
  });
  const [tweet, setTweet] = useState("");
  const submit = useMutation({
    mutationFn: () => launchpadV2("submit_post", { method: "POST", body: { campaign_id: campaignId, tweet_url: tweet } }),
    onSuccess: (d: { reward_usd?: number; kind?: string; posts_today?: number }) => {
      toast.success(`Verified ${d.kind} post · $${Number(d.reward_usd || 0).toFixed(2)} · ${d.posts_today}/10 today`);
      setTweet("");
      qc.invalidateQueries({ queryKey: ["lpv2-eligible"] });
      qc.invalidateQueries({ queryKey: ["lpv2-rewards"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (campaignId) {
    const c = (campaign.data as { campaign?: Record<string, unknown> } | undefined)?.campaign;
    return (
      <div className="lp-v2 mx-auto max-w-2xl">
        <TabHero icon={Megaphone} accent="gold" eyebrow="Bagworking" title="Submit a qualifying post" subtitle="Paste a public X status URL. We verify it through the X API — the button cannot invent a reward." />
        {!session && <p className="mb-3 text-sm text-[#F0C75E]">Sign in to submit.</p>}
        {me.data && !(me.data as { x_connected?: boolean }).x_connected && (
          <button type="button" className="ox-btn ox-btn--blue mb-4 inline-flex items-center gap-2" onClick={() => xStartLogin().catch((e) => toast.error(String(e.message || e)))}>
            <Twitter className="h-4 w-4" /> Connect X
          </button>
        )}
        {me.data && (me.data as { x_connected?: boolean }).x_connected && (
          <div className="mb-4 text-sm text-[#60A5FA]">X Connected · @{(me.data as { x_username?: string }).x_username}</div>
        )}
        {campaign.isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
        {c && (
          <div className="ox-panel pf-card mb-4 p-4 text-sm">
            <div className="font-black text-white">{String(c.title || c.mint)}</div>
            <div className="mt-1 text-white/60">Pool ${Number(c.budget_usd).toFixed(2)} · spent ${Number(c.spent_usd).toFixed(2)} · ${Number((campaign.data as { remaining_usd?: number }).remaining_usd || 0).toFixed(2)} remaining</div>
          </div>
        )}
        <input
          value={tweet}
          onChange={(e) => setTweet(e.target.value)}
          placeholder="https://x.com/you/status/…"
          className="mb-3 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-sm"
        />
        <button
          type="button"
          disabled={!session || submit.isPending || !tweet.trim()}
          onClick={() => submit.mutate()}
          className="ox-btn ox-btn--blue inline-flex items-center gap-2 disabled:opacity-40"
        >
          {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Verify & credit
        </button>
      </div>
    );
  }

  const coins = eligible.data?.coins || [];
  return (
    <div className="lp-v2 mx-auto max-w-5xl">
      <TabHero
        icon={Megaphone}
        accent="gold"
        eyebrow="Bagworking"
        title="Eligible coins"
        subtitle="Promote live OrbitX launches. Rewards only after X API verification."
        actions={
          me.data && (me.data as { x_connected?: boolean }).x_connected ? (
            <span className="text-xs text-[#60A5FA]">X Connected · @{(me.data as { x_username?: string }).x_username}</span>
          ) : (
            <button type="button" className="ox-btn ox-btn--blue inline-flex items-center gap-2" onClick={() => xStartLogin().catch((e) => toast.error(String(e.message || e)))}>
              <Twitter className="h-4 w-4" /> Connect X
            </button>
          )
        }
      />
      {eligible.isLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>}
      {eligible.isError && <p className="text-sm text-[#ff4d6d]">{(eligible.error as Error).message}</p>}
      {!eligible.isLoading && !coins.length && (
        <div className="ox-panel pf-card p-8 text-center text-sm text-white/60">No active Bagworking campaigns with remaining budget. Launch a Bagworking token, then activate the campaign from My Launches.</div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {coins.map((c) => (
          <article key={String(c.campaign_id)} className="ox-panel pf-card p-5">
            <div className="flex items-start gap-3">
              {c.image_url ? <img src={String(c.image_url)} alt="" className="h-12 w-12 rounded-full object-cover" /> : <div className="h-12 w-12 rounded-full bg-white/10" />}
              <div className="min-w-0 flex-1">
                <div className="font-black text-white">{String(c.name || "Token")} <span className="text-[#F0C75E]">${String(c.symbol || "")}</span></div>
                <div className="truncate pf-mono text-[10px] text-white/45">{String(c.mint)}</div>
              </div>
              <span className="rounded-full border border-[#60A5FA]/40 px-2 py-0.5 text-[10px] uppercase text-[#60A5FA]">{String(c.status)}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/70">
              <div>Reward ${Number(c.reward_short).toFixed(2)}–${Number(c.reward_long).toFixed(2)}</div>
              <div>${Number(c.remaining_usd).toFixed(0)} remaining</div>
              <div>{Number(c.posts_count)} posts</div>
              <div>{Number(c.participants_count)} participants</div>
              <div>Kind {String(c.kind)}</div>
              <div>Ends {c.ends_at ? new Date(String(c.ends_at)).toLocaleDateString() : "—"}</div>
            </div>
            <div className="mt-4 flex gap-2">
              <Link to={`/orbitxlaunch/bagworking/${c.campaign_id}`} className="ox-btn ox-btn--blue flex-1 text-center text-sm">Start Bagworking</Link>
              <Link to={`/orbitxlaunch/token/${c.mint}`} className="ox-btn flex-1 text-center text-sm">Token</Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function LaunchpadMyLaunches() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["lpv2-mine"],
    queryFn: () => launchpadV2<{ launches: Array<Record<string, unknown>> }>("my_launches"),
    enabled: !!session,
    refetchInterval: 20_000,
  });
  const [budget, setBudget] = useState("500");
  const activate = useMutation({
    mutationFn: (body: Record<string, unknown>) => launchpadV2("update_campaign", { method: "POST", body }),
    onSuccess: () => { toast.success("Campaign updated"); qc.invalidateQueries({ queryKey: ["lpv2-mine"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!session) {
    return <div className="ox-panel pf-card p-8 text-center text-sm text-white/70">Sign in to see tokens you launched through OrbitX V2.</div>;
  }
  const launches = q.data?.launches || [];
  return (
    <div className="lp-v2 mx-auto max-w-4xl">
      <TabHero icon={Coins} accent="gold" eyebrow="Creator" title="My launches" subtitle="Confirmed mints registered after your wallet signed. Activate Bagworking here." />
      {q.isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
      {!q.isLoading && !launches.length && <p className="text-sm text-white/60">No V2 launches yet. Start from the Launch tab.</p>}
      <div className="space-y-4">
        {launches.map((l) => {
          const camps = l.ox_lp_campaigns;
          const camp = Array.isArray(camps) ? camps[0] : camps;
          return (
            <article key={String(l.id)} className="ox-panel pf-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-black text-white">{String(l.name)} <span className="text-[#F0C75E]">${String(l.ticker)}</span></div>
                  <div className="pf-mono text-[10px] text-white/45">{String(l.mint)}</div>
                </div>
                <span className="text-xs uppercase text-[#60A5FA]">{String(l.launch_kind)} · {String(l.status)}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Link to={`/orbitxlaunch/token/${l.mint}`} className="ox-btn">Token page</Link>
                {l.mint_signature ? (
                  <a href={`https://solscan.io/tx/${String(l.mint_signature)}`} target="_blank" rel="noreferrer" className="ox-btn inline-flex items-center gap-1">
                    Mint tx <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </div>
              {camp && (
                <div className="mt-4 rounded-lg border border-white/10 p-3">
                  <div className="text-xs text-white/70">Bagworking · {String(camp.status)} · spent ${Number(camp.spent_usd).toFixed(2)} / ${Number(camp.budget_usd).toFixed(2)}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input value={budget} onChange={(e) => setBudget(e.target.value)} className="w-24 rounded border border-white/15 bg-black/40 px-2 py-1 font-mono text-xs" />
                    <button type="button" className="ox-btn ox-btn--blue text-xs" disabled={activate.isPending} onClick={() => activate.mutate({ campaign_id: camp.id, status: "active", budget_usd: Number(budget) })}>
                      <Play className="mr-1 inline h-3 w-3" /> Activate
                    </button>
                    <button type="button" className="ox-btn text-xs" disabled={activate.isPending} onClick={() => activate.mutate({ campaign_id: camp.id, status: "paused" })}>
                      <Pause className="mr-1 inline h-3 w-3" /> Pause
                    </button>
                    <button type="button" className="ox-btn text-xs" disabled={activate.isPending} onClick={() => activate.mutate({ campaign_id: camp.id, status: "active" })}>
                      Resume
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function LaunchpadRewards() {
  const { session } = useAuth();
  const q = useQuery({
    queryKey: ["lpv2-rewards"],
    queryFn: () => launchpadV2<{
      balance: { pending_usd: number; paid_usd: number; lifetime_usd: number; lifetime_posts: number };
      today: { posts: number; earned_usd: number; max_posts: number };
      posts: Array<Record<string, unknown>>;
      x: { connected: boolean; username: string | null };
    }>("rewards"),
    enabled: !!session,
    refetchInterval: 15_000,
  });
  if (!session) return <div className="ox-panel pf-card p-8 text-center text-sm">Sign in to load your Bagworking ledger.</div>;
  if (q.isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (q.isError) return <p className="text-sm text-[#ff4d6d]">{(q.error as Error).message}</p>;
  const d = q.data!;
  return (
    <div className="lp-v2 mx-auto max-w-4xl">
      <TabHero icon={Gift} accent="gold" eyebrow="Rewards" title="Bagworking ledger" subtitle="Every credit is a verified X post. Pending until the existing OrbitX payout desk pays it." />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Stat label="Today" value={`${d.today.posts} / ${d.today.max_posts}`} sub={`$${d.today.earned_usd.toFixed(2)} earned`} />
        <Stat label="Pending" value={`$${Number(d.balance.pending_usd).toFixed(2)}`} />
        <Stat label="Paid" value={`$${Number(d.balance.paid_usd).toFixed(2)}`} />
        <Stat label="Lifetime" value={`$${Number(d.balance.lifetime_usd || 0).toFixed(2)}`} sub={`${d.balance.lifetime_posts || d.posts.length} posts`} />
      </div>
      {d.x?.connected ? <p className="mb-3 text-sm text-[#60A5FA]">X Connected · @{d.x.username}</p> : (
        <button type="button" className="ox-btn ox-btn--blue mb-3" onClick={() => xStartLogin().catch((e) => toast.error(String(e.message || e)))}>Connect X</button>
      )}
      <div className="space-y-2">
        {d.posts.map((p) => (
          <div key={String(p.id)} className="ox-panel pf-card flex flex-wrap items-center justify-between gap-2 p-3 text-xs">
            <a href={String(p.post_url)} target="_blank" rel="noreferrer" className="text-[#60A5FA] underline">{String(p.x_post_id)}</a>
            <span className="uppercase text-white/50">{String(p.post_kind)}</span>
            <span className="text-[#F0C75E]">${Number(p.reward_usd).toFixed(2)}</span>
            <span>{String(p.status)}</span>
            <span className="text-white/40">{new Date(String(p.created_at)).toLocaleString()}</span>
          </div>
        ))}
        {!d.posts.length && <p className="text-sm text-white/50">No verified posts yet.</p>}
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="ox-panel pf-card p-4">
      <div className="pf-mono text-[10px] uppercase tracking-widest text-white/45">{label}</div>
      <div className="mt-1 font-display text-xl font-black text-white">{value}</div>
      {sub && <div className="text-xs text-white/50">{sub}</div>}
    </div>
  );
}

export function FeeBurnPanel({ mint }: { mint: string }) {
  const { publicKey } = useWallet();
  const q = useQuery({
    queryKey: ["lpv2-launch", mint],
    queryFn: () => launchpadV2<{
      launch: Record<string, unknown> | null;
      jobs: Array<Record<string, unknown>>;
      stats: {
        total_claimed_usd: number;
        completed_burns: number;
        last_claim_sig: string | null;
        last_burn_sig: string | null;
        open_job: Record<string, unknown> | null;
        threshold_usd: number;
        live_claimable_usd: number;
        progress: { current: number; threshold: number; ready: boolean };
      };
    }>("launch", { query: { mint } }),
    enabled: !!mint,
    refetchInterval: 20_000,
  });
  if (q.isLoading) return <div className="ox-tok-panel text-sm text-white/50">Loading fee / burn status…</div>;
  if (q.isError || !q.data?.launch) return null;
  const s = q.data.stats;
  const progress = Math.min(100, (s.progress.current / s.progress.threshold) * 100);
  const creator = String(q.data.launch.creator_wallet || "");
  const mine = publicKey?.toBase58() === creator;
  return (
    <div className="ox-tok-panel">
      <div className="mb-2 pf-mono text-[10px] uppercase tracking-widest text-[#F0C75E]">Automated creator fees</div>
      <div className="text-sm text-white">
        ${s.progress.current.toFixed(2)} / ${s.progress.threshold.toFixed(2)} toward next automated burn
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-[#F0C75E]" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/65">
        <div>Claimed ${s.total_claimed_usd.toFixed(2)}</div>
        <div>Burns {s.completed_burns}</div>
        {s.last_claim_sig && <a className="text-[#60A5FA]" href={`https://solscan.io/tx/${s.last_claim_sig}`} target="_blank" rel="noreferrer">Last claim</a>}
        {s.last_burn_sig && <a className="text-[#60A5FA]" href={`https://solscan.io/tx/${s.last_burn_sig}`} target="_blank" rel="noreferrer">Last burn</a>}
      </div>
      {s.open_job && (
        <div className="mt-3 rounded-lg border border-[#F0C75E]/30 bg-[#F0C75E]/10 p-3 text-xs">
          <div className="font-bold text-[#F0C75E]">{String(s.open_job.status).replace(/_/g, " ")}</div>
          <p className="mt-1 text-white/70">{String(s.open_job.error || "Waiting on creator signature for collectCreatorFee.")}</p>
          {mine && String(s.open_job.status) === "awaiting_creator_sign" && (
            <Link to="/orbitxlaunch/claim" className="ox-btn ox-btn--blue mt-2 inline-flex text-xs">Sign claim in Claim desk</Link>
          )}
        </div>
      )}
    </div>
  );
}

export function LaunchpadV2AdminPanel() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["lpv2-admin"],
    queryFn: () => launchpadV2<{
      stats: Record<string, unknown>;
      fee_jobs: Array<Record<string, unknown>>;
      campaigns: Array<Record<string, unknown>>;
      posts: Array<Record<string, unknown>>;
      flags: Array<Record<string, unknown>>;
      rules: Record<string, unknown>;
    }>("admin"),
    refetchInterval: 30_000,
  });
  const [rules, setRules] = useState<Record<string, unknown> | null>(null);
  const save = useMutation({
    mutationFn: () => launchpadV2("admin", { method: "POST", body: { set_rules: true, ...(rules || q.data?.rules || {}) } }),
    onSuccess: () => { toast.success("Rules saved"); qc.invalidateQueries({ queryKey: ["lpv2-admin"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const pause = useMutation({
    mutationFn: (body: Record<string, unknown>) => launchpadV2("update_campaign", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lpv2-admin"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  if (q.isLoading) return <div className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>;
  if (q.isError) return <p className="text-sm text-red-400">{(q.error as Error).message}</p>;
  const s = q.data?.stats || {};
  const r = rules || q.data?.rules || {};
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Launches" value={String(s.total_launches || 0)} sub={`${s.live || 0} live`} />
        <Stat label="Fee jobs open" value={String(s.fee_pending || 0)} sub={`${s.fee_completed || 0} completed`} />
        <Stat label="Verified posts" value={String(s.posts_verified || 0)} sub={`${s.posts_rejected || 0} rejected`} />
        <Stat label="Rewards" value={`$${Number(s.rewards_usd || 0).toFixed(0)}`} />
      </div>
      <div className="ox-panel pf-card p-4">
        <div className="mb-2 text-sm font-bold">Global Bagworking rules</div>
        <div className="grid gap-2 sm:grid-cols-3 text-xs">
          {(["min_short_chars", "long_min_chars", "max_posts_per_day", "short_reward_usd", "long_reward_usd", "fee_threshold_usd"] as const).map((k) => (
            <label key={k}>
              {k}
              <input
                className="mt-1 w-full rounded border border-white/15 bg-black/40 px-2 py-1 font-mono"
                value={String(r[k] ?? "")}
                onChange={(e) => setRules({ ...r, [k]: Number(e.target.value) })}
              />
            </label>
          ))}
        </div>
        <button type="button" className="ox-btn ox-btn--blue mt-3 text-xs" onClick={() => save.mutate()} disabled={save.isPending}>Save rules</button>
      </div>
      <div className="ox-panel pf-card p-4">
        <div className="mb-2 text-sm font-bold">Campaigns</div>
        {(q.data?.campaigns || []).slice(0, 12).map((c) => (
          <div key={String(c.id)} className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 py-2 text-xs">
            <span>{String(c.title || c.mint)}</span>
            <span>{String(c.status)} · ${Number(c.spent_usd).toFixed(0)}/${Number(c.budget_usd).toFixed(0)}</span>
            <span className="flex gap-1">
              <button type="button" className="ox-btn text-[10px]" onClick={() => pause.mutate({ campaign_id: c.id, status: "paused" })}>Pause</button>
              <button type="button" className="ox-btn text-[10px]" onClick={() => pause.mutate({ campaign_id: c.id, status: "completed" })}>Disable</button>
            </span>
          </div>
        ))}
      </div>
      <div className="ox-panel pf-card p-4">
        <div className="mb-2 text-sm font-bold">Open risk flags</div>
        {(q.data?.flags || []).map((f) => (
          <div key={String(f.id)} className="border-t border-white/5 py-2 text-xs">
            <span className="text-[#F0C75E]">{String(f.risk)}</span> · {String(f.reason)}
          </div>
        ))}
        {!q.data?.flags?.length && <p className="text-xs text-white/40">No open flags.</p>}
      </div>
    </div>
  );
}

export function useLaunchKindParam(): { kind: LaunchKind; flywheel: FlywheelAlloc; setFlywheel: (v: FlywheelAlloc) => void } {
  const [params] = useSearchParams();
  const kind = kindFromSearch(params.get("kind"));
  const [flywheel, setFlywheel] = useState<FlywheelAlloc>(() => defaultFlywheel());
  return { kind, flywheel, setFlywheel };
}

export function LaunchKindBanner({ kind }: { kind: LaunchKind }) {
  const meta = KINDS.find((k) => k.id === kind) || KINDS[0];
  return (
    <div className="ox-panel ox-panel--gold pf-card p-4">
      <div className="pf-mono text-[10px] uppercase tracking-[0.24em] text-[#F0C75E]">Launch type · {kind}</div>
      <div className="mt-1 font-black text-white">{meta.title}</div>
      <p className="mt-1 text-sm text-white/65">{meta.blurb}</p>
      {kind === "standard" && (
        <p className="mt-2 text-xs text-white/50">Pump supply 1,000,000,000 · decimals 6 are locked by Pump.fun. Custom lane can set supply and authorities.</p>
      )}
    </div>
  );
}
