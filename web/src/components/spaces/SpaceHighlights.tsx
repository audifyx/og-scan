/**
 * SpaceHighlights — Mark key moments during a live space.
 * Host/co-hosts can add timestamped highlight labels that appear as chapters in replay.
 * Also allows creating short "clips" from highlighted moments.
 */
import React, { useState, useEffect } from "react";
import { Bookmark, Plus, Clock, Scissors, Share2, Copy, ChevronUp, Loader2, Trash2, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface Highlight {
  id: string;
  space_id: string;
  label: string;
  timestamp_seconds: number;
  created_by: string;
  created_at: string;
}

interface SpaceHighlightsProps {
  spaceId: string;
  startedAt: string; // ISO string of when space started
  isHost: boolean;
  isCoHost?: boolean;
  isLive: boolean;
}

const fmtTs = (sec: number): string => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const SpaceHighlights: React.FC<SpaceHighlightsProps> = ({ spaceId, startedAt, isHost, isCoHost, isLive }) => {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [addLabel, setAddLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [showClip, setShowClip] = useState<string | null>(null);

  // Fetch + subscribe
  useEffect(() => {
    const fetchHL = async () => {
      const { data } = await supabase.from("space_highlights")
        .select("*").eq("space_id", spaceId).order("timestamp_seconds", { ascending: true });
      if (data) setHighlights(data as Highlight[]);
    };
    fetchHL();

    const channel = supabase.channel(`hl-${spaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "space_highlights", filter: `space_id=eq.${spaceId}` },
        (payload) => {
          if (payload.eventType === "INSERT") setHighlights(prev => [...prev, payload.new as Highlight].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds));
          else if (payload.eventType === "DELETE") setHighlights(prev => prev.filter(h => h.id !== (payload.old as any).id));
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [spaceId]);

  const addHighlight = async () => {
    if (!addLabel.trim()) return;
    setAdding(true);
    const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    await supabase.from("space_highlights").insert({
      space_id: spaceId,
      label: addLabel.trim(),
      timestamp_seconds: elapsed,
      created_by: "host",
    });
    setAddLabel("");
    setAdding(false);
  };

  const removeHighlight = async (id: string) => {
    await supabase.from("space_highlights").delete().eq("id", id);
  };

  const shareClip = (hl: Highlight) => {
    const url = `${window.location.origin}/listen/${spaceId}?t=${hl.timestamp_seconds}`;
    navigator.clipboard.writeText(url);
  };

  const canEdit = isHost || isCoHost;
  const QUICK_LABELS = ["🔥 Key point", "💡 Alpha", "📢 Announcement", "😂 Funny moment", "🎯 Call-out"];

  return (
    <div className="space-y-2">
      {/* Header */}
      <button onClick={() => setExpanded(!expanded)} className="flex items-center justify-between w-full px-1">
        <div className="flex items-center gap-2">
          <Bookmark className="h-3.5 w-3.5 text-orange-400" />
          <span className="text-[11px] font-bold text-white/50">
            {isLive ? "Highlights" : "Chapters"}
          </span>
          {highlights.length > 0 && (
            <span className="text-[9px] font-bold text-orange-400 px-1.5 py-0.5 rounded-full bg-orange-500/10">{highlights.length}</span>
          )}
        </div>
        <ChevronUp className={cn("h-3 w-3 text-white/20 transition-transform", !expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="space-y-2">
          {/* Add highlight (live mode, host/co-host only) */}
          {isLive && canEdit && (
            <div className="space-y-2">
              {/* Quick label buttons */}
              <div className="flex gap-1 flex-wrap">
                {QUICK_LABELS.map(label => (
                  <button key={label} onClick={() => setAddLabel(label)}
                    className={cn(
                      "px-2 py-1 rounded-lg text-[9px] font-bold transition-all border",
                      addLabel === label
                        ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                        : "bg-white/[0.03] text-white/20 border-white/[0.06] hover:bg-white/[0.05]"
                    )}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex gap-1.5">
                <input value={addLabel} onChange={e => setAddLabel(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addHighlight()}
                  placeholder="Highlight label..."
                  className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[11px] text-white placeholder:text-white/15 focus:outline-none focus:border-orange-500/20" />
                <button onClick={addHighlight} disabled={adding || !addLabel.trim()}
                  className="px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 disabled:opacity-30 transition-all flex items-center gap-1 text-[10px] font-bold">
                  {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Bookmark className="h-3 w-3" /> Mark</>}
                </button>
              </div>
            </div>
          )}

          {/* Highlights list */}
          <div className="space-y-1">
            {highlights.map((hl, idx) => (
              <div key={hl.id} className="group flex items-center gap-2 p-2 rounded-lg border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.02] transition-colors">
                {/* Timeline dot */}
                <div className="flex flex-col items-center shrink-0">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    idx === highlights.length - 1 ? "bg-orange-400" : "bg-white/15"
                  )} />
                  {idx < highlights.length - 1 && <div className="w-px h-4 bg-white/[0.06]" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-white/60 font-medium truncate">{hl.label}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Clock className="h-2.5 w-2.5 text-white/15" />
                    <span className="text-[9px] text-white/20 font-mono">{fmtTs(hl.timestamp_seconds)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => shareClip(hl)}
                    className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/20 hover:text-white/50 transition-all" title="Copy clip link">
                    <Share2 className="h-2.5 w-2.5" />
                  </button>
                  {canEdit && (
                    <button onClick={() => removeHighlight(hl.id)}
                      className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all" title="Remove">
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {highlights.length === 0 && (
              <div className="text-center py-4">
                <Sparkles className="h-5 w-5 mx-auto text-white/[0.06] mb-1" />
                <p className="text-[10px] text-white/15">{isLive ? "Mark key moments as they happen" : "No highlights saved"}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SpaceHighlights;
