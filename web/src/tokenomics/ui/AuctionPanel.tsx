/**
 * Generic auction panel (#18) — mount anywhere.
 * Bids burn immediately (losing bids burned by construction).
 */
import { useState } from "react";
import { useOrbitxBilling } from "../useOrbitxBilling";
import { useAuctions, type Auction } from "../auction";
import { BillingBanner } from "./BurnButton";
import { formatOrbitx } from "../constants";

function timeLeft(endsAt: number): string {
  const ms = Math.max(0, endsAt - Date.now());
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function AuctionPanel({ auctionId }: { auctionId?: string }): JSX.Element {
  const billing = useOrbitxBilling();
  const { auctions, placeBid, close } = useAuctions();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = auctionId ? auctions.filter((a) => a.id === auctionId) : auctions;

  const bid = async (auction: Auction) => {
    if (!billing.ready) {
      billing.beginAuth();
      return;
    }
    const n = Math.floor(Number(amounts[auction.id] || 0));
    if (!Number.isFinite(n) || n <= 0) {
      setError("Enter a bid amount.");
      return;
    }
    setBusy(auction.id);
    setError(null);
    try {
      await placeBid(billing.spend, auction.id, n, billing.wallet || "you");
      setAmounts((p) => ({ ...p, [auction.id]: "" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <BillingBanner compact />
      {list.length === 0 ? (
        <div style={{ fontSize: 13, color: "#6b7280" }}>No auctions live right now.</div>
      ) : null}
      {list.map((a) => {
        const top = a.bids.length ? Math.max(...a.bids.map((b) => b.amount)) : a.minBid;
        const closed = a.closed || Date.now() > a.endsAt;
        return (
          <div key={a.id} style={{ border: "1px solid #374151", borderRadius: 12, padding: 14, background: "#0b0f16" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontWeight: 700 }}>🔨 {a.title}</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>
                {closed ? (a.winner ? `Won by ${a.winner.slice(0, 8)}…` : "Closed") : `Ends in ${timeLeft(a.endsAt)}`}
              </div>
            </div>
            <div style={{ fontSize: 13, color: "#fbbf24", fontWeight: 700, marginBottom: 8 }}>
              Top bid: {formatOrbitx(top)} · {a.bids.length} bids · all bids burned
            </div>
            {!closed ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  value={amounts[a.id] || ""}
                  onChange={(e) => setAmounts((p) => ({ ...p, [a.id]: e.target.value.replace(/[^0-9]/g, "") }))}
                  inputMode="numeric" placeholder={`Min ${top + 1}`}
                  style={{ width: 120, padding: "8px 10px", borderRadius: 8, border: "1px solid #374151", background: "#030712", color: "#fff" }}
                  aria-label={`Bid amount for ${a.title}`}
                />
                <button type="button" disabled={!billing.ready || busy === a.id} onClick={() => bid(a)}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#b45309", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                  {busy === a.id ? "Burning…" : "Place bid (burns)"}
                </button>
                <button type="button" onClick={() => close(a.id)}
                  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #4b5563", background: "transparent", color: "#9ca3af", cursor: "pointer", fontSize: 12 }}>
                  Close
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
      {error ? <div style={{ fontSize: 12, color: "#f87171" }}>{error}</div> : null}
    </div>
  );
}
