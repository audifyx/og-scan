/** Shared presentation atoms for the bounty module UI. */

import type { Bounty, BountyCurrency, ClaimBountyError, PostBountyError } from "./types";

export const POST_ERROR_COPY: Record<PostBountyError, string> = {
  self_target: "You can't put a bounty on your own head.",
  bad_amount: "Enter a valid whole amount within the bounty limits.",
  bad_target: "Name the rival you're hunting.",
  bad_duration: "Pick a valid bounty duration.",
  insufficient_paper: "Not enough paper CITY. Earn more in the city first.",
  billing_not_ready: "ORBITX billing isn't authed yet — tap below to auth once.",
  billing_failed: "The burn spend failed. Check your ORBITX balance and retry.",
  store_full: "Too many open bounties right now. Try again later.",
};

export const CLAIM_ERROR_COPY: Record<ClaimBountyError, string> = {
  not_found: "That bounty no longer exists.",
  not_open: "That bounty is no longer open.",
  self_claim: "You can't claim your own bounty.",
  backend_pending: "The backend payout route isn't available yet — the bounty stays open. Try again later.",
  store_error: "Something went wrong recording the claim. Try again.",
};

export function currencyLabel(c: BountyCurrency): string {
  return c === "CITY" ? "CITY" : "ORBITX";
}

export function currencySymbol(c: BountyCurrency): string {
  return c === "CITY" ? "◉" : "◎";
}

/** Short relative countdown, e.g. "5h 12m", "2d 3h", "expired". */
export function timeLeft(expiresAt: number, now: number): string {
  const ms = expiresAt - now;
  if (ms <= 0) return "expired";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export function shortDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function statusCopy(b: Bounty): string {
  switch (b.status) {
    case "open":
      return "OPEN";
    case "claimed":
      return "CLAIMED";
    case "expired":
      return "EXPIRED";
    case "cancelled":
      return "CANCELLED";
  }
}

export function statusClass(b: Bounty): string {
  switch (b.status) {
    case "open":
      return "text-emerald-300 border-emerald-500/40 bg-emerald-500/10";
    case "claimed":
      return "text-amber-300 border-amber-500/40 bg-amber-500/10";
    case "expired":
      return "text-zinc-400 border-zinc-500/40 bg-zinc-500/10";
    case "cancelled":
      return "text-zinc-500 border-zinc-600/40 bg-zinc-600/10";
  }
}
