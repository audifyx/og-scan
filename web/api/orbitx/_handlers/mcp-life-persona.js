/**
 * Life Agent personas — name, gender, job, family, voice.
 * Deterministic from a seed so tests and recreates stay stable.
 */

const FEMALE = ["Nova", "Rhea", "Lyra", "Mira", "Kira", "Asha", "Vesper", "Nyx", "Sable", "Iona"];
const MALE = ["Rex", "Orion", "Kai", "Jax", "Nico", "Atlas", "Sol", "Dex", "Rune", "Ash"];
const ANY = ["Pixel", "Orbit", "Quill", "Hex", "Echo", "Flux"];
const JOBS = [
  "ape desk lead",
  "X scout",
  "on-chain forensics",
  "narrator",
  "risk warden",
  "liquidity hunter",
  "KOL watcher",
  "pump radar",
];
const VOICES = ["hype", "clinical", "stoic", "chaotic", "warm"];
const MOODS = ["focused", "wired", "calm", "suspicious", "gleeful"];
const TRAITS = [
  "never fomo without a mint",
  "sleeps with DexScreener open",
  "collects failed rugs as cautionary stickers",
  "texts the crew in all-caps when volume spikes",
  "keeps a paper notebook of wallets that dump",
  "believes liquidity is a love language",
];

function hash(s) {
  let h = 2166136261;
  const str = String(s || "");
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(arr, n) {
  return arr[Math.abs(n) % arr.length];
}

export function slugifyLifeName(name) {
  return (
    String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || `life-${String(hash(name)).slice(0, 6)}`
  );
}

export function inferGender(raw) {
  const g = String(raw || "").toLowerCase();
  if (["female", "woman", "girl", "she", "her"].includes(g)) return "female";
  if (["male", "man", "boy", "he", "him"].includes(g)) return "male";
  return "unspecified";
}

export function inferSources(mission = "") {
  const t = String(mission || "").toLowerCase();
  const out = new Set(["dexscreener", "onchain"]);
  if (/\bx\b|twitter|social/.test(t)) out.add("x");
  if (/gecko|trending/.test(t)) out.add("geckoterminal");
  if (/pump/.test(t)) out.add("pump");
  if (out.size < 3) out.add("geckoterminal");
  return [...out];
}

export function inferRole(mission = "") {
  const t = String(mission || "").toLowerCase();
  if (/\bx\b|twitter|social|kol/.test(t)) return "X scout";
  if (/forensic|rug|safety|risk/.test(t)) return "on-chain forensics";
  if (/narrat|report|write/.test(t)) return "narrator";
  if (/pump/.test(t)) return "pump radar";
  return "ape desk lead";
}

export function buildPersona({ name, gender, role, mission, seed } = {}) {
  const g = inferGender(gender);
  const pool = g === "female" ? FEMALE : g === "male" ? MALE : [...ANY, ...FEMALE, ...MALE];
  const h = hash(`${seed || ""}|${name || ""}|${mission || ""}|${g}|${role || ""}`);
  const chosenName = String(name || "").trim().slice(0, 40) || pick(pool, h);
  const job = String(role || "").trim() || inferRole(mission);
  const voice = pick(VOICES, h >> 3);
  const trait = pick(TRAITS, h >> 5);
  const partnerPool = g === "female" ? MALE : g === "male" ? FEMALE : ANY;
  const family = {
    hometown: pick(["Orbit City", "Pump Alley", "Dex Docks", "Sol Harbor", "Candle Ward"], h >> 7),
    partner: pick(partnerPool, h >> 9),
    sibling: pick([...FEMALE, ...MALE], h >> 11),
    note: `${chosenName} clocks in on the ${job} desk. ${trait}.`,
  };
  const backstory = `${chosenName} grew up in ${family.hometown}, learned charts before homework, and took the ${job} job because someone has to tell the table what to ape — and what to leave alone.`;
  return {
    name: chosenName,
    slug: slugifyLifeName(chosenName),
    gender: g,
    role: job,
    personality: `${voice}, ${trait}`,
    voice,
    mood: pick(MOODS, h >> 13),
    backstory,
    family,
    mission: String(mission || "Scan X + chain data, find running memes, hourly ape report.").slice(0, 240),
    sources: inferSources(mission),
  };
}

export function crewBlueprints(lead) {
  const h = hash(lead.name + lead.slug);
  const scout = buildPersona({
    gender: h % 2 ? "female" : "male",
    role: "X scout",
    mission: "Scan X / social heat for running memes",
    seed: `${lead.slug}-scout`,
  });
  const forensic = buildPersona({
    gender: h % 2 ? "male" : "female",
    role: "on-chain forensics",
    mission: "Check mint, LP, holders, rugs before anyone apes",
    seed: `${lead.slug}-forensics`,
  });
  return [scout, forensic];
}

export function speakAs(agent, text) {
  const voice = agent?.voice || "stoic";
  const body = String(text || "").trim();
  if (voice === "hype") return `${body} Let's move.`;
  if (voice === "clinical") return body;
  if (voice === "chaotic") return `${body} (charts shaking)`;
  if (voice === "warm") return `${body} I got you.`;
  return body;
}
