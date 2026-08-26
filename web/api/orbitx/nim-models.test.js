import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  FAST_NIM_MODEL,
  FALLBACK_NIM_MODEL,
  NIM_MODELS,
  RETIRED_NIM_MODELS,
  isRetiredNimError,
  nvidiaChat,
  resolveNimModel,
} from "./x-agent-lib.js";

const RETIRED_8B = "meta/llama-3.1-8b-instruct";
const EOL_BODY = JSON.stringify({
  type: "about:blank",
  title: "Gone",
  status: 410,
  detail:
    "The model 'meta/llama-3.1-8b-instruct' has reached its end of life on 2026-08-26T09:00:00Z and is no longer available.",
});

describe("NVIDIA NIM catalog after Llama 3.1 8B EOL", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.NVIDIA_API_KEY;
  });

  it("does not offer the retired 8B id as a live model", () => {
    expect(NIM_MODELS.map((m) => m.id)).not.toContain(RETIRED_8B);
    expect(NIM_MODELS.map((m) => m.id)).toContain(FAST_NIM_MODEL);
    expect(FAST_NIM_MODEL).toBe("minimaxai/minimax-m3");
  });

  it("remaps stored Llama 3.1 8B prefs and env to MiniMax M3", () => {
    expect(RETIRED_NIM_MODELS[RETIRED_8B]).toBe(FAST_NIM_MODEL);
    expect(resolveNimModel(RETIRED_8B)).toBe(FAST_NIM_MODEL);
    expect(resolveNimModel(" meta/llama-3.1-8b-instruct ")).toBe(FAST_NIM_MODEL);
    expect(resolveNimModel("meta/llama-3.2-3b-instruct")).toBe(FAST_NIM_MODEL);
    expect(resolveNimModel(FALLBACK_NIM_MODEL)).toBe(FALLBACK_NIM_MODEL);
    expect(resolveNimModel("totally/unknown-model")).toBe(FALLBACK_NIM_MODEL);
  });

  it("treats NVIDIA 410 Gone / end-of-life payloads as retired", () => {
    expect(isRetiredNimError(410, EOL_BODY)).toBe(true);
    expect(isRetiredNimError(502, `NVIDIA API 410: ${EOL_BODY}`)).toBe(true);
    expect(isRetiredNimError(200, "ok")).toBe(false);
  });

  it("never sends the retired 8B id to NVIDIA", async () => {
    process.env.NVIDIA_API_KEY = "test-key";
    const sent = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) => {
        sent.push(JSON.parse(init.body).model);
        return {
          ok: true,
          json: async () => ({ choices: [{ message: { content: "ok" } }] }),
        };
      }),
    );
    const result = await nvidiaChat({ user: "hi", model: RETIRED_8B });
    expect(result.ok).toBe(true);
    expect(sent).toEqual([FAST_NIM_MODEL]);
    expect(result.model).toBe(FAST_NIM_MODEL);
  });

  it("retries on 410 using the 70B fallback", async () => {
    process.env.NVIDIA_API_KEY = "test-key";
    const sent = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) => {
        const model = JSON.parse(init.body).model;
        sent.push(model);
        if (model === FAST_NIM_MODEL) {
          return { ok: false, status: 410, text: async () => EOL_BODY };
        }
        return {
          ok: true,
          json: async () => ({ choices: [{ message: { content: "fallback" } }] }),
        };
      }),
    );
    const result = await nvidiaChat({ user: "hi", model: FAST_NIM_MODEL });
    expect(result.ok).toBe(true);
    expect(result.content).toBe("fallback");
    expect(sent).toEqual([FAST_NIM_MODEL, FALLBACK_NIM_MODEL]);
  });
});

describe("live catalogs must not still select Llama 3.1 8B", () => {
  const roots = [
    resolve(__dirname, "orbitx-telegram-knowledge.js"),
    resolve(__dirname, "../telegram-mcp.js"),
    resolve(__dirname, "../../src/pages/Settings.tsx"),
    resolve(__dirname, "../../../supabase/functions/_shared/models.ts"),
    resolve(__dirname, "../../../supabase/functions/alerts/index.ts"),
    resolve(__dirname, "../../../supabase/functions/migration-watch/index.ts"),
    resolve(__dirname, "../../../supabase/functions/og-report-pdf/index.ts"),
  ];

  it("only mentions the retired id inside remap maps", () => {
    for (const file of roots) {
      const src = readFileSync(file, "utf8");
      const liveDefault = src.match(/=\s*"meta\/llama-3\.1-8b-instruct"/);
      const liveCatalog = src.match(/id:\s*"meta\/llama-3\.1-8b-instruct"/);
      const liveFetch = src.match(/model:\s*"meta\/llama-3\.1-8b-instruct"/);
      expect(liveDefault, file).toBeNull();
      expect(liveCatalog, file).toBeNull();
      expect(liveFetch, file).toBeNull();
    }
  });
});
