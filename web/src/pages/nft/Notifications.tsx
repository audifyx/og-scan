// OrbitX NFT Marketplace — notifications (Phase 2). Wallet-scoped.
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { listNotifications } from "./social";
import { SectionHeader, Empty } from "./_ui";
import { timeAgo } from "./nftMarketData";
import { Bell } from "lucide-react";

export default function Notifications() {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58();
  const { data } = useQuery({ queryKey: ["nftmkt-notifs", wallet], enabled: !!wallet, queryFn: () => listNotifications(wallet!) });
  const items = data ?? [];
  if (!wallet) return <div><SectionHeader title="Notifications" /><Empty label="Connect your wallet to see notifications." /></div>;
  return (
    <div>
      <SectionHeader title="Notifications" sub="Drops, offers, sales, and follows for your wallet" />
      {items.length === 0 ? <Empty label="You're all caught up." /> : (
        <div className="mkt-panel divide-y divide-[hsl(var(--mkt-line))]">
          {items.map((n) => (
            <div key={n.id} className="flex items-start gap-3 px-4 py-3">
              <Bell className={`mt-0.5 h-4 w-4 ${n.read ? "mkt-muted" : "text-[hsl(var(--og-cyan))]"}`} />
              <div className="min-w-0 flex-1"><div className="text-sm">{n.body}</div><div className="mkt-mono text-[11px] mkt-muted">{timeAgo(n.created_at)} ago</div></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
