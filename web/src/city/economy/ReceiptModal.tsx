/**
 * OrbitX City — on-chain receipt modal.
 * Every real on-chain action (buy, burn, swap, launch) ends here with the
 * tx signature and a Solscan link. Dark glass, cyan/gold, 44px+ targets.
 */
import { CheckCircle2, ExternalLink, X } from "lucide-react";

export interface ReceiptRow {
  label: string;
  value: string;
}

export interface ReceiptLink {
  label: string;
  href: string;
}

export function solscanTxLink(signature: string): string {
  return `https://solscan.io/tx/${signature}`;
}

export function solscanAddressLink(address: string): string {
  return `https://solscan.io/address/${address}`;
}

export default function ReceiptModal({
  title,
  subtitle,
  rows,
  signature,
  links,
  onClose,
}: {
  title: string;
  subtitle?: string;
  rows: ReceiptRow[];
  signature: string;
  links?: ReceiptLink[];
  onClose: () => void;
}) {
  const short = signature.length > 20 ? `${signature.slice(0, 8)}…${signature.slice(-8)}` : signature;
  return (
    <div className="oxe-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="oxe-sheet">
        <div className="oxe-sheet-head">
          <div className="oxe-sheet-title">
            <CheckCircle2 className="oxe-ic" />
            <div>
              <div className="oxe-t1">{title}</div>
              {subtitle && <div className="oxe-t2">{subtitle}</div>}
            </div>
          </div>
          <button className="oxe-x" onClick={onClose} aria-label="Close receipt">
            <X />
          </button>
        </div>

        <div className="oxe-rows">
          {rows.map((r) => (
            <div key={r.label} className="oxe-row">
              <span className="oxe-row-k">{r.label}</span>
              <span className="oxe-row-v">{r.value}</span>
            </div>
          ))}
          <div className="oxe-row">
            <span className="oxe-row-k">Signature</span>
            <span className="oxe-row-v oxe-mono">{short}</span>
          </div>
        </div>

        <div className="oxe-actions">
          <a
            className="oxe-btn oxe-btn-primary"
            href={solscanTxLink(signature)}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="oxe-ic-sm" /> View on Solscan
          </a>
          {(links ?? []).map((l) => (
            <a key={l.href} className="oxe-btn" href={l.href} target="_blank" rel="noreferrer">
              <ExternalLink className="oxe-ic-sm" /> {l.label}
            </a>
          ))}
          <button className="oxe-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
