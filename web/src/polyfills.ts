// Browser polyfills for Node globals that some Solana / Metaplex / SPL / Jupiter
// libraries touch at MODULE-EVALUATION time. This module MUST be the first
// import in main.tsx: ES module imports are evaluated depth-first BEFORE the
// importing module's body runs, so assigning these globals in main.tsx's body
// is too late for any module that touches them during evaluation. Importing
// this file first guarantees the globals exist before any other module in the
// graph evaluates — including lazily-loaded route chunks (e.g. the NFT hub,
// which pulls in Metaplex umi + a transitive dep that reads `process.version`).
import { Buffer } from "buffer";

type GlobalWithNodeShims = typeof globalThis & {
  Buffer?: typeof Buffer;
  process?: {
    env: Record<string, string | undefined>;
    version: string;
    versions: Record<string, string>;
    platform: string;
    browser: boolean;
    nextTick: (cb: (...args: unknown[]) => void, ...args: unknown[]) => void;
  };
  global?: typeof globalThis;
};

const g = globalThis as GlobalWithNodeShims;

// ── Buffer ──
if (!g.Buffer) g.Buffer = Buffer;
if (typeof window !== "undefined") {
  const w = window as unknown as { Buffer?: typeof Buffer };
  if (!w.Buffer) w.Buffer = Buffer;
}

// ── global ──
if (!g.global) g.global = globalThis;

// ── process ──
// Some deps do Node feature-detection like `parseInt(process.version.substr(1))`
// at import time; without this the whole chunk throws "process is not defined",
// which surfaces to React.lazy as "Cannot read properties of undefined
// (reading 'default')" and trips the ErrorBoundary.
if (!g.process) {
  g.process = {
    env: {},
    version: "",
    versions: {},
    platform: "browser",
    browser: true,
    nextTick: (cb, ...args) => setTimeout(() => cb(...args), 0),
  };
} else {
  if (g.process.env == null) g.process.env = {};
  if (typeof g.process.version !== "string") g.process.version = "";
}
