/**
 * OrbitX City theme playlist — real uploaded tracks served from /orbitxcity/music.
 */
export interface ThemeTrack {
  id: string;
  title: string;
  src: string;
}

const BASE = "/orbitxcity/music";

export const THEME_TRACKS: ThemeTrack[] = [
  { id: "night-menu-ritual", title: "Night Menu Ritual", src: `${BASE}/night-menu-ritual.mp3` },
  { id: "boss-menu-mayhem", title: "Boss Menu Mayhem", src: `${BASE}/boss-menu-mayhem.mp3` },
  { id: "grime-boss-bounce", title: "Grime Boss Bounce", src: `${BASE}/grime-boss-bounce.mp3` },
  { id: "boss-meme-circuit", title: "Boss Meme Circuit", src: `${BASE}/boss-meme-circuit.mp3` },
  { id: "boss-battle-overture", title: "Boss Battle Overture", src: `${BASE}/boss-battle-overture.mp3` },
  { id: "boss-door-riot", title: "Boss Door Riot", src: `${BASE}/boss-door-riot.mp3` },
  { id: "boss-door-countdown", title: "Boss Door Countdown", src: `${BASE}/boss-door-countdown.mp3` },
  { id: "boss-fight-meme", title: "Boss Fight Meme", src: `${BASE}/boss-fight-meme.mp3` },
  { id: "boss-gate-requiem", title: "Boss Gate Requiem", src: `${BASE}/boss-gate-requiem.mp3` },
  { id: "quest-actions", title: "Quest Actions", src: `${BASE}/quest-actions.mp3` },
  { id: "quest-world-fx", title: "Quest World FX", src: `${BASE}/quest-world-fx.mp3` },
  { id: "night-menu-ritual-alt", title: "Night Menu Ritual (Alt)", src: `${BASE}/night-menu-ritual-alt.mp3` },
  { id: "boss-menu-mayhem-alt", title: "Boss Menu Mayhem (Alt)", src: `${BASE}/boss-menu-mayhem-alt.mp3` },
  { id: "grime-boss-bounce-alt", title: "Grime Boss Bounce (Alt)", src: `${BASE}/grime-boss-bounce-alt.mp3` },
  { id: "boss-meme-circuit-alt", title: "Boss Meme Circuit (Alt)", src: `${BASE}/boss-meme-circuit-alt.mp3` },
  { id: "boss-battle-overture-alt", title: "Boss Battle Overture (Alt)", src: `${BASE}/boss-battle-overture-alt.mp3` },
  { id: "boss-door-riot-alt", title: "Boss Door Riot (Alt)", src: `${BASE}/boss-door-riot-alt.mp3` },
  { id: "boss-door-countdown-alt", title: "Boss Door Countdown (Alt)", src: `${BASE}/boss-door-countdown-alt.mp3` },
  { id: "boss-fight-meme-alt", title: "Boss Fight Meme (Alt)", src: `${BASE}/boss-fight-meme-alt.mp3` },
  { id: "boss-gate-requiem-alt", title: "Boss Gate Requiem (Alt)", src: `${BASE}/boss-gate-requiem-alt.mp3` },
  { id: "quest-actions-alt", title: "Quest Actions (Alt)", src: `${BASE}/quest-actions-alt.mp3` },
  { id: "quest-world-fx-alt", title: "Quest World FX (Alt)", src: `${BASE}/quest-world-fx-alt.mp3` },
];

export const DEFAULT_THEME_TRACK_ID = "night-menu-ritual";

export function getThemeTrack(id: string | null | undefined): ThemeTrack {
  return THEME_TRACKS.find((t) => t.id === id) ?? THEME_TRACKS[0]!;
}
