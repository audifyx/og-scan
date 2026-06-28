import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Megaphone, ExternalLink, Loader2, TrendingUp, Wallet2, Clock } from "lucide-react";
import { supaSelect, SUPABASE_ANON_KEY } from "../lib/supa";

interface Callout {
  id: string | number;
  type?: "token" | "wallet" | string;
  address?: string;
  symbol?: string;
  name?: string;
  note?: string;
  username?: string;
  avatar?: string;
  created_at?: string;
}

function timeAgo(iso?: string): string {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
const short = (a?: string) => (a && a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a || "");

export default function Callouts() {
  const [rows, setRows] = useState<Callout[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let on = true;
    supaSelect<Callout>("callouts", "select=*&order=created_at.desc&limit=60")
      .then((d) => { if (on) { setRows(d || []); setLoading(false); } })
      .catch(() => { if (on) { setErr(true); setLoading(false); } });
    return () => { on = false; };
  }, []);

  return (
    <div className="mx-auto max-w-[900px] space-y-5 px-4 py-6">
      <div className="flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-accent" />
        <h1 className="font-display text-2xl font-black text-white">Callouts</h1>
      </div>
      <p className="-mt-2 text-sm text-muted">
        Live token and wallet callouts from the community. Tap any token to run an OG Scan.
      </p>

      {loading ? (
        <div className="grid place-items-center py-20 text-muted"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : !SUPABASE_ANON_KEY ? (
        <div className="rounded-xl border border-line bg-panel2/60 p-6 text-sm text-muted">
          Callouts feed needs <span className="font-mono text-white">VITE_SUPABASE_ANON_KEY</span> in the OG Dex build env.
        </div>
      ) : err || rows.length === 0 ? (
        <div className="rounded-xl border border-line bg-panel2/60 p-8 text-center text-sm text-muted">
          <Bell className="mx-auto mb-2 h-6 w-6 text-muted/60" />
          No callouts yet. Be the first to make one.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((c) => {
            const isToken = (c.type || "token") === "token";
            return (
              <div key={c.id} className="rounded-2xl border border-line bg-panel2/60 p-4 transition hover:border-accent/40">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg border ${isToken ? "border-up/30 bg-up/10 text-up" : "border-accent/30 bg-accent/10 text-accent"}`}>
                      {isToken ? <TrendingUp className="h-4 w-4" /> : <Wallet2 className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-white">
                        {c.symbol || c.name || short(c.address)}
                      </div>
                      <div className="truncate font-mono text-[11px] text-muted">{short(c.address)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-muted shrink-0">
                    <Clock className="h-3 w-3" /> {timeAgo(c.created_at)}
                  </div>
                </div>
                {c.note && <p className="mt-2 text-[13px] leading-relaxed text-white/80">{c.note}</p>}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] text-muted">by <span className="text-white/70">{c.username || "anon"}</span></span>
                  {isToken && c.address && (
                    <Link to={`/token/${c.address}`} className="inline-flex items-center gap-1 text-[12px] font-bold text-accent hover:brightness-110">
                      OG Scan <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
