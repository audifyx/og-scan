/**
 * OrbitX pad agent API — Spec v2 §O
 * GET/POST /api/v1/*  (rewritten to /api/pad-v1?path=)
 *
 * Unsigned txs only. No user keys. Honest 400/501 when create_v2 / market program / Track B are not live.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, idempotency-key",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Content-Type": "application/json",
};

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const QUOTES = [
  { symbol: "SOL", mint: SOL, kind: "native", allowed: true },
  { symbol: "USDC", mint: USDC, kind: "stable", allowed: true },
  { symbol: "NVDAX", mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh", kind: "stock", allowed: false },
];

function json(res: VercelResponse, body: unknown, status = 200) {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  return res.status(status).json(body);
}

function pathOf(req: VercelRequest): string {
  const q = req.query?.path;
  if (typeof q === "string") return q.replace(/^\//, "");
  if (Array.isArray(q)) return String(q[0] || "").replace(/^\//, "");
  const url = String(req.url || "");
  const m = url.match(/\/api\/v1\/?(.*?)(?:\?|$)/);
  return (m?.[1] || "").replace(/\/$/, "");
}

function flags() {
  const on = (k: string, fb: boolean) => {
    const v = process.env[k];
    if (!v) return fb;
    return v === "1" || v.toLowerCase() === "true";
  };
  return {
    predict_markets: on("PAD_PREDICT_MARKETS", true),
    stocks: on("PAD_STOCKS", true),
    bagwork: on("PAD_BAGWORK", true),
    track_b_vault: on("PAD_TRACK_B_VAULT", false),
    kill_create: on("PAD_KILL_CREATE", false),
    kill_trade: on("PAD_KILL_TRADE", false),
  };
}

function db() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function openapi() {
  return {
    openapi: "3.1.0",
    info: {
      title: "OrbitX Launchpad Agent API",
      version: "2.0.0",
      description: "Unsigned-tx pad surface. SOL create is live via /api/pump-create. Quoted create_v2, Track B vault, and on-chain Yes/No ixs return 501 until those programs are live. No custody of user keys.",
    },
    servers: [{ url: "https://www.orbitx.world/api/v1" }],
    paths: {
      "/quotes": { get: { summary: "Quote allowlist (curated + live SOL/USDC)" } },
      "/flags": { get: { summary: "Feature flags" } },
      "/params": { get: { summary: "Economic defaults" } },
      "/markets": { get: { summary: "Indexed Yes/No markets" } },
      "/markets/{mint}": { get: { summary: "Market by coin mint" } },
      "/launch": {
        post: {
          summary: "Validate LaunchIntentV2 and return a dry-run ix list. Does not custody keys.",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/LaunchIntentV2" } } } },
        },
      },
      "/claim": { post: { summary: "Unsigned claim tx — Track B 501 until audit; Track A is Pump auto-pay" } },
      "/sweep": { post: { summary: "Permissionless sweep hint — client builds collect_creator_fee_v2" } },
      "/rewards/{wallet}": { get: { summary: "Indexed rewards claims for a wallet" } },
    },
    components: {
      schemas: {
        LaunchIntentV2: {
          type: "object",
          required: ["name", "symbol", "launchType", "quoteMint", "style", "rewards", "graduationDest"],
          properties: {
            name: { type: "string", maxLength: 32 },
            symbol: { type: "string", maxLength: 10 },
            launchType: { enum: ["normal", "vanity", "custom_ca", "rewards", "bagwork", "predict"] },
            quoteMint: { type: "string" },
            style: { enum: ["curve", "delay", "dutch", "batch", "ido_then_curve"] },
            graduationDest: { enum: ["pumpswap", "raydium", "meteora", "none"] },
            rewards: { type: "object" },
            market: { type: "object" },
          },
        },
      },
    },
  };
}

function dryRun(body: Record<string, unknown>) {
  const f = flags();
  const notes: string[] = [];
  const issues: string[] = [];
  if (f.kill_create) issues.push("Create is paused (kill switch)");
  const quoteMint = String(body.quoteMint || SOL);
  const launchType = String(body.launchType || "normal");
  const style = String(body.style || "curve");
  const rewards = (body.rewards || {}) as Record<string, unknown>;
  const market = body.market as Record<string, unknown> | undefined;
  if (quoteMint !== SOL) issues.push("Non-SOL create_v2 is not live. Launch on SOL, or wait for QuoteControl.");
  if (body.cashback) issues.push("Refuse cashback flag — use holderReward");
  if (body.lpToCreator) issues.push("Refuse ToCreator LP default");
  if (body.mintAuthorityKept) issues.push("Refuse hidden mint authority");
  if (rewards.track === "epoch_vault" && !f.track_b_vault) issues.push("vault not live");
  if ((launchType === "predict" || market) && !f.predict_markets) issues.push("predict disabled");
  if (style === "delay") notes.push("Delay-open is indexed. On-chain swap gate is not live.");
  if (style !== "curve") notes.push(`${style} is stored on the intent; create still uses Pump curve.`);
  if (market) notes.push("Market is indexed. Unsigned init_market returns 501 until pm-core is deployed.");
  notes.push("holderReward:true when rewards.track=pump_holder. Cashback is rejected.");
  const ixs = ["ComputeBudgetProgram.setComputeUnitLimit(1200000)", "pump create(+buy) via /api/pump-create"];
  if (market) ixs.push("init_market (501 on-chain)");
  return {
    ok: issues.length === 0,
    issues,
    ixs,
    signatures: 1,
    notes,
    createLive: quoteMint === SOL && issues.length === 0,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
    return res.status(204).end();
  }
  const path = pathOf(req);
  const method = req.method || "GET";
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

  try {
    if (path === "openapi" || path === "") return json(res, openapi());
    if (path === "flags") return json(res, flags());
    if (path === "quotes") return json(res, { quotes: QUOTES });
    if (path === "params") {
      return json(res, {
        padTakeCurveBps: 100,
        padTakePredictBps: 100,
        delayOpenMaxSec: 3600,
        antiSnipeMax: 30,
        epochDefaultSec: 14400,
        predictBoostCap: 1.25,
        insuranceBuffer: 0.2,
        graceResolveSec: 1800,
        questionMax: 140,
        tickerMax: 10,
        track_b_vault: flags().track_b_vault,
      });
    }
    if (path === "launch" && method === "POST") {
      const simulate = String(req.query?.simulate || body.simulate || "") === "1";
      const result = dryRun(body);
      if (!result.ok) return json(res, { error: result.issues[0], ...result }, 400);
      if (simulate || body.dryRun) return json(res, { ...result, simulated: true });
      return json(res, {
        ...result,
        message: "SOL create is live in the browser via /orbitxlaunch/create. This endpoint returns the ix plan; it never holds keys. POST /api/pump-create for the unsigned Pump tx.",
      });
    }
    if (path === "claim" && method === "POST") {
      return json(res, {
        error: "Track B claim ix not live. Track A (Pump holderReward) auto-pays — no claim button.",
        cta: "history",
      }, 501);
    }
    if (path === "sweep" && method === "POST") {
      return json(res, {
        error: "Build collect_creator_fee_v2 in the client. Destination is always the creator, never the payer.",
        hint: "/orbitxlaunch/claim",
      }, 501);
    }
    if (path.startsWith("markets/") && method === "POST") {
      return json(res, { error: "Unsigned bet tx not live until pm-core. Market is indexed only." }, 501);
    }

    const client = db();
    if (path === "markets" && method === "GET") {
      if (!client) return json(res, { markets: [] });
      const { data } = await client.from("orbitx_pad_markets").select("*").order("created_at", { ascending: false }).limit(80);
      return json(res, { markets: data ?? [] });
    }
    if (path.startsWith("markets/") && method === "GET") {
      const mint = path.slice("markets/".length);
      if (!client) return json(res, { market: null });
      const { data } = await client.from("orbitx_pad_markets").select("*").eq("mint", mint).maybeSingle();
      return json(res, { market: data ?? null });
    }
    if (path.startsWith("rewards/") && method === "GET") {
      const wallet = path.slice("rewards/".length);
      if (!client) return json(res, { claims: [] });
      const { data } = await client.from("orbitx_rewards_claims").select("*").eq("owner", wallet).order("claimed_at", { ascending: false }).limit(50);
      return json(res, { claims: data ?? [] });
    }
    return json(res, { error: "unknown path", path }, 404);
  } catch (e) {
    return json(res, { error: e instanceof Error ? e.message : String(e) }, 500);
  }
}
