import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchKols, fetchSignals } from "../api/client";

type AlertRow = {
  id: string;
  title: string;
  detail: string;
  mint?: string;
  wallet?: string;
  tone: "good" | "warn" | "bad";
};

function asArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of ["signals", "alerts", "kols", "data", "items", "wallets"]) {
      if (Array.isArray(o[k])) return o[k] as unknown[];
    }
  }
  return [];
}

export default function WhaleIntel() {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sig, kol] = await Promise.all([
          fetchSignals().catch(() => ({})),
          fetchKols().catch(() => ({})),
        ]);
        if (cancelled) return;
        const rows: AlertRow[] = [];

        for (const s of asArray(sig)) {
          const o = s as Record<string, unknown>;
          rows.push({
            id: String(o.id || o.mint || Math.random()),
            title: String(o.title || o.type || o.signal || "Smart-money signal"),
            detail: String(o.note || o.description || o.summary || "Live signal feed"),
            mint: typeof o.mint === "string" ? o.mint : undefined,
            wallet: typeof o.wallet === "string" ? o.wallet : typeof o.address === "string" ? o.address : undefined,
            tone: (o.side === "sell" || o.tone === "bad" ? "bad" : o.tone === "warn" ? "warn" : "good") as AlertRow["tone"],
          });
        }

        for (const k of asArray(kol)) {
          const o = k as Record<string, unknown>;
          rows.push({
            id: `kol-${String(o.wallet || o.address || o.handle || Math.random())}`,
            title: String(o.handle || o.name || "Tracked wallet"),
            detail: String(o.note || o.bio || `Win rate / focus: ${o.winRate ?? o.focus ?? "smart money"}`),
            wallet: typeof o.wallet === "string" ? o.wallet : typeof o.address === "string" ? o.address : undefined,
            mint: typeof o.lastMint === "string" ? o.lastMint : undefined,
            tone: "warn",
          });
        }

        if (rows.length === 0) {
          rows.push(
            {
              id: "demo-1",
              title: "Whale accumulation watch",
              detail: "Connect signals feed — large wallet clusters buying thin-liq mints will surface here.",
              tone: "warn",
            },
            {
              id: "demo-2",
              title: "Smart money desk",
              detail: "KOL / trader wallets from /api/ogdex/kols appear as trackable entities.",
              tone: "good",
            },
          );
        }

        setAlerts(rows.slice(0, 40));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <header className="oxc-hero">
        <h1>Whale & smart money</h1>
        <p>Alerts and tracked wallets — concentration moves, KOL activity, and high-conviction flow.</p>
      </header>

      <div className="oxc-panel">
        {loading && <p className="oxc-empty oxc-pulse">Loading alerts…</p>}
        {error && <p style={{ color: "var(--oxc-red)" }}>{error}</p>}
        <div className="oxc-grid" style={{ gap: "0.75rem" }}>
          {alerts.map((a) => (
            <div
              key={a.id}
              style={{
                border: "1px solid var(--oxc-line)",
                borderRadius: 6,
                padding: "0.85rem 1rem",
                background: "var(--oxc-bg-elev)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{a.title}</div>
                  <p className="oxc-muted" style={{ margin: "0.35rem 0 0", fontSize: "0.82rem" }}>
                    {a.detail}
                  </p>
                </div>
                <span className={`oxc-badge oxc-tone-${a.tone === "bad" ? "bad" : a.tone === "warn" ? "warn" : "good"}`}>
                  {a.tone}
                </span>
              </div>
              <div style={{ marginTop: "0.55rem", display: "flex", gap: "0.75rem", fontSize: "0.8rem" }}>
                {a.mint && (
                  <Link className="oxc-link" to={`/intel/scan/${a.mint}`}>
                    Scan mint
                  </Link>
                )}
                {a.wallet && (
                  <Link className="oxc-link" to={`/intel/wallet/${a.wallet}`}>
                    Track wallet
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
