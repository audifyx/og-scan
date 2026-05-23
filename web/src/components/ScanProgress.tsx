import { useEffect, useRef, useState } from "react";
import { Check, Circle, Loader2, ShieldCheck, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Step definitions ───────────────────────────────────────────────────────

type ScanStep = {
  id: string;
  label: string;
  sublabel: string;
  durationMs: number; // how long this step "takes" visually
};

const SCAN_STEPS: ScanStep[] = [
  {
    id: "rpc",
    label: "Connecting to blockchain",
    sublabel: "Establishing Solana RPC link…",
    durationMs: 520,
  },
  {
    id: "index",
    label: "Pulling token index",
    sublabel: "Querying Jupiter aggregator…",
    durationMs: 680,
  },
  {
    id: "history",
    label: "Scanning wallet history",
    sublabel: "Fetching on-chain transaction proofs…",
    durationMs: 900,
  },
  {
    id: "liquidity",
    label: "Auditing liquidity pools",
    sublabel: "Checking LP depth & pull events…",
    durationMs: 740,
  },
  {
    id: "cluster",
    label: "Building cluster graph",
    sublabel: "Mapping dominance & clone network…",
    durationMs: 820,
  },
  {
    id: "og",
    label: "Checking OG status",
    sublabel: "Running forensic origin attribution…",
    durationMs: 960,
  },
  {
    id: "score",
    label: "Scoring & ranking results",
    sublabel: "Calculating dominance, risk, origin…",
    durationMs: 600,
  },
];

// ─── Hook: drive step progression ──────────────────────────────────────────

type StepState = "waiting" | "active" | "done";

function useScanSteps(active: boolean) {
  const [stepIndex, setStepIndex] = useState(0);
  const [stepStates, setStepStates] = useState<StepState[]>(SCAN_STEPS.map(() => "waiting"));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset when scan starts
  useEffect(() => {
    if (!active) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setStepIndex(0);
      setStepStates(SCAN_STEPS.map(() => "waiting"));
      return;
    }

    // Mark step 0 as active immediately
    setStepStates((prev) => {
      const next = [...prev];
      next[0] = "active";
      return next;
    });

    let current = 0;

    const advance = () => {
      if (current >= SCAN_STEPS.length - 1) return;

      timerRef.current = setTimeout(() => {
        setStepStates((prev) => {
          const next = [...prev];
          next[current] = "done";
          if (current + 1 < SCAN_STEPS.length) next[current + 1] = "active";
          return next;
        });
        setStepIndex(current + 1);
        current++;
        advance();
      }, SCAN_STEPS[current].durationMs);
    };

    advance();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active]);

  const doneCount = stepStates.filter((s) => s === "done").length;
  const activeIdx = stepStates.findIndex((s) => s === "active");
  const progress = active
    ? Math.min(95, Math.round(((doneCount + (activeIdx >= 0 ? 0.5 : 0)) / SCAN_STEPS.length) * 100))
    : 0;

  return { stepStates, stepIndex, progress };
}

// ─── Animated progress bar ─────────────────────────────────────────────────

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/10">
      {/* Track glow */}
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-og-cyan via-og-gold to-og-cyan transition-all duration-500 ease-out"
        style={{ width: `${progress}%` }}
      />
      {/* Shimmer sweep */}
      <div
        className="absolute inset-y-0 left-0 w-full rounded-full"
        style={{ width: `${progress}%` }}
      >
        <div className="h-full w-full animate-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

type Props = {
  active: boolean;
  query: string;
  className?: string;
};

export function ScanProgress({ active, query, className }: Props) {
  const { stepStates, progress } = useScanSteps(active);

  if (!active) return null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/12 bg-gradient-to-b from-white/[0.07] to-og-ink/90",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_28px_80px_-50px_hsl(var(--og-cyan)/0.7)]",
        "backdrop-blur-xl",
        "p-5",
        className
      )}
    >
      {/* Ambient top glow */}
      <div className="pointer-events-none absolute -top-10 left-1/2 h-24 w-3/4 -translate-x-1/2 rounded-full bg-og-gold/10 blur-2xl" />

      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-og-gold animate-pulse" />
          <span className="font-mono text-[11px] uppercase tracking-[0.35em] text-og-gold">
            OG Scanner — Active
          </span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/25 px-2.5 py-1 backdrop-blur">
          <Loader2 className="h-3 w-3 animate-spin text-og-cyan" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-og-cyan">
            {progress}%
          </span>
        </div>
      </div>

      {/* Query label */}
      {query && (
        <div className="mb-4 truncate font-mono text-xs text-white/50">
          <span className="text-white/30">›</span>{" "}
          <span className="text-og-cyan/80">{query}</span>
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-5">
        <ProgressBar progress={progress} />
      </div>

      {/* Step list */}
      <ol className="space-y-1.5">
        {SCAN_STEPS.map((step, i) => {
          const state = stepStates[i];
          return (
            <StepRow
              key={step.id}
              step={step}
              state={state}
              index={i}
            />
          );
        })}
      </ol>

      {/* Bottom shimmer line */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px overflow-hidden rounded-b-2xl">
        <div className="h-full w-full animate-ticker bg-gradient-to-r from-transparent via-og-gold/60 to-transparent" />
      </div>
    </div>
  );
}

// ─── Individual step row ───────────────────────────────────────────────────

function StepRow({
  step,
  state,
  index,
}: {
  step: ScanStep;
  state: StepState;
  index: number;
}) {
  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-xl px-3 py-2 transition-all duration-300",
        state === "active" && "bg-og-cyan/8 border border-og-cyan/20",
        state === "done" && "opacity-60",
        state === "waiting" && "opacity-25"
      )}
    >
      {/* Icon */}
      <div className="mt-0.5 flex-shrink-0">
        {state === "done" ? (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-og-gold/20 text-og-gold">
            <Check className="h-2.5 w-2.5 stroke-[3]" />
          </span>
        ) : state === "active" ? (
          <span className="flex h-4 w-4 items-center justify-center">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-og-cyan" />
          </span>
        ) : (
          <span className="flex h-4 w-4 items-center justify-center">
            <Circle className="h-3 w-3 text-white/20" />
          </span>
        )}
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "font-mono text-[11px] font-semibold uppercase tracking-wider",
            state === "done" && "text-og-gold/70",
            state === "active" && "text-white",
            state === "waiting" && "text-white/40"
          )}
        >
          {step.label}
        </div>
        {state === "active" && (
          <div className="mt-0.5 font-mono text-[10px] text-og-cyan/70">
            {step.sublabel}
          </div>
        )}
      </div>

      {/* Step number badge */}
      <span
        className={cn(
          "flex-shrink-0 self-center rounded-full border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest",
          state === "done" && "border-og-gold/30 text-og-gold/50",
          state === "active" && "border-og-cyan/40 text-og-cyan",
          state === "waiting" && "border-white/10 text-white/20"
        )}
      >
        {String(index + 1).padStart(2, "0")}
      </span>
    </li>
  );
}
