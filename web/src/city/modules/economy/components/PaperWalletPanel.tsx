/** Paper CITY wallet panel — balance, earn/spend info, full ledger history. */
import { useState } from "react";
import { formatCity, formatTime, usePaperWallet } from "../store/paperWallet";

const KIND_LABEL: Record<string, string> = {
  earn: "Earned",
  spend: "Spent",
  wager: "Wagered",
  win: "Won",
  loss: "Lost",
  adjust: "Adjusted",
};

export function PaperWalletPanel() {
  const { wallet } = usePaperWallet();
  const [showAll, setShowAll] = useState(false);
  const entries = showAll ? wallet.ledger : wallet.ledger.slice(0, 12);

  return (
    <div>
      <div className="ox-eco-balrow">
        <div className="ox-eco-balance">
          <div className="lbl">CITY balance</div>
          <div className="val gold">{formatCity(wallet.balance)} CITY</div>
          <div className="sub">Paper coins — gameplay only, no chain, no cash value.</div>
        </div>
      </div>

      <div className="ox-eco-note">
        Earn CITY by playing: win the candle predictor, beat arcade games, complete
        city missions. Spend it on wagers and in-game perks. Premium upgrades live
        in the <b>ORBITX Bank</b> tab — those burn real ORBITX.
      </div>

      <div className="ox-eco-section-title">Transaction history</div>
      <div className="ox-eco-ledger">
        {entries.length === 0 && <div className="ox-eco-note">No transactions yet — go play.</div>}
        {entries.map((e) => (
          <div className="ox-eco-tx" key={e.id}>
            <div>
              <div>
                {KIND_LABEL[e.kind] ?? e.kind} — {e.label}
              </div>
              <div className="meta">
                {formatTime(e.at)} · {e.source}
                {e.burnSignature ? ` · burn ${e.burnSignature.slice(0, 8)}…` : ""}
              </div>
            </div>
            <div className={e.amount >= 0 ? "pos" : "neg"}>
              {e.amount >= 0 ? "+" : ""}
              {formatCity(e.amount)}
            </div>
          </div>
        ))}
      </div>
      {wallet.ledger.length > 12 && (
        <button className="ox-eco-btn ghost" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show less" : `Show all ${wallet.ledger.length}`}
        </button>
      )}
    </div>
  );
}
