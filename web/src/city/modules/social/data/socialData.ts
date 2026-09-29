/**
 * Static content for the social module: NPC personas, venues, DJ roster,
 * comedy material. All copy is flavor; market-driven copy is generated at
 * runtime in feedEngine/newsEngine from REAL price data only.
 */

import type { DjProfile, NpcProfile, Venue } from "../types";

// ---------------------------------------------------------------------------
// NPC personas — the city's social population
// ---------------------------------------------------------------------------

export const NPCS: NpcProfile[] = [
  { id: "dexdegen", name: "Dex Degen", handle: "@dexdegen", bio: "chart goblin. liq hunter.", persona: "trader", initials: "DD", hue: 150, followers: 12840, verified: true },
  { id: "solana_sue", name: "Solana Sue", handle: "@solana_sue", bio: "SOL maxi since $8. i was right.", persona: "trader", initials: "SS", hue: 265, followers: 9320, verified: true },
  { id: "orbitx_maxi", name: "ORBITX Maxi", handle: "@orbitx_maxi", bio: "burn baby burn", persona: "dev", initials: "OM", hue: 25, followers: 4102, verified: false },
  { id: "rugdoc", name: "Rug Doc", handle: "@rugdoc", bio: "i read contracts so you don't get rekt", persona: "trader", initials: "RD", hue: 200, followers: 22100, verified: true },
  { id: "dj_neon", name: "DJ Neon Vice", handle: "@djneonvice", bio: "rooftop resident. synthwave till sunrise.", persona: "dj", initials: "NV", hue: 300, followers: 15670, verified: true },
  { id: "marina_wave", name: "Marina Wave", handle: "@marinawave", bio: "beach sets only. salt in the mix.", persona: "dj", initials: "MW", hue: 190, followers: 8830, verified: false },
  { id: "byte_beat", name: "Byte Beat", handle: "@bytebeat", bio: "hard techno. harder charts.", persona: "dj", initials: "BB", hue: 340, followers: 11250, verified: true },
  { id: "lou_laughs", name: "Lou Laughs", handle: "@loulaughs", bio: "open mic survivor. 3rd place, 2024.", persona: "comic", initials: "LL", hue: 45, followers: 5210, verified: false },
  { id: "punchline_pam", name: "Punchline Pam", handle: "@punchlinepam", bio: "i roast your portfolio for free", persona: "comic", initials: "PP", hue: 10, followers: 14880, verified: true },
  { id: "nia_kade", name: "Nia Kade", handle: "@niakade", bio: "Channel 6 anchor. i report, you decide.", persona: "anchor", initials: "NK", hue: 220, followers: 31200, verified: true },
  { id: "vice_vic", name: "Vice Vic", handle: "@vicevic", bio: "born on the boardwalk. knows a guy.", persona: "local", initials: "VV", hue: 120, followers: 3340, verified: false },
  { id: "turbo_tess", name: "Turbo Tess", handle: "@turbotess", bio: "docks regular. my car is faster than your bags.", persona: "local", initials: "TT", hue: 0, followers: 7650, verified: false },
  { id: "quiet_quinn", name: "Quiet Quinn", handle: "@quietquinn", bio: "campsite philosopher. fewer words, more signal.", persona: "local", initials: "QQ", hue: 100, followers: 1890, verified: false },
  { id: "chart_chef", name: "Chart Chef", handle: "@chartchef", bio: "cooking entries. tasting exits.", persona: "trader", initials: "CC", hue: 60, followers: 6940, verified: false },
];

export const npcById = (id: string): NpcProfile | undefined => NPCS.find((n) => n.id === id);

// ---------------------------------------------------------------------------
// Venues
// ---------------------------------------------------------------------------

