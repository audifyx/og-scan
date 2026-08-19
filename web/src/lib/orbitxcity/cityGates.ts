/** Pre-world screens. `world` is the live 3D city. */
export const CITY_GATES = [
  "menu",
  "characters",
  "lobbies",
  "settings",
  "help",
  "quick",
  "world",
] as const;

export type CityGateId = (typeof CITY_GATES)[number];

export const GATE_COPY: Record<
  Exclude<CityGateId, "menu" | "world">,
  { kicker: string; title: string; sub: string }
> = {
  characters: {
    kicker: "Roster",
    title: "Choose your mascot",
    sub: "Five crypto-native avatars. The one you pick is who you walk as.",
  },
  lobbies: {
    kicker: "Rooms",
    title: "Multiplayer",
    sub: "Join a public room or host a private code. Same city, shared streets.",
  },
  settings: {
    kicker: "Prefs",
    title: "Settings",
    sub: "Audio, render quality, and touch controls — saved on this device.",
  },
  help: {
    kicker: "Manual",
    title: "Controls",
    sub: "Keyboard, mouse, and mobile. How to move, look, and talk.",
  },
  quick: {
    kicker: "Drop-in",
    title: "Quick play",
    sub: "Pick a district and land with your current mascot. No lobby required.",
  },
};
