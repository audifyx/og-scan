function pausedFeature(req, res) {
  res.statusCode = 503;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Retry-After", "604800");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify({
    ok: false,
    status: "paused",
    error: "Trading and on-chain features are temporarily paused.",
    message: "Coming back live this week.",
  }));
}

// Lazy-load every route so one broken module can't crash all /api/web routes.
// CONNECTOR RULE (Vercel Hobby max 12 serverless functions): new endpoints
// plug in here — NEVER add a new standalone api/ file.
const LAZY = {
  "admin-tokens": () => import("./_admin-tokens.ts"),
  "signup-check": () => import("./_signup-check.ts"),
  "bagwork": () => import("./_bagwork.ts"),
  "pump-create": () => import("./_pump-create.ts"),
  "orbitx-world": () => import("./_orbitx-world.ts"),
  "kol": () => import("./_kol.ts"),
  "city-property": () => import("./_city-property.js"),
  "share": () => import("./_share.ts"),
  "share-wallet": () => import("./_share-wallet.ts"),
  "orbitx-onchain": () => import("./_orbitx-onchain.js"),
  "orbitx-ai": () => import("./_orbitx-ai.js"),
  "social": () => import("./_social.js"),
  "telegram-mcp": () => import("./_telegram-mcp.js"),
};

export default async function handler(req, res) {
  const raw = req.query?.path || req.query?.route || "";
  const key = String(raw).split("/").filter(Boolean)[0];
  if (key === "paused") return pausedFeature(req, res);
  const load = LAZY[key];
  if (!load) {
    res.statusCode = 404;
    return res.end("Not found");
  }
  try {
    const fn = (await load()).default;
    return fn(req, res);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({
      ok: false,
      error: "route_failed",
      route: key,
      detail: String((e && e.message) || e).slice(0, 200),
    }));
  }
}
