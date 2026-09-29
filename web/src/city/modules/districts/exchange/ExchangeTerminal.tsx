/**
 * In-game trade terminal UI — opens when the player walks up to a kiosk in
 * the stock exchange interior. Paper trading on LIVE quotes, settled in
 * paper CITY. Mobile-friendly bottom-sheet style.
 */
import { useEffect, useMemo, useState } from "react";
import type { TokenQuote } from "../types";
import { paperWallet, executePaperTrade } from "./Exchange";

interface Props {
  open: boolean;
  onClose: () => void;
  quotes: TokenQuote[];
}

export default function ExchangeTerminal({ open, onClose, quotes }: Props) {
  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("100");
  const [msg, setMsg] = useState<string | null>(null);
  const [snap, setSnap] = useState(() => paperWallet.snapshot());

  useEffect(() => {
    if (!open) return;
    setMsg(null);
    return paperWallet.subscribe(() => setSnap(paperWallet.snapshot()));
  }, [open ]);

  useEffect(() => {
    if (quotes.length && !symbol) setSymbol(quotes[0].symbol);
  }, [quotes, symbol]);

  const selected = useMemo(
    () => quotes.find((q) => q.symbol === symbol),
    [quotes, symbol]
  );
  const equity = useMemo(() => paperWallet.equity(quotes), [quotes, snap]);

  if (!open) return null;

  const submit = () => {
    if (!selected) return;
    const r = executePaperTrade(selected, side, Number(amount) || 0);
    setMsg(r.message);
    setSnap(paperWallet.snapshot());
  };

  const positions = Object.values(snap.positions);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 60, display: "flex",
        alignItems: "flex-end", justifyContent: "center",
        background: "rgba(0,0,0,0.55)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 100%)", maxHeight: "88vh", overflowY: "auto",
          background: "#0b0f14", color: "#e8eef5", borderTop: "2px solid #22ff88",
          borderRadius: "14px 14px 0 0", padding: 16, fontFamily: "monospace",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: "#22ff88" }}>ORBITX EXCHANGE · TERMINAL</div>
          <button onClick={onClose} style={btn}>✕</button>
        </div>
        <div style={{ margin: "8px 0", fontSize: 13, opacity: 0.85 }}>
          Paper CITY: <b style={{ color: "#f5c518" }}>{Math.floor(snap.city).toLocaleString()}</b>
          {" · "}Equity: <b>{Math.floor(equity).toLocaleString()}</b>
          {" · "}Realized PnL: <b style={{ color: snap.realizedPnl >= 0 ? "#22ff88" : "#ff4455" }}>
            {snap.realizedPnl >= 0 ? "+" : ""}{snap.realizedPnl.toFixed(2)}
          </b>
          <span style={{ opacity: 0.6 }}> · paper only, no real funds</span>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)} style={field}>
            {quotes.map((q) => (
              <option key={q.symbol} value={q.symbol}>
                {q.symbol} · {q.price > 0 ? q.price.toFixed(q.price < 1 ? 5 : 2) : "—"} ({q.change24h >= 0 ? "+" : ""}{q.change24h.toFixed(1)}%)
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          {(["buy", "sell"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSide(s)}
              style={{
                ...btn, flex: 1, padding: 12, fontWeight: 800,
                background: side === s ? (s === "buy" ? "#0e5c2e" : "#6e1423") : "#182028",
                color: side === s ? "#fff" : "#9fb0c3",
              }}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={amount} onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal" placeholder="Amount (paper CITY)"
            style={{ ...field, flex: 1 }}
          />
          <button onClick={submit} style={{ ...btn, background: "#f5c518", color: "#111", fontWeight: 800, padding: "0 22px" }}>
            EXECUTE
          </button>
        </div>

        {msg && (
          <div style={{ marginTop: 10, padding: 8, background: "#141b24", borderRadius: 6, fontSize: 13 }}>
            {msg}
          </div>
        )}

        <div style={{ marginTop: 14, fontSize: 13 }}>
          <div style={{ fontWeight: 800, marginBottom: 6, color: "#9fb0c3" }}>POSITIONS</div>
          {positions.length === 0 && <div style={{ opacity: 0.5 }}>No open positions.</div>}
          {positions.map((p) => {
            const q = quotes.find((x) => x.symbol === p.symbol);
            const pnl = q ? paperWallet.positionPnl(p.symbol, q.price) : 0;
            return (
              <div key={p.symbol} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #182028" }}>
                <span><b>{p.symbol}</b> {p.qty.toFixed(4)} @ {p.avgPrice.toFixed(p.avgPrice < 1 ? 5 : 2)}</span>
                <span style={{ color: pnl >= 0 ? "#22ff88" : "#ff4455" }}>
                  {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  background: "#182028", color: "#e8eef5", border: "1px solid #2a3542",
  borderRadius: 8, padding: "8px 12px", cursor: "pointer",
};
const field: React.CSSProperties = {
  background: "#141b24", color: "#e8eef5", border: "1px solid #2a3542",
  borderRadius: 8, padding: "10px 12px", fontFamily: "monospace",
};
