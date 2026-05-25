/**
 * LaunchAlerts — Sound + Desktop notifications for launches matching filters.
 * Alert when new token has Twitter + LP > threshold.
 * Wired to: Jupiter trending API — polls every 30s for newly trending tokens.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, BellOff, Volume2, VolumeX, Filter, Plus, X, Check, Settings, Loader2, Zap, ExternalLink, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { jupTrending, fmtUsd, type JupTokenInfo } from "@/lib/og";

interface AlertFilter {
  id: string;
  name: string;
  minLp: number;
  requireTwitter: boolean;
  requireWebsite: boolean;
  requireLpLock: boolean;
  maxDevHolding: number;
  enabled: boolean;
}

interface AlertMatch {
  mint: string;
  symbol: string;
  name: string;
  logoURI?: string;
  liquidity: number;
  mcap: number;
  priceChange: number;
  matchedFilter: string;
  timestamp: string;
}

interface Props {
  onAlert?: (tokenMint: string) => void;
}

const STORAGE_KEY = "ogscan_launch_alerts";
const ALERTS_KEY = "ogscan_launch_alert_matches";
const DEFAULT_FILTER: AlertFilter = {
  id: "",
  name: "Default",
  minLp: 10000,
  requireTwitter: true,
  requireWebsite: false,
  requireLpLock: false,
  maxDevHolding: 20,
  enabled: true,
};

function loadFilters(): AlertFilter[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveFilters(filters: AlertFilter[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
}
function loadAlerts(): AlertMatch[] {
  try { return JSON.parse(localStorage.getItem(ALERTS_KEY) || "[]"); } catch { return []; }
}
function saveAlerts(alerts: AlertMatch[]) {
  localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts.slice(0, 50)));
}

function playAlertSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
    setTimeout(() => ctx.close(), 500);
  } catch {}
}

function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function sendDesktopNotification(title: string, body: string) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: "/og-brand.jpg" });
  }
}

export const LaunchAlerts: React.FC<Props> = ({ onAlert }) => {
  const [filters, setFilters] = useState<AlertFilter[]>(loadFilters);
  const [alerts, setAlerts] = useState<AlertMatch[]>(loadAlerts);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [desktopEnabled, setDesktopEnabled] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [editingFilter, setEditingFilter] = useState<AlertFilter | null>(null);
  const [polling, setPolling] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const seenMints = useRef<Set<string>>(new Set());
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);
  useEffect(() => { if (desktopEnabled) requestNotificationPermission(); }, [desktopEnabled]);

  // Check a token against all enabled filters
  const checkToken = useCallback((t: JupTokenInfo): AlertFilter | null => {
    const enabledFilters = filters.filter(f => f.enabled);
    const lp = t.liquidity ?? (t as any).effectiveLiquidityUsd ?? 0;
    const devHolding = t.topHoldersPercent ?? (t.audit?.topHoldersPercentage ?? 100);
    const hasSocial = !!(t as any).dexUrl || t.isVerified;

    for (const filter of enabledFilters) {
      if (lp < filter.minLp) continue;
      if (filter.requireTwitter && !hasSocial) continue;
      if (devHolding > filter.maxDevHolding) continue;
      if (filter.requireLpLock && !((t as any).audit?.mintAuthorityDisabled)) continue;
      return filter;
    }
    return null;
  }, [filters]);

  // Poll for new trending tokens
  const poll = useCallback(async () => {
    if (filters.filter(f => f.enabled).length === 0) return;
    setPolling(true);
    try {
      const fresh = await jupTrending("5m", 20);
      if (!mounted.current) return;

      for (const token of fresh) {
        const mint = (token as any).address ?? token.id;
        if (seenMints.current.has(mint)) continue;
        seenMints.current.add(mint);

        const matchedFilter = checkToken(token);
        if (!matchedFilter) continue;

        const priceChange = token.stats24h?.priceChange ?? (token as any).priceChange24h ?? 0;
        const alert: AlertMatch = {
          mint,
          symbol: token.symbol || "???",
          name: token.name || "",
          logoURI: (token as any).logoURI ?? token.icon,
          liquidity: token.liquidity ?? 0,
          mcap: token.mcap ?? 0,
          priceChange,
          matchedFilter: matchedFilter.name,
          timestamp: new Date().toISOString(),
        };

        setAlerts(prev => {
          const next = [alert, ...prev].slice(0, 50);
          saveAlerts(next);
          return next;
        });

        if (soundEnabled) playAlertSound();
        if (desktopEnabled) {
          sendDesktopNotification(
            `🚀 $${token.symbol} matched "${matchedFilter.name}"`,
            `LP: ${fmtUsd(token.liquidity ?? 0)} · MCap: ${fmtUsd(token.mcap ?? 0)}`
          );
        }
        toast.success(`🚀 $${token.symbol} matched "${matchedFilter.name}"`);
        onAlert?.(mint);
      }
    } catch (e) {
      console.error("[LaunchAlerts] Poll failed:", e);
    }
    if (mounted.current) setPolling(false);
  }, [filters, soundEnabled, desktopEnabled, checkToken, onAlert]);

  // Start/stop monitoring
  useEffect(() => {
    if (!monitoring) return;
    // Initial poll
    poll();
    // Poll every 30 seconds
    const iv = setInterval(poll, 30 * 1000);
    return () => clearInterval(iv);
  }, [monitoring, poll]);

  const addFilter = () => {
    const newFilter: AlertFilter = {
      ...DEFAULT_FILTER,
      id: crypto.randomUUID(),
      name: `Filter ${filters.length + 1}`,
    };
    setEditingFilter(newFilter);
  };

  const saveFilter = (filter: AlertFilter) => {
    setFilters(prev => {
      const exists = prev.find(f => f.id === filter.id);
      const next = exists ? prev.map(f => f.id === filter.id ? filter : f) : [...prev, filter];
      saveFilters(next);
      return next;
    });
    setEditingFilter(null);
  };

  const removeFilter = (id: string) => {
    setFilters(prev => {
      const next = prev.filter(f => f.id !== id);
      saveFilters(next);
      return next;
    });
  };

  const toggleFilter = (id: string) => {
    setFilters(prev => {
      const next = prev.map(f => f.id === id ? { ...f, enabled: !f.enabled } : f);
      saveFilters(next);
      return next;
    });
  };

  const activeCount = filters.filter(f => f.enabled).length;

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center border",
          monitoring
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
            : activeCount > 0
            ? "bg-primary/10 border-primary/20 text-primary"
            : "bg-white/[0.04] border-white/[0.06] text-white/20"
        )}>
          {monitoring ? <Zap className="h-3.5 w-3.5 animate-pulse" /> : activeCount > 0 ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold text-white">Launch Alerts</p>
            {monitoring && (
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[8px] animate-pulse">
                LIVE
              </Badge>
            )}
            {polling && <Loader2 className="h-3 w-3 animate-spin text-white/20" />}
          </div>
          <p className="text-[10px] text-white/25">
            {activeCount} filter{activeCount !== 1 ? "s" : ""} · {alerts.length} match{alerts.length !== 1 ? "es" : ""}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={() => setMonitoring(!monitoring)}
            className={cn("h-7 text-[10px] px-2 gap-1",
              monitoring ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
            )}
          >
            {monitoring ? "Stop" : "Start"} Monitor
          </Button>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={cn("p-1.5 rounded-lg border transition-all",
              soundEnabled ? "border-primary/20 bg-primary/5 text-primary" : "border-white/[0.06] text-white/15"
            )}
          >
            {soundEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1.5 rounded-lg border border-white/[0.06] text-white/15 hover:text-white/30 transition-colors"
          >
            <Settings className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Recent matches */}
      {alerts.length > 0 && (
        <div className="border-t border-white/[0.04]">
          <button
            onClick={() => setShowAlerts(!showAlerts)}
            className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-white/[0.015]"
          >
            <span className="text-[10px] font-bold text-white/40">Recent Matches</span>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-[8px]">{alerts.length}</Badge>
          </button>
          {showAlerts && (
            <div className="max-h-[200px] overflow-y-auto divide-y divide-white/[0.03]">
              {alerts.slice(0, 20).map((alert, i) => (
                <button
                  key={i}
                  onClick={() => onAlert?.(alert.mint)}
                  className="w-full flex items-center gap-2 p-2.5 hover:bg-white/[0.02] text-left"
                >
                  {alert.logoURI && <img src={alert.logoURI} className="w-5 h-5 rounded-full" alt="" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-white">${alert.symbol}</span>
                      <span className="text-[8px] text-white/15">via "{alert.matchedFilter}"</span>
                    </div>
                    <div className="flex gap-2 text-[8px] text-white/20">
                      <span>LP: {fmtUsd(alert.liquidity)}</span>
                      <span>MCap: {fmtUsd(alert.mcap)}</span>
                    </div>
                  </div>
                  <span className={cn("text-[9px] font-bold", alert.priceChange >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {alert.priceChange >= 0 ? "+" : ""}{alert.priceChange.toFixed(1)}%
                  </span>
                  <span className="text-[8px] text-white/10">
                    {new Date(alert.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {showSettings && (
        <div className="border-t border-white/[0.06] p-3 space-y-2">
          {filters.map(f => (
            <div key={f.id} className={cn(
              "flex items-center gap-2 p-2 rounded-lg border",
              f.enabled ? "border-primary/15 bg-primary/5" : "border-white/[0.04] bg-white/[0.01]"
            )}>
              <button
                onClick={() => toggleFilter(f.id)}
                className={cn("w-4 h-4 rounded border flex items-center justify-center",
                  f.enabled ? "bg-primary border-primary text-white" : "border-white/[0.15] bg-transparent"
                )}
              >
                {f.enabled && <Check className="h-2.5 w-2.5" />}
              </button>
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-bold text-white">{f.name}</span>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  <span className="text-[8px] text-white/20">LP≥${(f.minLp / 1000).toFixed(0)}k</span>
                  {f.requireTwitter && <span className="text-[8px] text-white/20">+Social</span>}
                  {f.requireWebsite && <span className="text-[8px] text-white/20">+Website</span>}
                  <span className="text-[8px] text-white/20">Dev≤{f.maxDevHolding}%</span>
                </div>
              </div>
              <button onClick={() => setEditingFilter(f)} className="text-white/15 hover:text-white/30 text-[9px]">Edit</button>
              <button onClick={() => removeFilter(f.id)} className="text-white/15 hover:text-red-400"><X className="h-3 w-3" /></button>
            </div>
          ))}

          <button
            onClick={addFilter}
            className="w-full flex items-center justify-center gap-1.5 p-2 rounded-lg border border-dashed border-white/[0.08] hover:border-primary/30 text-white/20 hover:text-white/40 transition-colors"
          >
            <Plus className="h-3 w-3" /> <span className="text-[10px]">Add Filter</span>
          </button>

          {editingFilter && (
            <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-2">
              <Input placeholder="Filter name" value={editingFilter.name} onChange={e => setEditingFilter({ ...editingFilter, name: e.target.value })} className="h-7 text-xs bg-white/[0.03] border-white/[0.08]" />
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-white/40 w-20">Min LP ($)</label>
                <Input type="number" value={editingFilter.minLp} onChange={e => setEditingFilter({ ...editingFilter, minLp: Number(e.target.value) })} className="h-7 text-xs bg-white/[0.03] border-white/[0.08] flex-1" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-white/40 w-20">Max Dev %</label>
                <Input type="number" value={editingFilter.maxDevHolding} onChange={e => setEditingFilter({ ...editingFilter, maxDevHolding: Number(e.target.value) })} className="h-7 text-xs bg-white/[0.03] border-white/[0.08] flex-1" />
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "requireTwitter", label: "Require Social" },
                  { key: "requireWebsite", label: "Require Website" },
                  { key: "requireLpLock", label: "Require LP Lock" },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setEditingFilter({ ...editingFilter, [key]: !(editingFilter as any)[key] })}
                    className={cn("px-2 py-1 rounded text-[9px] border",
                      (editingFilter as any)[key] ? "bg-primary/10 border-primary/20 text-primary" : "bg-white/[0.02] border-white/[0.06] text-white/25"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveFilter(editingFilter)} className="flex-1 h-7 text-xs">Save</Button>
                <Button size="sm" variant="outline" onClick={() => setEditingFilter(null)} className="h-7 text-xs">Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LaunchAlerts;
