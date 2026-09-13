import ogMemes from "./_og-memes.ts";
import adminTokens from "./_admin-tokens.ts";
import signupCheck from "./_signup-check.ts";
import bagwork from "./_bagwork.ts";
import pumpCreate from "./_pump-create.ts";
import orbitxWorld from "./_orbitx-world.ts";
import kol from "./_kol.ts";

const ROUTES = {
  "og-memes": ogMemes,
  "admin-tokens": adminTokens,
  "signup-check": signupCheck,
  bagwork,
  "pump-create": pumpCreate,
  "orbitx-world": orbitxWorld,
  kol,
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
