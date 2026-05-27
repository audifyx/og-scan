/**
 * SpaceReminders — ogscan.fun/reminders
 *
 * Push + Email reminder system for scheduled spaces.
 * - 15-minute and 1-hour "before" reminders
 * - Per-space reminder toggle from the schedule page
 * - Global notification preferences panel
 * - Email delivery via resend (simulation)
 * - Browser push notification opt-in (Notification API)
 */

import React, { useState, useEffect } from "react";
import {
  Bell, BellOff, Mail, Smartphone, Clock, Check, Calendar,
  ChevronRight, Radio, Users, Trash2, Plus, Toggle, Loader2,
  AlertCircle, BellRing, Settings, Globe, Send,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow, format, addMinutes, isFuture } from "date-fns";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ReminderPref {
  id: string;
  user_id: string;
  space_id: string;
  remind_15min: boolean;
  remind_1hour: boolean;
  via_push: boolean;
  via_email: boolean;
  space_title?: string;
  scheduled_for?: string;
  host_username?: string;
}

interface NotifSettings {
  push_enabled: boolean;
  email_enabled: boolean;
  remind_15min_default: boolean;
  remind_1hour_default: boolean;
  email_address: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Browser Push helper
// ─────────────────────────────────────────────────────────────────────────────

async function requestPushPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    toast.error("Push notifications are not supported in this browser.");
    return false;
  }
  const permission = await Notification.requestPermission();
  return permission === "granted";
}

