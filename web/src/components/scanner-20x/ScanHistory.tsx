/**
 * ScanHistory — Global Forensics Feed
 * Every scan run by any user is saved to Supabase (public.scan_history) and
 * shown here as a shared, global feed. Tagging / notes / delete are limited to
 * the scans you created.
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { History, Search, Star, AlertTriangle, ShieldCheck, MessageSquare, Trash2, Clock, ChevronDown, ChevronUp, Copy, Check, Globe, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { shortAddr, fmtUsd } from "@/lib/og";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { trackActivity } from "@/lib/trackActivity";

interface ScanEntry {
  id: string;
  userId: string | null;
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

const MAX_HISTORY = 120;
const SCAN_SAVED_EVENT = "ogscan:scan-saved";

const tagConfig = {
  safe: { color: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300", icon: ShieldCheck, label: "Safe" },
  avoid: { color: "border-red-400/40 bg-red-500/10 text-red-400", icon: AlertTriangle, label: "Avoid" },
  watch: { color: "border-amber-400/40 bg-amber-500/10 text-amber-300", icon: Star, label: "Watch" },
};

// In-memory guard so the same mint isn't inserted repeatedly within a short window.
const recentInserts = new Map<string, number>();

/** Add a scan to the global history (Supabase). Fire-and-forget. */
export function addToScanHistory(entry: Omit<ScanEntry, "id" | "userId" | "scannedAt" | "tag" | "note">) {
  if (!entry.mint) return;
  const now = Date.now();
  const last = recentInserts.get(entry.mint);
  if (last && now - last < 300_000) return; // 5 min dedupe
  recentInserts.set(entry.mint, now);

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
        tag: null,
        note: "",
      },
    }).then(({ error }) => {
      if (!error && typeof window !== "undefined") window.dispatchEvent(new Event(SCAN_SAVED_EVENT));
    });
    trackActivity({
      user_id: data.user.id,
      activity_type: "scanner.scan",
      title: `Scanned ${entry.symbol || entry.name || "token"}`,
      description: entry.mint,
      data: { mint: entry.mint, symbol: entry.symbol, name: entry.name, rugScore: entry.rugScore, marketCap: entry.marketCap },
      is_public: true,
    });
  });
}

function rowToEntry(r: any): ScanEntry {
  return {
    id: r.id,
    userId: r.user_id ?? null,
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
  };
}

