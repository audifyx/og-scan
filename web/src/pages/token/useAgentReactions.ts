import { useMemo } from "react";

export type AgentReaction =
  | "eyes-wide"
  | "nervous"
  | "celebrating"
  | "chill"
  | "sleepy"
  | "hyped";

export const REACTION_LABEL: Record<AgentReaction, string> = {
  "eyes-wide": "EYES WIDE",
  nervous: "NERVOUS",
  celebrating: "CELEBRATING",
  chill: "CHILL",
  sleepy: "SLEEPY",
  hyped: "HYPED",
};

export function useAgentReaction(
  price: number | null | undefined,
  change24h: number | null | undefined,
  mcap: number | null | undefined
): AgentReaction {
  void price;
  return useMemo(() => {
    if (change24h == null) {
      if (mcap != null && mcap >= 500_000) return "eyes-wide";
      return "chill";
    }
    if (change24h >= 25) return "hyped";
    if (change24h >= 8) return "celebrating";
    if (change24h <= -15) return "nervous";
    if (change24h <= -5) return "sleepy";
    if (mcap != null && mcap >= 500_000) return "eyes-wide";
    return "chill";
  }, [change24h, mcap]);
}