export const VENUES: Venue[] = [
  { id: "rooftop-neon", name: "Neon Skyline", kind: "rooftop", district: "Downtown", blurb: "42nd-floor open deck. City lights, synth sets, zero cover on Fridays." },
  { id: "rooftop-helios", name: "Helios Deck", kind: "rooftop", district: "Uptown", blurb: "Sunset-first rooftop. House DJs, skyline pool, guest list only." },
  { id: "beach-bonfire", name: "Bonfire Point", kind: "beach", district: "Boardwalk", blurb: "Driftwood fires, acoustic-to-electronic sets, firm recruiters welcome." },
  { id: "club-eclipse", name: "Club Eclipse", kind: "club", district: "Downtown", blurb: "THE ownable nightclub. Three rooms, one legend. For sale to the bold." },
  { id: "club-basement", name: "The Basement", kind: "club", district: "Old Town", blurb: "Sweaty, loud, honest. Techno till the sun files a complaint." },
  { id: "dock-east", name: "East Docks", kind: "dock", district: "Harbor", blurb: "Saturday nights: engines, neons, and opinions about your stance." },
  { id: "camp-pines", name: "Whisper Pines", kind: "campsite", district: "North Hills", blurb: "No signal, no charts, just fire and talk." },
  { id: "camp-lake", name: "Stillwater Lake", kind: "campsite", district: "North Hills", blurb: "Lakeside tents, night fishing, rumor-grade gossip." },
  { id: "comedy-gutter", name: "The Gutter", kind: "comedy", district: "Old Town", blurb: "Brick walls, cheap drinks, open mic Tuesdays. Bombs welcome." },
];

export const venueById = (id: string): Venue | undefined => VENUES.find((v) => v.id === id);

// ---------------------------------------------------------------------------
// Bookable DJ roster (nightclub)
// ---------------------------------------------------------------------------

export const DJ_ROSTER: DjProfile[] = [
  { ...npcById("dj_neon")!, genre: "synthwave", feeCity: 900, hype: 9 },
  { ...npcById("byte_beat")!, genre: "hard techno", feeCity: 750, hype: 8 },
  { ...npcById("marina_wave")!, genre: "deep house", feeCity: 500, hype: 7 },
  { id: "dj_static", name: "DJ Static Bloom", handle: "@staticbloom", bio: "glitch sets. beautiful errors.", persona: "dj", initials: "SB", hue: 280, followers: 4210, verified: false, genre: "glitch/bass", feeCity: 300, hype: 6 },
  { id: "dj_lowtide", name: "Lowtide", handle: "@lowtide", bio: "warm-up specialist. never clears a floor.", persona: "dj", initials: "LT", hue: 170, followers: 1980, verified: false, genre: "lo-fi house", feeCity: 150, hype: 5 },
];

// ---------------------------------------------------------------------------
// Comedy material — clean-ish GTA flavor, no real-world targets
// ---------------------------------------------------------------------------

export const COMIC_BIOS: Record<string, { style: string }> = {
  lou_laughs: { style: "self-deprecating millennial" },
  punchline_pam: { style: "roast-battle menace" },
};

export const COMEDY_SETS: { comicId: string; title: string; lines: string[] }[] = [
  {
    comicId: "lou_laughs",
    title: "My Portfolio Is a Horror Movie",
    lines: [
      "I bought the top so hard my wallet filed a restraining order.",
      "My trading strategy is just astrology with extra steps.",
      "I told my mom I invest in crypto. She told the priest. We're both praying now.",
      "Diamond hands? I have paper hands, paper wallet, paper everything. I'm origami.",
      "The chart went down so fast I got motion sickness watching it.",
    ],
  },
  {
    comicId: "punchline_pam",
    title: "Roasting the Front Row's Bags",
    lines: [
      "You bought at the top? Bold. I respect the commitment to donating.",
      "Your portfolio has more red than a bullfight. And you're still the bull.",
      "I asked for financial advice and the group chat sent me a meme. Fair.",
      "You call it 'long term holding', I call it 'too scared to look'.",
      "At this point your bags aren't an investment, they're a personality.",
    ],
  },
  {
    comicId: "lou_laughs",
    title: "Gas Fees Ate My Lunch",
    lines: [
      "I tried to move twenty bucks and the fee was nineteen. That's not a network, that's a toll booth with dreams.",
      "My transaction failed but the fee succeeded. That's the real rug.",
      "I now budget gas fees like rent. First of the month, wallet cries.",
      "Pending... pending... I've aged. My transaction is still pending.",
    ],
  },
];

