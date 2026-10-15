import { useState } from "react";
import { Loader2, HandCoins, ExternalLink, CheckCircle2, Rocket } from "lucide-react";
import { toast } from "sonner";
import { useActiveTradingWallet } from "@/hooks/useActiveTradingWallet";
import { callSupercomputerTool } from "@/tokenomics/mcpClient";
import { getBillingAuthCode } from "@/tokenomics/auth";

export default function CreatorFeeClaimPanel() {
  const { publicKey, ready, label } = useActiveTradingWallet();
  const [claiming, setClaiming] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [sig, setSig] = useState("");

  const claimFees = async () => {
    if (!publicKey || !ready) {
      toast.error("Link your in-app wallet first");
      return;
    }
    const authCode = getBillingAuthCode();
    if (!authCode) {
      toast.error("Link your in-app wallet first");
      return;
    }
    setClaiming(true);
    setResult(null);
    try {
      const res = await callSupercomputerTool("orbitx_app_claim", { authCode });
      if (!res.ok) {
        throw new Error(res.message || res.error || "Claim failed");
      }
      setResult(res);
      if (res.signature) setSig(res.signature);
      toast.success(res.message || "Creator fees claimed!");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || "Claim failed");
    } finally {
      setClaiming(false);
    }
  };

  if (!ready || !publicKey) {
    return (
      <div className="rounded-2xl border border-white/20 bg-black/60 p-6 text-center">
        <HandCoins className="mx-auto h-8 w-8 text-white/50" />
        <p className="mt-3 text-sm text-white/80">
          Link your in-app wallet to claim creator fees
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
          <Rocket className="h-5 w-5 text-white" />
          <span className="text-base font-bold text-white">Creator Fee Claim</span>
        </div>
        <p className="mt-2 text-sm text-white/70">
          Claims pump.fun creator fees accrued to your in-app wallet.
          Backend-signed — no popups, fees land directly in your wallet.
        </p>

        {result && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-300" />
              <span className="text-sm font-bold text-emerald-200">Claimed!</span>
            </div>
            <p className="mt-1 text-xs text-white/70">{result.message}</p>
          </div>
        )}

        <button
          type="button"
          disabled={claiming}
          onClick={() => void claimFees()}
          className="mt-4 h-12 w-full rounded-2xl bg-white text-sm font-bold text-black disabled:opacity-40"
        >
          {claiming ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Claiming…
            </span>
          ) : (
            "Claim creator fees"
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
