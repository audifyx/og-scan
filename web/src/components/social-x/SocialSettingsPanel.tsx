/**
 * OrbitX Social — in-app social settings panel.
 *
 * DEFAULT export, props { onClose?: () => void }.
 * Sections:
 *   1. Feed tuning toggles — hide reposts, hide replies, show only
 *      following. Persisted to localStorage (`orbitx-social-feed-prefs`)
 *      on this device for now; W1 reads them when rendering the feed.
 *   2. Mute list — fetched from GET /api/social/mutes, unmute via DELETE.
 *   3. Block list — fetched from GET /api/social/blocks, unblock via DELETE.
 *
 * Mutes/blocks hit the signed-in API with the Supabase session JWT
 * (Authorization: Bearer). Signed-out users see the toggles + a sign-in
 * hint instead of the lists.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Ban, Loader2, Settings, VolumeX, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

const PREFS_KEY = "orbitx-social-feed-prefs";

export interface SocialFeedPrefs {
  hideReposts: boolean;
  hideReplies: boolean;
  onlyFollowing: boolean;
}

export const DEFAULT_FEED_PREFS: SocialFeedPrefs = {
  hideReposts: false,
  hideReplies: false,
  onlyFollowing: false,
};

/** Read the persisted feed-tuning prefs (what W1 applies when rendering). */
export function getSocialFeedPrefs(): SocialFeedPrefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_FEED_PREFS };
    const parsed = JSON.parse(raw) as Partial<SocialFeedPrefs>;
    return { ...DEFAULT_FEED_PREFS, ...parsed };
  } catch {
    return { ...DEFAULT_FEED_PREFS };
  }
}

function saveSocialFeedPrefs(prefs: SocialFeedPrefs): void {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode — prefs live for this session only */
  }
}

interface ListedUser {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl bg-black/40 px-3 py-2.5 text-left"
    >
      <span className="min-w-0">
        <span className="block text-[13px] font-bold text-white">{label}</span>
        <span className="block text-[11px] text-white/40">{hint}</span>
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-[#e8b84a]" : "bg-white/15"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}

export default function SocialSettingsPanel({ onClose }: { onClose?: () => void }) {
  const [prefs, setPrefs] = useState<SocialFeedPrefs>({ ...DEFAULT_FEED_PREFS });
  const [mutes, setMutes] = useState<ListedUser[] | null>(null);
  const [blocks, setBlocks] = useState<ListedUser[] | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPrefs(getSocialFeedPrefs());
  }, []);

  const loadLists = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers.Authorization) {
      setSignedIn(false);
      setMutes([]);
      setBlocks([]);
      return;
    }
    setSignedIn(true);
    try {
      const [mRes, bRes] = await Promise.all([
        fetch("/api/social/mutes", { headers }),
        fetch("/api/social/blocks", { headers }),
      ]);
      const mJson = mRes.ok ? await mRes.json() : null;
      const bJson = bRes.ok ? await bRes.json() : null;
      setMutes(Array.isArray(mJson?.mutes) ? mJson.mutes : []);
      setBlocks(Array.isArray(bJson?.blocks) ? bJson.blocks : []);
    } catch {
      setError("Could not load your mute / block lists. Check your connection and try again.");
    }
  }, []);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  const updatePref = (key: keyof SocialFeedPrefs, next: boolean) => {
    setPrefs((prev) => {
      const updated = { ...prev, [key]: next };
      saveSocialFeedPrefs(updated);
      return updated;
    });
  };

  const unlist = async (kind: "mutes" | "blocks", userId: string) => {
    setBusyId(`${kind}:${userId}`);
    setError(null);
    try {
      const headers = await authHeaders();
      const r = await fetch(`/api/social/${kind}?userId=${encodeURIComponent(userId)}`, {
        method: "DELETE",
        headers,
      });
      if (!r.ok) throw new Error("request failed");
      if (kind === "mutes") setMutes((prev) => (prev || []).filter((u) => u.user_id !== userId));
      else setBlocks((prev) => (prev || []).filter((u) => u.user_id !== userId));
    } catch {
      setError("That didn't work — please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const renderList = (kind: "mutes" | "blocks", list: ListedUser[] | null, emptyText: string, actionLabel: string) => {
    if (list === null) {
      return (
        <div className="flex items-center gap-2 px-1 py-2 text-[13px] text-white/40">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      );
    }
    if (!list.length) return <div className="px-1 py-2 text-[13px] text-white/40">{emptyText}</div>;
    return (
      <ul className="space-y-2">
        {list.map((u) => (
          <li key={u.user_id} className="flex items-center gap-2.5 rounded-xl bg-black/40 px-3 py-2">
            {u.avatar_url ? (
              <img src={u.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-white/10" />
            ) : (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e8b84a]/15 text-[12px] font-extrabold text-[#e8b84a]">
                {(u.display_name || u.username || "?").slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold text-white">
                {u.display_name || u.username || "Unknown account"}
              </span>
              {u.username && <span className="block truncate text-[11px] text-white/40">@{u.username}</span>}
            </span>
            <button
              type="button"
              disabled={busyId === `${kind}:${u.user_id}`}
              onClick={() => void unlist(kind, u.user_id)}
              className="shrink-0 rounded-full border border-[#e8b84a]/40 px-3 py-1 text-[12px] font-bold text-[#e8b84a] disabled:opacity-50"
            >
              {busyId === `${kind}:${u.user_id}` ? "…" : actionLabel}
            </button>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b0b0d] p-4">
      <div className="mb-4 flex items-center gap-2">
        <Settings className="h-4 w-4 text-[#e8b84a]" />
        <span className="text-[15px] font-extrabold text-white">Social settings</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="ml-auto grid h-8 w-8 place-items-center rounded-full bg-white/5 text-white/60"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-white/40">Feed tuning</div>
      <div className="space-y-2">
        <Toggle
          label="Hide reposts"
          hint="Reposts won't appear in your home feed."
          checked={prefs.hideReposts}
          onChange={(v) => updatePref("hideReposts", v)}
        />
        <Toggle
          label="Hide replies"
          hint="Replies to other people's posts won't appear in your home feed."
          checked={prefs.hideReplies}
          onChange={(v) => updatePref("hideReplies", v)}
        />
        <Toggle
          label="Only people I follow"
          hint="Show posts only from accounts you follow."
          checked={prefs.onlyFollowing}
          onChange={(v) => updatePref("onlyFollowing", v)}
        />
      </div>
      <p className="mt-2 text-[11px] text-white/30">Feed tuning is saved on this device for now.</p>

      <div className="mb-1.5 mt-5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/40">
        <VolumeX className="h-3.5 w-3.5" /> Muted accounts
        {mutes !== null && <span className="text-white/30">· {mutes.length}</span>}
      </div>
      {signedIn === false ? (
        <div className="px-1 py-2 text-[13px] text-white/40">Sign in to manage your mute list.</div>
      ) : (
        renderList("mutes", mutes, "Nobody muted. Muted accounts' posts stay out of your feed.", "Unmute")
      )}

      <div className="mb-1.5 mt-5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/40">
        <Ban className="h-3.5 w-3.5" /> Blocked accounts
        {blocks !== null && <span className="text-white/30">· {blocks.length}</span>}
      </div>
      {signedIn === false ? (
        <div className="px-1 py-2 text-[13px] text-white/40">Sign in to manage your block list.</div>
      ) : (
        renderList("blocks", blocks, "Nobody blocked. Blocked accounts can't interact with you.", "Unblock")
      )}

      {error && <div className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-[12px] font-semibold text-red-300">{error}</div>}
    </div>
  );
}
