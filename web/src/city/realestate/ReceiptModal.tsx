/**
 * OrbitX City — Real Estate receipt modal.
 *
 * Shown after every on-chain real estate action (buy, list, unlist, rent
 * claim). Carries the Solscan link so the player can verify the transaction
 * themselves — never trust, always verify.
 */

import React from "react";

export interface ReceiptLine {
  label: string;
  value: string;
  highlight?: boolean;
}

export interface ReceiptModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  lines: ReceiptLine[];
  /** Base58 transaction signature — renders the Solscan link. Omit for off-chain receipts. */
  signature?: string | null;
  note?: string;
}

export function ReceiptModal({ open, onClose, title, lines, signature, note }: ReceiptModalProps) {
  if (!open) return null;
  const solscan = signature ? `https://solscan.io/tx/${signature}` : null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.72)", display: "flex",
        alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(420px, 94vw)", borderRadius: 14, padding: 20,
          background: "linear-gradient(180deg, #101826 0%, #0a0f1a 100%)",
          border: "1px solid rgba(0,255,200,0.35)",
          boxShadow: "0 0 32px rgba(0,255,200,0.15)",
          color: "#e8f4ff", fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: "#00ffc8" }}>🧾 {title}</div>
          <button
            onClick={onClose}
            style={{
              background: "transparent", border: "1px solid #2a3a4d", color: "#9fb3c8",
              borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 13,
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
          {lines.map((l, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
              <span style={{ color: "#9fb3c8" }}>{l.label}</span>
              <span style={{ fontWeight: l.highlight ? 800 : 600, color: l.highlight ? "#ffd76a" : "#e8f4ff", textAlign: "right", wordBreak: "break-all" }}>
                {l.value}
              </span>
            </div>
          ))}
        </div>
        {solscan && (
          <a
            href={solscan}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "block", textAlign: "center", marginBottom: 10, padding: "10px 0",
              borderRadius: 10, background: "rgba(0,255,200,0.08)",
              border: "1px solid rgba(0,255,200,0.4)", color: "#00ffc8",
              fontWeight: 700, fontSize: 13, textDecoration: "none",
            }}
          >
            🔍 View on Solscan ↗
          </a>
        )}
        {note && <div style={{ fontSize: 12, color: "#8fa3b8", lineHeight: 1.5 }}>{note}</div>}
      </div>
    </div>
  );
}

export default ReceiptModal;
