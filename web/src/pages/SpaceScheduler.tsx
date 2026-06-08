/**
 * SpaceScheduler — ogscan.fun/schedule
 *
 * Feature 10: Scheduling + Calendar
 * - View all upcoming scheduled spaces (host's own + public)
 * - Create a new scheduled space (title, time, category, tags, optional token gate)
 * - RSVP "Going / Maybe" on any upcoming space
 * - One-click Google Calendar sync (generates .ics link)
 * - Reminder preferences (24h, 1h, 5min)
 * - Recurring spaces toggle (weekly)
 *
 * No external calendar SDK required — pure .ics generation + Supabase.
 */

import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Calendar, Clock, Plus, Bell, Users, ChevronRight, Trash2,
  Radio, Star, ExternalLink, Check, RefreshCw, MapPin, Repeat2,
  Lock, Globe, Hash, X, Edit3, CalendarPlus, CheckCircle2,
  AlertCircle, Loader2, ChevronDown, Flame, ArrowLeft,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { format, formatDistanceToNow, addHours, isAfter, isBefore, startOfDay, addDays } from "date-fns";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { safeAvatarUrl } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ScheduledSpace {
  id: string;
  title: string;
  description: string | null;
  host_id: string;
  host_username: string;
  host_avatar: string | null;
  scheduled_for: string;
  category: string | null;
  tags: string[] | null;
  is_private: boolean;
  token_gated: boolean;
  rsvp_count: number;
  reminder_sent: boolean;
  is_recurring: boolean;
  recurrence_type: string | null;
}

interface MyRsvp {
  space_id: string;
  rsvp_type: "going" | "maybe" | "not_going";
}

const CATEGORIES = ["Health", "Tech", "Business", "Music", "Education", "Finance", "Crypto", "Gaming", "Sports", "Other"];

// ─────────────────────────────────────────────────────────────────────────────
// Google Calendar ICS helper
// ─────────────────────────────────────────────────────────────────────────────

