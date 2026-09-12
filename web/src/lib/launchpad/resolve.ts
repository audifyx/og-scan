import { PAD_PARAMS } from "./params";
import type { ResolverKind } from "./types";

export type OracleTick = {
  value: number;
  conf: number;
  publishTime: number;
  feedId: string;
};

export type ResolveDecision =
  | { outcome: "yes" | "no"; reason: string }
  | { outcome: "void"; reason: string }
  | { outcome: "skip"; reason: string };

export function pythThresholdResolve(opts: {
  nowUnix: number;
  deadlineUnix: number;
  graceSec?: number;
  tick: OracleTick | null;
  threshold: number;
  maxConfRatio?: number;
}): ResolveDecision {
  const grace = opts.graceSec ?? PAD_PARAMS.graceResolveSec;
  if (opts.nowUnix < opts.deadlineUnix) return { outcome: "skip", reason: "before deadline" };
  if (!opts.tick) {
    if (opts.nowUnix >= opts.deadlineUnix + grace) return { outcome: "void", reason: "no feed at T+grace" };
    return { outcome: "skip", reason: "stale — wait for grace" };
  }
  const age = opts.nowUnix - opts.tick.publishTime;
  const confRatio = opts.tick.value === 0 ? Infinity : Math.abs(opts.tick.conf / opts.tick.value);
  const maxConf = opts.maxConfRatio ?? 0.05;
  if (age > grace || confRatio > maxConf) {
    if (opts.nowUnix >= opts.deadlineUnix + grace) return { outcome: "void", reason: "stale oracle → void, not steal" };
    return { outcome: "skip", reason: "conf interval too wide" };
  }
  return {
    outcome: opts.tick.value >= opts.threshold ? "yes" : "no",
    reason: `value ${opts.tick.value} vs threshold ${opts.threshold}`,
  };
}

export function metricGraduationResolve(opts: {
  nowUnix: number;
  deadlineUnix: number;
  graduatedAtUnix: number | null;
  graceSec?: number;
}): ResolveDecision {
  const grace = opts.graceSec ?? PAD_PARAMS.graceResolveSec;
  if (opts.nowUnix < opts.deadlineUnix) return { outcome: "skip", reason: "before deadline" };
  if (opts.graduatedAtUnix && opts.graduatedAtUnix <= opts.deadlineUnix) {
    return { outcome: "yes", reason: "graduated on or before T" };
  }
  if (opts.nowUnix >= opts.deadlineUnix + grace) {
    return { outcome: "no", reason: "did not graduate by T" };
  }
  return { outcome: "skip", reason: "in grace window" };
}

export function resolverCopy(kind: ResolverKind): string {
  switch (kind) {
    case "pyth":
      return "Pyth price threshold. Stale feed halts, then voids at T+grace.";
    case "switchboard":
      return "Switchboard on-demand threshold. Same stale → void rule as Pyth.";
    case "metric":
      return "On-chain metric snapshot (holders, LP, graduated bit). Raw accounts, not an API.";
    case "mofn":
      return "M-of-N authority. Requires a public evidence URI. Captured committee is the failure mode.";
    case "optimistic":
      return "Propose + challenge window. Needs a bond and a court. Not live until market program.";
    default:
      return "Unknown resolver";
  }
}

export function freezeResolverAfterFirstBet(before: ResolverKind, after: ResolverKind, openInterest: bigint): string | null {
  if (openInterest > 0n && before !== after) return "Cannot change resolver type after first bet";
  return null;
}

export function freezeDeadlineAfterFirstBet(before: number, after: number, openInterest: bigint): string | null {
  if (openInterest > 0n && before !== after) return "Cannot change deadline after first bet";
  return null;
}
