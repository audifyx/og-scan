import { REWARDS_LEGAL, type LaunchIntent, type RewardsTrack } from "@/lib/launchpad/types";
import { trackCopy } from "@/lib/launchpad/rewards";
import { PAD_PARAMS } from "@/lib/launchpad/params";
import type { PadFlags } from "@/lib/launchpad/flags";

const TRACKS: { id: RewardsTrack; label: string; hint: string }[] = [
  { id: "none", label: "None", hint: "Creator vault only" },
  { id: "pump_holder", label: "Track A", hint: "Pump holderReward" },
  { id: "epoch_vault", label: "Track B", hint: "Epoch vault · audit first" },
];

export function RewardsTrack({
  intent,
  flags,
  onChange,
}: {
  intent: LaunchIntent;
  flags: PadFlags;
  onChange: (p: Partial<LaunchIntent>) => void;
}) {
  const copy = trackCopy(intent.rewards.track);
  return (
    <div className="lp-id-block">
      <div className="lp-field-label">Rewards policy</div>
      <div className="lp-grad">
        {TRACKS.map((t) => {
          const off = t.id === "epoch_vault" && !flags.track_b_vault;
          return (
            <button
              key={t.id}
              type="button"
              disabled={off}
              className={`lp-mode ${intent.rewards.track === t.id ? "lp-mode--on" : ""}`}
              onClick={() => onChange({
                rewards: { ...intent.rewards, track: t.id },
                holderRewards: t.id === "pump_holder" || intent.type === "bagwork",
              })}
            >
              <span>{t.label}</span>
              <em>{off ? "not live" : t.hint}</em>
            </button>
          );
        })}
      </div>
      {intent.rewards.track === "pump_holder" && (
        <label className="lp-check">
          <input
            type="checkbox"
            checked={!!intent.rewards.predictBoost}
            onChange={(e) => onChange({ rewards: { ...intent.rewards, predictBoost: e.target.checked } })}
          />
          Predict-boost (correct YES/NO + holding the coin). Capped at {PAD_PARAMS.predictBoostCap}×. Indexed until vault is live.
        </label>
      )}
      <p className="lp-auth-copy">{copy.body}</p>
      <p className="lp-legal">{REWARDS_LEGAL}</p>
    </div>
  );
}
