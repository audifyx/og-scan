import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, Loader2, RefreshCw, Activity, Zap, Globe } from "lucide-react";

interface ServiceStatus {
  name: string;
  ok: boolean;
  latencyMs?: number | null;
  status?: number | null;
  note?: string;
}

interface HealthData {
  ok: boolean;
  timestamp?: string;
  services?: ServiceStatus[];
  overall?: "operational" | "degraded" | "down";
  error?: string;
}

function StatusBadge({ ok, note }: { ok: boolean; note?: string }) {
  if (ok) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-up/10 text-up border border-up/25">
      <CheckCircle2 className="w-3 h-3" /> Operational
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-down/10 text-down border border-down/25">
      <XCircle className="w-3 h-3" /> {note || "Down"}
    </span>
  );
}

function Dot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${ok ? "bg-up" : "bg-down"} animate-pulse`} />
  );
}

export default function Status() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/ogdex/health")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLastChecked(new Date());
      })
      .catch(() => {
        setData({ ok: false, overall: "down", error: "Could not reach health endpoint" });
        setLastChecked(new Date());
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  const overall = data?.ok
    ? (data.services?.every((s) => s.ok) ? "operational" : data.services?.some((s) => s.ok) ? "degraded" : "down")
    : "down";

  const overallColor = overall === "operational" ? "text-up" : overall === "degraded" ? "text-accent" : "text-down";
  const overallBg = overall === "operational" ? "bg-up/10 border-up/25" : overall === "degraded" ? "bg-accent/10 border-accent/25" : "bg-down/10 border-down/25";

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white mb-5">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <div className="flex items-center gap-2.5 mb-1">
        <Activity className="w-5 h-5 text-accent" />
        <h1 className="text-2xl font-black tracking-tight">System Status</h1>
      </div>
      <p className="text-xs text-muted mb-6">Live status of OG DEX services. Auto-refreshes every 30 seconds.</p>

      {/* Overall Banner */}
      <div className={`card p-5 mb-5 flex items-center justify-between border ${overallBg}`}>
        <div className="flex items-center gap-3">
          <Dot ok={overall === "operational"} />
          <div>
            <div className={`text-lg font-black ${overallColor}`}>
              {overall === "operational" ? "All Systems Operational" : overall === "degraded" ? "Partial Outage" : "Service Disruption"}
            </div>
            <div className="text-xs text-muted mt-0.5">
              {lastChecked ? `Last checked ${lastChecked.toLocaleTimeString()}` : "Checking…"}
            </div>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="btn bg-panel2 text-muted hover:text-white"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Services */}
      {loading && !data ? (
        <div className="grid place-items-center py-16 text-muted">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {(data?.services?.length ? data.services : [
            { name: "Token Data", ok: data?.ok ?? false },
            { name: "Chart & OHLCV", ok: data?.ok ?? false },
            { name: "Forensics Engine", ok: data?.ok ?? false },
            { name: "AI Coin Chat", ok: data?.ok ?? false },
            { name: "Screener", ok: data?.ok ?? false },
            { name: "Alerts", ok: data?.ok ?? false },
          ]).map((svc, i) => (
            <div key={i} className="card p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Dot ok={svc.ok} />
                <div>
                  <div className="text-sm font-semibold text-white">{svc.name}</div>
                  {svc.note && <div className="text-[10px] text-muted">{svc.note}</div>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {svc.latencyMs != null && (
                  <span className={`text-[11px] font-mono ${svc.latencyMs < 500 ? "text-up" : svc.latencyMs < 1500 ? "text-accent" : "text-down"}`}>
                    {svc.latencyMs}ms
                  </span>
                )}
                <StatusBadge ok={svc.ok} note={svc.note} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Incident History Placeholder */}
      <div className="mt-8">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">Past 7 days</div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-up" />
            <span className="text-sm text-white/80 font-semibold">No incidents reported</span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 28 }).map((_, i) => (
              <div key={i} className="flex-1 h-8 rounded-sm bg-up/25" title="Operational" />
            ))}
          </div>
          <div className="flex justify-between text-[9px] text-muted mt-1">
            <span>7 days ago</span>
            <span>Today</span>
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <a href="https://t.me/ogupdates" target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-all">
          <Zap className="w-3.5 h-3.5" /> Updates Channel
        </a>
        <a href="https://t.me/ogscanner" target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-panel2 text-muted border border-line hover:text-white transition-all">
          <Globe className="w-3.5 h-3.5" /> Support
        </a>
      </div>
    </div>
  );
}
