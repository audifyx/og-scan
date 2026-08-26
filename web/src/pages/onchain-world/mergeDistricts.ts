import type { CityDistricts, TokenDistrict } from "./api";
import type { TickerStats } from "./lib/orbitx/types";

export function tokenCatalogSize(districts: CityDistricts | null | undefined): number {
  return Array.isArray(districts?.tokens) ? districts.tokens.length : 0;
}

/** Keep the largest token catalog and the OrbitX 24h fields that actually exist. */
export function mergeDistricts(
  ...candidates: Array<CityDistricts | null | undefined>
): CityDistricts {
  const list = candidates.filter((d): d is CityDistricts => Boolean(d));
  if (!list.length) return { tokens: [] };
  let best = list[0];
  for (const candidate of list) {
    if (tokenCatalogSize(candidate) > tokenCatalogSize(best)) best = candidate;
  }
  const orbitxWithFlow = list
    .map((d) => d.orbitx)
    .filter((o): o is TokenDistrict => Boolean(o))
    .find((o) => o.buys_24h != null || o.sells_24h != null);
  const orbitxAny = list.map((d) => d.orbitx).find((o): o is TokenDistrict => Boolean(o));
  const hubs = best.hubs?.length ? best.hubs : list.find((d) => d.hubs?.length)?.hubs;
  const tokens = tokenCatalogSize(best)
    ? best.tokens
    : list.find((d) => tokenCatalogSize(d))?.tokens || [];
  return {
    ...best,
    orbitx: orbitxWithFlow
      ? { ...(best.orbitx || orbitxAny || {}), ...orbitxWithFlow }
      : best.orbitx || orbitxAny,
    hubs: hubs || best.hubs || [],
    tokens,
  };
}

/** Keep previously confirmed ticker numbers when a later poll returns blanks. */
export function keepTicker(prev: TickerStats | undefined, next: TickerStats): TickerStats {
  if (!prev) return next;
  const out = { ...next };
  (Object.keys(prev) as Array<keyof TickerStats>).forEach((key) => {
    if (out[key] == null && prev[key] != null) out[key] = prev[key];
  });
  return out;
}
