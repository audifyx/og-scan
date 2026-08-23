/**
 * Canonical OrbitX Predictions product.
 * Hub / OS / Telegram / MCP buttons must use this — not /predictions,
 * solno.fun, or orbitx-prediction.fun.
 */
export const ORBITX_PREDICTIONS_URL = "https://orbitxtrade.world/";

export function isHttpUrl(href) {
  return typeof href === "string" && /^https?:\/\//i.test(href.trim());
}

/** Resolve in-app or absolute Predictions links to the live product. */
export function resolvePredictionsUrl(href) {
  if (typeof href !== "string" || !href.trim()) return ORBITX_PREDICTIONS_URL;
  const trimmed = href.trim();
  if (isHttpUrl(trimmed) && /orbitxtrade\.world/i.test(trimmed)) return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
  if (trimmed === "/predictions" || trimmed.startsWith("/predictions/") || trimmed === "predictions") {
    return ORBITX_PREDICTIONS_URL;
  }
  if (/solno\.fun|orbitx-prediction\.fun/i.test(trimmed)) return ORBITX_PREDICTIONS_URL;
  return trimmed;
}
