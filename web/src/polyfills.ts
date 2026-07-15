// Buffer polyfill for browser (Solana/SPL/Jupiter libs).
// This module MUST be the first import in main.tsx: ES module imports are
// evaluated depth-first BEFORE the importing module's body runs, so assigning
// window.Buffer in main.tsx's body is too late for any module that touches
// Buffer at module-evaluation time. Importing this file first guarantees the
// global exists before any other module in the graph evaluates.
import { Buffer } from "buffer";

const g = globalThis as unknown as { Buffer?: typeof Buffer };
if (!g.Buffer) g.Buffer = Buffer;
if (typeof window !== "undefined") {
  const w = window as unknown as { Buffer?: typeof Buffer };
  if (!w.Buffer) w.Buffer = Buffer;
}
