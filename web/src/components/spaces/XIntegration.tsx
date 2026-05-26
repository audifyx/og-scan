/**
 * XIntegration — Twitter/X Spaces integration panel
 *
 * Features:
 *  1. Cross-post to X — when going live, auto-tweet with public listener link
 *  2. X Space Card — paste any X Space URL to create a card in the Spaces feed
 *  3. Schedule Sync — add X Spaces events to OGScan calendar
 *  4. X Handle linking (stored in profiles.twitter_handle)
 *
 * NOTE: We cannot bridge X Space audio (X API doesn't allow audio relay).
 * Instead we surface X Spaces as discoverable cards with deep-link join.
 */

import React, { useState, useEffect } from "react";
import { Twitter, ExternalLink, Copy, Check, Link as LinkIcon, Plus, X as XIcon, Radio, Calendar, Loader2, Headphones, AlertCircle, Globe } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface XSpaceCard {
  id: string;
  user_id: string;
  username: string;
  title: string;
  x_space_url: string;
  x_handle: string | null;
  scheduled_for: string | null;
  is_live: boolean;
  listener_count: number | null;
  created_at: string;
}

interface Props {
  spaceId?: string;        // If inside a live space, for cross-post
  spaceTitle?: string;
  mode?: "crosspost" | "card" | "full";
  onClose?: () => void;
  accentBtn?: string;
}

