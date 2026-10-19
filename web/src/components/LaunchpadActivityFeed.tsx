/**
 * LaunchpadActivityFeed — real-time feed of recent token launches.
 * Self-contained: polls Supabase every 30s, flashes NEW on fresh entries.
 * Compact sidebar-style layout; drop it beside the feed or use standalone.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface ActivityToken {
  mint: string;
  name: string;
  symbol: string;
  image_url: string | null;
  creator_username: string | null;
  created_at: string;
}

const POLL_MS = 30_000;
const MAX_ITEMS = 20;

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function LaunchpadActivityFeed() {
  const [tokens, setTokens] = useState<ActivityToken[]>([]);
  const [newMints, setNewMints] = useState<Set<string>>(new Set());
  const knownMints = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from("launchpad_tokens")
        .select("mint,name,symbol,image_url,creator_username,created_at")
        .order("created_at", { ascending: false })
        .limit(MAX_ITEMS);
      if (cancelled) return;
      const rows = (data || []) as ActivityToken[];

      if (firstLoad.current) {
        // Seed known set without flashing on the first load
        knownMints.current = new Set(rows.map((r) => r.mint));
        firstLoad.current = false;
        setTokens(rows);
        return;
      }

      const fresh = rows.filter((r) => !knownMints.current.has(r.mint));
      if (fresh.length > 0) {
        knownMints.current = new Set(rows.map((r) => r.mint));
        setTokens(rows);
        setNewMints((prev) => new Set([...prev, ...fresh.map((r) => r.mint)]));
        // Clear the NEW flash after 8s
        setTimeout(() => {
          if (cancelled) return;
          setNewMints((prev) => {
            const next = new Set(prev);
            fresh.forEach((r) => next.delete(r.mint));
            return next;
          });
        }, 8000);
      } else {
        setTokens(rows);
      }
    };

    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <>
      <style>{`
        @keyframes lp-activity-flash {
          0% { background-color: rgba(34, 197, 94, 0.18); }
          100% { background-color: transparent; }
        }
        .lp-activity-new {
          animation: lp-activity-flash 1.2s ease-out 3;
        }
        @keyframes lp-live-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
        .lp-live-dot {
          animation: lp-live-pulse 1.6s ease-in-out infinite;
        }
      `}</style>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="lp-live-dot h-2 w-2 rounded-full bg-green-400" />
            <h3 className="text-sm font-bold tracking-wide">Live launches</h3>
          </div>
          <Link
            to="/launchpad/live"
            className="text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline"
          >
            View all →
          </Link>
        </div>

        {/* Items */}
        {tokens.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-white/40">
            No launches yet — be the first via the MCP
          </div>
        ) : (
          <ul className="max-h-[420px] divide-y divide-white/5 overflow-y-auto">
            {tokens.map((t) => (
              <li
                key={t.mint}
                className={newMints.has(t.mint) ? "lp-activity-new" : undefined}
              >
                <Link
                  to={`/launchpad/token/${t.mint}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.04]"
                >
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-blue-800 to-purple-800">
                    {t.image_url ? (
                      <img
                        src={t.image_url}
                        alt={t.symbol}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-black text-white/60">
                        {t.symbol.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      <span className="font-bold text-white/90">
                        {t.creator_username || "Someone"}
                      </span>{" "}
                      <span className="text-white/50">launched</span>{" "}
                      <span className="font-bold text-blue-300">${t.symbol}</span>
                      {newMints.has(t.mint) && (
                        <span className="ml-2 rounded-full bg-green-500/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-green-300">
                          New
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-white/30">{t.name}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-white/30">
                    {timeAgo(t.created_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
