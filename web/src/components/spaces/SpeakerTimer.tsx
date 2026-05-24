/**
 * SpeakerTimer — Customizable speaker timer (up to 60 min).
 * Auto-removes speaker from host when time expires.
 * Shows countdown overlay to everyone in the room.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Timer, Play, Pause, RotateCcw, X, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActiveTimer {
  speakerId: string;
  speakerName: string;
  durationSec: number;
  startedAt: number;
  pausedAt?: number;
  remaining: number;
}

interface SpeakerTimerProps {
  isHost: boolean;
  speakers: { id: string; name: string }[];
  onTimeUp?: (speakerId: string) => void; // Called when timer expires — parent should demote
  autoTimerMinutes?: number | null; // If set, auto-start timer for the first speaker
}

const PRESETS = [
  { label: "1 min", sec: 60 },
  { label: "2 min", sec: 120 },
  { label: "5 min", sec: 300 },
  { label: "10 min", sec: 600 },
  { label: "15 min", sec: 900 },
  { label: "30 min", sec: 1800 },
  { label: "60 min", sec: 3600 },
];

const fmtTime = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const SpeakerTimer: React.FC<SpeakerTimerProps> = ({ isHost, speakers, onTimeUp, autoTimerMinutes }) => {
  const [timer, setTimer] = useState<ActiveTimer | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [selectedSpeaker, setSelectedSpeaker] = useState("");
  const [customMin, setCustomMin] = useState(autoTimerMinutes || 5);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const alertedRef = useRef(false);
  const autoStartedRef = useRef<Set<string>>(new Set());

  // Auto-start timer for new speakers if autoTimerMinutes is set
  useEffect(() => {
    if (!autoTimerMinutes || !isHost || timer) return;
    // Find a speaker that hasn't had a timer yet (skip host)
    const newSpeaker = speakers.find(s => !autoStartedRef.current.has(s.id));
    if (newSpeaker) {
      autoStartedRef.current.add(newSpeaker.id);
      alertedRef.current = false;
      setTimer({ speakerId: newSpeaker.id, speakerName: newSpeaker.name, durationSec: autoTimerMinutes * 60, startedAt: Date.now(), remaining: autoTimerMinutes * 60 });
      setPaused(false);
    }
  }, [speakers, autoTimerMinutes, isHost, timer]);

  // Tick
  useEffect(() => {
    if (!timer || paused) return;
    intervalRef.current = setInterval(() => {
      setTimer(prev => {
        if (!prev) return null;
        const elapsed = Math.floor((Date.now() - prev.startedAt) / 1000);
        const remaining = Math.max(0, prev.durationSec - elapsed);

        // 30-second warning
        if (remaining <= 30 && remaining > 0 && !alertedRef.current) {
          alertedRef.current = true;
        }

        // Time's up
        if (remaining <= 0) {
          onTimeUp?.(prev.speakerId);
          return null;
        }
        return { ...prev, remaining };
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timer, paused, onTimeUp]);

  const startTimer = (speakerId: string, speakerName: string, sec: number) => {
    alertedRef.current = false;
    setTimer({ speakerId, speakerName, durationSec: sec, startedAt: Date.now(), remaining: sec });
    setShowSetup(false);
    setPaused(false);
  };

  const togglePause = () => {
    if (!timer) return;
    if (paused) {
      // Resume: adjust startedAt to account for paused time
      const pausedDuration = Date.now() - (timer.pausedAt || Date.now());
      setTimer({ ...timer, startedAt: timer.startedAt + pausedDuration, pausedAt: undefined });
    } else {
      setTimer({ ...timer, pausedAt: Date.now() });
    }
    setPaused(!paused);
  };

  const resetTimer = () => { setTimer(null); setPaused(false); alertedRef.current = false; };

  const pct = timer ? ((timer.durationSec - timer.remaining) / timer.durationSec) * 100 : 0;
  const isWarning = timer && timer.remaining <= 30;

  return (
    <>
      {/* Active timer display (visible to everyone) */}
      {timer && (
        <div className={cn(
          "rounded-xl border p-3 transition-all",
          isWarning
            ? "border-red-500/20 bg-red-500/[0.05] animate-pulse"
            : "border-amber-500/15 bg-amber-500/[0.03]"
        )}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Timer className={cn("h-3.5 w-3.5", isWarning ? "text-red-400" : "text-amber-400")} />
              <span className="text-[10px] font-bold text-white/40">Speaker Timer</span>
            </div>
            {isHost && (
              <div className="flex items-center gap-1">
                <button onClick={togglePause}
                  className="p-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/30 hover:text-white/60 transition-all">
                  {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                </button>
                <button onClick={resetTimer}
                  className="p-1 rounded-lg bg-white/[0.04] hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-all">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className={cn(
              "font-mono font-black text-xl",
              isWarning ? "text-red-400" : "text-white"
            )}>
              {fmtTime(timer.remaining)}
            </span>
            <div className="flex-1">
              <p className="text-[11px] text-white/50 font-medium">{timer.speakerName}</p>
              {isWarning && (
                <p className="text-[9px] text-red-400/60 flex items-center gap-1 mt-0.5">
                  <AlertTriangle className="h-2.5 w-2.5" /> Time almost up!
                </p>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-2 h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div className={cn(
              "h-full rounded-full transition-all duration-1000",
              isWarning ? "bg-red-500" : "bg-amber-400"
            )} style={{ width: `${pct}%` }} />
          </div>

          {paused && <p className="text-[9px] text-amber-400/40 text-center mt-1.5">⏸ Paused</p>}
        </div>
      )}

      {/* Setup button (host only) */}
      {isHost && !timer && (
        <div>
          <button onClick={() => setShowSetup(!showSetup)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[10px] font-bold text-white/30 hover:text-white/50 hover:bg-white/[0.06] transition-all">
            <Timer className="h-3 w-3" /> Speaker Timer
          </button>

          {showSetup && (
            <div className="mt-2 p-3 rounded-xl bg-[#0c1219] border border-white/[0.08] shadow-xl">
              {/* Select speaker */}
              <p className="text-[10px] text-white/30 font-bold mb-1.5">Speaker</p>
              <div className="flex flex-wrap gap-1 mb-3">
                {speakers.map(s => (
                  <button key={s.id} onClick={() => setSelectedSpeaker(s.id)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                      selectedSpeaker === s.id
                        ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                        : "bg-white/[0.04] text-white/30 border border-white/[0.06] hover:bg-white/[0.06]"
                    )}>
                    {s.name}
                  </button>
                ))}
              </div>

              {/* Duration presets */}
              <p className="text-[10px] text-white/30 font-bold mb-1.5">Duration</p>
              <div className="flex flex-wrap gap-1 mb-3">
                {PRESETS.map(p => (
                  <button key={p.sec} onClick={() => setCustomMin(p.sec / 60)}
                    className={cn(
                      "px-2 py-1 rounded-lg text-[10px] font-bold transition-all",
                      customMin === p.sec / 60
                        ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                        : "bg-white/[0.04] text-white/20 border border-white/[0.06] hover:bg-white/[0.06]"
                    )}>
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Custom input */}
              <div className="flex items-center gap-2 mb-3">
                <input type="number" min={1} max={60} value={customMin}
                  onChange={e => setCustomMin(Math.min(60, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-16 px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-white text-center focus:outline-none focus:border-amber-500/20" />
                <span className="text-[10px] text-white/20">minutes (max 60)</span>
              </div>

              <button
                onClick={() => {
                  const sp = speakers.find(s => s.id === selectedSpeaker);
                  if (sp) startTimer(sp.id, sp.name, customMin * 60);
                }}
                disabled={!selectedSpeaker}
                className="w-full py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-[12px] font-black transition-all disabled:opacity-30 flex items-center justify-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Start Timer
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default SpeakerTimer;
