/**
 * OrbitXCity — Seasons module: season-pass hub UI.
 *
 * Season timer, tier progression, free + premium reward tracks with claim
 * buttons, premium-track entry via real ORBITX burn (backend-signed, no
 * popups), and the seasonal Event Board.
 *
 * Self-contained: only external deps are `react` (+ sibling files in this
 * module). No imports from other city modules, no `@/tokenomics/*`.
 */

import { useEffect, useMemo, useState } from "react";
import "../seasons.css";
import type { RewardTrack, SeasonBillingProvider } from "../types";
import { XP_PER_TIER, formatCountdown, getSeasonInfo } from "../data/seasons";
import { formatPaperOrbitx, seasonStore, useSeasonStore } from "../store/seasonStore";
import { useSeasonBilling } from "../billing";
import { startSeasonalTicker, stopSeasonalTicker } from "../eventFramework";
import { EventBoard } from "./EventBoard";

/** HUD panel id for the integrator (e.g. core `GtaHud` panel registry). */
export const SEASONS_PANEL_ID = "seasons";

interface SeasonPassPanelProps {
  /** Tokenomics billing provider — inject once it lands (see BILLING_CONTRACT.md). */
  billing?: SeasonBillingProvider | null;
  onClose?: () => void;
}

export function SeasonPassPanel({ billing: billingProvider, onClose }: SeasonPassPanelProps) {
  const progress = useSeasonStore();
  const billing = useSeasonBilling(billingProvider ?? null);
  const [now, setNow] = useState(() => Date.now());
  const [claiming, setClaiming] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    startSeasonalTicker();
    return () => stopSeasonalTicker();
  }, []);

  const info = useMemo(() => getSeasonInfo(now), [now]);
  const season = info.season;
  const seasonActive = info.status === "active";

  const nextTierXp = (progress.tier + 1) * XP_PER_TIER;
  const prevTierXp = progress.tier * XP_PER_TIER;
  const tierSpan = Math.max(1, nextTierXp - prevTierXp);
  const tierFillPct =
    progress.tier >= season.maxTier
      ? 100
      : Math.min(100, Math.max(0, ((progress.xp - prevTierXp) / tierSpan) * 100));

  const claim = (tier: number, track: RewardTrack) => {
    const key = `${track === "free" ? "f" : "p"}${tier}`;
    setClaiming(key);
    try {
      seasonStore.claimReward(tier, track);
    } finally {
      setClaiming(null);
    }
  };

  const enterPremium = async () => {
    try {
      const { signature } = await billing.enterPremium(season.id, season.premiumEntryCost);
      seasonStore.unlockPremium(signature);
    } catch {
      /* error is surfaced on billing.error */
    }
  };

  const unlockedCosmetics = useMemo(
    () =>
      season.tiers
        .filter((t) => progress.claimed.includes(`p${t.tier}`) && t.premium.cosmetic)
        .map((t) => t.premium.cosmetic as string),
    [season, progress.claimed],
  );

  const timerLabel =
    info.status === "active"
      ? `Ends in ${formatCountdown(info.msRemaining)}`
      : info.status === "upcoming"
        ? `Starts in ${formatCountdown(info.msRemaining)}`
        : "Season ended";

  return (
    <div className="ox-sea-hub" role="dialog" aria-label="Season pass">
      <div className="ox-sea-card">
        <div className="ox-sea-head">
          <div>
            <div className="ox-sea-kicker">ORBITXCITY</div>
            <div className="ox-sea-title">🎫 {season.name}</div>
            <div className="ox-sea-timer">{timerLabel}</div>
          </div>
          {onClose && (
            <button type="button" className="ox-sea-close" onClick={onClose} aria-label="Close">
              ✕
            </button>
          )}
        </div>

        {!seasonActive && (
          <div className="ox-sea-notice">
            {info.status === "upcoming"
              ? "This season hasn't started yet. Progress and claims unlock at season start."
              : "This season has ended. Your paper ORBITX balance carries over to the next season."}
          </div>
        )}

        <div className="ox-sea-progress">
          <div className="ox-sea-progress-row">
            <span className="ox-sea-tier-label">
              Tier <strong>{progress.tier}</strong> / {season.maxTier}
            </span>
            <span className="ox-sea-xp-label">
              {formatPaperOrbitx(progress.xp)} XP
              {progress.tier < season.maxTier && (
                <> · {formatPaperOrbitx(Math.max(0, nextTierXp - progress.xp))} to next</>
              )}
            </span>
          </div>
          <div className="ox-sea-bar">
            <div className="ox-sea-bar-fill" style={{ width: `${tierFillPct}%` }} />
          </div>
          <div className="ox-sea-wallet">
            🪙 <strong>{formatPaperOrbitx(progress.paperOrbitx)}</strong> paper ORBITX
            <span className="ox-sea-wallet-note">paper — no chain</span>
          </div>
        </div>

        <div className="ox-sea-premium">
          {progress.premiumUnlocked ? (
            <div className="ox-sea-premium-on">
              ⭐ Premium track unlocked
              {progress.premiumBurnSignature && (
                <span className="ox-sea-burn-sig" title={progress.premiumBurnSignature}>
                  burn {progress.premiumBurnSignature.slice(0, 8)}…
                </span>
              )}
            </div>
          ) : (
            <>
              <div className="ox-sea-premium-copy">
                <div className="ox-sea-premium-title">Premium track</div>
                <div className="ox-sea-premium-sub">
                  Bigger paper-ORBITX rewards + exclusive cosmetics. Entry burns{" "}
                  <strong>{season.premiumEntryCost} ORBITX</strong> (real, backend-signed — no popup).
                </div>
                {billing.balance !== null && (
                  <div className="ox-sea-premium-sub">Wallet: {billing.balance} ORBITX</div>
                )}
              </div>
              {!billing.providerConnected ? (
                <div className="ox-sea-auth-note">
                  🔒 Premium entry opens after the one-time wallet auth (tokenomics team). Free track
                  is live now.
                </div>
              ) : !billing.ready ? (
                <button
                  type="button"
                  className="ox-sea-btn ox-sea-btn-ghost"
                  onClick={billing.beginAuth}
                >
                  Complete one-time auth
                </button>
              ) : (
                <button
                  type="button"
                  className="ox-sea-btn ox-sea-btn-gold"
                  onClick={enterPremium}
                  disabled={billing.busy || !seasonActive}
                >
                  {billing.busy ? "Burning…" : `Enter premium — burn ${season.premiumEntryCost} ORBITX`}
                </button>
              )}
              {billing.error && <div className="ox-sea-error">{billing.error}</div>}
            </>
          )}
        </div>

        <div className="ox-sea-tracks">
          <div className="ox-sea-track-head">
            <span className="ox-sea-track-col">Free</span>
            <span className="ox-sea-track-col">Premium</span>
          </div>
          <div className="ox-sea-tier-list">
            {season.tiers.map((t) => (
              <TierRow
                key={t.tier}
                tier={t.tier}
                xpRequired={t.xpRequired}
                reached={progress.tier >= t.tier}
                freeLabel={t.free.label}
                premiumLabel={t.premium.label}
                freeClaimed={progress.claimed.includes(`f${t.tier}`)}
                premiumClaimed={progress.claimed.includes(`p${t.tier}`)}
                freeClaimable={seasonActive && seasonStore.canClaim(t.tier, "free")}
                premiumClaimable={seasonActive && seasonStore.canClaim(t.tier, "premium")}
                premiumLocked={!progress.premiumUnlocked}
                claiming={claiming}
                onClaim={claim}
              />
            ))}
          </div>
        </div>

        {unlockedCosmetics.length > 0 && (
          <div className="ox-sea-cosmetics">
            <div className="ox-sea-events-title">Unlocked cosmetics</div>
            <div className="ox-sea-cosmetics-list">
              {unlockedCosmetics.map((c) => (
                <span key={c} className="ox-sea-cosmetic-chip">
                  ✨ {c}
                </span>
              ))}
            </div>
          </div>
        )}

        <EventBoard />
      </div>
    </div>
  );
}

