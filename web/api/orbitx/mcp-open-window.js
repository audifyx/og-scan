/**
 * MCP is free for everyone during testing/development.
 * Default window: 2026-09-07 → 2026-11-07 (two months).
 *
 * Env:
 *   MCP_OPEN_UNTIL=ISO timestamp to extend or shorten
 *   MCP_OPEN_TESTING=0|false|off to close the window immediately
 */

export const MCP_OPEN_UNTIL_DEFAULT = "2026-11-07T00:00:00.000Z";

function truthyOff(raw) {
  const v = String(raw || "")
    .trim()
    .toLowerCase();
  return v === "0" || v === "false" || v === "off" || v === "no";
}

export function mcpOpenUntilMs() {
  const env = String(process.env.MCP_OPEN_UNTIL || "").trim();
  const parsed = env ? Date.parse(env) : NaN;
  const ms = Number.isFinite(parsed) ? parsed : Date.parse(MCP_OPEN_UNTIL_DEFAULT);
  return Number.isFinite(ms) ? ms : Date.parse(MCP_OPEN_UNTIL_DEFAULT);
}

export function mcpOpenUntilIso() {
  return new Date(mcpOpenUntilMs()).toISOString();
}

export function isMcpOpenTesting(now = Date.now()) {
  if (truthyOff(process.env.MCP_OPEN_TESTING)) return false;
  return Number(now) < mcpOpenUntilMs();
}

export function formatOpenUntilLabel(now = Date.now()) {
  const until = mcpOpenUntilMs();
  try {
    return new Date(until).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return new Date(until).toISOString().slice(0, 10);
  }
}

export function mcpOpenRemainingMs(now = Date.now()) {
  return Math.max(0, mcpOpenUntilMs() - Number(now));
}

export function mcpOpenRemainingLabel(now = Date.now()) {
  const left = mcpOpenRemainingMs(now);
  if (left <= 0) return "Closed";
  const days = Math.floor(left / (24 * 60 * 60 * 1000));
  const hours = Math.floor((left % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days >= 2) return `Free until ${formatOpenUntilLabel(now)} (${days}d left)`;
  if (days === 1) return `Free until ${formatOpenUntilLabel(now)} (1d ${hours}h left)`;
  if (hours >= 1) return `Free until ${formatOpenUntilLabel(now)} (${hours}h left)`;
  const minutes = Math.max(1, Math.floor(left / 60000));
  return `Free until ${formatOpenUntilLabel(now)} (${minutes}m left)`;
}

export function mcpOpenWindow(now = Date.now()) {
  const active = isMcpOpenTesting(now);
  const until = mcpOpenUntilIso();
  return {
    active,
    openTesting: active,
    until,
    remainingMs: mcpOpenRemainingMs(now),
    remainingLabel: active ? mcpOpenRemainingLabel(now) : "Closed",
    source: active ? "open_testing" : null,
    message: active
      ? `MCP is free for everyone until ${formatOpenUntilLabel(now)} during testing and development. After that, hold ≥$5 ORBITX or burn a timed seat.`
      : null,
  };
}

/** Merge the open-testing window onto a burn-access status payload. */
export function decorateAccessStatus(status, now = Date.now()) {
  const open = mcpOpenWindow(now);
  const base = status && typeof status === "object" ? { ...status } : {};
  if (!open.active) {
    return {
      ...base,
      openTesting: false,
      openUntil: open.until,
      allowed: Boolean(base.active || base.allowed),
    };
  }
  return {
    ...base,
    openTesting: true,
    openUntil: open.until,
    allowed: true,
    source: base.active ? base.source || "burn" : "open_testing",
    remainingLabel: base.active ? base.remainingLabel : open.remainingLabel,
    message: open.message,
  };
}