function generateICS(space: ScheduledSpace): string {
  const start = new Date(space.scheduled_for);
  const end = addHours(start, 1);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const desc = `Hosted by @${space.host_username} on OGScan Spaces\\nhttps://ogscan.fun/space/${space.id}`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OGScan//Spaces//EN",
    "BEGIN:VEVENT",
    `UID:${space.id}@ogscan.fun`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${space.title}`,
    `DESCRIPTION:${desc}`,
    `URL:https://ogscan.fun/space/${space.id}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function downloadICS(space: ScheduledSpace) {
  const blob = new Blob([generateICS(space)], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${space.title.replace(/\s+/g, "_")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

function googleCalendarUrl(space: ScheduledSpace): string {
  const start = new Date(space.scheduled_for);
  const end = addHours(start, 1);
  const fmt = (d: Date) => d.toISOString().replace(/[-:.Z]/g, "").slice(0, 15) + "Z";
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: space.title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: `Hosted by @${space.host_username} on OGScan Spaces\nhttps://ogscan.fun/space/${space.id}`,
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Schedule Card
// ─────────────────────────────────────────────────────────────────────────────

function SpaceCard({
  space,
  myRsvp,
  isOwner,
  onRsvp,
  onDelete,
  onCalSync,
}: {
  space: ScheduledSpace;
  myRsvp?: MyRsvp;
  isOwner: boolean;
  onRsvp: (spaceId: string, type: "going" | "maybe" | "not_going") => void;
  onDelete: (spaceId: string) => void;
  onCalSync: (space: ScheduledSpace) => void;
}) {
  const scheduledDate = new Date(space.scheduled_for);
  const isToday = isBefore(scheduledDate, addDays(startOfDay(new Date()), 1)) && isAfter(scheduledDate, startOfDay(new Date()));
  const isSoon = isBefore(scheduledDate, addHours(new Date(), 2));

  return (
    <div className="relative group bg-[#0d0d1a] border border-white/5 rounded-xl p-4 hover:border-purple-500/30 transition-all duration-200">
      {/* Soon badge */}
      {isSoon && (
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-amber-500/20 border border-amber-500/30 rounded-full px-2 py-0.5">
          <Flame className="h-3 w-3 text-amber-400" />
          <span className="text-[10px] text-amber-400 font-semibold">SOON</span>
        </div>
      )}
      {isToday && !isSoon && (
        <div className="absolute top-3 right-3 bg-purple-500/20 border border-purple-500/30 rounded-full px-2 py-0.5">
          <span className="text-[10px] text-purple-400 font-semibold">TODAY</span>
        </div>
      )}
      {space.is_recurring && (
        <div className="absolute top-3 right-16 flex items-center gap-1 text-[10px] text-cyan-400/60">
          <Repeat2 className="h-3 w-3" />
          <span>Weekly</span>
        </div>
      )}

      <div className="flex gap-3">
        {/* Host avatar */}
        <img
          src={safeAvatarUrl(space.host_avatar, space.host_username)}
          alt={space.host_username}
          className="w-9 h-9 rounded-full border border-white/10 flex-shrink-0"
        />

        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="text-sm font-semibold text-white truncate pr-16">{space.title}</h3>

          {/* Host + time */}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-xs text-white/40">@{space.host_username}</span>
            <span className="text-white/15">·</span>
            <div className="flex items-center gap-1 text-xs text-purple-400">
              <Calendar className="h-3 w-3" />
              <span>{format(scheduledDate, "MMM d · h:mm a")}</span>
            </div>
            <span className="text-white/15">·</span>
            <span className="text-xs text-white/30">{formatDistanceToNow(scheduledDate, { addSuffix: true })}</span>
          </div>

          {/* Tags */}
          {(space.category || (space.tags && space.tags.length > 0)) && (
            <div className="flex flex-wrap gap-1 mt-2">
              {space.category && (
                <span className="text-[10px] bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-full px-2 py-0.5">
                  {space.category}
                </span>
              )}
              {space.tags?.slice(0, 3).map((t) => (
                <span key={t} className="text-[10px] text-white/30 bg-white/5 rounded-full px-2 py-0.5">
                  #{t}
                </span>
              ))}
            </div>
          )}

          {/* RSVP count */}
          <div className="flex items-center gap-3 mt-2">
            <span className="flex items-center gap-1 text-xs text-white/30">
              <Users className="h-3 w-3" />
              {space.rsvp_count ?? 0} going
            </span>
            {(space.is_private) && (
              <span className="flex items-center gap-1 text-[10px] text-white/20">
                <Lock className="h-3 w-3" />Private
              </span>
            )}
            {space.token_gated && (
              <span className="flex items-center gap-1 text-[10px] text-amber-400/60">
                <Star className="h-3 w-3" />Token Gated
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 mt-3">
            {/* RSVP buttons */}
            <button
              onClick={() => onRsvp(space.id, "going")}
              className={cn(
                "flex items-center gap-1 text-xs px-3 py-1 rounded-full border transition-all",
                myRsvp?.rsvp_type === "going"
                  ? "bg-purple-600/30 border-purple-500/60 text-purple-300"
                  : "border-white/10 text-white/40 hover:border-purple-500/30 hover:text-purple-300"
              )}
            >
              <Check className="h-3 w-3" />
              Going
            </button>
            <button
              onClick={() => onRsvp(space.id, "maybe")}
              className={cn(
                "flex items-center gap-1 text-xs px-3 py-1 rounded-full border transition-all",
                myRsvp?.rsvp_type === "maybe"
                  ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                  : "border-white/10 text-white/40 hover:border-amber-500/30 hover:text-amber-300"
              )}
            >
              Maybe
            </button>

            {/* Calendar sync */}
            <button
              onClick={() => onCalSync(space)}
              className="flex items-center gap-1 text-xs px-3 py-1 rounded-full border border-white/10 text-white/40 hover:border-cyan-500/30 hover:text-cyan-300 transition-all"
            >
              <CalendarPlus className="h-3 w-3" />
              Add to Calendar
            </button>

            {/* Owner controls */}
            {isOwner && (
              <button
                onClick={() => onDelete(space.id)}
                className="flex items-center gap-1 text-xs px-3 py-1 rounded-full border border-white/10 text-white/20 hover:border-red-500/30 hover:text-red-400 transition-all ml-auto"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Scheduled Space Modal
// ─────────────────────────────────────────────────────────────────────────────

function CreateScheduleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [category, setCategory] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [loading, setLoading] = useState(false);

  // Default to 24h from now
  useEffect(() => {
    const d = addHours(new Date(), 24);
    setScheduledFor(format(d, "yyyy-MM-dd'T'HH:mm"));
  }, []);

  const handleCreate = async () => {
    if (!user || !title.trim() || !scheduledFor) return;
    setLoading(true);
    try {
      const tags = tagsInput.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("user_id", user.id)
        .single();

      const { error } = await supabase.from("spaces").insert({
        title: title.trim(),
        description: description.trim() || null,
        host_id: user.id,
        host_username: profile?.username || user.email?.split("@")[0] || "anon",
        host_avatar: profile?.avatar_url || null,
        is_live: false,
        is_private: isPrivate,
        scheduled_for: new Date(scheduledFor).toISOString(),
        category: category || null,
        tags: tags.length ? tags : null,
        listener_count: 0,
        peak_listeners: 0,
        rsvp_count: 0,
        is_recurring: isRecurring,
        recurrence_type: isRecurring ? "weekly" : null,
      });

      if (error) throw error;
      toast.success("Space scheduled!");
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to schedule space");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#0d0d1a] border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Calendar className="h-4 w-4 text-purple-400" />
            Schedule a Space
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Space title *"
            maxLength={100}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50"
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this space about? (optional)"
            rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 resize-none"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-white/40 block mb-1">Date & Time *</label>
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50"
              />
            </div>
            <div>
              <label className="text-[11px] text-white/40 block mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#0d0d1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50"
              >
                <option value="">None</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="Tags: solana, health, trading (comma separated)"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50"
          />

          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setIsPrivate(!isPrivate)}
                className={cn(
                  "w-8 h-4 rounded-full transition-colors relative",
                  isPrivate ? "bg-purple-600" : "bg-white/10"
                )}
              >
                <div className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all", isPrivate ? "left-4" : "left-0.5")} />
              </div>
              <span className="text-xs text-white/50">Private</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setIsRecurring(!isRecurring)}
                className={cn(
                  "w-8 h-4 rounded-full transition-colors relative",
                  isRecurring ? "bg-cyan-600" : "bg-white/10"
                )}
              >
                <div className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all", isRecurring ? "left-4" : "left-0.5")} />
              </div>
              <span className="text-xs text-white/50">Recurring (weekly)</span>
            </label>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white/70 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || !scheduledFor || loading}
            className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Calendar className="h-3.5 w-3.5" />}
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendar Sync Modal
// ─────────────────────────────────────────────────────────────────────────────

function CalSyncModal({ space, onClose }: { space: ScheduledSpace; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-[#0d0d1a] border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Add to Calendar</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/70">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-white/50 truncate">"{space.title}"</p>
        <p className="text-xs text-purple-400">{format(new Date(space.scheduled_for), "EEEE, MMMM d · h:mm a")}</p>

        <div className="space-y-2">
          <a
            href={googleCalendarUrl(space)}
            target="_blank"
            rel="noreferrer"
            onClick={onClose}
            className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white transition-all"
          >
            <span className="flex items-center gap-2">
              <span className="text-base">📅</span>
              Google Calendar
            </span>
            <ExternalLink className="h-3.5 w-3.5 text-white/30" />
          </a>
          <button
            onClick={() => { downloadICS(space); onClose(); }}
            className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white transition-all"
          >
            <span className="flex items-center gap-2">
              <span className="text-base">📲</span>
              Apple Calendar / Outlook (.ics)
            </span>
            <ExternalLink className="h-3.5 w-3.5 text-white/30" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

type FilterType = "upcoming" | "mine" | "today";

export default function SpaceScheduler() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState<ScheduledSpace[]>([]);
  const [myRsvps, setMyRsvps] = useState<MyRsvp[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("upcoming");
  const [showCreate, setShowCreate] = useState(false);
  const [calSyncSpace, setCalSyncSpace] = useState<ScheduledSpace | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Load spaces ──────────────────────────────────────────────────────────
  const loadSpaces = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("spaces")
        .select("*")
        .eq("is_live", false)
        .is("ended_at", null)
        .not("scheduled_for", "is", null)
        .gte("scheduled_for", new Date().toISOString())
        .order("scheduled_for", { ascending: true });

      if (filter === "mine" && user) {
        q = q.eq("host_id", user.id) as any;
      } else if (filter === "today") {
        q = q.lte("scheduled_for", addDays(startOfDay(new Date()), 1).toISOString()) as any;
      } else {
        q = q.limit(50) as any;
      }

      const { data, error } = await q;
      if (error) throw error;

      // Enrich with host profile + rsvp_count — batched queries to avoid N+1
      const hostIds = [...new Set((data || []).map((s: any) => s.host_id).filter(Boolean))];
      const spaceIds = (data || []).map((s: any) => s.id).filter(Boolean);

      const [profilesRes, rsvpRes] = await Promise.all([
        hostIds.length > 0
          ? supabase.from("profiles").select("user_id, username, avatar_url").in("user_id", hostIds)
          : Promise.resolve({ data: [] }),
        spaceIds.length > 0
          ? supabase.from("space_rsvps").select("space_id").in("space_id", spaceIds).eq("rsvp_type", "going")
          : Promise.resolve({ data: [] }),
      ]);

      const profilesMap: Record<string, any> = {};
      (profilesRes.data || []).forEach((p: any) => { profilesMap[p.user_id] = p; });

      const rsvpCountMap: Record<string, number> = {};
      (rsvpRes.data || []).forEach((r: any) => {
        rsvpCountMap[r.space_id] = (rsvpCountMap[r.space_id] || 0) + 1;
      });

      const enriched = (data || []).map((s: any) => ({
        ...s,
        host_username: profilesMap[s.host_id]?.username || s.host_username || "anon",
        host_avatar: profilesMap[s.host_id]?.avatar_url || s.host_avatar || null,
        rsvp_count: rsvpCountMap[s.id] ?? 0,
      }));

      setSpaces(enriched as ScheduledSpace[]);

      // Load my RSVPs
      if (user) {
        const ids = enriched.map((s) => s.id);
        if (ids.length) {
          const { data: rsvps } = await supabase
            .from("space_rsvps")
            .select("space_id, rsvp_type")
            .eq("user_id", user.id)
            .in("space_id", ids);
          setMyRsvps((rsvps || []) as MyRsvp[]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filter, user, refreshKey]);

  useEffect(() => { loadSpaces(); }, [loadSpaces]);

  // ── RSVP ────────────────────────────────────────────────────────────────
  const handleRsvp = async (spaceId: string, type: "going" | "maybe" | "not_going") => {
    if (!user) { toast.error("Sign in to RSVP"); return; }
    const existing = myRsvps.find((r) => r.space_id === spaceId);
    // Toggle off
    if (existing?.rsvp_type === type) {
      await supabase.from("space_rsvps").delete().eq("space_id", spaceId).eq("user_id", user.id);
      setMyRsvps((prev) => prev.filter((r) => r.space_id !== spaceId));
      setSpaces((prev) => prev.map((s) => s.id === spaceId ? { ...s, rsvp_count: Math.max(0, s.rsvp_count - 1) } : s));
      return;
    }
    const { error } = await supabase.from("space_rsvps").upsert(
      { space_id: spaceId, user_id: user.id, rsvp_type: type },
      { onConflict: "space_id,user_id" }
    );
    if (error) { toast.error("Failed to RSVP"); return; }
    setMyRsvps((prev) => {
      const filtered = prev.filter((r) => r.space_id !== spaceId);
      return [...filtered, { space_id: spaceId, rsvp_type: type }];
    });
    if (!existing) {
      setSpaces((prev) => prev.map((s) => s.id === spaceId && type === "going" ? { ...s, rsvp_count: s.rsvp_count + 1 } : s));
    }
    toast.success(type === "going" ? "You're going! 🎉" : "Maybe added");
  };

  // ── Delete (host only) ───────────────────────────────────────────────────
  const handleDelete = async (spaceId: string) => {
    if (!user) return;
    const { error } = await supabase.from("spaces").delete().eq("id", spaceId).eq("host_id", user.id);
    if (error) { toast.error("Failed to delete"); return; }
    setSpaces((prev) => prev.filter((s) => s.id !== spaceId));
    toast.success("Scheduled space removed");
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#080810] text-white">
      <Toaster />

      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#080810]/95 backdrop-blur-md border-b border-white/5 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors group"
              >
                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                Back
              </button>
            <div className="w-px h-4 bg-white/10" />
            <Calendar className="h-5 w-5 text-purple-400" />
            <h1 className="text-base font-bold text-white">Schedule</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            {user && (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 transition-colors px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                Schedule
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="flex gap-2">
          {(["upcoming", "today", "mine"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                filter === f
                  ? "bg-purple-600/30 border border-purple-500/50 text-purple-300"
                  : "bg-white/5 border border-transparent text-white/40 hover:text-white/70"
              )}
            >
              {f === "upcoming" ? "All Upcoming" : f === "today" ? "Today" : "My Spaces"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 text-purple-400 animate-spin" />
          </div>
        ) : spaces.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="h-10 w-10 text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/30">
              {filter === "mine" ? "You haven't scheduled any spaces yet" :
               filter === "today" ? "No spaces scheduled for today" :
               "No upcoming spaces scheduled"}
            </p>
            {user && (
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 flex items-center gap-1.5 mx-auto bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 px-4 py-2 rounded-xl text-sm transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                Schedule your first space
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {spaces.map((space) => (
              <SpaceCard
                key={space.id}
                space={space}
                myRsvp={myRsvps.find((r) => r.space_id === space.id)}
                isOwner={user?.id === space.host_id}
                onRsvp={handleRsvp}
                onDelete={handleDelete}
                onCalSync={setCalSyncSpace}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateScheduleModal
          onClose={() => setShowCreate(false)}
          onCreated={() => setRefreshKey((k) => k + 1)}
        />
      )}
      {calSyncSpace && (
        <CalSyncModal
          space={calSyncSpace}
          onClose={() => setCalSyncSpace(null)}
        />
      )}
    </div>
  );
}
