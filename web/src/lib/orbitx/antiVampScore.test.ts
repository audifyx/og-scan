import { describe, expect, it } from "vitest";
import { bigramSimilarity, normalizeIdentity, scoreIdentity } from "./antiVampScore";

describe("antiVampScore", () => {
  it("normalizes leetspeak and strips junk", () => {
    expect(normalizeIdentity("OrbitX Anti-Vamp!")).toBe("orbitxantivamp");
    expect(normalizeIdentity("$ORBIT")).toBe("orbit");
  });

  it("does not hard-block OrbitX Anti-Vamp against unrelated short tickers", () => {
    const r = scoreIdentity("Something", "$", "OrbitX Anti-Vamp", "AVAMP");
    expect(r.hard).toBe(false);
  });

  it("does not hard-block against a shorter OrbitX root name alone", () => {
    const r = scoreIdentity("OrbitX", "ORBITX", "OrbitX Anti-Vamp", "AVAMP");
    expect(r.hard).toBe(false);
    expect(r.sim).toBeLessThan(0.92);
  });

  it("hard-blocks exact ticker collisions", () => {
    const r = scoreIdentity("Clone Coin", "AVAMP", "OrbitX Anti-Vamp", "AVAMP");
    expect(r.hard).toBe(true);
    expect(r.sim).toBe(1);
  });

  it("hard-blocks exact name collisions", () => {
    const r = scoreIdentity("OrbitX Anti-Vamp", "OTHER", "OrbitX Anti-Vamp", "AVAMP");
    expect(r.hard).toBe(true);
  });

  it("ignores ultra-short bigram noise", () => {
    expect(bigramSimilarity("ox", "box")).toBe(0);
    expect(bigramSimilarity("ab", "abc")).toBe(0);
  });
});
