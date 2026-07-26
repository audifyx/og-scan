import { describe, expect, it } from "vitest";
import {
  bigramSimilarity,
  isRelevantMarketCandidate,
  normalizeIdentity,
  scoreIdentity,
} from "./antiVampScore";

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

  it("hard-blocks exact ticker collisions on registry", () => {
    const r = scoreIdentity("Clone Coin", "AVAMP", "OrbitX Anti-Vamp", "AVAMP", "registry");
    expect(r.hard).toBe(true);
    expect(r.sim).toBe(1);
  });

  it("hard-blocks exact name collisions on registry", () => {
    const r = scoreIdentity("OrbitX Anti-Vamp", "OTHER", "OrbitX Anti-Vamp", "AVAMP", "registry");
    expect(r.hard).toBe(true);
  });

  it("hard-blocks exact name collisions on market sources", () => {
    const r = scoreIdentity("OrbitX Anti-Vamp", "OTHER", "OrbitX Anti-Vamp", "AVAMP", "market");
    expect(r.hard).toBe(true);
  });

  it("does not hard-block common ticker reuse with unrelated name on market", () => {
    const r = scoreIdentity("Moon Rocket", "MOON", "Galaxy Explorer", "MOON", "market");
    expect(r.hard).toBe(false);
    expect(r.sim).toBe(0);
  });

  it("does not hard-block PEPE ticker when names differ on market", () => {
    const r = scoreIdentity("Pepe", "PEPE", "Super Dog Coin", "PEPE", "market");
    expect(r.hard).toBe(false);
    expect(r.sim).toBe(0);
  });

  it("hard-blocks real pepe clone on market (same name + ticker)", () => {
    const r = scoreIdentity("Pepe", "PEPE", "Pepe", "PEPE", "market");
    expect(r.hard).toBe(true);
  });

  it("hard-blocks near-exact name clone on market", () => {
    const r = scoreIdentity("OrbitX Anti Vamp", "CLONE", "OrbitX Anti-Vamp", "AVAMP", "market");
    expect(r.hard).toBe(true);
  });

  it("clears fully unique token identity on market", () => {
    const r = scoreIdentity("Zorbital Flux", "ZFLX", "Galaxy Explorer", "GALX", "market");
    expect(r.hard).toBe(false);
    expect(r.sim).toBeLessThan(0.72);
  });

  it("ignores ultra-short bigram noise", () => {
    expect(bigramSimilarity("ox", "box")).toBe(0);
    expect(bigramSimilarity("ab", "abc")).toBe(0);
  });

  it("filters unrelated pump.fun search noise", () => {
    expect(isRelevantMarketCandidate("Random Cat Token", "RCAT", "Galaxy Explorer", "GALX")).toBe(false);
    expect(isRelevantMarketCandidate("Galaxy Coin", "GALX", "Galaxy Explorer", "GALX")).toBe(true);
  });
});
