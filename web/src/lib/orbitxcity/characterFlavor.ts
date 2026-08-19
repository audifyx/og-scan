import type { CharacterClassId } from "./characterClasses";

export type CharacterFlavor = {
  handle: string;
  perk: string;
  blurb: string;
  lore: string;
  badge?: string;
  kit: [string, string, string];
};

export const CHARACTER_FLAVOR: Record<CharacterClassId, CharacterFlavor> = {
  pepe: {
    handle: "@pepe",
    perk: "Degen intuition",
    blurb: "Reads the tape like a swamp oracle. First to ape, last to cope.",
    lore: "The frog reads candles like a battlefield. Rarely blinks. Always early or catastrophically late.",
    badge: "Degen",
    kit: ["Ledger shades", "Meme spray", "Degen visor"],
  },
  wojak: {
    handle: "@wojak",
    perk: "Feels amplifier",
    blurb: "Turns crowd sentiment into XP. The board's unofficial therapist.",
    lore: "Broadcasts the feels. Turns rugs into lore and lore into markets.",
    kit: ["Pink beanie", "Sketch pad", "Feels mug"],
  },
  chad: {
    handle: "@gigachad",
    perk: "Arena presence",
    blurb: "Walks into any raid like the patch notes were written for him.",
    lore: "Jawline priced in. Every candle is a ranked match and he never looks at the chart twice.",
    badge: "Aura",
    kit: ["Jawline oil", "Raid pass", "Protein crate"],
  },
  doge: {
    handle: "@doge",
    perk: "Much wander",
    blurb: "Sniffs every alley for hidden crates. Very map. So secret.",
    lore: "Much explore. Very district. Maps unknown blocks first and still has time for wow.",
    kit: ["Shibe scarf", "Treat pouch", "Compass bone"],
  },
  anon: {
    handle: "@anon",
    perk: "On-chain sight",
    blurb: "Laser eyes lock the next mint. Builds the city while you sleep.",
    lore: "Laser-eyed maxi. Ships rails, never doxxes, orange-pills the room.",
    kit: ["Laser visor", "Orange tie", "Blueprint chip"],
  },
};
