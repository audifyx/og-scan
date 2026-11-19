import { useState } from "react";
import { Copy, Check } from "lucide-react";
export default function Copyable({ text, display, className = "" }: { text: string; display?: string; className?: string }) {
  const [c, setC] = useState(false);
  return (
    <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text); setC(true); setTimeout(() => setC(false), 1200); }}
      className={`inline-flex items-center gap-1 hover:text-accent transition-colors ${className}`} title="Copy to clipboard">
      <span className="font-mono">{display ?? text}</span>
      {c ? <Check className="w-3 h-3 text-up" /> : <Copy className="w-3 h-3 opacity-60" />}
    </button>
  );
}
