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
  if (id === "whale") {
    return (
      <svg viewBox="0 0 64 64" className="oxc-mascot-face" aria-hidden>
        <path d="M10 34c6-11 38-11 44 0-6 11-38 11-44 0z" fill="#3fa7d6" />
        <path d="M10 34c6-6 38-6 44 0-6 5-38 5-44 0z" fill="#5fc0e8" />
        <circle cx="22" cy="31" r="3" fill="#0d2430" />
        <path d="M46 22l8-6 2 10z" fill="#2c6b8a" />
        <path d="M26 14l6 8 6-8z" fill="#9fd8f0" />
        <path d="M32 12l-3 6h6z" fill="#f0dcff" opacity="0.8" />
      </svg>
    );
  }

  if (id === "bot") {
    return (
      <svg viewBox="0 0 64 64" className="oxc-mascot-face" aria-hidden>
        <rect x="14" y="18" width="36" height="30" rx="5" fill="#1b2b2e" />
        <rect x="18" y="26" width="28" height="10" rx="2" fill="#00e5c0" />
        <circle cx="25" cy="31" r="2.4" fill="#04211d" />
        <circle cx="39" cy="31" r="2.4" fill="#04211d" />
        <rect x="24" y="41" width="16" height="3" rx="1.5" fill="#37585c" />
        <rect x="30" y="10" width="4" height="8" fill="#37585c" />
        <circle cx="32" cy="9" r="3" fill="#00e5c0" />
      </svg>
    );
  }

  if (id === "oracle") {
    return (
      <svg viewBox="0 0 64 64" className="oxc-mascot-face" aria-hidden>
        <path d="M32 8c12 0 19 10 19 22 0 10-6 18-19 18s-19-8-19-18C13 18 20 8 32 8z" fill="#2a1f3d" />
        <ellipse cx="32" cy="34" rx="13" ry="14" fill="#d9c3b0" />
        <circle cx="26" cy="32" r="2.6" fill="#d9a7ff" />
        <circle cx="38" cy="32" r="2.6" fill="#d9a7ff" />
        <path d="M27 41c3 2 7 2 10 0" fill="none" stroke="#8a7060" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="32" cy="18" r="3.5" fill="#d9a7ff" opacity="0.9" />
      </svg>
    );
  }

  if (id === "miner") {
    return (
      <svg viewBox="0 0 64 64" className="oxc-mascot-face" aria-hidden>
        <circle cx="32" cy="34" r="16" fill="#c08d5f" />
        <path d="M14 26c2-9 34-9 36 0z" fill="#f2a13c" />
        <rect x="12" y="24" width="40" height="5" rx="2.5" fill="#6b4f34" />
        <circle cx="26" cy="34" r="2.6" fill="#2b1d12" />
        <circle cx="38" cy="34" r="2.6" fill="#2b1d12" />
        <path d="M25 42c4 3 10 3 14 0" fill="none" stroke="#7a5638" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="32" cy="21" r="3" fill="#ffd08a" />
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
