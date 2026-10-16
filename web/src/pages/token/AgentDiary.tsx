import { Brain } from "lucide-react";

export type MemoryType = "whale" | "burn" | "ath" | "dip" | "milestone";

export interface AgentMemory {
  id: string;
  type: string;
  text: string;
  time: number;
  usd?: number;
}

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

const TYPE_DOT: Record<string, string> = {
  whale: "bg-blue-400",
  burn: "bg-orange-400",
  ath: "bg-green-400",
  dip: "bg-red-400",
  milestone: "bg-purple-400",
};

export function AgentDiary({ memories }: { memories: AgentMemory[] }) {
  const items = memories.slice(0, 8);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 border border-white/10">
          <Brain className="h-4 w-4 text-white/80" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Agent diary</h3>
          <p className="text-[11px] text-white/40">what the agents remember</p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <p className="text-[13px] text-white/40 italic">
            No memories yet — the agents are watching the chain.
          </p>
        ) : (
          items.map((m) => (
            <div key={m.id} className="flex items-start gap-2.5">
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TYPE_DOT[m.type] ?? "bg-white/30"}`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-white/85">{m.text}</p>
                <p className="text-[11px] text-white/40">{timeAgo(m.time)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default AgentDiary;
