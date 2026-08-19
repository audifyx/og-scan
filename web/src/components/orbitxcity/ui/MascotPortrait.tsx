/**
 * Flat recognizable portraits for the character strip — the actual faces, not stick figures.
 */
import type { CharacterClassId } from "@/lib/orbitxcity/characterClasses";

export function MascotPortrait({ id }: { id: CharacterClassId }) {
  if (id === "wojak") {
    return (
      <svg viewBox="0 0 64 64" className="oxc-mascot-face" aria-hidden>
        <circle cx="32" cy="30" r="18" fill="#f3d5c0" />
        <path d="M18 22c4-8 24-8 28 2-6-4-22-4-28-2z" fill="#6b5344" />
        <circle cx="20" cy="28" r="5" fill="#6b5344" />
        <circle cx="44" cy="28" r="5" fill="#6b5344" />
        <circle cx="26" cy="32" r="2" fill="#1a1612" />
        <circle cx="38" cy="32" r="2" fill="#1a1612" />
        <path d="M28 42c2 3 6 3 8 0" fill="none" stroke="#b07a7a" strokeWidth="1.6" />
      </svg>
    );
  }
  if (id === "chad") {
    return (
      <svg viewBox="0 0 64 64" className="oxc-mascot-face" aria-hidden>
        <rect x="20" y="22" width="24" height="22" rx="6" fill="#d4a574" />
        <rect x="18" y="16" width="28" height="10" rx="3" fill="#1a1410" />
        <rect x="24" y="30" width="6" height="2" fill="#1a1612" />
        <rect x="34" y="30" width="6" height="2" fill="#1a1612" />
        <rect x="28" y="40" width="8" height="3" rx="1" fill="#8a5a48" />
        <rect x="26" y="44" width="12" height="6" rx="2" fill="#d4a574" />
      </svg>
    );
  }
  if (id === "doge") {
    return (
      <svg viewBox="0 0 64 64" className="oxc-mascot-face" aria-hidden>
        <circle cx="32" cy="34" r="16" fill="#e8a54b" />
        <ellipse cx="32" cy="40" rx="10" ry="8" fill="#f5e6c8" />
        <polygon points="18,22 14,8 26,20" fill="#e8a54b" />
        <polygon points="46,22 54,10 40,20" fill="#e8a54b" />
        <circle cx="26" cy="32" r="2.4" fill="#1a1612" />
        <circle cx="38" cy="32" r="2.4" fill="#1a1612" />
        <circle cx="32" cy="40" r="2" fill="#1a1210" />
      </svg>
    );
  }
  if (id === "vitalik") {
    return (
      <svg viewBox="0 0 64 64" className="oxc-mascot-face" aria-hidden>
        <circle cx="32" cy="30" r="17" fill="#e7d9c4" />
        <path d="M17 24c3-9 27-9 30 0-7-5-23-5-30 0z" fill="#3b3468" />
        <rect x="14" y="27" width="36" height="7" rx="3.5" fill="#8a7dff" opacity="0.9" />
        <circle cx="23" cy="30.5" r="2.4" fill="#0e0c1c" />
        <circle cx="41" cy="30.5" r="2.4" fill="#0e0c1c" />
        <path d="M32 8l7 12-7 4-7-4z" fill="#8a7dff" />
        <path d="M32 8l7 12-7-3z" fill="#c3bcff" />
        <path d="M27 43c3 2.4 7 2.4 10 0" fill="none" stroke="#a08b74" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  if (id === "anon") {
    return (
      <svg viewBox="0 0 64 64" className="oxc-mascot-face" aria-hidden>
        <circle cx="32" cy="30" r="16" fill="#f4f1ea" />
        <rect x="20" y="26" width="10" height="4" fill="#ff2a2a" />
        <rect x="34" y="26" width="10" height="4" fill="#ff2a2a" />
        <rect x="26" y="36" width="12" height="2" fill="#1a1814" />
        <rect x="22" y="46" width="20" height="10" fill="#111318" />
        <rect x="30" y="46" width="4" height="10" fill="#f7931a" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 64" className="oxc-mascot-face" aria-hidden>
      <circle cx="32" cy="32" r="18" fill="#4fa64a" />
      <ellipse cx="32" cy="38" rx="12" ry="8" fill="#7ec46a" />
      <circle cx="24" cy="28" r="7" fill="#f7f4ea" />
      <circle cx="40" cy="28" r="7" fill="#f7f4ea" />
      <circle cx="24" cy="29" r="2.6" fill="#14120f" />
      <circle cx="40" cy="29" r="2.6" fill="#14120f" />
      <ellipse cx="24" cy="34" rx="6" ry="2" fill="#c45c5c" />
      <ellipse cx="40" cy="34" rx="6" ry="2" fill="#c45c5c" />
      <rect x="22" y="42" width="20" height="3" rx="1" fill="#2a4a28" />
    </svg>
  );
}
