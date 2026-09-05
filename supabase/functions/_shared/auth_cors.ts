/** Shared CORS allowlist for auth edge functions. */
export const AUTH_ORIGINS = [
  "https://orbitx.world",
  "https://www.orbitx.world",
  "https://ogscan.fun",
  "https://www.ogscan.fun",
  "https://orbitxcity.vercel.app",
];

export function allowOrigin(origin: string | null): string | null {
  if (!origin) return null;
  if (AUTH_ORIGINS.includes(origin)) return origin;
  try {
    const host = new URL(origin).hostname;
    if (host === "localhost" || host === "127.0.0.1") return origin;
    if (host.endsWith(".vercel.app")) return origin;
  } catch {
    return null;
  }
  return null;
}

export function authCors(origin: string | null): Record<string, string> {
  const allowed = allowOrigin(origin) ?? "https://www.orbitx.world";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
    "Content-Type": "application/json",
  };
}
