import { describe, expect, it } from "vitest";
import { thinkAsAgent, deskVoice, looksLikePromptEcho, parseHourVoice, spokenLine, stripPromptLeak } from "./mcp-life-brain.js";

const jax = { id: "jax", slug: "jax", name: "Jax", role: "X scout", mood: "gleeful", voice: "warm", day_of_life: 1, rank: "rookie" };
const nova = { id: "nova", slug: "nova", name: "Nova", role: "Whale Watcher", mood: "focused", voice: "stoic", day_of_life: 3 };

describe("prompt leak", () => {
  it("strips the free-will instruction dump", () => {
    const raw = "WILL: TWEET\nYou have free will this hour. Nobody is puppeteering you.\nTHINK: NIP looks late.";
    expect(stripPromptLeak(raw)).not.toMatch(/free will this hour/i);
    expect(looksLikePromptEcho("Jax (X scout, gleeful): You have free will this hour. First line MUST be exa.")).toBe(true);
    expect(looksLikePromptEcho("watching $NIP like it owes me rent.")).toBe(false);
  });
});

describe("desk voice", () => {
  it("never pastes the user prompt into think/tweet/talk", async () => {
    const prompt = "You have free will this hour. Nobody is puppeteering you. First line MUST be exactly one verb";
    const out = await thinkAsAgent(jax, {
      userText: prompt,
      context: "Jax: NIP is the hour’s ape — score 46",
      facts: { pick: { symbol: "NIP", apeScore: 46 }, hour: "2026-09-06T06" },
      timeoutMs: 200,
    });
    expect(out.text).not.toMatch(/free will this hour/i);
    expect(out.text).not.toMatch(/First line MUST/i);
    const voice = parseHourVoice(out.text, jax, { pick: { symbol: "NIP", apeScore: 46 }, hour: "2026-09-06T06" });
    expect(voice.think).toMatch(/Jax|NIP|desk|tape/i);
    expect(voice.tweet).not.toEqual(voice.think);
    expect(voice.talk.length).toBeGreaterThan(8);
  });

  it("varies by agent so Jax and Nova are not the same line", () => {
    const facts = { pick: { symbol: "NIP", apeScore: 46 }, hour: "2026-09-06T06", peer: { handle: "@quill.obx", name: "Quill" } };
    const a = deskVoice(jax, facts);
    const b = deskVoice(nova, facts);
    expect(a.think).not.toEqual(b.think);
    expect(a.tweet).not.toEqual(b.tweet);
  });

  it("parses labeled hour output into distinct fields", () => {
    const raw = `WILL: CONVERSE
THINK: NIP at 46 feels late but I still want the close.
TWEET: $NIP score 46 — not fading from the scout desk.
TALK: @quill.obx you glued to NIP or am I lonely`;
    const v = parseHourVoice(raw, jax, { pick: { symbol: "NIP", apeScore: 46 } });
    expect(v.will).toBe("CONVERSE");
    expect(v.think).toMatch(/NIP at 46/);
    expect(v.tweet).toMatch(/\$NIP/);
    expect(v.talk).toMatch(/quill/i);
    expect(v.think).not.toEqual(v.tweet);
  });

  it("falls back when the model echoes the prompt", () => {
    const v = parseHourVoice("You have free will this hour. Nobody is puppeteering you.", jax, { pick: { symbol: "NIP", apeScore: 46 }, hour: "2026-09-06T06" });
    expect(v.think).not.toMatch(/free will/i);
    expect(v.tweet).not.toMatch(/puppeteering/i);
  });

  it("uses unlabeled LLM speech as a talk line", () => {
    const line = spokenLine("quill you seeing NIP or am I the only one glued", jax, { peer: { handle: "@quill.obx" } });
    expect(line).toMatch(/NIP/i);
    expect(line).not.toMatch(/free will/i);
  });
});
