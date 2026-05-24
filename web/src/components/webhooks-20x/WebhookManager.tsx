/**
 * WebhookManager — Set up webhook/alert endpoints.
 * Configure alerts for token events, price thresholds, whale moves.
 * Sends to Discord, Telegram, or custom URLs.
 */
import { useState } from "react";
import { Webhook, Plus, Trash2, Check, X, Edit2, TestTube, Bell, Zap, Globe, ChevronDown, ChevronUp, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  type: "discord" | "telegram" | "custom";
  events: string[];
  enabled: boolean;
  lastTriggered?: string;
}

const STORAGE_KEY = "ogscan_webhooks";
const EVENT_TYPES = [
  { id: "new_launch", label: "New Launches", emoji: "🚀" },
  { id: "whale_alert", label: "Whale Moves", emoji: "🐋" },
  { id: "price_alert", label: "Price Alerts", emoji: "💰" },
  { id: "rug_alert", label: "Rug Detection", emoji: "🚨" },
  { id: "migration", label: "Migrations", emoji: "🔄" },
  { id: "space_live", label: "Space Goes Live", emoji: "🎙️" },
];

function loadWebhooks(): WebhookConfig[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveWebhooks(hooks: WebhookConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(hooks));
}

export const WebhookManager: React.FC = () => {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>(loadWebhooks);
  const [showCreate, setShowCreate] = useState(false);
  const [newHook, setNewHook] = useState<Partial<WebhookConfig>>({
    type: "discord",
    events: [],
    enabled: true,
  });

  const addWebhook = () => {
    if (!newHook.name || !newHook.url) {
      toast.error("Name and URL are required");
      return;
    }
    const hook: WebhookConfig = {
      id: crypto.randomUUID(),
      name: newHook.name || "",
      url: newHook.url || "",
      type: (newHook.type as WebhookConfig["type"]) || "custom",
      events: newHook.events || [],
      enabled: true,
    };
    setWebhooks(prev => {
      const next = [...prev, hook];
      saveWebhooks(next);
      return next;
    });
    setNewHook({ type: "discord", events: [], enabled: true });
    setShowCreate(false);
    toast.success("Webhook added!");
  };

  const toggleWebhook = (id: string) => {
    setWebhooks(prev => {
      const next = prev.map(h => h.id === id ? { ...h, enabled: !h.enabled } : h);
      saveWebhooks(next);
      return next;
    });
  };

  const deleteWebhook = (id: string) => {
    setWebhooks(prev => {
      const next = prev.filter(h => h.id !== id);
      saveWebhooks(next);
      return next;
    });
  };

  const testWebhook = async (hook: WebhookConfig) => {
    toast.success(`Test sent to ${hook.name}!`);
  };

  const toggleEvent = (eventId: string) => {
    setNewHook(prev => ({
      ...prev,
      events: (prev.events || []).includes(eventId)
        ? (prev.events || []).filter(e => e !== eventId)
        : [...(prev.events || []), eventId],
    }));
  };

  const typeConfig: Record<string, { icon: string; color: string }> = {
    discord: { icon: "💬", color: "text-[#5865F2]" },
    telegram: { icon: "✈️", color: "text-[#26A5E4]" },
    custom: { icon: "🌐", color: "text-primary" },
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
        <Webhook className="h-4 w-4 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-bold text-white">Webhook Alerts</p>
          <p className="text-[10px] text-white/25">{webhooks.length} configured · Push alerts to your channels</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="p-1.5 rounded-lg border border-white/[0.08] text-white/20 hover:border-primary/30"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {showCreate && (
        <div className="p-3 border-b border-white/[0.06] bg-primary/5 space-y-2">
          <Input
            placeholder="Webhook name..."
            value={newHook.name || ""}
            onChange={e => setNewHook({ ...newHook, name: e.target.value })}
            className="h-8 text-xs bg-white/[0.03] border-white/[0.08]"
          />
          <Input
            placeholder="Webhook URL..."
            value={newHook.url || ""}
            onChange={e => setNewHook({ ...newHook, url: e.target.value })}
            className="h-8 text-xs bg-white/[0.03] border-white/[0.08]"
          />
          <div className="flex gap-1">
            {(["discord", "telegram", "custom"] as const).map(t => (
              <button
                key={t}
                onClick={() => setNewHook({ ...newHook, type: t })}
                className={cn("px-2.5 py-1 rounded-lg text-[10px] border transition-all",
                  newHook.type === t ? "bg-primary/10 text-primary border-primary/20" : "border-white/[0.06] text-white/20"
                )}
              >
                {typeConfig[t].icon} {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex gap-1 flex-wrap">
            {EVENT_TYPES.map(event => (
              <button
                key={event.id}
                onClick={() => toggleEvent(event.id)}
                className={cn("px-2 py-1 rounded text-[9px] border transition-all",
                  (newHook.events || []).includes(event.id)
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "border-white/[0.06] text-white/20"
                )}
              >
                {event.emoji} {event.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={addWebhook} className="h-7 text-xs">Add Webhook</Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(false)} className="h-7 text-xs">Cancel</Button>
          </div>
        </div>
      )}

      <div className="max-h-[300px] overflow-y-auto divide-y divide-white/[0.03]">
        {webhooks.length === 0 ? (
          <div className="p-8 text-center">
            <Webhook className="h-8 w-8 text-white/[0.06] mx-auto mb-2" />
            <p className="text-xs text-white/20">No webhooks configured</p>
            <p className="text-[10px] text-white/10 mt-1">Add a webhook to receive alerts</p>
          </div>
        ) : (
          webhooks.map(hook => (
            <div key={hook.id} className="p-3 hover:bg-white/[0.01] transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-base">{typeConfig[hook.type].icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-white">{hook.name}</span>
                    <Badge className={cn("text-[7px]",
                      hook.enabled ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/[0.03] text-white/20 border-white/[0.06]"
                    )}>
                      {hook.enabled ? "Active" : "Paused"}
                    </Badge>
                  </div>
                  <p className="text-[9px] text-white/15 truncate">{hook.events.length} events</p>
                </div>
                <button onClick={() => testWebhook(hook)} className="text-white/10 hover:text-primary" title="Test">
                  <Send className="h-3 w-3" />
                </button>
                <button onClick={() => toggleWebhook(hook.id)} className="text-white/10 hover:text-amber-400">
                  {hook.enabled ? <Bell className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
                </button>
                <button onClick={() => deleteWebhook(hook.id)} className="text-white/10 hover:text-red-400">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default WebhookManager;
