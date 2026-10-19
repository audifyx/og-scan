/**
 * LaunchpadComments — per-token comment thread for the OrbitX Launchpad.
 * Read-only ethos: anonymous posting with a username field, no auth required.
 * Comments live in Supabase table `launchpad_comments` (see SQL below).
 * If the table doesn't exist yet, fails gracefully with "Comments coming soon".
 *
 * Usage:
 *   import LaunchpadComments from "@/components/LaunchpadComments";
 *   <LaunchpadComments mint={token.mint} />
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface Comment {
  id: string;
  mint: string;
  username: string;
  body: string;
  created_at: string;
}

const MAX_LEN = 280;
const LS_KEY = "launchpad_my_comments";
const TABLE_MISSING_CODES = new Set(["42P01", "PGRST205"]);

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function getMyIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}

function addMyId(id: string) {
  try {
    const ids = getMyIds();
    if (!ids.includes(id)) {
      ids.push(id);
      localStorage.setItem(LS_KEY, JSON.stringify(ids));
    }
  } catch { /* storage unavailable — ignore */ }
}

function removeMyId(id: string) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(getMyIds().filter((x) => x !== id)));
  } catch { /* ignore */ }
}

export default function LaunchpadComments({ mint }: { mint: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [username, setUsername] = useState("");
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [myIds, setMyIds] = useState<string[]>([]);

  useEffect(() => {
    setMyIds(getMyIds());
    try {
      setUsername(localStorage.getItem("launchpad_username") || "");
    } catch { /* ignore */ }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setTableMissing(false);
    const { data, error } = await supabase
      .from("launchpad_comments")
      .select("id,mint,username,body,created_at")
      .eq("mint", mint)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      if (TABLE_MISSING_CODES.has(error.code)) {
        setTableMissing(true);
      } else {
        setError("Couldn't load comments.");
      }
      setLoading(false);
      return;
    }
    setComments((data || []) as Comment[]);
    setLoading(false);
  }, [mint]);

  useEffect(() => {
    load();
  }, [load]);

  const post = async () => {
    const name = username.trim().slice(0, 24);
    const text = body.trim().slice(0, MAX_LEN);
    if (!name || !text || posting) return;
    setPosting(true);
    setError(null);
    const { data, error } = await supabase
      .from("launchpad_comments")
      .insert({ mint, username: name, body: text })
      .select("id,mint,username,body,created_at")
      .single();
    setPosting(false);
    if (error) {
      if (TABLE_MISSING_CODES.has(error.code)) {
        setTableMissing(true);
      } else {
        setError("Couldn't post. Try again.");
      }
      return;
    }
    if (data) {
      addMyId(data.id);
      setMyIds(getMyIds());
      try {
        localStorage.setItem("launchpad_username", name);
      } catch { /* ignore */ }
      setComments((prev) => [data as Comment, ...prev]);
      setBody("");
    }
  };

  const remove = async (id: string) => {
    if (deleting) return;
    setDeleting(id);
    const { error } = await supabase.from("launchpad_comments").delete().eq("id", id);
    setDeleting(null);
    if (error) {
      setError("Couldn't delete. Try again.");
      return;
    }
    removeMyId(id);
    setMyIds(getMyIds());
    setComments((prev) => prev.filter((c) => c.id !== id));
  };

  if (tableMissing) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
        <p className="font-bold text-white/50">Comments coming soon</p>
        <p className="mt-1 text-sm text-white/30">The comment feed isn't live yet — check back shortly.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h3 className="text-lg font-bold">
        Comments <span className="text-sm font-normal text-white/40">({comments.length})</span>
      </h3>

      {/* Post box */}
      <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-4">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          maxLength={24}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-blue-500/50"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, MAX_LEN))}
          placeholder="What do you think of this token?"
          rows={3}
          className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-blue-500/50"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className={`text-xs ${body.length >= MAX_LEN ? "text-red-400" : "text-white/30"}`}>
            {body.length}/{MAX_LEN}
          </span>
          <button
            onClick={post}
            disabled={posting || !username.trim() || !body.trim()}
            className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {posting ? "Posting…" : "Post"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-400">{error}</p>
      )}

      {/* Thread */}
      <div className="mt-4 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
          ))
        ) : comments.length === 0 ? (
          <p className="py-4 text-center text-sm text-white/30">No comments yet — be the first.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="rounded-xl border border-white/5 bg-black/30 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-blue-300">{c.username}</span>
                  <span className="text-xs text-white/30">{timeAgo(c.created_at)}</span>
                  {myIds.includes(c.id) && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/40">you</span>
                  )}
                </div>
                {myIds.includes(c.id) && (
                  <button
                    onClick={() => remove(c.id)}
                    disabled={deleting === c.id}
                    className="text-xs text-white/30 transition-colors hover:text-red-400 disabled:opacity-40"
                  >
                    {deleting === c.id ? "Deleting…" : "Delete"}
                  </button>
                )}
              </div>
              <p className="mt-1 text-sm text-white/80 whitespace-pre-wrap break-words">{c.body}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
