/**
 * ORBITX bank — real on-chain ORBITX balances and premium spends.
 * Every purchase executes a backend-signed burn (buy-and-burn per tx).
 * No wallet popups, no key custody — auth happens once up front.
 */
import { useMemo, useState } from "react";
import { useCityBilling } from "../billing";
import type { OrbitxBillingProvider } from "../types";
import { BANK_CATALOG } from "../data/catalog";
import { formatTime, paperWallet } from "../store/paperWallet";

export function OrbitxBankPanel({ billing: provider }: { billing?: OrbitxBillingProvider }) {
  const billing = useCityBilling(provider);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSig, setLastSig] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const items = useMemo(
    () => (filter === "all" ? BANK_CATALOG : BANK_CATALOG.filter((i) => i.tag === filter)),
    [filter]
  );

  const buy = async (itemId: string) => {
    const item = BANK_CATALOG.find((i) => i.id === itemId);
    if (!item) return;
    setError(null);
    setLastSig(null);
    try {
      const { signature } = await billing.buyPremium(item.id, item.label, item.priceOrbitx);
      setLastSig(signature);
      setConfirmId(null);
      // Paper-side record of the premium purchase (linked burn, no CITY moved).
      paperWallet.adjust(0, `Premium unlocked: ${item.label} (burned ${item.priceOrbitx} ORBITX)`, "city-bank", {
        burnSignature: signature,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Purchase failed");
    }
  };

  if (!billing.providerConnected) {
    return (
      <div>
        <div className="ox-eco-balrow">
          <div className="ox-eco-balance">
            <div className="lbl">ORBITX balance</div>
            <div className="val cyan">—</div>
            <div className="sub">Billing primitive not connected yet.</div>
          </div>
        </div>
        <div className="ox-eco-note warn">
          The ORBITX bank needs the shared billing primitive
          (<code>@/tokenomics/useOrbitxBilling</code>). Until the tokenomics team
          ships it, premium purchases are unavailable and the city runs on paper
          CITY only. Every future purchase will burn — buy-and-burn per tx.
        </div>
      </div>
    );
  }

  if (!billing.ready) {
    return (
      <div>
        <div className="ox-eco-note warn">
          Link your wallet once to enable seamless ORBITX spends — no signing
          popups afterwards, every purchase burns.
        </div>
        <button className="ox-eco-btn" onClick={billing.beginAuth}>
          Link wallet
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="ox-eco-balrow">
        <div className="ox-eco-balance">
          <div className="lbl">ORBITX balance</div>
          <div className="val cyan">
            {billing.balance == null ? "…" : billing.balance.toLocaleString("en-US")} ORBITX
          </div>
          <div className="sub">On-chain · in-app wallet · every spend auto-burns 🔥</div>
        </div>
      </div>

      {error && <div className="ox-eco-status lose">{error}</div>}
      {lastSig && (
        <div className="ox-eco-status win">
          Burned on-chain.
          <div className="ox-eco-sig">{lastSig}</div>
        </div>
      )}

      <div className="ox-eco-tabs" style={{ padding: 0 }}>
        {["all", "vehicle", "property", "cosmetic", "utility", "event"].map((t) => (
          <button
            key={t}
            className={`ox-eco-tab ${filter === t ? "active" : ""}`}
            onClick={() => setFilter(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {items.map((item) => (
        <div className="ox-eco-item" key={item.id}>
          <div className="icon">{item.icon}</div>
          <div className="meta">
            <div className="name">{item.label}</div>
            <div className="desc">{item.description}</div>
            <div className="desc" style={{ marginTop: 4 }}>
              <b style={{ color: "#ffd166" }}>{item.priceOrbitx} ORBITX</b> · burned on purchase
            </div>
          </div>
          {confirmId === item.id ? (
            <div className="ox-eco-row">
              <button className="ox-eco-btn danger" disabled={billing.busy} onClick={() => buy(item.id)}>
                {billing.busy ? "Burning…" : `Burn ${item.priceOrbitx}`}
              </button>
              <button className="ox-eco-btn ghost" onClick={() => setConfirmId(null)}>
                ✕
              </button>
            </div>
          ) : (
            <button className="ox-eco-btn" onClick={() => setConfirmId(item.id)}>
              Buy
            </button>
          )}
        </div>
      ))}

      <div className="ox-eco-section-title">Burn history</div>
      <div className="ox-eco-ledger">
        {billing.burns.length === 0 && (
          <div className="ox-eco-note">No burns yet — your first purchase starts the engine.</div>
        )}
        {billing.burns.map((b) => (
          <div className="ox-eco-tx" key={b.ref}>
            <div>
              <div>🔥 {b.itemLabel}</div>
              <div className="meta">
                {formatTime(b.at)} · {b.amount} ORBITX
              </div>
              <div className="ox-eco-sig">{b.signature}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