interface TierRowProps {
  tier: number;
  xpRequired: number;
  reached: boolean;
  freeLabel: string;
  premiumLabel: string;
  freeClaimed: boolean;
  premiumClaimed: boolean;
  freeClaimable: boolean;
  premiumClaimable: boolean;
  premiumLocked: boolean;
  claiming: string | null;
  onClaim: (tier: number, track: RewardTrack) => void;
}

function TierRow(props: TierRowProps) {
  const { tier } = props;
  const cell = (
    track: RewardTrack,
    label: string,
    claimed: boolean,
    claimable: boolean,
    locked: boolean,
  ) => {
    const key = `${track === "free" ? "f" : "p"}${tier}`;
    return (
      <div className={`ox-sea-reward${locked ? " is-locked" : ""}`}>
        <div className="ox-sea-reward-label">{locked ? "🔒" : label}</div>
        {claimed ? (
          <span className="ox-sea-claimed">Claimed ✓</span>
        ) : (
          <button
            type="button"
            className="ox-sea-btn ox-sea-btn-small"
            disabled={!claimable || props.claiming === key}
            onClick={() => props.onClaim(tier, track)}
          >
            {props.claiming === key ? "…" : "Claim"}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className={`ox-sea-tier${props.reached ? " is-reached" : ""}`}>
      <div className="ox-sea-tier-num">
        <div className="ox-sea-tier-n">{tier}</div>
        <div className="ox-sea-tier-xp">{formatPaperOrbitx(props.xpRequired)} XP</div>
      </div>
      {cell("free", props.freeLabel, props.freeClaimed, props.freeClaimable, false)}
      {cell("premium", props.premiumLabel, props.premiumClaimed, props.premiumClaimable, props.premiumLocked)}
    </div>
  );
}
