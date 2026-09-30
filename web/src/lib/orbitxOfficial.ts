/** Official OrbitX brand / owner profile — gold globe verification. */

export function officialUsernameKey(username?: string | null): string {
  return String(username || "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const OFFICIAL_USERNAME_KEYS = new Set(["orbitx", "orbitxworld"]);

export function isOfficialOrbitxUsername(username?: string | null): boolean {
  const key = officialUsernameKey(username);
  return Boolean(key) && OFFICIAL_USERNAME_KEYS.has(key);
}

export function isOrbitxGoldGlobeProfile(
  profile:
    | {
        username?: string | null;
        is_official_account?: boolean | null;
      }
    | null
    | undefined,
  isOwnerAccount = false,
): boolean {
  if (isOwnerAccount) return true;
  if (!profile) return false;
  if (profile.is_official_account) return true;
  return isOfficialOrbitxUsername(profile.username);
}
