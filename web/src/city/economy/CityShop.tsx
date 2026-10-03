/**
 * OrbitX City — in-game shop.
 *
 * Premium items are bought with ORBITX which is BURNED on-chain through the
 * canonical burnPurchase() flow: backend-signed desk-wallet burn
 * (orbitx_app_burn), no wallet popup, real signature, receipt with Solscan
 * link. Owned items persist per wallet in the city inventory.
 *
 * If the in-app billing isn't linked yet, the shop shows the one-time
 * "Link in-app wallet" action (dashboard auth-code flow) instead of prices.
 */
import { useState } from "react";
import { Flame, Lock, X } from "lucide-react";
import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";
import { burnPurchase, burnReason } from "@/tokenomics/burnFlow";
import { CITY_SHOP_ITEMS, type CityShopItem } from "./shopItems";
import { useCityInventory } from "./useCityInventory";
import { useCityWallet } from "./useCityWallet";
import ReceiptModal from "./ReceiptModal";
import "./economy.css";

type Receipt = { title: string; amount: string; signature: string } | null;

function ShopCard({
  item,
  owned,
  buying,
  billingReady,
  onBuy,
}: {
  item: CityShopItem;
  owned: boolean;
  buying: boolean;
  billingReady: boolean;
  onBuy: () => void;
}) {
  const free = item.priceOrbitx === 0;
  return (
    <div className={`oxe-card oxe-accent-${item.accent}`}>
      <div className="oxe-card-glyph" aria-hidden>
        {item.glyph}
      </div>
      <div className="oxe-card-name">{item.name}</div>
      <div className="oxe-card-blurb">{item.blurb}</div>
      <div className="oxe-card-foot">
        {owned || free ? (
          <span className="oxe-owned">{free ? "DEFAULT" : "OWNED"}</span>
        ) : !billingReady ? (
          <span className="oxe-locked">
            <Lock className="oxe-ic-sm" /> LINK WALLET
          </span>
        ) : (
          <button className="oxe-btn oxe-btn-burn" onClick={onBuy} disabled={buying}>
            <Flame className="oxe-ic-sm" />
            {buying ? "BURNING…" : `BURN ${item.priceOrbitx.toLocaleString()} ORBITX`}
          </button>
        )}
      </div>
    </div>
  );
}

export default function CityShop({ onClose }: { onClose: () => void }) {
  const billing = useOrbitxBilling();
  const wallet = useCityWallet();
  const { has, add } = useCityInventory(wallet.address);
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt>(null);

  async function buy(item: CityShopItem) {
    if (item.priceOrbitx === 0 || has(item.id) || buying) return;
    setError(null);
    setBuying(item.id);
    try {
      const res = await burnPurchase(billing, {
        amount: item.priceOrbitx,
        itemId: item.id,
        label: item.name,
        reason: burnReason("shop", "buy", item.id),
        module: "shop",
      });
      if (res.ok && !res.dryRun) {
        add(item.id);
        setReceipt({
          title: `${item.name} unlocked`,
          amount: `${item.priceOrbitx.toLocaleString()} ORBITX burned`,
          signature: res.signature,
        });
      } else if (res.ok && res.dryRun) {
        setError("Verification mode is on — no real burn was made, item not granted.");
      } else {
        setError(res.message);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Purchase failed.");
    } finally {
      setBuying(null);
    }
  }

  const groups: Array<{ kind: CityShopItem["kind"]; title: string }> = [
    { kind: "style", title: "TRADER STYLES" },
    { kind: "part", title: "PARTS" },
    { kind: "boost", title: "BOOSTS" },
  ];

  return (
    <div className="oxe-overlay" role="dialog" aria-modal="true" aria-label="City shop">
      <div className="oxe-sheet oxe-sheet-wide">
        <div className="oxe-sheet-head">
          <div className="oxe-sheet-title">
            <Flame className="oxe-ic" />
            <div>
              <div className="oxe-t1">CITY SHOP</div>
              <div className="oxe-t2">Premium items burn ORBITX — real on-chain</div>
            </div>
          </div>
          <button className="oxe-x" onClick={onClose} aria-label="Close shop">
            <X />
          </button>
        </div>

        {!billing.ready && (
          <div className="oxe-notice">
            <div className="oxe-notice-t">Link your in-app wallet to buy</div>
            <div className="oxe-notice-s">
              One-time dashboard link. After that, burns are seamless — no popups.
            </div>
            <button
              className="oxe-btn oxe-btn-primary"
              onClick={() => billing.beginAuth()}
            >
              Link in-app wallet
            </button>
            {billing.error && <div className="oxe-err">{billing.error}</div>}
            {billing.balance !== null && (
              <div className="oxe-t2">In-app ORBITX: {billing.balance.toLocaleString()}</div>
            )}
          </div>
        )}

        {billing.ready && billing.balance !== null && (
          <div className="oxe-balancebar">
            In-app wallet ORBITX: <b>{billing.balance.toLocaleString()}</b>
          </div>
        )}

        {error && <div className="oxe-err oxe-err-block">{error}</div>}

        {groups.map((g) => (
          <div key={g.kind} className="oxe-group">
            <div className="oxe-group-t">{g.title}</div>
            <div className="oxe-grid">
              {CITY_SHOP_ITEMS.filter((i) => i.kind === g.kind).map((item) => (
                <ShopCard
                  key={item.id}
                  item={item}
                  owned={has(item.id)}
                  buying={buying === item.id}
                  billingReady={billing.ready}
                  onBuy={() => buy(item)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {receipt && (
        <ReceiptModal
          title={receipt.title}
          subtitle="Purchase complete — ORBITX burned on-chain"
          rows={[{ label: "Burned", value: receipt.amount }]}
          signature={receipt.signature}
          onClose={() => setReceipt(null)}
        />
      )}
    </div>
  );
}
