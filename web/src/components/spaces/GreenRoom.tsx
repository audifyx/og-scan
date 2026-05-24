/**
 * GreenRoom — Pre-show staging area for speakers/hosts before going live.
 * Speakers can test mic, chat privately, and host can start when ready.
 */
import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Users, Clock, Play, MessageSquare, Send, Volume2, CheckCircle, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

interface GreenRoomProps {
  spaceName: string;
  isHost: boolean;
  username: string | null;
  onGoLive: () => void;
  onLeave: () => void;
}

const GreenRoom: React.FC<GreenRoomProps> = ({ spaceName, isHost, username, onGoLive, onLeave }) => {
  const [micTesting, setMicTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micOk, setMicOk] = useState(false);
  const [messages, setMessages] = useState<{ id: number; user: string; text: string }[]>([]);
  const [msgInput, setMsgInput] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);

  // Mic test
  const startMicTest = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      setMicTesting(true);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const level = Math.min(100, avg * 1.5);
        setMicLevel(level);
        if (level > 15) setMicOk(true);
        animRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setMicTesting(false);
    }
  };

  const stopMicTest = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setMicTesting(false);
    setMicLevel(0);
  };

  useEffect(() => () => stopMicTest(), []);

  // Countdown to go live
  const startCountdown = () => {
    setCountdown(5);
    const iv = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) { clearInterval(iv); onGoLive(); return null; }
        return prev - 1;
      });
    }, 1000);
  };

  const sendMsg = () => {
    if (!msgInput.trim()) return;
    setMessages(prev => [...prev, { id: Date.now(), user: username || "You", text: msgInput.trim() }]);
    setMsgInput("");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Green Room</span>
        </div>
        <h2 className="text-lg font-black text-white">{spaceName}</h2>
        <p className="text-[11px] text-white/30 mt-1">Pre-show staging — test your mic and chat before going live</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5" style={{ scrollbarWidth: "none" }}>
        {/* Mic Test */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-blue-400" /> Mic Check
            </h3>
            {micOk && (
              <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> Mic Working
              </span>
            )}
          </div>

          {/* Level meter */}
          <div className="mb-4">
            <div className="h-3 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-75",
                  micLevel > 60 ? "bg-emerald-400" : micLevel > 20 ? "bg-blue-400" : "bg-white/20"
                )}
                style={{ width: `${micLevel}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-white/15">Silent</span>
              <span className="text-[9px] text-white/15">Loud</span>
            </div>
          </div>

          <button
            onClick={micTesting ? stopMicTest : startMicTest}
            className={cn(
              "w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2",
              micTesting
                ? "bg-red-500/15 border border-red-500/25 text-red-400"
                : "bg-blue-500/15 border border-blue-500/25 text-blue-400 hover:bg-blue-500/25"
            )}
          >
            {micTesting ? <><MicOff className="h-4 w-4" /> Stop Test</> : <><Mic className="h-4 w-4" /> Test Microphone</>}
          </button>
        </div>

        {/* Private backstage chat */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-purple-400" /> Backstage Chat
            </h3>
            <p className="text-[9px] text-white/20 mt-0.5">Only speakers can see this</p>
          </div>
          <div className="h-36 overflow-y-auto px-4 py-2 space-y-1.5" style={{ scrollbarWidth: "none" }}>
            {messages.length === 0 && (
              <p className="text-[10px] text-white/15 text-center py-8">Say hi to other speakers 👋</p>
            )}
            {messages.map(m => (
              <div key={m.id} className="flex items-start gap-2 py-1">
                <span className="text-[10px] font-bold text-white/40 shrink-0">{m.user}:</span>
                <span className="text-[11px] text-white/60">{m.text}</span>
              </div>
            ))}
          </div>
          <div className="px-4 py-2.5 border-t border-white/[0.06] flex gap-2">
            <input value={msgInput} onChange={e => setMsgInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMsg()}
              placeholder="Message speakers..."
              className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[11px] text-white placeholder:text-white/15 focus:outline-none" />
            <button onClick={sendMsg} className="px-3 py-2 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-all">
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom actions */}
      <div className="px-5 py-4 border-t border-white/[0.06] shrink-0 space-y-2">
        {countdown !== null ? (
          <div className="text-center py-4">
            <div className="text-5xl font-black text-amber-400 animate-pulse">{countdown}</div>
            <p className="text-[11px] text-white/30 mt-1">Going live...</p>
          </div>
        ) : (
          <>
            {isHost && (
              <button onClick={startCountdown}
                className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">
                <Radio className="h-4 w-4" /> Go Live Now
              </button>
            )}
            <button onClick={onLeave}
              className="w-full py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/40 font-bold text-sm hover:bg-white/[0.08] transition-all">
              Leave Green Room
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default GreenRoom;
