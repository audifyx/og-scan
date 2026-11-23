/**
 * Sanitizer for OG share pages (audit B1).
 *
 * /share/:mint and /sharew/:address proxy HTML from the Supabase edge
 * functions token-og / wallet-og, whose source is NOT in this repo —
 * their escaping of the mint / address / PnL query params cannot be
 * verified from here. The pages only need OpenGraph/Twitter meta tags
 * to work, so the proxy strips everything executable before serving
 * the HTML first-party: script/iframe/object/embed/form/base/link
 * elements, meta-refresh redirects, inline event handlers, and
 * javascript: URLs. Ordinary meta tags, titles and plain markup pass
 * through untouched.
 */
export function sanitizeOgHtml(html) {
  let out = String(html || "");
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "");
  out = out.replace(/<script\b[^>]*\/?>/gi, "");
  out = out.replace(/<(iframe|object|embed|form|base|link)\b[^>]*>/gi, "");
  out = out.replace(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh[^>]*>/gi, "");
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/(href|content|action)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, "$1=$2#$2");
  return out;
}
