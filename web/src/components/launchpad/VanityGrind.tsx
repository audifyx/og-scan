import { Loader2, Wand2 } from "lucide-react";
import { vanityEta, vanityPatternLength } from "@/lib/launchpad/intent";
import type { LaunchIntent } from "@/lib/launchpad/types";

export function VanityGrind({
  intent,
  grinding,
  found,
  attempts,
  onChange,
  onGrind,
  onStop,
}: {
  intent: LaunchIntent;
  grinding: boolean;
  found: string | null;
  attempts: number;
  onChange: (patch: Partial<LaunchIntent>) => void;
  onGrind: () => void;
  onStop: () => void;
}) {
  const chars = vanityPatternLength(intent);
  const eta = vanityEta(chars);
  return (
    <div className="lp-mint-block">
      <div className="lp-field-label">Vanity mint</div>
      <div className="lp-vanity-row">
        <label>
          Prefix
          <input
            value={intent.vanityPrefix}
            maxLength={5}
            onChange={(e) => onChange({ vanityPrefix: e.target.value })}
            placeholder="none"
            className="lp-input"
          />
        </label>
        <label>
          Suffix
          <input
            value={intent.vanitySuffix}
            maxLength={5}
            onChange={(e) => onChange({ vanitySuffix: e.target.value })}
            placeholder="obx"
            className="lp-input"
          />
        </label>
        <label className="lp-check">
          <input
            type="checkbox"
            checked={intent.vanityCaseInsensitive}
            onChange={(e) => onChange({ vanityCaseInsensitive: e.target.checked })}
          />
          Case-insensitive
        </label>
      </div>
      <div className="lp-vanity-eta">
        {chars} chars · {eta.label}
      </div>
      <div className="flex gap-2">
        {!grinding ? (
          <button type="button" className="lp-auth-btn" disabled={eta.disabled} onClick={onGrind}>
            <Wand2 className="h-3.5 w-3.5" /> Grind
          </button>
        ) : (
          <button type="button" className="lp-auth-btn" onClick={onStop}>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Stop · {attempts.toLocaleString()}
          </button>
        )}
      </div>
      {found && <div className="lp-mint-preview font-mono">{found}</div>}
    </div>
  );
}
