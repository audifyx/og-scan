import { supabase } from "@/lib/supabase";
import type { ThemePack } from "./osStore";

/**
 * OrbitX OS theme gallery — community packs in Supabase table `os_themes`
 * (id, owner, name, pack jsonb, created_at). Public read, owner-only
 * writes via RLS. Fails soft everywhere: the local Theme Store works
 * without the gallery.
 */

export interface GalleryTheme {
  id: string;
  owner: string;
  name: string;
  pack: ThemePack;
  createdAt: string;
}

function isPack(v: unknown): v is ThemePack {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    typeof p.name === "string" &&
    typeof p.wallpaper === "string" &&
    typeof p.accent === "string" &&
    typeof p.radius === "number"
  );
}

/** Public packs, newest first. [] on any failure. */
export async function fetchGalleryThemes(): Promise<GalleryTheme[]> {
  try {
    const { data, error } = await supabase
      .from("os_themes")
      .select("id, owner, name, pack, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error || !Array.isArray(data)) return [];
    return data
      .filter((r: any) => r && typeof r.id === "string" && isPack(r.pack))
      .map((r: any) => ({
        id: r.id as string,
        owner: (r.owner as string) || "",
        name: (r.name as string) || (r.pack as ThemePack).name,
        pack: r.pack as ThemePack,
        createdAt: (r.created_at as string) || "",
      }));
  } catch {
    return [];
  }
}

/** Publish one of the user's packs. Requires a signed-in session. */
export async function publishGalleryTheme(
  owner: string,
  pack: ThemePack,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const { error } = await supabase.from("os_themes").insert({
      owner,
      name: pack.name,
      pack,
    });
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  } catch {
    return { ok: false, reason: "Gallery unreachable" };
  }
}

/** Delete a gallery pack (RLS enforces owner-only). */
export async function deleteGalleryTheme(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("os_themes").delete().eq("id", id);
    return !error;
  } catch {
    return false;
  }
}
