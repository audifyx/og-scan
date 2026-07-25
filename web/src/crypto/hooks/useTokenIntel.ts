import { useCallback, useEffect, useState } from "react";
import {
  scanTokenFull,
  isValidMint,
  type ForensicsPayload,
  type SafetyPayload,
  type TokenPayload,
} from "../api/client";
import { composeRisk, type ComposedRisk } from "../risk/composeRisk";
import { holderEntropyScore } from "@/lib/intelligence";

export type TokenIntelState = {
  loading: boolean;
  error: string | null;
  mint: string | null;
  safety: SafetyPayload | null;
  forensics: ForensicsPayload | null;
  token: TokenPayload | null;
  risk: ComposedRisk | null;
  refresh: () => void;
};

function buildRisk(
  safety: SafetyPayload | null,
  forensics: ForensicsPayload | null,
  token: TokenPayload | null,
): ComposedRisk {
  const holders = token?.holders || [];
  const balances = holders.map((h) => Number(h.uiAmount ?? h.pct ?? 0)).filter((n) => n > 0);
  const entropy = balances.length >= 2 ? holderEntropyScore(balances) : null;
  const liq = Number(token?.liquidityUsd ?? token?.liquidity ?? NaN);

  return composeRisk({
    canBuy: safety?.canBuy ?? null,
    canSell: safety?.canSell ?? null,
    roundTripLossPct: safety?.roundTripLossPct ?? null,
    mintRenounced: forensics?.safetyFlags?.mintRenounced ?? null,
    freezeRenounced: forensics?.safetyFlags?.freezeRenounced ?? null,
    lpLockedPct: forensics?.safetyFlags?.lpLockedPct ?? null,
    rugged: forensics?.safetyFlags?.rugged ?? null,
    top10Pct: forensics?.concentration?.top10Pct ?? null,
    whaleCount: forensics?.concentration?.whales ?? null,
    totalHolders: forensics?.concentration?.totalHolders ?? null,
    liquidityUsd: Number.isFinite(liq) ? liq : null,
    devSold: forensics?.dev?.sold ?? null,
    devSerial: forensics?.dev?.serial ?? null,
    creatorTokensCount: forensics?.dev?.tokensCreated ?? null,
    holderEntropy: entropy,
    externalRiskScore: forensics?.safetyFlags?.riskScore ?? null,
  });
}

export function useTokenIntel(mint: string | null | undefined): TokenIntelState {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [safety, setSafety] = useState<SafetyPayload | null>(null);
  const [forensics, setForensics] = useState<ForensicsPayload | null>(null);
  const [token, setToken] = useState<TokenPayload | null>(null);
  const [risk, setRisk] = useState<ComposedRisk | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!mint || !isValidMint(mint)) {
      setSafety(null);
      setForensics(null);
      setToken(null);
      setRisk(null);
      setError(mint ? "Invalid mint address" : null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const data = await scanTokenFull(mint);
        if (cancelled) return;
        const s = (data.safety as SafetyPayload) || null;
        const f = (data.forensics as ForensicsPayload) || null;
        const t = (data.token as TokenPayload) || null;
        setSafety(s);
        setForensics(f);
        setToken(t);
        setRisk(buildRisk(s, f, t));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mint, tick]);

  return {
    loading,
    error,
    mint: mint && isValidMint(mint) ? mint : null,
    safety,
    forensics,
    token,
    risk,
    refresh,
  };
}
