/**
 * ScanHistory — Personal Forensics Journal
 * Saves every scan, lets users search back through history,
 * add notes, tag tokens as safe/avoid.
 */
import { useState, useEffect, useMemo } from "react";
import { History, Search, Star, AlertTriangle, Shield, ShieldCheck, MessageSquare, Trash2, Clock, ChevronDown, ChevronUp, Filter, X, Tag, ExternalLink, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { shortAddr, fmtUsd } from "@/lib/og";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { trackActivity } from "@/lib/trackActivity";

interface ScanEntry {
  id: string;
  mint: string;
  symbol: string;
  name: string;
  scannedAt: string;
  rugScore: number | null;
  liquidity: number | null;
  marketCap: number | null;
  holders: number | null;
  tag: "safe" | "avoid" | "watch" | null;
  note: string;
  priceAtScan: number | null;
}

interface Props {
  onSelectMint?: (mint: string) => void;
  currentMint?: string;
}

const STORAGE_KEY = "ogscan_scan_history";
const MAX_HISTORY = 200;

const tagConfig = {
  safe: { color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: ShieldCheck, label: "Safe" },
  avoid: { color: "bg-red-500/10 text-red-400 border-red-500/20", icon: AlertTriangle, label: "Avoid" },
  watch: { color: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: Star, label: "Watch" },
};

function loadHistory(): ScanEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(entries: ScanEntry[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY))); } catch {}
}

/** Add a scan to history — writes to both localStorage and Supabase */
export function addToScanHistory(entry: Omit<ScanEntry, "id" | "scannedAt" | "tag" | "note">) {
  const history = loadHistory();
  const id = crypto.randomUUID();
  const scannedAt = new Date().toISOString();
  // Dedupe: if same mint was scanned in last 5 minutes, update instead of add
  const recent = history.find(h => h.mint === entry.mint && (Date.now() - new Date(h.scannedAt).getTime()) < 300000);
  if (recent) {
    Object.assign(recent, entry, { scannedAt });
  } else {
    history.unshift({ ...entry, id, scannedAt, tag: null, note: "" });
  }
  saveHistory(history);

  // Also write to Supabase (async, fire-and-forget)
  supabase.auth.getUser().then(({ data }) => {
    if (!data?.user) return;
    supabase.from("scan_history").insert({
      user_id: data.user.id,
      mint: entry.mint,
      symbol: entry.symbol,
      name: entry.name,
      risk_score: entry.rugScore,
      scan_result: {
        liquidity: entry.liquidity,
        marketCap: entry.marketCap,
        holders: entry.holders,
        priceAtScan: entry.priceAtScan,
      },
    }).then(() => {});
    // Track scan activity
    trackActivity({
      user_id: data.user.id,
      activity_type: "scanner.scan",
      title: `Scanned ${entry.symbol || entry.name || "token"}`,
      description: entry.mint,
      data: {
        mint: entry.mint,
        symbol: entry.symbol,
        name: entry.name,
        rugScore: entry.rugScore,
        marketCap: entry.marketCap,
      },
      is_public: false,
    });
  });
}

