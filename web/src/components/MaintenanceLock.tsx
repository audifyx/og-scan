import { useState, useEffect, useRef } from "react";
import { Scanlines } from "@/components/Scanlines";
import { Shield, Lock, Wrench, KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabase";

const ADMIN_CODE = "0129";
const BETA_CODE = "OG";
const SESSION_KEY = "ogscan_admin_unlocked";

export function MaintenanceLock({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) === "true";
    } catch {
      return false;
    }
  });

  // Check DB for maintenance_mode setting
  const [maintenanceEnabled, setMaintenanceEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase
          .from("site_settings")
          .select("value")
          .eq("key", "maintenance_mode")
          .single();
        if (alive) {
          // value is stored as jsonb boolean
          const isOn = data?.value === true || data?.value === "true";
          setMaintenanceEnabled(isOn);
        }
      } catch {
        // If table doesn't exist or query fails, default to maintenance ON
        if (alive) setMaintenanceEnabled(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-focus input on mount
  useEffect(() => {
    if (!unlocked && maintenanceEnabled) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [unlocked, maintenanceEnabled]);

  const tryUnlock = (value: string) => {
    const upper = value.trim().toUpperCase();
    if (upper === BETA_CODE || upper === ADMIN_CODE) {
      sessionStorage.setItem(SESSION_KEY, "true");
      setUnlocked(true);
    } else {
      setError(true);
      setShaking(true);
      setTimeout(() => {
        setShaking(false);
        setCode("");
        setError(false);
        inputRef.current?.focus();
      }, 600);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCode(val);
    setError(false);
    // Auto-submit when they type "OG" (2 chars)
    if (val.trim().toUpperCase() === BETA_CODE) {
      tryUnlock(val);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      tryUnlock(code);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    setCode(pasted);
    tryUnlock(pasted);
  };

  // Still loading DB check
  if (maintenanceEnabled === null) {
    return (
      <div className="min-h-screen w-full bg-[#050a12] flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
      </div>
    );
  }

  // Maintenance is OFF in DB → let everyone through
  if (!maintenanceEnabled) return <>{children}</>;

  // Maintenance is ON but user entered the code → let through
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
              @ogscanbackup
            </a>{" "}
            for live updates.
          </p>
        </div>

        {/* Divider */}
        <div className="w-full max-w-xs border-t border-white/5" />

        {/* Beta access section */}
        <div className="flex flex-col items-center gap-4 w-full max-w-xs">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-mono">
            <Lock className="w-3 h-3" />
            <span>Have a beta code?</span>
          </div>

          {/* Code input */}
          <div
            className={`w-full transition-transform duration-100 ${shaking ? "animate-[shake_0.5s_ease-in-out]" : ""}`}
            style={shaking ? { animation: "shake 0.5s ease-in-out" } : {}}
          >
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Enter code"
                value={code}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                autoComplete="off"
                autoCapitalize="characters"
                className={`
                  w-full h-12 pl-10 pr-4 rounded-xl text-center font-mono text-sm uppercase tracking-widest
                  bg-white/5 border-2 transition-all duration-200 outline-none
                  ${error
                    ? "border-red-500/60 bg-red-500/10 text-red-400 placeholder-red-400/40"
                    : code
                    ? "border-blue-500/60 bg-blue-500/10 text-white placeholder-slate-600"
                    : "border-white/10 text-white placeholder-slate-600 focus:border-blue-500/40 focus:bg-white/8"
                  }
                `}
              />
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-xs font-mono animate-pulse">
              ✗ Invalid code — try again
            </p>
          )}

          {!error && (
            <p className="text-slate-600 text-xs font-mono">
              Press Enter or type your beta code
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
