import { useState } from "react";
import { Loader2, Flame, ExternalLink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useActiveTradingWallet } from "@/hooks/useActiveTradingWallet";
import { callSupercomputerTool } from "@/tokenomics/mcpClient";
import { getBillingAuthCode } from "@/tokenomics/auth";

export default function TokenBurnerPanel() {
  const { publicKey, ready, label } = useActiveTradingWallet();
  const [mint, setMint] = useState("");
  const [percent, setPercent] = useState(100);
  const [burning, setBurning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [sig, setSig] = useState("");

  const burn = async () => {
    if (!publicKey || !ready) {
      toast.error("Link your in-app wallet first");
      return;
    }
    if (!mint.trim()) {
      toast.error("Enter a token mint address");
      return;
    }
    const authCode = getBillingAuthCode();
    if (!authCode) {
      toast.error("Link your in-app wallet first");
      return;
    }
    setBurning(true);
    setResult(null);
    try {
      const res = await callSupercomputerTool("orbitx_app_burn", {
        authCode,
        mint: mint.trim(),
        percent,
      });
      if (!res.ok) {
        throw new Error(res.message || res.error || "Burn failed");
      }
      setResult(res);
      if (res.signature) setSig(res.signature);
      toast.success(res.message || "Tokens burned!");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || "Burn failed");
    } finally {
      setBurning(false);
    }
  };

  if (!ready || !publicKey) {
    return (
      <div className="rounded-2xl border border-white/20 bg-black/60 p-6 text-center">
        <Flame className="mx-auto h-8 w-8 text-white/50" />
        <p className="mt-3 text-sm text-white/80">
          Link your in-app wallet to burn tokens
        </p>
        <p className="mt-1 text-xs text-white/60">
          One wallet across OrbitX — no separate connection needed
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/20 bg-black/60 p-5">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-white" />
          <span className="text-base font-bold text-white">Token Burner</span>
        </div>
        <p className="mt-2 text-sm text-white/70">
          Burn tokens from your in-app wallet. Burn 100% to close the account
          and reclaim rent. Backend-signed — no popups.
        </p>

        <div className="mt-4">
          <label className="text-xs text-white/60">Token mint address</label>
          <input
            value={mint}
            onChange={(e) => setMint(e.target.value)}
            placeholder="Paste mint address…"
            className="mt-1 h-11 w-full rounded-xl border border-white/20 bg-black/40 px-3 font-mono text-sm text-white placeholder:text-white/30 outline-none focus:border-white/40"
          />
        </div>

        <div className="mt-3">
          <label className="text-xs text-white/60">Amount: {percent}%</label>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {[25, 50, 75, 100].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPercent(p)}
                className={`h-10 rounded-xl text-xs font-bold ${
                  percent === p
                    ? "bg-white text-black"
                    : "border border-white/20 text-white/70 hover:bg-white/10"
                }`}
              >
                {p}%
              </button>
            ))}
          </div>
        </div>

        {result && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-300" />
              <span className="text-sm font-bold text-emerald-200">Burned!</span>
            </div>
            <p className="mt-1 text-xs text-white/70">{result.message}</p>
          </div>
        )}

        <button
          type="button"
          disabled={burning || !mint.trim()}
          onClick={() => void burn()}
          className="mt-4 h-12 w-full rounded-2xl bg-red-500 text-sm font-bold text-white disabled:opacity-40 hover:bg-red-600"
        >
          {burning ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Burning…
            </span>
          ) : (
            `Burn ${percent}%`
          )}
        </button>

        {sig && (
          <a
            href={`https://solscan.io/tx/${sig}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs text-white/70 hover:text-white"
          >
            View tx <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <p className="text-center text-[11px] text-white/50">
        Wallet: {label || publicKey.toBase58().slice(0, 8) + "…"}
      </p>
    </div>
  );
}
