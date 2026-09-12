import { cn } from "@/lib/utils";
import type { LaunchType } from "@/lib/launchpad/types";

const MODES: { id: LaunchType; label: string; hint: string }[] = [
  { id: "normal", label: "Normal", hint: "Random CA · instant" },
  { id: "vanity", label: "Vanity", hint: "Prefix / suffix grind" },
  { id: "custom_ca", label: "Custom CA", hint: "Bring your mint keypair" },
  { id: "rewards", label: "Rewards", hint: "Holder vault" },
  { id: "bagwork", label: "Bagwork", hint: "Fees fund work" },
];

export function ModeRail({ value, onChange }: { value: LaunchType; onChange: (t: LaunchType) => void }) {
  return (
    <div className="lp-mode-rail" role="tablist" aria-label="Launch type">
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          role="tab"
          aria-selected={value === m.id}
          className={cn("lp-mode", value === m.id && "lp-mode--on")}
          onClick={() => onChange(m.id)}
        >
          <span>{m.label}</span>
          <em>{m.hint}</em>
        </button>
      ))}
    </div>
  );
}
