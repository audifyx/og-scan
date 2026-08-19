/**
 * Human operative portraits for the select strip — faces, not frogs.
 */
import type { CharacterClassId } from "@/lib/orbitxcity/characterClasses";

export function MascotPortrait({ id }: { id: CharacterClassId }) {
  if (id === "wojak") {
    return (
      <svg viewBox="0 0 64 64" className="oxc-mascot-face" aria-hidden>
        <rect x="18" y="38" width="28" height="22" rx="4" fill="#2a3344" />
        <circle cx="32" cy="28" r="16" fill="#f3d5c0" />
        <path d="M18 20c5-7 23-7 28 1" fill="#6b5344" />
        <path d="M22 24c3-2 6-1 8 1" stroke="#2a2218" strokeWidth="1.6" fill="none" />
        <path d="M34 25c3-2 6-2 8 0" stroke="#2a2218" strokeWidth="1.6" fill="none" />
        <circle cx="26" cy="30" r="3.2" fill="#f7f4ea" />
        <circle cx="38" cy="30" r="3.2" fill="#f7f4ea" />
        <circle cx="26" cy="30" r="1.4" fill="#1a1612" />
        <circle cx="38" cy="30" r="1.4" fill="#1a1612" />
        <path d="M31 32 l2 5 l-4 0 z" fill="#e0b8a0" />
        <path d="M27 42c2-2 8-2 10 0" fill="none" stroke="#8a5a52" strokeWidth="1.5" />
        <path d="M24 38c4 3 12 3 16 0" fill="#6b5344" opacity="0.45" />
      </svg>
    );
  }
  if (id === "chad") {
    return (
      <svg viewBox="0 0 64 64" className="oxc-mascot-face" aria-hidden>
        <rect x="16" y="40" width="32" height="20" rx="3" fill="#2e8a6e" />
        <rect x="20" y="18" width="24" height="26" rx="8" fill="#d4a574" />
        <rect x="18" y="14" width="28" height="10" rx="3" fill="#1a1410" />
        <rect x="24" y="28" width="6" height="3" fill="#1a1612" />
        <rect x="34" y="28" width="6" height="3" fill="#1a1612" />
        <path d="M30 32 l4 6 l-8 0 z" fill="#c4926a" />
        <path d="M24 44c4 6 12 6 16 0" fill="#1a1410" />
        <rect x="26" y="38" width="12" height="3" rx="1" fill="#8a5a48" />
        <circle cx="32" cy="42" r="2" fill="#c5a26f" />
      </svg>
    );
  }
  if (id === "doge") {
    return (
      <svg viewBox="0 0 64 64" className="oxc-mascot-face" aria-hidden>
        <rect x="18" y="40" width="28" height="20" rx="4" fill="#d4893a" />
        <circle cx="32" cy="30" r="15" fill="#d4a574" />
        <path d="M18 18c8-8 20-4 22 2" fill="#c47a28" />
        <circle cx="26" cy="30" r="3.2" fill="#f7f4ea" />
        <circle cx="38" cy="30" r="3.2" fill="#f7f4ea" />
        <circle cx="26" cy="30" r="1.5" fill="#1a1612" />
        <circle cx="38" cy="30" r="1.5" fill="#1a1612" />
        <path d="M31 33 l2 5 l-4 0 z" fill="#c4926a" />
        <path d="M26 42c3 4 9 4 12 0" fill="none" stroke="#8a4a40" strokeWidth="1.8" />
        <circle cx="32" cy="22" r="4" fill="#e8a54b" />
      </svg>
    );
  }
  if (id === "anon") {
    return (
      <svg viewBox="0 0 64 64" className="oxc-mascot-face" aria-hidden>
        <rect x="18" y="40" width="28" height="20" rx="2" fill="#3a4454" />
        <circle cx="32" cy="28" r="15" fill="#e8d5c0" />
        <rect x="20" y="24" width="24" height="12" rx="2" fill="#1a1e24" />
        <rect x="22" y="27" width="8" height="3" fill="#ff2a2a" />
        <rect x="34" y="27" width="8" height="3" fill="#ff2a2a" />
        <rect x="28" y="40" width="8" height="3" fill="#f7931a" />
        <rect x="22" y="44" width="20" height="8" fill="#111318" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 64" className="oxc-mascot-face" aria-hidden>
      <rect x="18" y="40" width="28" height="20" rx="4" fill="#3d7a38" />
      <circle cx="32" cy="30" r="15" fill="#c9a07a" />
      <path d="M16 22 h32 v6 h-8 l-8-4-8 4 h-8 z" fill="#3d8a38" />
      <circle cx="32" cy="18" r="3" fill="#c23b3b" />
      <circle cx="26" cy="31" r="3.2" fill="#f7f4ea" />
      <circle cx="38" cy="31" r="3.2" fill="#f7f4ea" />
      <circle cx="26" cy="31" r="1.4" fill="#1a1612" />
      <circle cx="38" cy="31" r="1.4" fill="#1a1612" />
      <path d="M31 33 l2 5 l-4 0 z" fill="#c4926a" />
      <path d="M26 42c3 3 9 3 12 0" fill="none" stroke="#8a4a40" strokeWidth="1.6" />
    </svg>
  );
}