function sendBrowserPush(title: string, body: string) {
  if (Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: "/favicon.ico",
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings Panel
// ─────────────────────────────────────────────────────────────────────────────

function NotificationSettingsPanel({ onSave }: { onSave: () => void }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotifSettings>({
    push_enabled: false,
    email_enabled: true,
    remind_15min_default: true,
    remind_1hour_default: true,
    email_address: user?.email ?? "",
  });
  const navigate = useNavigate();
  const [pushPermission, setPushPermission] = useState<string>(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "default"
  );
  const [saving, setSaving] = useState(false);

  async function handleEnablePush() {
    const granted = await requestPushPermission();
    if (granted) {
      setSettings((s) => ({ ...s, push_enabled: true }));
      setPushPermission("granted");
      sendBrowserPush("🔔 OGScan Notifications Active", "You'll receive space reminders here.");
      toast.success("Push notifications enabled!");
    } else {
      toast.error("Push permission denied. Enable it in browser settings.");
    }
  }

  async function handleSave() {
    setSaving(true);
    if (!user) return;
    await supabase.from("notification_settings").upsert({
      user_id: user.id,
      push_enabled: settings.push_enabled,
      email_enabled: settings.email_enabled,
      remind_15min_default: settings.remind_15min_default,
      remind_1hour_default: settings.remind_1hour_default,
      email_address: settings.email_address,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    toast.success("Notification preferences saved!");
    onSave();
  }

  return (
    <div className="space-y-5">
      {/* Push */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-violet-400" />
            <span className="text-sm font-bold text-white">Push Notifications</span>
          </div>
          {pushPermission === "granted" ? (
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">Active</span>
          ) : (
            <button
              onClick={handleEnablePush}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-500 transition"
            >
              Enable
            </button>
          )}
        </div>
        <p className="text-xs text-white/40">
          Receive browser push notifications when spaces you follow are about to start.
        </p>
      </div>

      {/* Email */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-sky-400" />
            <span className="text-sm font-bold text-white">Email Reminders</span>
          </div>
          <button
            onClick={() => setSettings((s) => ({ ...s, email_enabled: !s.email_enabled }))}
            className={cn(
              "relative h-5 w-9 rounded-full transition",
              settings.email_enabled ? "bg-sky-500" : "bg-white/10"
            )}
          >
            <span className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
              settings.email_enabled ? "translate-x-4" : "translate-x-0.5"
            )} />
          </button>
        </div>
        <input
          type="email"
          value={settings.email_address}
          onChange={(e) => setSettings((s) => ({ ...s, email_address: e.target.value }))}
          placeholder="your@email.com"
          className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-sky-500/60"
        />
      </div>

      {/* Default timings */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-bold text-white">Default Reminder Timing</span>
        </div>
        <div className="space-y-2">
          {[
            { key: "remind_15min_default", label: "15 minutes before", sub: "Quick heads-up" },
            { key: "remind_1hour_default", label: "1 hour before", sub: "Plan your time" },
          ].map(({ key, label, sub }) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-white">{label}</div>
                <div className="text-[10px] text-white/40">{sub}</div>
              </div>
              <button
                onClick={() => setSettings((s) => ({ ...s, [key]: !s[key as keyof NotifSettings] }))}
                className={cn(
                  "relative h-5 w-9 rounded-full transition",
                  settings[key as keyof NotifSettings] ? "bg-amber-500" : "bg-white/10"
                )}
              >
                <span className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                  settings[key as keyof NotifSettings] ? "translate-x-4" : "translate-x-0.5"
                )} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Save Preferences
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reminder Row
// ─────────────────────────────────────────────────────────────────────────────

function ReminderRow({
  pref,
  onUpdate,
  onDelete,
}: {
  pref: ReminderPref;
  onUpdate: (id: string, updates: Partial<ReminderPref>) => void;
  onDelete: (id: string) => void;
}) {
  const scheduled = pref.scheduled_for ? new Date(pref.scheduled_for) : null;
  const upcoming = scheduled ? isFuture(scheduled) : false;

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Radio className={cn("h-3.5 w-3.5 shrink-0", upcoming ? "text-emerald-400" : "text-white/30")} />
            <p className="text-sm font-bold text-white truncate">{pref.space_title ?? "Untitled Space"}</p>
          </div>
          {pref.host_username && (
            <p className="text-xs text-white/40 mb-1">@{pref.host_username}</p>
          )}
          {scheduled && (
            <div className="flex items-center gap-1.5 text-[11px] text-white/40">
              <Calendar className="h-3 w-3" />
              {format(scheduled, "MMM d, yyyy · h:mm a")}
              {upcoming && (
                <span className="ml-1 text-emerald-400">
                  ({formatDistanceToNow(scheduled, { addSuffix: true })})
                </span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => onDelete(pref.id)}
          className="shrink-0 rounded-lg p-1.5 text-white/25 hover:text-red-400 hover:bg-red-400/10 transition"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Toggle timings */}
      <div className="mt-3 flex flex-wrap gap-2">
        {[
          { key: "remind_15min", label: "15 min before" },
          { key: "remind_1hour", label: "1 hour before" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onUpdate(pref.id, { [key]: !pref[key as keyof ReminderPref] })}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
              pref[key as keyof ReminderPref]
                ? "border-violet-500/40 bg-violet-500/15 text-violet-300"
                : "border-white/10 bg-white/[0.03] text-white/35 hover:border-white/20"
            )}
          >
            <Bell className="h-2.5 w-2.5" />
            {label}
          </button>
        ))}
        {[
          { key: "via_push", label: "Push", icon: Smartphone },
          { key: "via_email", label: "Email", icon: Mail },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onUpdate(pref.id, { [key]: !pref[key as keyof ReminderPref] })}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
              pref[key as keyof ReminderPref]
                ? "border-sky-500/40 bg-sky-500/15 text-sky-300"
                : "border-white/10 bg-white/[0.03] text-white/35 hover:border-white/20"
            )}
          >
            <Icon className="h-2.5 w-2.5" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SpaceReminders() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"reminders" | "settings">("reminders");
  const [prefs, setPrefs] = useState<ReminderPref[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadReminders();
  }, [user]);

  async function loadReminders() {
    setLoading(true);
    if (!user) return;
    // Load existing reminder preferences with space info joined
    const { data, error } = await supabase
      .from("space_reminder_prefs")
      .select(`
        *,
        scheduled_spaces (title, scheduled_for, host_username)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      const mapped: ReminderPref[] = data.map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        space_id: r.space_id,
        remind_15min: r.remind_15min ?? true,
        remind_1hour: r.remind_1hour ?? true,
        via_push: r.via_push ?? false,
        via_email: r.via_email ?? true,
        space_title: r.scheduled_spaces?.title ?? "Unknown Space",
        scheduled_for: r.scheduled_spaces?.scheduled_for,
        host_username: r.scheduled_spaces?.host_username,
      }));
      setPrefs(mapped);
    }
    setLoading(false);
  }

  async function handleUpdate(id: string, updates: Partial<ReminderPref>) {
    setPrefs((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
    await supabase.from("space_reminder_prefs").update(updates).eq("id", id);
    toast.success("Reminder updated");
  }

  async function handleDelete(id: string) {
    setPrefs((prev) => prev.filter((p) => p.id !== id));
    await supabase.from("space_reminder_prefs").delete().eq("id", id);
    toast.success("Reminder removed");
  }

  async function handleTestNotification() {
    const granted = Notification.permission === "granted";
    if (granted) {
      sendBrowserPush(
        "⏰ Space starting in 15 minutes",
        "Crypto Morning Brief by @cryptoking is about to go live!"
      );
      toast.success("Test notification sent!");
    } else {
      toast.info("Enable push notifications in Settings to test.");
    }
  }

  return (
    <div className="min-h-screen bg-[#07070f] text-white">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="border-b border-white/[0.07] bg-[#0a0a14] px-4 py-5">
        <div className="mx-auto max-w-3xl">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors group mb-4"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            Back
          </button>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10">
              <BellRing className="h-4.5 w-4.5 text-violet-400" style={{ height: 18, width: 18 }} />
            </div>
            <div>
              <h1 className="text-lg font-black text-white">Space Reminders</h1>
              <p className="text-xs text-white/40">Push & email alerts before your spaces start</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            {[
              { key: "reminders", label: "My Reminders", icon: Bell },
              { key: "settings", label: "Settings", icon: Settings },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key as typeof tab)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                  tab === key
                    ? "bg-white/[0.08] text-white"
                    : "text-white/45 hover:bg-white/[0.04] hover:text-white/70"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
            <button
              onClick={handleTestNotification}
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/50 hover:border-white/20 hover:text-white transition"
            >
              <Send className="h-3 w-3" />
              Test Push
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6">
        {tab === "reminders" ? (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-white/30" />
              </div>
            ) : prefs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Bell className="mb-4 h-10 w-10 text-white/15" />
                <p className="text-sm font-bold text-white/50">No reminders set</p>
                <p className="mt-1 text-xs text-white/30">
                  RSVP to a scheduled space to add reminders.
                </p>
                <a
                  href="/schedule"
                  className="mt-4 flex items-center gap-1.5 rounded-xl bg-violet-600/20 border border-violet-500/30 px-4 py-2 text-sm font-semibold text-violet-300 hover:bg-violet-600/30 transition"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Browse Scheduled Spaces
                  <ChevronRight className="h-3.5 w-3.5" />
                </a>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-white/50">{prefs.length} reminder{prefs.length !== 1 ? "s" : ""} active</p>
                  <div className="flex items-center gap-3 text-xs text-white/30">
                    <div className="flex items-center gap-1">
                      <Bell className="h-3 w-3 text-violet-400" />
                      <span>15-min</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-amber-400" />
                      <span>1-hour</span>
                    </div>
                  </div>
                </div>
                {prefs.map((pref) => (
                  <ReminderRow
                    key={pref.id}
                    pref={pref}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <NotificationSettingsPanel onSave={() => setTab("reminders")} />
        )}

        {/* Info banner */}
        <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
            <div>
              <p className="text-xs font-semibold text-white/70 mb-1">How reminders work</p>
              <p className="text-xs text-white/40 leading-relaxed">
                When you RSVP "Going" or "Maybe" on a scheduled space, you can enable 15-minute
                and/or 1-hour reminders. Reminders are delivered via browser push (if enabled) and
                email. Server-side cron checks every 5 minutes for upcoming spaces and sends
                reminders accordingly.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
