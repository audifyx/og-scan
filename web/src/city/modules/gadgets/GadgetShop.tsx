/**
 * OrbitXCity — Gadget shop UI.
 *
 * Browse and buy gadgets. Every purchase burns real ORBITX through the
 * injected billing provider (backend-signed, no wallet popups). The game never
 * custodies keys.
 *
 * The integrator injects `billing` — normally `useOrbitxBilling()` from
 * `@/tokenomics/*` once the tokenomics team ships it (see
 * `web/src/city/BILLING_CONTRACT.md`). Until then, pass `null` and the shop
 * renders an "auth required" state instead of a broken buy button.
 */
import { useState } from "react";
import { GADGET_CATALOG, catalogBurnTotal } from "./catalog";
import { useGadgetInventory } from "./store";
import type { GadgetBillingProvider, GadgetId } from "./types";

export interface GadgetShopProps {
  /** Billing provider injected by the integrator. Null = not available yet. */
  billing: GadgetBillingProvider | null;
  onClose: () => void;
}

function makeRef(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `gadget-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }
}

export function GadgetShop({ billing, onClose }: GadgetShopProps) {
  const { owned, equipped, burns, owns, recordPurchase, equip, totalBurned } =
    useGadgetInventory();
  const [buying, setBuying] = useState<GadgetId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canBuy = billing !== null && billing.ready;

  async function buy(id: GadgetId) {
    if (!billing || !billing.ready || buying) return;
    const item = GADGET_CATALOG.find((g) => g.id === id);
    if (!item || owns(id)) return;
    setBuying(id);
    setError(null);
    const ref = makeRef();
    try {
      const { signature } = await billing.spend({
        amount: item.priceOrbitx,
        reason: `city:gadget:${id}`,
        ref,
      });
      recordPurchase(id, {
        at: Date.now(),
        gadgetId: id,
        gadgetLabel: item.label,
        amount: item.priceOrbitx,
        signature,
        ref,
      });
      equip(id); // auto-equip the new toy
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Purchase failed. Your ORBITX was not burned.",
      );
    } finally {
      setBuying(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Gadget shop"
    >
      <div
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-cyan-400/20 bg-[#0a0f1a]/95 p-5 shadow-[0_0_60px_rgba(34,211,238,0.15)] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="mb-1 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-white">
              🛠️ Gadget Shop
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Every purchase <span className="text-orange-400 font-semibold">burns ORBITX</span> —
              full catalog burns {catalogBurnTotal()} ORBITX.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close shop"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300 active:scale-95"
          >
            ✕
          </button>
        </div>

        {/* wallet strip */}
        <div className="mb-4 mt-3 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5">
          <div className="text-xs text-slate-400">
            ORBITX balance
            <div className="text-base font-bold text-white">
              {billing?.balance == null ? "—" : `${billing.balance.toLocaleString()} ORBITX`}
            </div>
          </div>
          <div className="text-right text-xs text-slate-400">
            Burned on gadgets
            <div className="text-base font-bold text-orange-400">
              {totalBurned.toLocaleString()} ORBITX
            </div>
          </div>
        </div>

        {!canBuy && (
          <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm">
            <p className="font-semibold text-amber-300">🔐 Wallet auth required</p>
            <p className="mt-1 text-xs text-amber-200/80">
              {billing === null
                ? "Gadget purchases go live once the ORBITX billing rail ships. Your progress is saved locally."
                : "Connect your wallet once to enable one-tap gadget purchases (backend-signed burns, no popups)."}
            </p>
            {billing !== null && !billing.ready && (
              <button
                onClick={billing.beginAuth}
                className="mt-3 w-full rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-black active:scale-[0.98]"
              >
                Connect wallet
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-2xl border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* catalog */}
        <div className="space-y-3">
          {GADGET_CATALOG.map((item) => {
            const isOwned = owns(item.id);
            const isEquipped = equipped === item.id;
            const isBuying = buying === item.id;
            return (
              <div
                key={item.id}
                className={`rounded-2xl border p-4 transition ${
                  isEquipped
                    ? "border-cyan-400/60 bg-cyan-400/10"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-3xl">{item.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white">{item.label}</h3>
                      {isEquipped && (
                        <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                          EQUIPPED
                        </span>
                      )}
                      {isOwned && !isEquipped && (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                          OWNED
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-cyan-300/90">{item.tagline}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">
                      {item.description}
                    </p>
                    <p className="mt-1.5 text-[11px] text-slate-500">🎮 {item.controls}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="text-sm font-extrabold text-orange-400">
                    🔥 {item.priceOrbitx} ORBITX
                  </div>
                  {isOwned ? (
                    <button
                      onClick={() => equip(isEquipped ? null : item.id)}
                      className={`rounded-xl px-4 py-2 text-sm font-bold active:scale-[0.98] ${
                        isEquipped
                          ? "border border-white/15 bg-white/5 text-slate-300"
                          : "bg-cyan-400 text-black"
                      }`}
                    >
                      {isEquipped ? "Unequip" : "Equip"}
                    </button>
                  ) : (
                    <button
                      onClick={() => buy(item.id)}
                      disabled={!canBuy || isBuying}
                      className={`rounded-xl px-4 py-2 text-sm font-bold active:scale-[0.98] disabled:opacity-40 ${
                        canBuy ? "bg-orange-500 text-black" : "bg-white/10 text-slate-400"
                      }`}
                    >
                      {isBuying ? "Burning…" : `Buy — burn ${item.priceOrbitx}`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* burn receipts */}
        {burns.length > 0 && (
          <details className="mt-4 text-xs text-slate-400">
            <summary className="cursor-pointer font-semibold text-slate-300">
              🧾 Burn receipts ({burns.length})
            </summary>
            <ul className="mt-2 space-y-1.5">
              {burns.slice().reverse().map((b) => (
                <li
                  key={b.ref}
                  className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2"
                >
                  <span className="font-semibold text-white">{b.gadgetLabel}</span> —{" "}
                  <span className="text-orange-400">{b.amount} ORBITX</span>
                  <div className="mt-0.5 break-all font-mono text-[10px] text-slate-500">
                    {b.signature}
                  </div>
                </li>
              ))}
            </ul>
          </details>
        )}

        <p className="mt-4 text-center text-[10px] text-slate-600">
          Gadgets are burned, not spent — every purchase permanently reduces ORBITX supply.
        </p>
      </div>
    </div>
  );
}
