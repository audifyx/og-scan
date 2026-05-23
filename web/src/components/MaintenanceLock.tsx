import { useState, useEffect, useRef } from "react";
import { Scanlines } from "@/components/Scanlines";
import { Shield, Lock, Wrench } from "lucide-react";

const ADMIN_CODE = "0129";
const SESSION_KEY = "ogscan_admin_unlocked";

export function MaintenanceLock({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [digits, setDigits] = useState(["", "", "", ""]);
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first input on mount
  useEffect(() => {
    if (!unlocked) {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [unlocked]);

  const handleDigit = (index: number, value: string) => {
    const v = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = v;
    setDigits(next);
    setError(false);

    if (v && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Check if all 4 filled
    const code = next.join("");
    if (code.length === 4) {
      if (code === ADMIN_CODE) {
        sessionStorage.setItem(SESSION_KEY, "true");
        setUnlocked(true);
      } else {
        setError(true);
        setShaking(true);
        setTimeout(() => {
          setShaking(false);
          setDigits(["", "", "", ""]);
          inputRefs.current[0]?.focus();
        }, 600);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const next = [...digits];
        next[index] = "";
        setDigits(next);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (pasted.length === 4) {
      setDigits(pasted.split(""));
      if (pasted === ADMIN_CODE) {
        sessionStorage.setItem(SESSION_KEY, "true");
        setUnlocked(true);
      } else {
        setError(true);
        setShaking(true);
        setTimeout(() => {
          setShaking(false);
          setDigits(["", "", "", ""]);
          inputRefs.current[0]?.focus();
        }, 600);
      }
    }
  };

  if (unlocked) return <>{children}</>;

  return (
    <div className="relative min-h-screen w-full bg-[#050a12] flex flex-col items-center justify-center overflow-hidden select-none">
      {/* Scanline overlay */}
      <Scanlines />

      {/* Animated grid background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Radial glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="w-[600px] h-[600px] rounded-full bg-blue-600/5 blur-[120px]" />
      </div>

      {/* Card */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-6">
        {/* Logo / Icon */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/30 flex items-center justify-center shadow-lg shadow-blue-500/10">
              <Shield className="w-8 h-8 text-blue-400" />
            </div>
            {/* pulse ring */}
            <div className="absolute inset-0 rounded-2xl border border-blue-400/20 animate-ping" />
          </div>
          <div className="flex items-center gap-2 text-blue-400/60 text-xs font-mono tracking-widest uppercase">
            <Wrench className="w-3 h-3" />
            <span>Maintenance Mode</span>
          </div>
        </div>

        {/* Heading */}
        <div className="text-center space-y-3 max-w-sm">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            🔧 We're Building Something{" "}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Big
            </span>
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            The OGScan team is currently upgrading the platform.
            We'll be back live <span className="text-white font-medium">tomorrow</span> with brand new updates.
          </p>
          <p className="text-slate-500 text-xs">
            Follow{" "}
            <a
              href="https://t.me/ogscanner"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              @ogscanner
            </a>{" "}
            for live updates.
          </p>
        </div>

        {/* Divider */}
        <div className="w-full max-w-xs border-t border-white/5" />

        {/* Admin access section */}
        <div className="flex flex-col items-center gap-4 w-full max-w-xs">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-mono">
            <Lock className="w-3 h-3" />
            <span>Admin Access</span>
          </div>

          {/* PIN inputs */}
          <div
            className={`flex gap-3 transition-transform duration-100 ${shaking ? "animate-[shake_0.5s_ease-in-out]" : ""}`}
            style={shaking ? { animation: "shake 0.5s ease-in-out" } : {}}
          >
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (inputRefs.current[i] = el)}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleDigit(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={handlePaste}
                className={`
                  w-12 h-14 text-center text-2xl font-bold rounded-xl
                  bg-white/5 border-2 transition-all duration-200 outline-none
                  caret-transparent
                  ${error
                    ? "border-red-500/60 bg-red-500/10 text-red-400"
                    : d
                    ? "border-blue-500/60 bg-blue-500/10 text-white"
                    : "border-white/10 text-white focus:border-blue-500/40 focus:bg-white/8"
                  }
                `}
                autoComplete="off"
              />
            ))}
          </div>

          {error && (
            <p className="text-red-400 text-xs font-mono animate-pulse">
              ✗ Incorrect code — try again
            </p>
          )}

          {!error && (
            <p className="text-slate-600 text-xs font-mono">
              Enter 4-digit code to access
            </p>
          )}
        </div>

        {/* Footer */}
        <p className="text-slate-700 text-xs text-center mt-4">
          ogscan.fun · Stay tuned for updates
        </p>
      </div>

      {/* Shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(8px); }
          45% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
          75% { transform: translateX(-3px); }
          90% { transform: translateX(3px); }
        }
      `}</style>
    </div>
  );
}
