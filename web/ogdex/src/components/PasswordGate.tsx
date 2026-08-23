import { useState, useEffect } from "react";
import { Lock } from "lucide-react";
import { requestMaintenanceUnlock } from "../../../shared/desk-unlock-client.js";

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("og_unlocked");
    if (stored === "true") setUnlocked(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const typed = password.trim();
    if (!typed || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await requestMaintenanceUnlock(typed);
      sessionStorage.setItem("og_unlocked", "true");
      setUnlocked(true);
    } catch {
      setError("Incorrect password");
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  };

  if (unlocked) return <>{children}</>;

  return (
    <div className="fixed inset-0 bg-bg z-50 flex items-center justify-center">
      <div className="w-full max-w-sm px-6">
        <div className="card p-8 border border-line">
          <div className="flex justify-center mb-6">
            <Lock className="w-12 h-12 text-accent" />
          </div>
          
          <h1 className="text-2xl font-bold text-center mb-2 text-accent">OrbitX Redesign</h1>
          <p className="text-center text-muted text-sm mb-6">Under maintenance & rebranding</p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-panel border border-line rounded text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent"
              autoFocus
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-4 py-2 bg-accent text-bg rounded font-bold hover:bg-accent/90 disabled:opacity-60"
            >
              {submitting ? "Checking…" : "Access"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