export const ScanHistory: React.FC<Props> = ({ onSelectMint, currentMint }) => {
  const { user } = useAuth();
  const [history, setHistory] = useState<ScanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchGlobal = useCallback(() => {
    supabase
      .from("scan_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(MAX_HISTORY)
      .then(({ data }) => {
        if (data) setHistory(data.map(rowToEntry));
        setLoading(false);
      });
  }, []);

  // Load global feed on mount, refresh on save + on a light interval
  useEffect(() => {
    fetchGlobal();
    const onSaved = () => fetchGlobal();
    window.addEventListener(SCAN_SAVED_EVENT, onSaved);
    const interval = window.setInterval(fetchGlobal, 30_000);
    return () => {
      window.removeEventListener(SCAN_SAVED_EVENT, onSaved);
      window.clearInterval(interval);
    };
  }, [fetchGlobal]);

  const filtered = useMemo(() => {
    let items = history;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(h => h.symbol.toLowerCase().includes(q) || h.name.toLowerCase().includes(q) || h.mint.toLowerCase().includes(q) || h.note.toLowerCase().includes(q));
    }
    if (filterTag) items = items.filter(h => h.tag === filterTag);
    return items;
  }, [history, searchQuery, filterTag]);

  const owns = (e: ScanEntry) => !!user && e.userId === user.id;

  const persist = (id: string, patch: Partial<ScanEntry>) => {
    setHistory(prev => {
      const next = prev.map(h => h.id === id ? { ...h, ...patch } : h);
      const entry = next.find(h => h.id === id);
      if (entry && owns(entry)) {
        supabase.from("scan_history").update({
          scan_result: { tag: entry.tag, note: entry.note, liquidity: entry.liquidity, marketCap: entry.marketCap, holders: entry.holders, priceAtScan: entry.priceAtScan },
        }).eq("id", id).then(() => {});
      }
      return next;
    });
  };

  const updateTag = (entry: ScanEntry, tag: ScanEntry["tag"]) => {
    if (!owns(entry)) { toast.error("You can only tag your own scans"); return; }
    persist(entry.id, { tag: entry.tag === tag ? null : tag });
  };

  const updateNote = (entry: ScanEntry, note: string) => {
    persist(entry.id, { note });
    setEditingNote(null);
  };

  const deleteEntry = (entry: ScanEntry) => {
    if (!owns(entry)) { toast.error("You can only delete your own scans"); return; }
    setHistory(prev => prev.filter(h => h.id !== entry.id));
    supabase.from("scan_history").delete().eq("id", entry.id).then(() => {});
  };

  const copyMint = (mint: string, id: string) => {
    navigator.clipboard.writeText(mint);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const safeCount = history.filter(h => h.tag === "safe").length;
  const avoidCount = history.filter(h => h.tag === "avoid").length;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
      {/* Header */}
      <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-white/[0.02]">
        <div className="grid h-10 w-10 flex-none place-items-center rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-300">
          <Globe className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-sm font-bold text-white">Scan History</span>
          <p className="text-[11px] text-white/30">{loading ? "Loading…" : `${history.length} scans`} · Global feed from all users</p>
        </div>
        <div className="flex items-center gap-2">
          {safeCount > 0 && <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-300">{safeCount} safe</span>}
          {avoidCount > 0 && <span className="rounded-full border border-red-400/30 bg-red-500/10 px-2 py-0.5 text-[9px] font-bold text-red-400">{avoidCount} avoid</span>}
          {expanded ? <ChevronUp className="h-4 w-4 text-white/30" /> : <ChevronDown className="h-4 w-4 text-white/30" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.06]">
          {/* Search + filters */}
          <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.04] p-3">
            <div className="relative min-w-[180px] flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
              <input
                placeholder="Search global history…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-9 pr-3 text-xs text-white placeholder:text-white/25 focus:border-emerald-400/50 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5">
              {(["safe", "avoid", "watch"] as const).map(tag => (
                <button
                  key={tag}
                  onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                  className={cn("rounded-full border px-2.5 py-1 text-[10px] font-bold transition", filterTag === tag ? tagConfig[tag].color : "border-white/10 bg-white/[0.02] text-white/35 hover:text-white/55")}
                >
                  {tagConfig[tag].label}
                </button>
              ))}
            </div>
          </div>

          {/* Entries */}
          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="grid place-items-center p-10 text-emerald-300/70"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <History className="mx-auto mb-2 h-8 w-8 text-white/15" />
                <p className="text-xs text-white/30">{searchQuery || filterTag ? "No matching scans" : "No scans yet"}</p>
                <p className="mt-1 text-[10px] text-white/15">Scans run by anyone will appear here</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {filtered.slice(0, 60).map(entry => {
                  const mine = owns(entry);
                  return (
                    <div key={entry.id} className={cn("p-3 transition hover:bg-white/[0.02]", entry.mint === currentMint && "bg-emerald-500/[0.05]")}>
                      <div className="mb-1 flex items-center gap-2">
                        <button onClick={() => onSelectMint?.(entry.mint)} className="text-xs font-bold text-white transition hover:text-emerald-300">${entry.symbol}</button>
                        <span className="truncate text-[10px] text-white/25">{entry.name || shortAddr(entry.mint, 4)}</span>
                        <button onClick={() => copyMint(entry.mint, entry.id)} className="text-white/20 hover:text-white/40">
                          {copiedId === entry.id ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5" />}
                        </button>
                        {mine && <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-emerald-300">you</span>}
                        {entry.tag && <span className={cn("rounded-full border px-1.5 py-0.5 text-[8px] font-bold", tagConfig[entry.tag].color)}>{tagConfig[entry.tag].label}</span>}
                        <span className="ml-auto text-[9px] text-white/20"><Clock className="mr-0.5 inline h-2.5 w-2.5" />{new Date(entry.scannedAt).toLocaleDateString()} {new Date(entry.scannedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>

                      <div className="mb-1.5 flex flex-wrap items-center gap-3">
                        {entry.rugScore !== null && <span className={cn("text-[10px] font-bold", entry.rugScore <= 30 ? "text-emerald-400" : entry.rugScore <= 60 ? "text-amber-400" : "text-red-400")}>Risk: {entry.rugScore}</span>}
                        {entry.liquidity !== null && <span className="text-[10px] text-white/30">LP: {fmtUsd(entry.liquidity)}</span>}
                        {entry.marketCap !== null && <span className="text-[10px] text-white/30">MC: {fmtUsd(entry.marketCap)}</span>}
                        {entry.holders !== null && <span className="text-[10px] text-white/25">Holders: {entry.holders.toLocaleString()}</span>}
                      </div>

                      {editingNote === entry.id ? (
                        <div className="mt-1 flex items-center gap-1.5">
                          <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note…" autoFocus onKeyDown={e => e.key === "Enter" && updateNote(entry, noteText)} className="h-7 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-[11px] text-white placeholder:text-white/25 focus:border-emerald-400/50 focus:outline-none" />
                          <button onClick={() => updateNote(entry, noteText)} className="text-[10px] font-bold text-emerald-300">Save</button>
                          <button onClick={() => setEditingNote(null)} className="text-[10px] text-white/30">Cancel</button>
                        </div>
                      ) : entry.note ? (
                        <button onClick={() => { if (mine) { setEditingNote(entry.id); setNoteText(entry.note); } }} className="mt-0.5 text-[10px] italic text-white/35 hover:text-white/55">📝 {entry.note}</button>
                      ) : null}

                      {mine && (
                        <div className="mt-2 flex items-center gap-1">
                          {(["safe", "avoid", "watch"] as const).map(tag => {
                            const Icon = tagConfig[tag].icon;
                            return (
                              <button key={tag} onClick={() => updateTag(entry, tag)} className={cn("rounded-md border px-1.5 py-0.5 text-[9px] font-medium transition", entry.tag === tag ? tagConfig[tag].color : "border-white/[0.06] text-white/25 hover:text-white/45")}>
                                <Icon className="mr-0.5 inline h-2.5 w-2.5" />{tagConfig[tag].label}
                              </button>
                            );
                          })}
                          <button onClick={() => { setEditingNote(entry.id); setNoteText(entry.note || ""); }} className="rounded-md border border-white/[0.06] px-1.5 py-0.5 text-[9px] font-medium text-white/25 transition hover:text-white/45">
                            <MessageSquare className="mr-0.5 inline h-2.5 w-2.5" />Note
                          </button>
                          <button onClick={() => deleteEntry(entry)} className="ml-auto rounded-md border border-white/[0.06] px-1.5 py-0.5 text-[9px] font-medium text-white/25 transition hover:border-red-400/30 hover:text-red-400">
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanHistory;
