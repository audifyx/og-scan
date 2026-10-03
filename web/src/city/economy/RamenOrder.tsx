/**
 * OrbitX City — Ramen House ordering.
 *
 * Order at the counter: pay real ORBITX via burnPurchase(), get a 60s buff
 * (speed boost or glow trail) or instant CITY points. Receipt on every order.
 */
import { useState } from "react";
import { Soup, X, Zap, Sparkles, Clover } from "lucide-react";
import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";
import { burnPurchase, burnReason } from "@/tokenomics/burnFlow";
import { useCityWallet } from "./useCityWallet";
import ReceiptModal, { type ReceiptRow } from "./ReceiptModal";
import { addCityPoints } from "../cityState";
import "./economy.css";

export type RamenBuff = "speed" | "glow" | "lucky";

interface RamenItem {
  id: string;
  name: string;
  desc: string;
  price: number;
  buff: RamenBuff;
  icon: typeof Zap;
}

const MENU: RamenItem[] = [
  {
    id: "ramen-speed", name: "Turbo Tonkotsu", desc: "+35% move speed for 60s",
    price: 25, buff: "speed", icon: Zap,
  },
  {
    id: "ramen-glow", name: "Neon Miso", desc: "Cyan glow trail for 60s",
    price: 40, buff: "glow", icon: Sparkles,
  },
  {
    id: "ramen-lucky", name: "Lucky Shoyu", desc: "+50 CITY points, instant",
    price: 60, buff: "lucky", icon: Clover,
  },
];

export default function RamenOrder({
  onClose,
  onBuff,
}: {
  onClose: () => void;
  onBuff: (buff: RamenBuff) => void;
}) {
  const billing = useOrbitxBilling();
  const wallet = useCityWallet();
  const [ordering, setOrdering] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ signature: string; rows: ReceiptRow[]; buff: RamenBuff } | null>(null);

  async function order(item: RamenItem) {
    if (ordering || !wallet.connected) return;
    setError(null);
    setOrdering(item.id);
    try {
      const res = await burnPurchase(billing, {
        amount: item.price,
        itemId: item.id,
        label: `${item.name} — Ramen House`,
        reason: burnReason("ramen", "order", item.id),
        module: "ramen",
      });
      if (res.ok && !res.dryRun) {
        if (item.buff === "lucky") addCityPoints(50);
        onBuff(item.buff);
        setReceipt({
          signature: res.signature,
          buff: item.buff,
          rows: [
            { label: "Dish", value: item.name },
            { label: "Burned", value: `${item.price} ORBITX` },
            { label: "Effect", value: item.desc },
          ],
        });
      } else if (res.ok && res.dryRun) {
        setError("Verification mode is on — no real burn was made.");
      } else {
        setError(res.message);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Order failed.");
    } finally {
      setOrdering(null);
    }
  }

  return (
    <div className="oxe-overlay" role="dialog" aria-modal="true" aria-label="Ramen House">
      <div className="oxe-sheet">
        <div className="oxe-sheet-head">
          <div className="oxe-sheet-title">
            <Soup className="oxe-ic" />
            <div>
              <div className="oxe-t1">RAMEN HOUSE</div>
              <div className="oxe-t2">Real ORBITX burns · buffs last 60s</div>
            </div>
          </div>
          <button className="oxe-x" onClick={onClose} aria-label="Close ramen menu">
            <X />
          </button>
        </div>

        {!wallet.connected && (
          <p className="oxe-err">Connect your wallet to order.</p>
        )}
        {MENU.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.id} className="oxe-arcade-row oxe-menu-row">
              <span><Icon size={15} /> <b>{item.name}</b><br /><small className="dim">{item.desc}</small></span>
              <button
                className="oxe-btn oxe-btn-primary"
                disabled={!wallet.connected || ordering !== null}
                onClick={() => order(item)}
              >
                {ordering === item.id ? "…" : `${item.price} ORX`}
              </button>
            </div>
          );
        })}
        {error && <p className="oxe-err">{error}</p>}
      </div>
      {receipt && (
        <ReceiptModal
          title={`${MENU.find((m) => m.buff === receipt.buff)?.name} served`}
          subtitle="Itadakimasu!"
          rows={receipt.rows}
          signature={receipt.signature}
          onClose={() => setReceipt(null)}
        />
      )}
    </div>
  );
}
