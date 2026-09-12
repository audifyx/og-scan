/** Spec v2-A / Y — studio flags. Env overrides; defaults are honest. */
export type PadFlags = {
  predict_markets: boolean;
  stocks: boolean;
  bagwork: boolean;
  track_b_vault: boolean;
  kill_create: boolean;
  kill_trade: boolean;
};

export const DEFAULT_PAD_FLAGS: PadFlags = {
  predict_markets: true,
  stocks: true,
  bagwork: true,
  track_b_vault: false,
  kill_create: false,
  kill_trade: false,
};

function envOn(name: string, fallback: boolean): boolean {
  const raw = (typeof process !== "undefined" ? process.env?.[name] : undefined) ?? "";
  if (!raw) return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

export function padFlagsFromEnv(): PadFlags {
  return {
    predict_markets: envOn("VITE_PAD_PREDICT_MARKETS", DEFAULT_PAD_FLAGS.predict_markets),
    stocks: envOn("VITE_PAD_STOCKS", DEFAULT_PAD_FLAGS.stocks),
    bagwork: envOn("VITE_PAD_BAGWORK", DEFAULT_PAD_FLAGS.bagwork),
    track_b_vault: envOn("VITE_PAD_TRACK_B_VAULT", DEFAULT_PAD_FLAGS.track_b_vault),
    kill_create: envOn("VITE_PAD_KILL_CREATE", DEFAULT_PAD_FLAGS.kill_create),
    kill_trade: envOn("VITE_PAD_KILL_TRADE", DEFAULT_PAD_FLAGS.kill_trade),
  };
}

/** Client flags. Vite inlines VITE_* at build; missing keys stay at defaults. */
export function clientPadFlags(): PadFlags {
  let env: Record<string, string | undefined> = {};
  try {
    env = ((import.meta as { env?: Record<string, string | undefined> }).env) ?? {};
  } catch {
    env = {};
  }
  const on = (k: string, fb: boolean) => {
    const v = env[k];
    if (v == null || v === "") return fb;
    return v === "1" || v.toLowerCase() === "true";
  };
  return {
    predict_markets: on("VITE_PAD_PREDICT_MARKETS", DEFAULT_PAD_FLAGS.predict_markets),
    stocks: on("VITE_PAD_STOCKS", DEFAULT_PAD_FLAGS.stocks),
    bagwork: on("VITE_PAD_BAGWORK", DEFAULT_PAD_FLAGS.bagwork),
    track_b_vault: on("VITE_PAD_TRACK_B_VAULT", DEFAULT_PAD_FLAGS.track_b_vault),
    kill_create: on("VITE_PAD_KILL_CREATE", DEFAULT_PAD_FLAGS.kill_create),
    kill_trade: on("VITE_PAD_KILL_TRADE", DEFAULT_PAD_FLAGS.kill_trade),
  };
}

/** US + territories stay blocked for predict until counsel signs off (F1004 / F1039). */
export const PREDICT_GEO_BLOCK = new Set(["US", "PR", "GU", "VI", "AS", "MP"]);

export function countryFromTimezone(tz?: string): string {
  const zone = tz || (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "") || "";
  if (zone.startsWith("America/") && !["America/Toronto", "America/Mexico_City", "America/Sao_Paulo", "America/Bogota", "America/Lima", "America/Argentina"].some((z) => zone.startsWith(z))) {
    return "US";
  }
  if (zone === "Pacific/Honolulu" || zone === "America/Anchorage" || zone === "America/Puerto_Rico") return "US";
  return "";
}

export function predictBlockedForCountry(country: string, flags: PadFlags = DEFAULT_PAD_FLAGS): boolean {
  if (!flags.predict_markets) return true;
  return PREDICT_GEO_BLOCK.has((country || "").toUpperCase());
}
