import React from "react";

/**
 * URL sanitizer for markdown-rendered links.
 *
 * react-markdown does NOT sanitize hrefs: `[x](javascript:alert(1))` renders a
 * clickable link. AI-generated chat content (hub, AI widgets, token analysis)
 * is an injection surface for exactly this, so every markdown `a` renderer in
 * the app must route hrefs through here.
 */
const SAFE_URL_RE = /^(https?:\/\/|mailto:)/i;

export function sanitizeHref(href?: string | null): string | undefined {
  if (!href) return undefined;
  const h = String(href).trim();
  // Block javascript:, data:, vbscript:, file:, blob: and other exotic schemes.
  // Also reject control characters that can smuggle scheme breaks.
  if (/[\u0000-\u001f\u007f]/.test(h)) return undefined;
  if (!SAFE_URL_RE.test(h)) return undefined;
  return h;
}

interface SafeLinkProps {
  href?: string;
  children?: React.ReactNode;
  className?: string;
}

/** Drop-in safe replacement for `<a>` inside ReactMarkdown `components`. */
export function SafeLink({ href, children, className }: SafeLinkProps) {
  const safe = sanitizeHref(href);
  if (!safe) return <span className={className}>{children}</span>;
  return (
    <a href={safe} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}
