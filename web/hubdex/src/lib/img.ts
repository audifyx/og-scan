// Reliable image delivery for third-party token logos/banners.
// Many sources are slow (ipfs.io), tiny/blank, or hotlink-protected. We route
// them through wsrv.nl, a fast CDN image proxy that caches, resizes and
// re-encodes to webp — so featured/token images load consistently everywhere.
export function imgProxy(url?: string | null, size = 160): string | undefined {
  if (!url) return undefined;
  const u = url.trim();
  if (!u || u.startsWith("data:")) return u || undefined;
  // strip protocol for wsrv's url param (it accepts host/path)
  const stripped = u.replace(/^https?:\/\//, "");
  const q = `url=${encodeURIComponent(stripped)}&w=${size}&h=${size}&fit=cover&output=webp&we&default=1`;
  return `https://wsrv.nl/?${q}`;
}
