/**
 * LaunchAlerts — Sound + Desktop notifications for launches matching filters.
 * Alert when new token has Twitter + LP > threshold.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, BellOff, Volume2, VolumeX, Filter, Plus, X, Check, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

interface Props {
  onAlert?: (tokenMint: string) => void;
}

const STORAGE_KEY = "ogscan_launch_alerts";
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
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveFilters(filters: AlertFilter[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
}

// Simple audio alert using Web Audio API
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
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [desktopEnabled, setDesktopEnabled] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingFilter, setEditingFilter] = useState<AlertFilter | null>(null);

  useEffect(() => {
    if (desktopEnabled) requestNotificationPermission();
  }, [desktopEnabled]);

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

  // Public method to check if a new launch matches any filter
  const checkLaunch = useCallback((launch: {
    lpAmount: number;
    hasTwitter: boolean;
    hasWebsite: boolean;
    lpLocked: boolean;
    devHoldingPct: number;
    symbol: string;
    mint: string;
  }) => {
    const enabledFilters = filters.filter(f => f.enabled);
    for (const filter of enabledFilters) {
      if (launch.lpAmount < filter.minLp) continue;
      if (filter.requireTwitter && !launch.hasTwitter) continue;
      if (filter.requireWebsite && !launch.hasWebsite) continue;
      if (filter.requireLpLock && !launch.lpLocked) continue;
      if (launch.devHoldingPct > filter.maxDevHolding) continue;

      // Match found!
      if (soundEnabled) playAlertSound();
      if (desktopEnabled) sendDesktopNotification(
        `🚀 New Launch: $${launch.symbol}`,
        `Matched filter "${filter.name}" — LP: $${(launch.lpAmount / 1000).toFixed(1)}k`
      );
      toast.success(`🚀 New launch matched: $${launch.symbol}`);
      onAlert?.(launch.mint);
      return true;
    }
    return false;
  }, [filters, soundEnabled, desktopEnabled, onAlert]);

  const activeCount = filters.filter(f => f.enabled).length;

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center border",
          activeCount > 0
            ? "bg-primary/10 border-primary/20 text-primary"
            : "bg-white/[0.04] border-white/[0.06] text-white/20"
        )}>
          {activeCount > 0 ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold text-white">Launch Alerts</p>
          <p className="text-[10px] text-white/25">{activeCount} active filter{activeCount !== 1 ? "s" : ""}</p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={cn("p-1.5 rounded-lg border transition-all",
              soundEnabled ? "border-primary/20 bg-primary/5 text-primary" : "border-white/[0.06] text-white/15"
            )}
            title={soundEnabled ? "Sound on" : "Sound off"}
          >
            {soundEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
          </button>
          <button
            onClick={() => setDesktopEnabled(!desktopEnabled)}
            className={cn("p-1.5 rounded-lg border transition-all",
              desktopEnabled ? "border-primary/20 bg-primary/5 text-primary" : "border-white/[0.06] text-white/15"
            )}
            title={desktopEnabled ? "Desktop notifications on" : "Desktop notifications off"}
          >
            <Bell className="h-3 w-3" />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1.5 rounded-lg border border-white/[0.06] text-white/15 hover:text-white/30 transition-colors"
          >
            <Settings className="h-3 w-3" />
          </button>
        </div>
      </div>

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
                  {f.requireTwitter && <span className="text-[8px] text-white/20">+Twitter</span>}
                  {f.requireWebsite && <span className="text-[8px] text-white/20">+Website</span>}
                  {f.requireLpLock && <span className="text-[8px] text-white/20">+LP Lock</span>}
                  <span className="text-[8px] text-white/20">Dev≤{f.maxDevHolding}%</span>
                </div>
              </div>
              <button
                onClick={() => setEditingFilter(f)}
                className="text-white/15 hover:text-white/30 text-[9px]"
              >
                Edit
              </button>
              <button
                onClick={() => removeFilter(f.id)}
                className="text-white/15 hover:text-red-400"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          <button
            onClick={addFilter}
            className="w-full flex items-center justify-center gap-1.5 p-2 rounded-lg border border-dashed border-white/[0.08] hover:border-primary/30 text-white/20 hover:text-white/40 transition-colors"
          >
            <Plus className="h-3 w-3" />
            <span className="text-[10px]">Add Filter</span>
          </button>

          {/* Edit modal */}
          {editingFilter && (
            <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-2">
              <Input
                placeholder="Filter name"
                value={editingFilter.name}
                onChange={e => setEditingFilter({ ...editingFilter, name: e.target.value })}
                className="h-7 text-xs bg-white/[0.03] border-white/[0.08]"
              />
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-white/40 w-20">Min LP ($)</label>
                <Input
                  type="number"
                  value={editingFilter.minLp}
                  onChange={e => setEditingFilter({ ...editingFilter, minLp: Number(e.target.value) })}
                  className="h-7 text-xs bg-white/[0.03] border-white/[0.08] flex-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-white/40 w-20">Max Dev %</label>
                <Input
                  type="number"
                  value={editingFilter.maxDevHolding}
                  onChange={e => setEditingFilter({ ...editingFilter, maxDevHolding: Number(e.target.value) })}
                  className="h-7 text-xs bg-white/[0.03] border-white/[0.08] flex-1"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "requireTwitter", label: "Require Twitter" },
                  { key: "requireWebsite", label: "Require Website" },
                  { key: "requireLpLock", label: "Require LP Lock" },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setEditingFilter({ ...editingFilter, [key]: !(editingFilter as any)[key] })}
                    className={cn("px-2 py-1 rounded text-[9px] border",
                      (editingFilter as any)[key]
                        ? "bg-primary/10 border-primary/20 text-primary"
                        : "bg-white/[0.02] border-white/[0.06] text-white/25"
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
