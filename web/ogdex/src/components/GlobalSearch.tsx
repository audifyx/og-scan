import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Loader2, TrendingUp, Wallet2, ArrowRight } from "lucide-react";
import { fmtUsd, compact } from "../lib/api";

const isAddr = (v: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v.trim()) || /^0x[0-9a-fA-F]{40}$/.test(v.trim());

interface SearchResult {
  mint: string;
  name: string | null;
  symbol: string | null;
  icon: string | null;
  priceUsd: number | null;
  mcap: number | null;
  change24h: number | null;
  chain: string;
}

let debounceTimer: ReturnType<typeof setTimeout>;

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  // ── ⌘K / Ctrl+K global shortcut ──────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Click outside to close ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  // ── Debounced search ──────────────────────────────────────────────────────
  useEffect(() => {
    const v = q.trim();
    if (!v) { setResults([]); setLoading(false); return; }
    setLoading(true);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/ogdex/search?q=${encodeURIComponent(v)}`);
        const d = await r.json();
        setResults((d.rows || []).slice(0, 8));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => clearTimeout(debounceTimer);
  }, [q]);

  const close = () => { setOpen(false); setQ(""); setResults([]); setCursor(-1); };

  const go = useCallback((result?: SearchResult) => {
    const v = q.trim();
    if (result) {
      nav(`/token/${result.mint}`);
    } else if (v) {
      if (isAddr(v)) nav(`/token/${v}`);
      else if (results.length > 0) nav(`/token/${results[0].mint}`);
      else nav(`/?q=${encodeURIComponent(v)}`);
    }
    close();
  }, [q, results, nav]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setCursor(c => Math.max(c - 1, -1)); }
    if (e.key === "Enter") { e.preventDefault(); cursor >= 0 ? go(results[cursor]) : go(); }
    if (e.key === "Escape") close();
  };

  const addr = isAddr(q.trim());

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Desktop trigger — inline in header */}
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="hidden md:flex items-center gap-2 w-56 lg:w-72 pl-3 pr-4 py-2 rounded-xl text-sm text-[#A8B3C2] transition-all"
        style={{ background: "rgba(0,255,163,0.06)", border: "1.5px solid rgba(0,255,163,0.18)" }}
      >
        <Search className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1 text-left">Search tokens, wallets…</span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.07)", color: "#A8B3C2" }}>⌘K</span>
      </button>

      {/* Mobile trigger — icon only */}
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl text-[#A8B3C2] hover:text-white transition-colors"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
        aria-label="Search"
      >
        <Search className="w-4 h-4" />
      </button>

      {/* ── Full-screen modal overlay ── */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col items-center" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}>
          <div ref={overlayRef} className="w-full max-w-2xl mx-4 mt-[10vh]">

            {/* Search input */}
            <div className="relative flex items-center rounded-2xl overflow-hidden"
              style={{ background: "#0B0C0C", border: "1.5px solid rgba(0,255,163,0.4)", boxShadow: "0 0 40px rgba(0,255,163,0.2)" }}>
              <Search className="w-5 h-5 absolute left-4 text-[#00FFA3] pointer-events-none" />
              <input
                ref={inputRef}
                value={q}
                onChange={e => { setQ(e.target.value); setCursor(-1); }}
                onKeyDown={onKey}
                placeholder="Search token name, symbol, or paste address…"
                autoComplete="off"
                spellCheck={false}
                className="w-full bg-transparent pl-12 pr-12 py-4 text-white text-base outline-none placeholder-[#A8B3C2]"
              />
              {loading && <Loader2 className="w-4 h-4 absolute right-10 text-[#00FFA3] animate-spin" />}
              <button onClick={close} className="absolute right-3 p-1.5 rounded-lg text-[#A8B3C2] hover:text-white hover:bg-white/10 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Results dropdown */}
            {(results.length > 0 || (q.trim() && !loading)) && (
              <div className="mt-2 rounded-2xl overflow-hidden"
                style={{ background: "#0B0C0C", border: "1px solid rgba(0,255,163,0.18)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>

                {results.length > 0 ? (
                  <>
                    <div className="px-4 py-2 border-b" style={{ borderColor: "rgba(0,255,163,0.1)" }}>
                      <span className="text-[10px] uppercase tracking-widest text-[#A8B3C2] font-bold">Tokens</span>
                    </div>
                    <div>
                      {results.map((r, i) => {
                        const pct = r.change24h ?? 0;
                        const isUp = pct >= 0;
                        return (
                          <button
                            key={r.mint}
                            onClick={() => go(r)}
                            onMouseEnter={() => setCursor(i)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:bg-white/5"
                            style={cursor === i ? { background: "rgba(0,255,163,0.1)" } : {}}
                          >
                            {/* Icon */}
                            <div className="w-9 h-9 rounded-full shrink-0 overflow-hidden flex items-center justify-center"
                              style={{ background: "rgba(0,255,163,0.12)" }}>
                              {r.icon
                                ? <img src={r.icon} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                : <TrendingUp className="w-4 h-4 text-[#00FFA3]" />}
                            </div>

                            {/* Name + symbol */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-white text-sm truncate">{r.symbol || r.name || r.mint.slice(0, 8)}</span>
                                {r.name && r.symbol && <span className="text-xs text-[#A8B3C2] truncate">{r.name}</span>}
                              </div>
                              <div className="text-[10px] text-[#A8B3C2] font-mono truncate">{r.mint.slice(0, 8)}…{r.mint.slice(-4)}</div>
                            </div>

                            {/* Price + change */}
                            <div className="text-right shrink-0">
                              {r.priceUsd != null && <div className="text-sm font-semibold text-white">{fmtUsd(r.priceUsd)}</div>}
                              {r.change24h != null && (
                                <div className={`text-[11px] font-bold ${isUp ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                                  {isUp ? "+" : ""}{pct.toFixed(2)}%
                                </div>
                              )}
                              {r.mcap != null && <div className="text-[10px] text-[#A8B3C2]">MCap {compact(r.mcap)}</div>}
                            </div>

                            <ArrowRight className="w-3.5 h-3.5 text-[#A8B3C2] shrink-0 ml-1" />
                          </button>
                        );
                      })}
                    </div>

                    {/* Wallet lookup shortcut if typed value looks like an address */}
                    {addr && (
                      <div className="border-t px-4 py-2" style={{ borderColor: "rgba(0,255,163,0.1)" }}>
                        <button
                          onClick={() => { nav(`/wallet/${q.trim()}`); close(); }}
                          className="flex items-center gap-2 text-xs text-[#A8B3C2] hover:text-white transition-colors"
                        >
                          <Wallet2 className="w-3.5 h-3.5" />
                          View as wallet instead
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="px-4 py-6 text-center text-sm text-[#A8B3C2]">
                    No results for <span className="text-white font-semibold">"{q}"</span>
                    {isAddr(q.trim()) && (
                      <div className="mt-2 flex gap-2 justify-center">
                        <button onClick={() => { nav(`/token/${q.trim()}`); close(); }} className="px-3 py-1 rounded-lg text-xs font-bold" style={{ background: "rgba(0,255,163,0.15)", color: "#00FFA3" }}>Open as Token</button>
                        <button onClick={() => { nav(`/wallet/${q.trim()}`); close(); }} className="px-3 py-1 rounded-lg text-xs font-bold" style={{ background: "rgba(255,255,255,0.07)", color: "#A8B3C2" }}>Open as Wallet</button>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer hint */}
                <div className="px-4 py-2 border-t flex items-center gap-3 text-[10px] text-[#A8B3C2]" style={{ borderColor: "rgba(0,255,163,0.1)" }}>
                  <span>↑↓ navigate</span>
                  <span>↵ open</span>
                  <span>Esc close</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
