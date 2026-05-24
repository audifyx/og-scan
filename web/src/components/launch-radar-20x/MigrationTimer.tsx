/**
 * MigrationTimer — Live countdown/progress bar to bonding curve completion.
 * Predicts migration time based on volume velocity.
 */
import { useState, useEffect, useRef } from "react";
import { Timer, TrendingUp, Zap, ArrowRight, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fmtUsd } from "@/lib/og";

interface Props {
  bondingCurveProgress: number; // 0-100
  currentVolume: number; // SOL or USD in the bonding curve
  targetVolume: number; // Target to complete bonding curve (usually ~85 SOL or equivalent)
  volumeVelocity: number; // SOL per minute
  migrated: boolean;
  compact?: boolean;
}

function estimateTimeRemaining(progress: number, velocity: number, target: number, current: number): string {
  if (velocity <= 0) return "Unknown";
  const remaining = target - current;
  const minutesLeft = remaining / velocity;
  if (minutesLeft < 1) return "< 1 min";
  if (minutesLeft < 60) return `~${Math.ceil(minutesLeft)} min`;
  if (minutesLeft < 1440) return `~${Math.ceil(minutesLeft / 60)}h`;
  return `~${Math.ceil(minutesLeft / 1440)}d`;
}

export const MigrationTimer: React.FC<Props> = ({
  bondingCurveProgress,
  currentVolume,
  targetVolume,
  volumeVelocity,
  migrated,
  compact = false,
}) => {
  const [progress, setProgress] = useState(bondingCurveProgress);
  const animRef = useRef<number>();

  // Animate progress smoothly
  useEffect(() => {
    const target = bondingCurveProgress;
    const step = () => {
      setProgress(prev => {
        const diff = target - prev;
        if (Math.abs(diff) < 0.1) return target;
        return prev + diff * 0.1;
      });
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [bondingCurveProgress]);

  const eta = estimateTimeRemaining(progress, volumeVelocity, targetVolume, currentVolume);
  const isClose = progress >= 80;
  const isHot = volumeVelocity > 1;

  if (migrated) {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] gap-1">
        <CheckCircle className="h-2.5 w-2.5" /> Migrated ✓
      </Badge>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all",
              isClose ? "bg-emerald-500" : progress >= 50 ? "bg-amber-500" : "bg-white/20"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className={cn("text-[9px] font-bold tabular-nums",
          isClose ? "text-emerald-400" : "text-white/30"
        )}>
          {progress.toFixed(0)}%
        </span>
        {isHot && <Zap className="h-2.5 w-2.5 text-amber-400 animate-pulse" />}
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-lg border p-3",
      isClose ? "border-emerald-500/20 bg-emerald-500/5" :
      isHot ? "border-amber-500/15 bg-amber-500/5" :
      "border-white/[0.06] bg-white/[0.015]"
    )}>
      <div className="flex items-center gap-2 mb-2">
        <Timer className={cn("h-4 w-4",
          isClose ? "text-emerald-400" : isHot ? "text-amber-400" : "text-white/30"
        )} />
        <span className="text-xs font-bold text-white">Migration Progress</span>
        {isClose && <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[8px] animate-pulse">Almost There!</Badge>}
        {isHot && !isClose && <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[8px]">🔥 Hot</Badge>}
      </div>

      {/* Progress bar */}
      <div className="relative h-3 rounded-full bg-white/[0.06] overflow-hidden mb-2">
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-300",
            isClose ? "bg-gradient-to-r from-emerald-600 to-emerald-400" :
            progress >= 50 ? "bg-gradient-to-r from-amber-600 to-amber-400" :
            "bg-gradient-to-r from-white/20 to-white/30"
          )}
          style={{ width: `${progress}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[8px] font-black text-white drop-shadow-md">{progress.toFixed(1)}%</span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-white/25">{fmtUsd(currentVolume)} / {fmtUsd(targetVolume)}</span>
        <div className="flex items-center gap-3">
          {volumeVelocity > 0 && (
            <span className="flex items-center gap-1 text-white/30">
              <TrendingUp className="h-2.5 w-2.5" />
              {volumeVelocity.toFixed(2)} SOL/min
            </span>
          )}
          <span className={cn("font-bold",
            isClose ? "text-emerald-400" : isHot ? "text-amber-400" : "text-white/40"
          )}>
            ETA: {eta}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MigrationTimer;
