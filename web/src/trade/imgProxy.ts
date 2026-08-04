/**
 * Reliable token logo delivery via wsrv.nl (cache + webp resize).
 * Raw IPFS / hotlink-protected URLs often blank in Trade UI without this.
 */
export function imgProxy(url?: string | null, size = 160): string | undefined {
  if (!url) return undefined;
  const u = url.trim();
  if (!u || u.startsWith("data:")) return u || undefined;
  const stripped = u.replace(/^https?:\/\//, "");
  const q = `url=${encodeURIComponent(stripped)}&w=${size}&h=${size}&fit=cover&output=webp&we&default=1`;
  return `https://wsrv.nl/?${q}`;
}
