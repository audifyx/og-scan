/** Unified platform legal & docs URLs — use in every product footer. */
export const PLATFORM_LINKS = {
  whitepaper: "/whitepaper",
  roadmap: "/roadmap",
  terms: "/terms",
  privacy: "/privacy",
} as const;

export const PLATFORM_FOOTER_LEGAL: { label: string; href: string }[] = [
  { label: "Whitepaper", href: PLATFORM_LINKS.whitepaper },
  { label: "Roadmap", href: PLATFORM_LINKS.roadmap },
  { label: "Terms", href: PLATFORM_LINKS.terms },
  { label: "Privacy", href: PLATFORM_LINKS.privacy },
];
