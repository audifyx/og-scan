import adminTokens from "./_admin-tokens.ts";
import signupCheck from "./_signup-check.ts";
import bagwork from "./_bagwork.ts";
import pumpCreate from "./_pump-create.ts";
import orbitxWorld from "./_orbitx-world.ts";
import kol from "./_kol.ts";
import deskUnlock from "./_orbitx-desk-unlock.js";

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

const ROUTES = {
  "admin-tokens": adminTokens,
  "signup-check": signupCheck,
  bagwork,
  "pump-create": pumpCreate,
  "orbitx-world": orbitxWorld,
  kol,
  "orbitx-desk-unlock": deskUnlock,
  paused: pausedFeature,
};

export default async function handler(req, res) {
  const raw = req.query?.path || req.query?.route || "";
  const key = String(raw).split("/").filter(Boolean)[0];
  const route = ROUTES[key];
  if (!route) {
    res.statusCode = 404;
    return res.end("Not found");
  }
  return route(req, res);
}
