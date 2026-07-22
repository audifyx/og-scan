// OrbitX NFT Marketplace — creator profile (Phase 2 social) + in-app fee claim.
// /nft/me  -> connected wallet;  /nft/profile/:wallet -> any creator.
import { useMemo, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  UserCircle2, Users, Image as ImageIcon, Layers, Activity as ActivityIcon, HandCoins,
  Copy, Wallet, BadgeCheck, Loader2, Rocket,
} from "lucide-react";
import { listNftsByCreator, listCollectionsByCreator } from "@/lib/orbitx/nftRegistry";
import { getCreatorNftStats } from "@/lib/orbitx/nftStats";
import { useWalletNfts } from "@/pages/orbitx/nfts";
import { getFollowCounts, isFollowing, toggleFollow } from "./social";
import { getCreatorFees, claimCreatorFees, NFT_COIN_CREATOR_FEE_BPS } from "./nftCoin";
import { Media, Verified, RarityBadge, Empty } from "./_ui";
import { fmtSol, shortAddr } from "./nftMarketData";

type Tab = "created" | "owned" | "collections" | "fees" | "activity";

export default function CreatorProfile() {
  const { wallet: routeWallet } = useParams();
  const { publicKey } = useWallet();
  const me = publicKey?.toBase58();
  const wallet = routeWallet || me || undefined;
  const isMe = !!wallet && wallet === me;
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "created");

  if (!wallet) {
    return (
      <div className="mkt-panel flex flex-col items-center gap-3 px-6 py-16 text-center">
        <Wallet className="h-8 w-8 text-[hsl(var(--og-cyan))]" />
        <div className="text-sm font-bold">Connect your wallet to view your profile</div>
        <p className="max-w-sm text-[12px] mkt-muted">Your connected wallet is your OrbitX identity — no separate login required.</p>
      </div>
    );
  }

  const { data: created } = useQuery({ queryKey: ["cp-created", wallet], queryFn: () => listNftsByCreator(wallet) });
  const { data: collections } = useQuery({ queryKey: ["cp-cols", wallet], queryFn: () => listCollectionsByCreator(wallet) });
  const { data: stats } = useQuery({ queryKey: ["cp-stats", wallet], queryFn: () => getCreatorNftStats(wallet) });
  const { data: owned } = useWalletNfts(wallet);

  const setActive = (t: Tab) => { setTab(t); const n = new URLSearchParams(params); n.set("tab", t); setParams(n, { replace: true }); };

  return (
    <div>
      <ProfileHeader wallet={wallet} isMe={isMe} verified={collections?.some((c) => c.verified)} />

      {/* stat strip */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Minted" value={stats?.totalMinted ?? "—"} />
        <StatCard label="Volume" value={stats ? fmtSol(stats.volumeSol) : "—"} tone="lime" />
        <StatCard label="Royalties earned" value={stats ? fmtSol(stats.royaltiesSol) : "—"} tone="gold" />
        <StatCard label="Floor" value={stats?.floorSol ? fmtSol(stats.floorSol) : "—"} />
      </div>

      {/* tabs */}
      <div className="mkt-rail mt-6 flex items-center gap-1 overflow-x-auto border-b mkt-hairline">
        {([["created", "Created", ImageIcon], ["owned", "Owned", Layers], ["collections", "Collections", Rocket], ["fees", "Creator fees", HandCoins], ["activity", "Activity", ActivityIcon]] as [Tab, string, any][]).map(([t, label, Icon]) => (
          <button key={t} onClick={() => setActive(t)} className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-sm font-bold ${tab === t ? "text-[hsl(var(--mkt-ink))]" : "mkt-muted"}`} style={tab === t ? { boxShadow: "inset 0 -2px 0 0 hsl(var(--og-cyan))" } : undefined}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "created" && <NftGrid items={(created ?? []).map((n) => ({ id: n.id, name: n.name, image: n.image_url, tier: n.rarity_tier, rank: n.rarity_rank }))} empty="No NFTs created yet." />}
        {tab === "owned" && <NftGrid items={(owned ?? []).map((n) => ({ id: n.id, name: n.name, image: n.image, tier: null, rank: null }))} empty="No NFTs held in this wallet." />}
        {tab === "collections" && (
          (collections ?? []).length === 0 ? <Empty label="No collections yet." /> : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {(collections ?? []).map((c) => (
                <Link key={c.id} to={`/nft/collection/${c.id}`} className="mkt-card">
                  <Media src={c.banner_url ?? c.logo_url} className="aspect-[16/9] w-full" />
                  <div className="p-3"><div className="flex items-center gap-1 truncate font-bold">{c.name} <Verified show={c.verified} /></div><div className="mt-1 text-[12px] mkt-muted">Floor {c.floor_price_sol ? fmtSol(c.floor_price_sol) : "—"}</div></div>
                </Link>
              ))}
            </div>
          )
        )}
        {tab === "fees" && <FeesTab wallet={wallet} isMe={isMe} />}
        {tab === "activity" && <Empty label="Per-creator activity feed lands with the v4 migration." />}
      </div>
    </div>
  );
}

function ProfileHeader({ wallet, isMe, verified }: { wallet: string; isMe: boolean; verified?: boolean }) {
  const { publicKey } = useWallet();
  const me = publicKey?.toBase58();
  const qc = useQueryClient();
  const { data: counts } = useQuery({ queryKey: ["cp-follow", wallet], queryFn: () => getFollowCounts(wallet) });
  const { data: following } = useQuery({ queryKey: ["cp-isfollowing", me, wallet], enabled: !!me && !isMe, queryFn: () => isFollowing(me!, wallet) });
  const [busy, setBusy] = useState(false);

  const onFollow = async () => {
    if (!me) { toast.error("Connect your wallet to follow"); return; }
    setBusy(true);
    try { await toggleFollow(me, wallet); await qc.invalidateQueries({ queryKey: ["cp-isfollowing", me, wallet] }); await qc.invalidateQueries({ queryKey: ["cp-follow", wallet] }); }
    catch { toast.error("Following goes live with the v4 migration."); }
    finally { setBusy(false); }
  };

  return (
    <div className="mkt-panel overflow-hidden">
      <div className="h-32 w-full sm:h-40" style={{ background: "linear-gradient(120deg, hsl(var(--og-cyan) / 0.35), hsl(var(--og-gold) / 0.25))" }} />
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:p-6">
        <div className="-mt-14 flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-[hsl(var(--mkt-panel))] bg-[hsl(var(--mkt-panel-2))] sm:h-24 sm:w-24">
          <UserCircle2 className="h-12 w-12 mkt-muted" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xl font-black">{shortAddr(wallet, 5)} {verified && <BadgeCheck className="h-5 w-5 text-[hsl(var(--og-cyan))]" />}</div>
          <button onClick={() => { navigator.clipboard?.writeText(wallet); toast.success("Address copied"); }} className="mt-1 inline-flex items-center gap-1 mkt-mono text-[12px] mkt-muted hover:text-[hsl(var(--mkt-ink))]"><Copy className="h-3 w-3" /> {shortAddr(wallet, 6)}</button>
          <div className="mt-2 flex items-center gap-4 text-[13px]">
            <span><span className="font-black">{counts?.followers ?? 0}</span> <span className="mkt-muted">followers</span></span>
            <span><span className="font-black">{counts?.following ?? 0}</span> <span className="mkt-muted">following</span></span>
          </div>
        </div>
        {!isMe && (
          <button onClick={onFollow} disabled={busy} className={`mkt-btn ${following ? "ghost" : ""}`}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />} {following ? "Following" : "Follow"}
          </button>
        )}
        {isMe && <Link to="/nft/create" className="mkt-btn"><ImageIcon className="h-4 w-4" /> Mint NFT</Link>}
      </div>
    </div>
  );
}

function FeesTab({ wallet, isMe }: { wallet: string; isMe: boolean }) {
  const qc = useQueryClient();
  const { data: fees } = useQuery({ queryKey: ["cp-fees", wallet], queryFn: () => getCreatorFees(wallet) });
  const [busy, setBusy] = useState(false);

  const onClaim = async () => {
    setBusy(true);
    try { const r = await claimCreatorFees(wallet); toast.success(`Claimed ${fmtSol(r.amount_sol)}`); await qc.invalidateQueries({ queryKey: ["cp-fees", wallet] }); }
    catch (e) { toast.message(e instanceof Error ? e.message : "Claim unavailable yet"); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="mkt-panel p-5 sm:col-span-2">
        <div className="flex items-center gap-2 text-sm font-black"><HandCoins className="h-4 w-4 text-[hsl(var(--og-gold))]" /> Creator fees (pump.fun-style)</div>
        <p className="mt-2 text-[13px] mkt-muted">Every trade of your NFT-as-coin market accrues a {(NFT_COIN_CREATOR_FEE_BPS / 100).toFixed(2)}% creator fee — same structure as a pump.fun coin, claimable in-app to the wallet that created it.</p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div><div className="mkt-mono text-[10px] uppercase tracking-widest mkt-muted">Claimable now</div><div className="text-2xl font-black text-[hsl(var(--og-lime))]">{fees ? fmtSol(fees.claimable_sol) : "—"}</div></div>
          <div><div className="mkt-mono text-[10px] uppercase tracking-widest mkt-muted">Lifetime earned</div><div className="text-2xl font-black">{fees ? fmtSol(fees.lifetime_sol) : "—"}</div></div>
        </div>
        {isMe && (
          <button onClick={onClaim} disabled={busy || !fees || fees.claimable_sol <= 0} className="mkt-btn mt-4 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <HandCoins className="h-4 w-4" />} Claim fees
          </button>
        )}
      </div>
      <div className="mkt-panel p-5">
        <div className="text-sm font-black">How it works</div>
        <ul className="mt-2 space-y-2 text-[12px] mkt-muted">
          <li>• Enable a coin market on any NFT you created.</li>
          <li>• Buyers/sellers trade on a bonding curve.</li>
          <li>• {(NFT_COIN_CREATOR_FEE_BPS / 100).toFixed(2)}% of every trade routes to you.</li>
          <li>• Claim to your wallet anytime — no lockup.</li>
        </ul>
        <p className="mt-3 text-[11px] mkt-muted">On-chain settlement activates when the OrbitX NFT-coin program is deployed. Accrual is tracked from launch.</p>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "lime" | "gold" }) {
  const color = tone === "lime" ? "text-[hsl(var(--og-lime))]" : tone === "gold" ? "text-[hsl(var(--og-gold))]" : "";
  return <div className="mkt-panel p-4"><div className="mkt-mono text-[10px] uppercase tracking-widest mkt-muted">{label}</div><div className={`mt-1 text-xl font-black ${color}`}>{value}</div></div>;
}

function NftGrid({ items, empty }: { items: { id: string; name: string; image: string | null; tier: string | null; rank: number | null }[]; empty: string }) {
  if (items.length === 0) return <Empty label={empty} />;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((n) => (
        <div key={n.id} className="mkt-card">
          <Media src={n.image} className="aspect-square w-full" />
          <div className="flex items-center justify-between gap-2 p-3"><span className="truncate text-[13px] font-bold">{n.name}</span><RarityBadge tier={n.tier} rank={n.rank} /></div>
        </div>
      ))}
    </div>
  );
}