export default function XIntegration({ spaceId, spaceTitle, mode = "full", onClose, accentBtn = "bg-violet-600 hover:bg-violet-500" }: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<"crosspost" | "card" | "sync">("crosspost");
  const [xHandle, setXHandle] = useState("");
  const [xSpaceUrl, setXSpaceUrl] = useState("");
  const [xSpaceTitle, setXSpaceTitle] = useState("");
  const [xScheduled, setXScheduled] = useState("");
  const [tweetDraft, setTweetDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedHandle, setSavedHandle] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [xCards, setXCards] = useState<XSpaceCard[]>([]);

  const publicUrl = spaceId ? `https://ogscan.fun/space/${spaceId}` : `https://ogscan.fun/spaces`;

  /* ── Load profile handle & X cards ── */
  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("twitter_handle")
        .eq("user_id", user.id)
        .single();
      if (profile?.twitter_handle) {
        setSavedHandle(profile.twitter_handle);
        setXHandle(profile.twitter_handle);
      }

      const { data: cards } = await supabase
        .from("x_space_cards")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      setXCards((cards as XSpaceCard[]) || []);
    }
    load();
  }, [user]);

  /* ── Generate tweet draft ── */
  useEffect(() => {
    const title = spaceTitle || "Live Crypto Space on OGScan";
    const handle = savedHandle ? `\n\nHosted by @${savedHandle.replace("@", "")}` : "";
    setTweetDraft(`🎙️ I'm live on OGScan Spaces!\n\n"${title}"${handle}\n\nAnyone can listen — no login needed:\n${publicUrl}\n\n#OGScan #CryptoSpaces`);
  }, [spaceTitle, savedHandle, publicUrl]);

  /* ── Save X handle ── */
  const saveHandle = async () => {
    if (!user || !xHandle) return;
    setLoading(true);
    const clean = xHandle.replace("@", "").trim();
    await supabase.from("profiles").update({ twitter_handle: clean }).eq("user_id", user.id);
    setSavedHandle(clean);
    toast.success("X handle saved!");
    setLoading(false);
  };

  /* ── Open tweet compose ── */
  const composeTweet = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetDraft)}`;
    window.open(url, "_blank", "width=600,height=500");
  };

  /* ── Add X Space card ── */
  const addXCard = async () => {
    if (!user || !xSpaceUrl) return;
    if (!xSpaceUrl.includes("twitter.com") && !xSpaceUrl.includes("x.com")) {
      toast.error("Please enter a valid X/Twitter Space URL");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("x_space_cards").insert({
        user_id: user.id,
        username: savedHandle || "anonymous",
        title: xSpaceTitle || "X Space",
        x_space_url: xSpaceUrl,
        x_handle: savedHandle,
        scheduled_for: xScheduled || null,
        is_live: true,
        listener_count: null,
      });
      if (error) throw error;
      toast.success("X Space card added to OGScan feed!");
      setXSpaceUrl("");
      setXSpaceTitle("");
      setXScheduled("");
      // Reload
      const { data: cards } = await supabase.from("x_space_cards").select("*").order("created_at", { ascending: false }).limit(20);
      setXCards((cards as XSpaceCard[]) || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to add card");
    }
    setLoading(false);
  };

  /* ── Delete X card ── */
  const deleteCard = async (id: string) => {
    await supabase.from("x_space_cards").delete().eq("id", id);
    setXCards(prev => prev.filter(c => c.id !== id));
    toast.success("Card removed");
  };

  const copyTweet = () => {
    navigator.clipboard.writeText(tweetDraft);
    setCopied(true);
    toast.success("Tweet copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (mode === "crosspost") {
    /* ── Inline cross-post panel (inside host controls) ── */
    return (
      <div className="space-y-3">
        <p className="text-xs text-white/40">Cross-post this space to X to reach your followers:</p>
        <div className="bg-black/30 rounded-xl border border-white/10 p-3">
          <textarea
            value={tweetDraft}
            onChange={e => setTweetDraft(e.target.value)}
            rows={5}
            className="w-full bg-transparent text-xs text-white/70 resize-none outline-none leading-relaxed"
          />
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
            <span className="text-[10px] text-white/25">{tweetDraft.length}/280</span>
            <div className="flex gap-2">
              <button onClick={copyTweet} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-white/50 border border-white/10 transition-all">
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                Copy
              </button>
              <button
                onClick={composeTweet}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1d9bf0] hover:bg-[#1a8cd8] text-[11px] font-semibold text-white transition-all"
              >
                <Twitter className="h-3 w-3" />
                Post to X
              </button>
            </div>
          </div>
        </div>
        {!savedHandle && (
          <p className="text-[10px] text-amber-400/70 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Add your X handle in Profile → Settings to include your @mention
          </p>
        )}
      </div>
    );
  }

  /* ── FULL MODE ── */
  return (
    <div className="bg-[#0c101e] border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-white/8">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-[#1d9bf0]/15 flex items-center justify-center">
            <Twitter className="h-4 w-4 text-[#1d9bf0]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">X Integration</h3>
            <p className="text-xs text-white/35">Cross-post, share, and discover X Spaces</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="h-7 w-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all">
            <XIcon className="h-3.5 w-3.5 text-white/50" />
          </button>
        )}
      </div>

      {/* X Handle section */}
      <div className="p-5 border-b border-white/5">
        <p className="text-xs text-white/40 mb-2 font-medium">Your X Handle</p>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
            <span className="text-white/30 text-sm">@</span>
            <input
              value={xHandle}
              onChange={e => setXHandle(e.target.value)}
              placeholder="yourhandle"
              className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/20"
            />
          </div>
          <button
            onClick={saveHandle}
            disabled={loading || !xHandle || xHandle.replace("@", "") === savedHandle?.replace("@", "")}
            className={cn("px-4 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-40", accentBtn)}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </button>
        </div>
        {savedHandle && (
          <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
            <Check className="h-3 w-3" />
            Linked: @{savedHandle.replace("@", "")}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-3 bg-white/3 border-b border-white/5">
        {(["crosspost", "card", "sync"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn("flex-1 py-1.5 rounded-lg text-xs font-medium transition-all", tab === t ? "bg-white/10 text-white" : "text-white/35 hover:text-white/60")}
          >
            {t === "crosspost" ? "📢 Cross-Post" : t === "card" ? "🃏 X Space Card" : "📅 Schedule Sync"}
          </button>
        ))}
      </div>

      <div className="p-5">
        {/* ── Cross-post tab ── */}
        {tab === "crosspost" && (
          <div className="space-y-4">
            <p className="text-xs text-white/40">
              Post a tweet to let your X followers know you're live on OGScan.
              Anyone can listen without an account.
            </p>
            <div className="bg-black/30 rounded-xl border border-white/8 p-4">
              <textarea
                value={tweetDraft}
                onChange={e => setTweetDraft(e.target.value)}
                rows={6}
                className="w-full bg-transparent text-sm text-white/75 resize-none outline-none leading-relaxed"
              />
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                <span className={cn("text-xs", tweetDraft.length > 280 ? "text-red-400" : "text-white/25")}>
                  {tweetDraft.length}/280
                </span>
                <div className="flex gap-2">
                  <button onClick={copyTweet} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/50 transition-all">
                    {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    onClick={composeTweet}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#1d9bf0] hover:bg-[#1a8cd8] text-xs font-bold text-white transition-all"
                  >
                    <Twitter className="h-3.5 w-3.5" />
                    Post to X
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
              <AlertCircle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-400/80">
                The public listener link lets anyone tune in instantly — no OGScan account needed.
                Great for growing your audience from X.
              </p>
            </div>
          </div>
        )}

        {/* ── X Space card tab ── */}
        {tab === "card" && (
          <div className="space-y-4">
            <p className="text-xs text-white/40">
              Hosting a Space on X? Paste the URL below to create a card in the OGScan Spaces feed.
              Your OGScan followers will see it and can jump over to join on X.
            </p>

            {/* Input form */}
            <div className="space-y-2">
              <input
                value={xSpaceTitle}
                onChange={e => setXSpaceTitle(e.target.value)}
                placeholder="Space title (e.g. Alpha calls this weekend)"
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/20 transition-all"
              />
              <input
                value={xSpaceUrl}
                onChange={e => setXSpaceUrl(e.target.value)}
                placeholder="https://twitter.com/i/spaces/..."
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/20 transition-all"
              />
              <button
                onClick={addXCard}
                disabled={loading || !xSpaceUrl}
                className={cn("w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40", accentBtn)}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add X Space Card to Feed
              </button>
            </div>

            {/* Existing cards */}
            {xCards.length > 0 && (
              <div className="space-y-2 mt-4">
                <p className="text-xs text-white/30 font-medium">Your X Space Cards</p>
                {xCards.map(card => (
                  <div key={card.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/8">
                    <div className="h-8 w-8 rounded-lg bg-[#1d9bf0]/10 flex items-center justify-center flex-shrink-0">
                      <Twitter className="h-3.5 w-3.5 text-[#1d9bf0]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white/80 truncate">{card.title}</p>
                      <p className="text-[10px] text-white/30 truncate">{card.x_space_url}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <a href={card.x_space_url} target="_blank" rel="noopener noreferrer"
                        className="h-7 w-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all">
                        <ExternalLink className="h-3 w-3 text-white/40" />
                      </a>
                      <button onClick={() => deleteCard(card.id)}
                        className="h-7 w-7 rounded-lg bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 flex items-center justify-center transition-all">
                        <XIcon className="h-3 w-3 text-white/30 hover:text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Schedule sync tab ── */}
        {tab === "sync" && (
          <div className="space-y-4">
            <p className="text-xs text-white/40">
              Got an upcoming X Space? Add it to OGScan so your followers get notified when it starts.
            </p>
            <div className="space-y-2">
              <input
                value={xSpaceTitle}
                onChange={e => setXSpaceTitle(e.target.value)}
                placeholder="Upcoming X Space title"
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/20 transition-all"
              />
              <input
                value={xSpaceUrl}
                onChange={e => setXSpaceUrl(e.target.value)}
                placeholder="https://twitter.com/i/spaces/..."
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/20 transition-all"
              />
              <input
                type="datetime-local"
                value={xScheduled}
                onChange={e => setXScheduled(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white/70 outline-none focus:border-white/20 transition-all"
              />
              <button
                onClick={addXCard}
                disabled={loading || !xSpaceUrl || !xScheduled}
                className={cn("w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40", accentBtn)}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                Schedule on OGScan
              </button>
            </div>
            <div className="p-3 rounded-xl bg-white/3 border border-white/8">
              <p className="text-xs text-white/40 leading-relaxed">
                <span className="text-white/60 font-medium">How it works:</span><br />
                Your followers on OGScan will see this upcoming event on your profile page and in the Spaces feed.
                When the time arrives, they'll get a notification. You'll still host it on X — this just surfaces it here.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