// ---------------------------------------------------------------------------
// Firm recruits (beach parties)
// ---------------------------------------------------------------------------

export const RECRUIT_POOL = [
  { npcId: "chart_chef", name: "Chart Chef", handle: "@chartchef", role: "Scalp cook", skill: 7, wageCity: 120 },
  { npcId: "quiet_quinn", name: "Quiet Quinn", handle: "@quietquinn", role: "Night-watch analyst", skill: 5, wageCity: 80 },
  { npcId: "vice_vic", name: "Vice Vic", handle: "@vicevic", role: "Street intel", skill: 6, wageCity: 100 },
  { npcId: "turbo_tess", name: "Turbo Tess", handle: "@turbotess", role: "Runner / courier", skill: 8, wageCity: 150 },
];

// ---------------------------------------------------------------------------
// Phone contacts (NPCs the player can call/text)
// ---------------------------------------------------------------------------

export const PHONE_CONTACTS = [
  { id: "dexdegen", name: "Dex Degen", npcId: "dexdegen", number: "555-0134" },
  { id: "nia_kade", name: "Nia Kade", npcId: "nia_kade", number: "555-0166" },
  { id: "dj_neon", name: "DJ Neon Vice", npcId: "dj_neon", number: "555-0192" },
  { id: "vice_vic", name: "Vice Vic", npcId: "vice_vic", number: "555-0117" },
  { id: "turbo_tess", name: "Turbo Tess", npcId: "turbo_tess", number: "555-0148" },
  { id: "lou_laughs", name: "Lou Laughs", npcId: "lou_laughs", number: "555-0121" },
];

/** Scripted call lines per NPC — subtitles during active calls. */
export const CALL_SCRIPTS: Record<string, string[]> = {
  dexdegen: [
    "Yo! Charts are MOVING, you seeing this?",
    "I just doubled my paper stack on that last swing.",
    "Meet me at Bonfire Point Saturday, I got alpha.",
  ],
  nia_kade: [
    "Nia Kade, Channel 6. Off the record?",
    "We're running your tip tonight at eleven. Exclusive.",
    "Stay liquid out there. Literally.",
  ],
  dj_neon: [
    "NEON VICE! Rooftop Friday, I'm closing the set.",
    "Bring friends. The skyline sounds better loud.",
    "New mix drops after my set. You heard it here first.",
  ],
  vice_vic: [
    "Vic here. I know a guy who knows a dock.",
    "Car meet Saturday. Don't bring a slow car, you'll hear about it.",
    "Boardwalk's quiet tonight. Too quiet.",
  ],
  turbo_tess: [
    "Tess! You coming Saturday? My build's finally done.",
    "I smoked three exotics last night. Paper trophies only.",
    "East Docks. Be there or be stock.",
  ],
  lou_laughs: [
    "It's Lou! Open mic Tuesday — I'm bombing on purpose now, it's art.",
    "I wrote five new minutes about gas fees. Comedy gold. Poverty gold.",
    "Come heckle. I need the material.",
  ],
};

/** In-world web: fake sites rendered inside the phone's web app. */
export const IN_WORLD_SITES = [
  {
    id: "vicepedia",
    title: "VicePedia",
    url: "vicepedia.city",
    body: "The free encyclopedia anyone in OrbitX City can edit at 3am. Featured article: 'Why the East Docks smell like opportunity.'",
  },
  {
    id: "chartz",
    title: "Chartz",
    url: "chartz.city",
    body: "Live token drama, zero financial advice. Red candles are just green candles that gave up.",
  },
  {
    id: "gutter-guide",
    title: "Gutter Guide",
    url: "gutter.city",
    body: "Every venue, every night. Tonight: open mic at The Gutter, rooftop at Neon Skyline, bonfire at the Point.",
  },
];
