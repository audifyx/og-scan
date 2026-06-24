import { useState, ReactNode } from "react";
import { ChevronDown } from "lucide-react";

// Dropdown / accordion section for organizing dense data cleanly.
export default function Collapsible({ title, icon, defaultOpen = true, right, children }: { title: string; icon?: ReactNode; defaultOpen?: boolean; right?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold hover:bg-panel2/40 transition-colors">
        {icon}<span>{title}</span>
        <span className="ml-auto flex items-center gap-2">{right}<ChevronDown className={`w-4 h-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} /></span>
      </button>
      {open && <div className="px-4 pb-4 pt-1 border-t border-line">{children}</div>}
    </div>
  );
}
