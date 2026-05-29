const RESERVED_OWNER_EMAILS = ["audifyx@gmail.com"] as const;

const RESERVED_SUBSTRINGS = [
  "admin",
  "administrator",
  "owner",
  "founder",
  "cofounder",
  "official",
  "staff",
  "support",
  "root",
  "sysadmin",
] as const;

export function normalizeUsernameForPolicy(username: string) {
  return username.trim().replace(/^@/, "").toLowerCase();
}

function collapseUsername(username: string) {
  return normalizeUsernameForPolicy(username).replace(/[^a-z0-9]/g, "");
}

export function canUseReservedUsername(email?: string | null) {
  const cleanEmail = email?.trim().toLowerCase();
  return Boolean(cleanEmail && RESERVED_OWNER_EMAILS.includes(cleanEmail as (typeof RESERVED_OWNER_EMAILS)[number]));
}

export function isReservedUsername(username: string) {
  const raw = normalizeUsernameForPolicy(username);
  const collapsed = collapseUsername(username);

  if (!raw) return false;

  if (RESERVED_SUBSTRINGS.some((term) => collapsed.includes(term))) {
    return true;
  }

  if (
    collapsed.startsWith("dev") ||
    collapsed.endsWith("dev") ||
    collapsed.includes("developer") ||
    raw.startsWith("dev_") ||
    raw.endsWith("_dev") ||
    raw.includes("_dev_")
  ) {
    return true;
  }

  return false;
}

export function getReservedUsernameMessage() {
  return "This username is reserved. Only the authorized owner account can use admin/dev-style usernames.";
}
