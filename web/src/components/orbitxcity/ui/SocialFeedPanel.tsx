import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ExternalLink, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { hasCreatorPresencePerk } from "@/lib/orbitxcity/characterClasses";
import { useCity } from "@/pages/orbitxcity/CityProvider";

interface SocialRow {
  id: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  content: string;
  likes_count: number | null;
  created_at: string;
}

async function loadFeed(): Promise<SocialRow[]> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return [];
  const { data, error } = await supabase
    .from("social_messages")
    .select("id,user_id,username,avatar_url,content,likes_count,created_at")
    .eq("channel", "social-general")
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw error;
  return (data ?? []) as SocialRow[];
}

/** Read/write OrbitX social feed from inside the city. */
export function SocialFeedPanel() {
  const { user, profile } = useAuth();
  const { avatar } = useCity();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const creatorPerk = hasCreatorPresencePerk(avatar.classId);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["oxc-social-feed"],
    queryFn: loadFeed,
    refetchInterval: 20_000,
  });

  const rows = useMemo(() => {
    const list = [...(data ?? [])];
    if (!creatorPerk || !user) return list;
    // Creator presence: pin own posts to the top of the city feed view.
    list.sort((a, b) => {
      const aMine = a.user_id === user.id ? 1 : 0;
      const bMine = b.user_id === user.id ? 1 : 0;
      if (aMine !== bMine) return bMine - aMine;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return list;
  }, [data, creatorPerk, user]);

  const post = useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error("Sign in to post");
      const body = creatorPerk ? `◈ ${content}` : content;
      const { error } = await supabase.from("social_messages").insert({
        channel: "social-general",
        user_id: user.id,
        username: profile?.username || avatar.name || "Anon",
        avatar_url: profile?.avatar_url,
        content: body,
        likes_count: creatorPerk ? 3 : 0,
        liked_by: [],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["oxc-social-feed"] });
      toast.success(creatorPerk ? "Posted with Creator presence aura" : "Posted to OrbitX Social");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Post failed"),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const c = text.trim();
    if (!c) return;
    post.mutate(c);
  };

  return (
    <div className="oxc-stack">
      <p className="oxc-muted">
        Live OrbitX social feed — same posts as /orbitx-social.
        {creatorPerk ? " Creator perk: presence aura pins your posts and seeds +3 likes." : ""}
      </p>

      {creatorPerk && (
        <div className="oxc-tile on" style={{ borderColor: avatar.accentColor }}>
          <div className="oxc-tile-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles className="h-3.5 w-3.5" /> Presence aura active
          </div>
          <p className="oxc-muted">Your signal gets priority placement in the city feed.</p>
        </div>
      )}

      <form className="oxc-chat-form" onSubmit={submit}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder={
            !user
              ? "Sign in to post"
              : creatorPerk
                ? "Broadcast with Creator aura…"
                : "Share something with the city…"
          }
          disabled={!user || post.isPending}
        />
        <button type="submit" className="oxc-btn primary compact" disabled={!user || !text.trim() || post.isPending}>
          {post.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Post"}
        </button>
      </form>

      {isLoading && <div className="oxc-muted">Loading feed…</div>}
      {isError && <div className="oxc-warn">Feed unavailable — check Supabase env.</div>}
      {!isLoading && rows.length === 0 && (
        <div className="oxc-muted">No posts yet. Be the first voice in the city.</div>
      )}

      <div className="oxc-feed-list">
        {rows.map((p) => {
          const mine = Boolean(user && p.user_id === user.id);
          return (
            <div
              key={p.id}
              className="oxc-feed-item"
              style={creatorPerk && mine ? { boxShadow: `inset 3px 0 0 ${avatar.accentColor}` } : undefined}
            >
              <div className="oxc-feed-head">
                <b>
                  @{p.username || "anon"}
                  {creatorPerk && mine ? " · CREATOR" : ""}
                </b>
                <span>{new Date(p.created_at).toLocaleString()}</span>
              </div>
              <p>{p.content}</p>
              <div className="oxc-muted">{p.likes_count ?? 0} likes</div>
            </div>
          );
        })}
      </div>

      <Link className="oxc-btn ghost" to="/orbitx-social">
        Open full Social <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
