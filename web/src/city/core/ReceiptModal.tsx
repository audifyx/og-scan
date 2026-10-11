import { X, ExternalLink } from "lucide-react";

export interface ReceiptRow {
  label: string;
  value: string;
}

interface Props {
  title: string;
  subtitle: string;
  rows: ReceiptRow[];
  signature: string;
  onClose: () => void;
}

export default function ReceiptModal({ title, subtitle, rows, signature, onClose }: Props) {
  const solscan = `https://solscan.io/tx/${signature}`;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 p-6 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold">{title}</h3>
            <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between text-sm">
              <span className="text-zinc-400">{r.label}</span>
              <span className="font-medium">{r.value}</span>
            </div>
          ))}
        </div>
        <a
          href={solscan}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300"
        >
          <ExternalLink size={14} />
          <span className="truncate font-mono text-xs">{signature.slice(0, 24)}…</span>
        </a>
        <button
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-emerald-500 py-3 font-bold text-black hover:bg-emerald-400"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
