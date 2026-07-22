// OrbitX NFT Marketplace — collection page: analytics strip + floor/volume
// history chart (Phase 4), curator feature control (Phase 5), item grid.
import { useMemo, useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { listNftCollections, listNfts } from "@/lib/orbitx/nftRegistry";
import { supabase } from "@/lib/supabase";
import { useCollectionStats } from "./nftAnalytics";
import { PriceText } from "./currency";
import { Media, Verified, RarityBadge, Empty } from "./_ui";
import { fmtInt } from "./nftMarketData";
import { TrendingUp, Users, Package, Percent, ArrowLeft, Star, AlertTriangle } from "lucide-react";

export default function CollectionPage() {
  const { id } = useParams();
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58();
  const { data: collections } = useQuery({ queryKey: ["nftmkt-collections"], queryFn: () => listNftCollections(200), staleTime: 30_000 });
  const { data: allNfts } = useQuery({ queryKey: ["nftmkt-nfts", 500], queryFn: () => listNfts(500), staleTime: 30_000 });
  const { data: stats } = useCollectionStats(id);

  const c = useMemo(() => (collections ?? []).find((x) => x.id === id) ?? null, [collections, id]);
  const items = useMemo(() => (allNfts ?? []).filter((n) => n.collection_id === id), [allNfts, id]);
  const holders = useMemo(() => new Set(items.map((n) => n.current_owner)).size, [items]);

  const [isCurator, setIsCurator] = useState(false);
  const [featured, setFeatured] = useState(false);
  useEffect(() => { setFeatured(!!(c as unknown as { featured?: boolean })?.featured); }, [c]);
  useEffect(() => {
    if (!wallet) { setIsCurator(false); return; }
    supabase.from("orbitx_curators").select("wallet").eq("wallet", wallet).maybeSingle()
      .then(({ data }) => setIsCurator(!!data)).catch(() => setIsCurator(false));
  }, [wallet]);

  const toggleFeatured = async () => {
    if (!wallet || !id) return;
    try {
      const next = !featured;
      const { error } = await supabase.rpc("orbitx_set_featured", { p_wallet: wallet, p_collection: id, p_featured: next, p_rank: next ? 1 : null });
      if (error) throw error;
      setFeatured(next);
      toast.success(next ? "Added to staff picks" : "Removed from staff picks");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Not authorized"); }
  };

  if (collections && !c) return <div><Link to="/nft" className="mkt-btn ghost mb-4"><ArrowLeft className="h-4 w-4" /> Back</Link><Empty label="Collection not found." /></div>;

  return (
    <div>
      <Link to="/nft" className="mkt-btn ghost mb-4"><ArrowLeft className="h-4 w-4" /> Back to marketplace</Link>
      <div className="mkt-panel overflow-hidden">
        <Media src={c?.banner_url ?? c?.logo_url} className="h-40 w-full sm:h-52" />
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:p-6">
          <Media src={c?.logo_url} className="-mt-16 h-24 w-24 rounded-2xl border-2 border-[hsl(var(--mkt-panel))]" />
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-2xl font-black">{c?.name ?? "…"} <Verified show={c?.verified} className="h-5 w-5" />{featured && <span className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--og-gold))]/40 bg-[hsl(var(--og-gold))]/10 px-2 py-0.5 text-[10px] font-black uppercase text-[hsl(var(--og-gold))]"><Star className="h-3 w-3" /> Staff pick</span>}</h1>
            {c?.description && <p className="mt-1 max-w-xl text-[13px] mkt-muted line-clamp-2">{c.description}</p>}
          </div>
          {isCurator && (
            <button onClick={toggleFeatured} className={`mkt-btn ${featured ? "ghost" : ""}`}><Star className="h-4 w-4" /> {featured ? "Unfeature" : "Feature"}</button>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Metric icon={TrendingUp} label="Floor" value={c?.floor_price_sol ? <PriceText sol={c.floor_price_sol} /> : "—"} tone="lime" />
        <Metric icon={Package} label="Volume" value={c?.volume_sol ? <PriceText sol={c.volume_sol} /> : "—"} />
        <Metric icon={Users} label="Holders" value={fmtInt(holders)} />
        <Metric icon={Package} label="Items" value={fmtInt(items.length)} />
        <Metric icon={Percent} label="Royalty" value={c ? `${(c.royalty_bps / 100).toFixed(1)}%` : "—"} tone="gold" />
      </div>

      <div className="mt-4 mkt-panel p-5">
        <div className="mb-3 text-sm font-black">Floor &amp; volume history</div>
        {(stats ?? []).length > 1 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#8a93a6" }} tickFormatter={(d: string) => d.slice(5)} minTickGap={24} />
              <YAxis tick={{ fontSize: 10, fill: "#8a93a6" }} width={44} />
              <Tooltip contentStyle={{ background: "#0a1220", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }} labelStyle={{ color: "#8a93a6" }} />
              <Line type="monotone" dataKey="volume_sol" name="Volume (SOL)" stroke="hsl(var(--og-lime))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="floor_sol" name="Floor (SOL)" stroke="hsl(var(--og-cyan))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed mkt-hairline text-[12px] mkt-muted">
            Charting begins once daily snapshots accrue (updates every day at 00:05 UTC).
          </div>
        )}
      </div>

      <div className="mt-6">
        <div className="mb-3 text-lg font-black">Items <span className="mkt-muted text-sm font-semibold">({items.length})</span></div>
        {items.length === 0 ? <Empty label="No items in this collection yet." /> : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {items.map((n) => (
              <Link key={n.id} to="/nft/explore" className="mkt-card">
                <Media src={n.image_url} className="aspect-square w-full" />
                <div className="flex items-center justify-between gap-2 p-3">
                  <span className="flex items-center gap-1 truncate text-[13px] font-bold">{n.is_flagged_duplicate && <AlertTriangle className="h-3 w-3 shrink-0 text-[hsl(var(--og-blood))]" aria-label="Possible copy" />}{n.name}</span>
                  <RarityBadge tier={n.rarity_tier} rank={n.rarity_rank} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: any; label: string; value: React.ReactNode; tone?: "lime" | "gold" }) {
  const color = tone === "lime" ? "text-[hsl(var(--og-lime))]" : tone === "gold" ? "text-[hsl(var(--og-gold))]" : "";
  return (
    <div className="mkt-panel p-4">
      <div className="flex items-center gap-1.5 mkt-mono text-[10px] uppercase tracking-widest mkt-muted"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className={`mt-1 text-lg font-black ${color}`}>{value}</div>
    </div>
  );
}
