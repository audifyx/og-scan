import { useEffect, useMemo, useState } from "react";
import { Share2, Bell, BellRing, Flame, Gem, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtUsdShort } from "./TokenWidgets";

const ORBITX_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
const ALERT_KEY = "orbitx-price-alert-v1";

/** Share / shill button. */
export function ShareButton({ price, change, mcap }: { price: number | null | undefined; change: number | null | undefined; mcap: number | null | undefined }) {
  const [done, setDone] = useState(false);
  const text = useMemo(() => {
    const p = price != null && price > 0 ? (price < 0.0001 ? price.toExponential(2) : price.toFixed(6)) : "?";
    const c = change != null ? `${change >= 0 ? "+" : ""}${change.toFixed(1)}%` : "?";
    return `ORBITX $${p} (${c} 24h) · MCAP ${fmtUsdShort(mcap)} · the token with a living 3D city 🚀 orbitx.world/token`;
  }, [price, change, mcap]);

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "ORBITX", text, url: "https://www.orbitx.world/token" });
      } else {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }
    } catch { /* dismissed */ }
  };

  return (
    <button
      onClick={share}
      className="flex items-center gap-1.5 rounded-full border border-teal-300/25 bg-teal-400/10 px-3.5 py-2 text-xs font-bold text-teal-200 transition hover:bg-teal-400/20 active:scale-95"
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
      {done ? "Copied!" : "Shill"}
    </button>
  );
}

interface Alert { target: number; dir: "above" | "below"; hit: boolean; }

/** Price alerts with localStorage persistence. */
export function PriceAlerts({ price }: { price: number | null | undefined }) {
  const [alert, setAlert] = useState<Alert | null>(null);
  const [input, setInput] = useState("");
  const [justHit, setJustHit] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ALERT_KEY);
      if (raw) setAlert(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!alert || alert.hit || price == null) return;
    const hit = alert.dir === "above" ? price >= alert.target : price <= alert.target;
    if (hit) {
      const next = { ...alert, hit: true };
      setAlert(next);
      setJustHit(true);
      try { localStorage.setItem(ALERT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      setTimeout(() => setJustHit(false), 8000);
    }
  }, [price, alert]);

  const fmtT = (p: number) => (p < 0.0001 ? p.toExponential(2) : p.toFixed(6));

  const save = (dir: "above" | "below") => {
    const t = parseFloat(input);
    if (!isFinite(t) || t <= 0) return;
    const next = { target: t, dir, hit: false };
    setAlert(next);
    setInput("");
    try { localStorage.setItem(ALERT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const clear = () => {
    setAlert(null);
    try { localStorage.removeItem(ALERT_KEY); } catch { /* ignore */ }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300">
          {alert && !alert.hit ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        </span>
        <div>
          <p className="text-sm font-extrabold">Price alerts</p>
          <p className="text-[11px] text-white/45">Get notified right here when ORBITX moves</p>
        </div>
      </div>

      {justHit && alert && (
        <div className="mt-3 animate-pulse rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-3 text-center">
          <p className="text-sm font-extrabold text-emerald-300">🎯 Alert hit! ORBITX {alert.dir === "above" ? "broke above" : "dipped below"} ${fmtT(alert.target)}</p>
        </div>
      )}

      {alert && !alert.hit ? (
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/[0.04] px-3 py-2.5">
          <p className="text-xs font-semibold text-white/70">
            Watching for <span className="text-amber-300">${fmtT(alert.target)}</span> {alert.dir === "above" ? "▲" : "▼"}
          </p>
          <button onClick={clear} className="text-xs font-bold text-white/40 hover:text-white/70">Cancel</button>
        </div>
      ) : !justHit && (
        <div className="mt-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Target price (e.g. 0.00002)"
            inputMode="decimal"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-teal-300/40 focus:outline-none"
          />
          <button onClick={() => save("above")} className="rounded-xl bg-emerald-400/15 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-400/25">▲ Above</button>
          <button onClick={() => save("below")} className="rounded-xl bg-rose-400/15 px-3 py-2 text-xs font-bold text-rose-300 hover:bg-rose-400/25">▼ Below</button>
        </div>
      )}
      {alert?.hit && !justHit && (
        <button onClick={clear} className="mt-3 w-full rounded-xl border border-white/10 py-2 text-xs font-bold text-white/50 hover:text-white/80">
          Set a new alert
        </button>
      )}
    </div>
  );
}

/** Tokenomics supply breakdown bars. */
export function TokenomicsBars({ burned, supply }: { burned: number | null; supply: number | null }) {
  const INITIAL = 1_000_000_000;
  const b = burned ?? 0;
  const circ = supply ?? INITIAL - b;
  const lpEst = circ * 0.08; // rough LP estimate
  const total = b + circ;
  const rows = [
    { label: "Burned forever", value: b, pct: total > 0 ? (b / total) * 100 : 0, color: "from-orange-500 to-red-500", icon: Flame },
    { label: "Circulating", value: circ, pct: total > 0 ? (circ / total) * 100 : 0, color: "from-teal-400 to-cyan-400", icon: Gem },
    { label: "In liquidity (est)", value: lpEst, pct: total > 0 ? (lpEst / total) * 100 : 0, color: "from-violet-400 to-purple-500", icon: null },
  ];
  const fmtT = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${(n / 1_000).toFixed(0)}k`);
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-sm font-extrabold">Tokenomics</p>
      <p className="text-[11px] text-white/45">1B fixed supply · every burn is permanent</p>
      <div className="mt-3 space-y-2.5">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 font-semibold text-white/60">
                {r.icon && <r.icon className="h-3 w-3" />}{r.label}
              </span>
              <span className="font-bold text-white/85">{fmtT(r.value)} · {r.pct.toFixed(1)}%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/8">
              <div className={cn("h-full rounded-full bg-gradient-to-r transition-[width] duration-1000", r.color)} style={{ width: `${Math.max(2, r.pct)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Diamond hands — days since first visit. */
export function DiamondHands() {
  const [days, setDays] = useState(0);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("orbitx-avatar-memory-v1");
      if (raw) {
        const first = JSON.parse(raw).firstSeen ?? Date.now();
        setDays(Math.floor((Date.now() - first) / 86400000));
      }
    } catch { /* ignore */ }
  }, []);
  const tier = days >= 30 ? { n: "DIAMOND", c: "text-cyan-300", e: "💎" } : days >= 7 ? { n: "GOLD", c: "text-amber-300", e: "🥇" } : days >= 1 ? { n: "SILVER", c: "text-slate-300", e: "🥈" } : { n: "ROOKIE", c: "text-white/50", e: "🌱" };
  return (
    <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <span className="text-3xl">{tier.e}</span>
      <div>
        <p className={cn("text-sm font-extrabold", tier.c)}>{tier.n} HANDS</p>
        <p className="text-[11px] text-white/45">{days === 0 ? "First day in orbit — welcome" : `${days} day${days === 1 ? "" : "s"} watching Orbit grow`}</p>
      </div>
    </div>
  );
}
