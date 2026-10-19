/**
 * PublicCommunityPage — Fancy public join page for communities.
 * Shows community branding, sign-in options for guests,
 * and instant join for authenticated users.
 */
import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

interface Community {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  verified: boolean | null;
  member_count: number | null;
  category: string | null;
  community_links: Array<{ label: string; url: string }> | null;
  created_at: string;
}

export default function PublicCommunityPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [community, setCommunity] = useState<Community | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [joining, setJoining] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase
        .from("communities")
        .select("id,name,description,avatar_url,banner_url,verified,member_count,category,community_links,created_at")
        .eq("id", id)
        .single();
      if (error || !data) {
        setNotFound(true);
      } else {
        setCommunity(data as Community);
      }
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      const { data } = await supabase
        .from("community_members")
        .select("id")
        .eq("community_id", id)
        .eq("user_id", user.id)
        .limit(1);
      setIsMember(!!data && data.length > 0);
    })();
  }, [user, id]);

  const handleJoin = async () => {
    if (!user || !community || joining || isMember) return;
    setJoining(true);
    try {
      const { error } = await supabase.from("community_members").insert({
        community_id: community.id,
        user_id: user.id,
        role: "member",
      });
      if (error) throw error;
      setIsMember(true);
      // Go to the community
      navigate("/communities");
    } catch (e) {
      console.error("Join failed:", e);
    } finally {
      setJoining(false);
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: community?.name, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <p className="text-white/60">Loading community…</p>
        </div>
      </div>
    );
  }

  if (notFound || !community) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white p-6">
        <div className="text-center">
          <p className="text-2xl font-bold">Community not found</p>
          <p className="mt-2 text-white/50">This link may be invalid or the community was removed.</p>
          <Link to="/orbitx-social" className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 font-bold hover:bg-blue-700">
            Explore OrbitX
          </Link>
        </div>
      </div>
    );
  }

  const links = Array.isArray(community.community_links) ? community.community_links : [];

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-blue-600/20 blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-purple-600/20 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      <div className="relative">
        {/* Banner */}
        <div className="relative h-56 sm:h-72 overflow-hidden">
          {community.banner_url ? (
            <img src={community.banner_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-blue-900 via-purple-900 to-black" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        </div>

        <div className="mx-auto max-w-2xl px-4 pb-16">
          {/* Avatar + Name */}
          <div className="-mt-16 mb-6 flex flex-col items-center text-center">
            <div className="h-32 w-32 overflow-hidden rounded-3xl border-4 border-black bg-gray-800 shadow-2xl">
              {community.avatar_url ? (
                <img src={community.avatar_url} alt={community.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-5xl font-bold text-white/40 bg-gradient-to-br from-blue-800 to-purple-800">
                  {community.name.charAt(0)}
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center gap-2 justify-center">
              <h1 className="text-3xl font-black tracking-tight">{community.name}</h1>
              {community.verified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 px-3 py-1 text-xs font-black text-black shadow-lg">
                  ✓ VERIFIED
                </span>
              )}
            </div>

            {community.category && (
              <p className="mt-1 text-sm font-medium text-blue-300">{community.category}</p>
            )}

            <div className="mt-2 flex items-center gap-4 text-sm text-white/50">
              <span className="flex items-center gap-1">
                <span className="font-bold text-white">{community.member_count ?? 0}</span> members
              </span>
              <span>•</span>
              <span>Public community</span>
            </div>
          </div>

          {/* Description */}
          {community.description && (
            <p className="text-center text-white/70 leading-relaxed max-w-lg mx-auto">
              {community.description}
            </p>
          )}

          {/* Join / Sign-in Card */}
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 sm:p-8">
            {!user ? (
              <>
                <h2 className="text-xl font-bold text-center">Join {community.name}</h2>
                <p className="mt-2 text-sm text-white/50 text-center">
                  Sign in to join the community, chat, and participate
                </p>

                <div className="mt-6 space-y-3">
                  <button
                    onClick={() => navigate(`/auth?redirect=/c/${community.id}`)}
                    className="w-full rounded-2xl bg-black border border-white/20 px-6 py-4 font-bold hover:bg-white/5 transition-all flex items-center justify-center gap-3"
                  >
                    <span className="text-xl">𝕏</span>
                    Continue with X
                  </button>
                  <button
                    onClick={() => navigate(`/auth?redirect=/c/${community.id}`)}
                    className="w-full rounded-2xl bg-blue-600 px-6 py-4 font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-3"
                  >
                    <span className="text-xl">✉️</span>
                    Continue with Email
                  </button>
                  <button
                    onClick={() => navigate(`/auth?redirect=/c/${community.id}`)}
                    className="w-full rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 font-bold hover:opacity-90 transition-all flex items-center justify-center gap-3"
                  >
                    <span className="text-xl">👛</span>
                    Connect Wallet
                  </button>
                </div>

                <p className="mt-4 text-xs text-white/30 text-center">
                  Free to join • No credit card required
                </p>
              </>
            ) : isMember ? (
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
                  <span className="text-2xl">✓</span>
                </div>
                <h2 className="text-xl font-bold">You're a member!</h2>
                <button
                  onClick={() => navigate("/communities")}
                  className="mt-4 w-full rounded-2xl bg-blue-600 px-6 py-4 font-bold hover:bg-blue-700 transition-all"
                >
                  Open Community
                </button>
              </div>
            ) : (
              <div className="text-center">
                <h2 className="text-xl font-bold">You're one tap away</h2>
                <p className="mt-2 text-sm text-white/50">Join {community.name} instantly</p>
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  className="mt-4 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 font-black text-lg hover:opacity-90 transition-all disabled:opacity-50 shadow-lg"
                >
                  {joining ? "Joining…" : `Join ${community.name}`}
                </button>
              </div>
            )}
          </div>

          {/* Links */}
          {links.length > 0 && (
            <div className="mt-8">
              <h2 className="text-sm font-bold text-white/40 uppercase tracking-widest text-center mb-4">
                Official Links
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {links.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 hover:bg-white/[0.07] hover:border-blue-500/30 transition-all group"
                  >
                    <span className="font-bold">{link.label}</span>
                    <span className="text-blue-400 group-hover:translate-x-1 transition-transform">→</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Share */}
          <div className="mt-8 text-center">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold hover:bg-white/10 transition-all"
            >
              {copied ? "✓ Link copied!" : "Share this community"}
            </button>
          </div>

          {/* Footer */}
          <p className="mt-12 text-center text-xs text-white/25">
            Powered by <span className="font-bold text-white/40">OrbitX</span>
          </p>
        </div>
      </div>
    </div>
  );
}
