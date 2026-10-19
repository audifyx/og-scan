/**
 * PublicCommunityPage — Public sharable community page.
 * No auth required. Shows community info, avatar, banner, description, links.
 */
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";

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
  const [community, setCommunity] = useState<Community | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-white/60">Loading community…</p>
      </div>
    );
  }

  if (notFound || !community) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <p className="text-xl font-bold">Community not found</p>
          <Link to="/orbitx-social" className="mt-4 inline-block text-blue-400 hover:underline">
            Back to OrbitX Social
          </Link>
        </div>
      </div>
    );
  }

  const links = Array.isArray(community.community_links) ? community.community_links : [];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Banner */}
      <div className="relative h-48 sm:h-64 overflow-hidden bg-gradient-to-br from-blue-900 to-black">
        {community.banner_url && (
          <img src={community.banner_url} alt="" className="h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
      </div>

      <div className="mx-auto max-w-2xl px-4 pb-16">
        {/* Avatar + Name */}
        <div className="-mt-12 mb-4 flex items-end gap-4">
          <div className="h-24 w-24 overflow-hidden rounded-2xl border-4 border-black bg-gray-800">
            {community.avatar_url ? (
              <img src={community.avatar_url} alt={community.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-white/40">
                {community.name.charAt(0)}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{community.name}</h1>
          {community.verified && (
            <span className="inline-flex items-center rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-bold text-yellow-400 border border-yellow-500/40">
              ✓ Verified
            </span>
          )}
        </div>

        {community.category && (
          <p className="mt-1 text-sm text-white/50">{community.category}</p>
        )}

        {community.description && (
          <p className="mt-3 text-white/80">{community.description}</p>
        )}

        <p className="mt-2 text-sm text-white/40">
          {community.member_count ?? 0} members
        </p>

        {/* Links */}
        {links.length > 0 && (
          <div className="mt-6 space-y-2">
            <h2 className="text-sm font-bold text-white/60 uppercase">Links</h2>
            {links.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl bg-white/5 px-4 py-3 hover:bg-white/10 transition-colors"
              >
                <span className="font-medium">{link.label}</span>
                <span className="block text-xs text-white/40 truncate">{link.url}</span>
              </a>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-8 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 p-6 text-center">
          <p className="font-bold text-lg">Join the conversation on OrbitX</p>
          <p className="mt-1 text-sm text-white/70">Connect your wallet or X account to join</p>
          <Link
            to="/orbitx-social"
            className="mt-4 inline-block rounded-xl bg-white px-6 py-3 font-bold text-black hover:bg-gray-200 transition-colors"
          >
            Open OrbitX Social
          </Link>
        </div>
      </div>
    </div>
  );
}
