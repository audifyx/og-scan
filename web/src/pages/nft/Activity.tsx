// OrbitX NFT Marketplace — global activity feed (real settled sales).
import { useRecentSales, fmtSol, timeAgo, shortAddr } from "./nftMarketData";
import { Media, SectionHeader, Empty } from "./_ui";
import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";

export default function Activity() {
  const { data, isLoading } = useRecentSales(60);
  const sales = data ?? [];
  return (
    <div>
      <SectionHeader title="Activity" sub="Live sales settled on-chain across OrbitX" />
      {isLoading ? <div className="px-4 py-10 text-center text-sm mkt-muted">Loading…</div> :
        sales.length === 0 ? <Empty label="No activity yet." /> : (
        <div className="mkt-panel overflow-hidden">
          <div className="grid grid-cols-[1fr_90px_120px] items-center gap-2 border-b mkt-hairline px-4 py-2.5 text-[10px] font-black uppercase tracking-widest mkt-muted sm:grid-cols-[24px_1fr_110px_140px_100px]">
            <span className="hidden sm:block">Event</span><span>Item</span><span className="text-right">Price</span>
            <span className="hidden text-right sm:block">Buyer</span><span className="text-right">Time</span>
          </div>
          {sales.map((s) => (
            <div key={s.id} className="mkt-row grid grid-cols-[1fr_90px_120px] items-center gap-2 border-b mkt-hairline px-4 py-3 text-sm last:border-0 sm:grid-cols-[24px_1fr_110px_140px_100px]">
              <ShoppingCart className="hidden h-4 w-4 text-[hsl(var(--og-lime))] sm:block" />
              <Link to="/nft/explore" className="flex min-w-0 items-center gap-3">
                <Media src={s.nft?.image_url} className="h-9 w-9 rounded-lg" />
                <span className="truncate font-semibold">{s.nft?.name ?? "NFT"}</span>
              </Link>
              <span className="text-right mkt-mono font-bold text-[hsl(var(--og-lime))]">{fmtSol(s.amount_sol)}</span>
              <span className="hidden text-right mkt-mono text-[12px] mkt-muted sm:block">{shortAddr(s.buyer_wallet)}</span>
              <span className="text-right mkt-mono text-[12px] mkt-muted">{timeAgo(s.created_at)} ago</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
