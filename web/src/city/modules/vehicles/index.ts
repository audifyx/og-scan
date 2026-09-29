/**
 * OrbitXCity — Vehicles module: public surface.
 *
 * Self-contained: no imports from other city modules, no `@/tokenomics/*`.
 * Logic-only (no DOM) — the integrator renders, ticks, and applies
 * PaperDelta ledgers + IBurnProvider burns.
 */
export * from "./types";
export * from "./data/catalog";
export * from "./economy";
export * from "./garage";
export * from "./dealership";
export * from "./fuel";
export * from "./mods";
export * from "./gangs";
export * from "./impound";
export * from "./lowrider";
export * from "./marina";
export * from "./trails";
export * from "./submarine";
export * from "./diving";