export const ScanHistory: React.FC<Props> = ({ onSelectMint, currentMint }) => {
  const { user } = useAuth();
  const [history, setHistory] = useState<ScanEntry[]>(loadHistory);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load from Supabase on mount (if logged in)
  useEffect(() => {
    if (!user) return;
    supabase
      .from("scan_history")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(MAX_HISTORY)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const entries: ScanEntry[] = data.map((r: any) => ({
            id: r.id,
            mint: r.mint,
            symbol: r.symbol || "???",
            name: r.name || "",
            scannedAt: r.created_at,
            rugScore: r.risk_score,
            liquidity: r.scan_result?.liquidity ?? null,
            marketCap: r.scan_result?.marketCap ?? null,
            holders: r.scan_result?.holders ?? null,
            tag: r.scan_result?.tag ?? null,
            note: r.scan_result?.note ?? "",
            priceAtScan: r.scan_result?.priceAtScan ?? null,
          }));
          setHistory(entries);
          saveHistory(entries);
        }
      });
  }, [user?.id]);

  const filtered = useMemo(() => {
    let items = history;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(h =>
        h.symbol.toLowerCase().includes(q) ||
        h.name.toLowerCase().includes(q) ||
        h.mint.toLowerCase().includes(q) ||
        h.note.toLowerCase().includes(q)
      );
    }
    if (filterTag) {
      items = items.filter(h => h.tag === filterTag);
    }
    return items;
  }, [history, searchQuery, filterTag]);

  const updateTag = (id: string, tag: ScanEntry["tag"]) => {
    setHistory(prev => {
      const next = prev.map(h => h.id === id ? { ...h, tag: h.tag === tag ? null : tag } : h);
      saveHistory(next);
      // Persist tag to Supabase
      const entry = next.find(h => h.id === id);
      if (entry && user) {
        supabase.from("scan_history").update({
          scan_result: { tag: entry.tag, note: entry.note, liquidity: entry.liquidity, marketCap: entry.marketCap, holders: entry.holders, priceAtScan: entry.priceAtScan },
        }).eq("id", id).then(() => {});
      }
      return next;
    });
  };

  const updateNote = (id: string, note: string) => {
    setHistory(prev => {
      const next = prev.map(h => h.id === id ? { ...h, note } : h);
      saveHistory(next);
      const entry = next.find(h => h.id === id);
      if (entry && user) {
        supabase.from("scan_history").update({
          scan_result: { tag: entry.tag, note, liquidity: entry.liquidity, marketCap: entry.marketCap, holders: entry.holders, priceAtScan: entry.priceAtScan },
        }).eq("id", id).then(() => {});
      }
      return next;
    });
    setEditingNote(null);
  };

  const deleteEntry = (id: string) => {
    setHistory(prev => {
      const next = prev.filter(h => h.id !== id);
      saveHistory(next);
      return next;
    });
    if (user) supabase.from("scan_history").delete().eq("id", id).then(() => {});
  };

  const clearAll = () => {
    if (confirm("Clear all scan history?")) {
      setHistory([]);
      saveHistory([]);
      if (user) supabase.from("scan_history").delete().eq("user_id", user.id).then(() => {});
      toast.success("History cleared");
    }
  };

  const copyMint = (mint: string, id: string) => {
    navigator.clipboard.writeText(mint);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
          <History className="h-4 w-4 text-white/40" />
        </div>
        <div className="flex-1 text-left">
          <span className="text-sm font-bold text-white">Scan History</span>
          <p className="text-[11px] text-white/25">{history.length} scans saved · Your personal forensics journal</p>
        </div>
        <div className="flex items-center gap-2">
          {history.filter(h => h.tag === "safe").length > 0 && (
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px]">
              {history.filter(h => h.tag === "safe").length} safe
            </Badge>
          )}
          {history.filter(h => h.tag === "avoid").length > 0 && (
            <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[9px]">
              {history.filter(h => h.tag === "avoid").length} avoid
            </Badge>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-white/20" /> : <ChevronDown className="h-4 w-4 text-white/20" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.06]">
          {/* Search + Filters */}
          <div className="p-3 flex flex-wrap items-center gap-2 border-b border-white/[0.04]">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20" />
              <Input
                placeholder="Search history..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-white/[0.03] border-white/[0.06]"
              />
            </div>
            <div className="flex items-center gap-1">
              {(["safe", "avoid", "watch"] as const).map(tag => {
                const tc = tagConfig[tag];
                return (
                  <button
                    key={tag}
                    onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                    className={cn(
                      "px-2 py-1 rounded-lg border text-[10px] font-bold transition-all",
                      filterTag === tag ? tc.color : "bg-white/[0.02] border-white/[0.06] text-white/25 hover:border-white/[0.1]"
                    )}
                  >
                    {tc.label}
                  </button>
                );
              })}
            </div>
            {history.length > 0 && (
              <button onClick={clearAll} className="text-[10px] text-white/15 hover:text-red-400 transition-colors">
                Clear All
              </button>
            )}
          </div>

          {/* Entries */}
          <div className="max-h-[400px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-8 text-center">
                <History className="h-8 w-8 text-white/10 mx-auto mb-2" />
                <p className="text-xs text-white/20">{searchQuery || filterTag ? "No matching scans" : "No scans yet"}</p>
                <p className="text-[10px] text-white/10 mt-1">Scans you run will appear here</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {filtered.slice(0, 50).map(entry => (
                  <div
                    key={entry.id}
                    className={cn(
                      "p-3 hover:bg-white/[0.015] transition-colors",
                      entry.mint === currentMint && "bg-primary/5"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <button
                        onClick={() => onSelectMint?.(entry.mint)}
                        className="text-xs font-bold text-white hover:text-primary transition-colors"
                      >
                        {entry.symbol}
                      </button>
                      <span className="text-[10px] text-white/20">{entry.name}</span>
                      <button onClick={() => copyMint(entry.mint, entry.id)} className="text-white/15 hover:text-white/30">
                        {copiedId === entry.id ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5" />}
                      </button>
                      {entry.tag && (
                        <Badge className={cn("text-[8px]", tagConfig[entry.tag].color)}>
                          {tagConfig[entry.tag].label}
                        </Badge>
                      )}
                      <span className="text-[9px] text-white/15 ml-auto">
                        <Clock className="h-2.5 w-2.5 inline mr-0.5" />
                        {new Date(entry.scannedAt).toLocaleDateString()} {new Date(entry.scannedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    {/* Quick stats */}
                    <div className="flex items-center gap-3 mb-1.5">
                      {entry.rugScore !== null && (
                        <span className={cn("text-[10px] font-bold",
                          entry.rugScore <= 30 ? "text-emerald-400" : entry.rugScore <= 60 ? "text-amber-400" : "text-red-400"
                        )}>
                          Risk: {entry.rugScore}
                        </span>
                      )}
                      {entry.liquidity !== null && <span className="text-[10px] text-white/20">LP: {fmtUsd(entry.liquidity)}</span>}
                      {entry.holders !== null && <span className="text-[10px] text-white/15">Holders: {entry.holders.toLocaleString()}</span>}
                    </div>

                    {/* Note */}
                    {editingNote === entry.id ? (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Input
                          value={noteText}
                          onChange={e => setNoteText(e.target.value)}
                          placeholder="Add a note..."
                          className="h-7 text-[11px] bg-white/[0.03] border-white/[0.08] flex-1"
                          autoFocus
                          onKeyDown={e => e.key === "Enter" && updateNote(entry.id, noteText)}
                        />
                        <button onClick={() => updateNote(entry.id, noteText)} className="text-[10px] text-primary font-bold">Save</button>
                        <button onClick={() => setEditingNote(null)} className="text-[10px] text-white/20">Cancel</button>
                      </div>
                    ) : entry.note ? (
                      <button
                        onClick={() => { setEditingNote(entry.id); setNoteText(entry.note); }}
                        className="text-[10px] text-white/30 italic hover:text-white/50 mt-0.5"
                      >
                        📝 {entry.note}
                      </button>
                    ) : null}

                    {/* Actions */}
                    <div className="flex items-center gap-1 mt-2">
                      {(["safe", "avoid", "watch"] as const).map(tag => {
                        const tc = tagConfig[tag];
                        const Icon = tc.icon;
                        return (
                          <button
                            key={tag}
                            onClick={() => updateTag(entry.id, tag)}
                            className={cn(
                              "px-1.5 py-0.5 rounded text-[9px] font-medium border transition-all",
                              entry.tag === tag ? tc.color : "bg-transparent border-white/[0.04] text-white/15 hover:border-white/[0.1]"
                            )}
                          >
                            <Icon className="h-2.5 w-2.5 inline mr-0.5" />{tc.label}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => { setEditingNote(entry.id); setNoteText(entry.note || ""); }}
                        className="px-1.5 py-0.5 rounded text-[9px] font-medium border border-white/[0.04] text-white/15 hover:border-white/[0.1] transition-all"
                      >
                        <MessageSquare className="h-2.5 w-2.5 inline mr-0.5" />Note
                      </button>
                      <button
                        onClick={() => deleteEntry(entry.id)}
                        className="px-1.5 py-0.5 rounded text-[9px] font-medium border border-white/[0.04] text-white/15 hover:text-red-400 hover:border-red-500/20 transition-all ml-auto"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanHistory;
