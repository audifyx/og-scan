import { useState } from "react";
import { Loader2, Droplets, ExternalLink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useActiveTradingWallet } from "@/hooks/useActiveTradingWallet";
import { callSupercomputerTool } from "@/tokenomics/mcpClient";
import { getBillingAuthCode } from "@/tokenomics/auth";

export default function UnwrapWsolPanel() {
  const { publicKey, ready, label } = useActiveTradingWallet();
  const [unwrapping, setUnwrapping] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [sig, setSig] = useState("");

  const unwrap = async () => {
    if (!publicKey || !ready) {
      toast.error("Link your in-app wallet first");
      return;
    }
    const authCode = getBillingAuthCode();
    if (!authCode) {
      toast.error("Link your in-app wallet first");
      return;
    }
    setUnwrapping(true);
    setResult(null);
    try {
      const res = await callSupercomputerTool("orbitx_app_unwrap_wsol", { authCode });
      if (!res.ok) {
        throw new Error(res.message || res.error || "Unwrap failed");
      }
      setResult(res);
      if (res.signature) setSig(res.signature);
      toast.success(res.message || "wSOL unwrapped!");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || "Unwrap failed");
    } finally {
      setUnwrapping(false);
    }
  };

  if (!ready || !publicKey) {
    return (
      <div className="rounded-2xl border border-white/20 bg-black/60 p-6 text-center">
        <Droplets className="mx-auto h-8 w-8 text-white/50" />
        <p className="mt-3 text-sm text-white/80">
          Link your in-app wallet to unwrap wSOL
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
          <Droplets className="h-5 w-5 text-white" />
          <span className="text-base font-bold text-white">Unwrap wSOL</span>
        </div>
        <p className="mt-2 text-sm text-white/70">
          Converts wrapped SOL (wSOL) back to native SOL in your in-app wallet.
          Backend-signed — no popups.
        </p>

        {result && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-300" />
              <span className="text-sm font-bold text-emerald-200">Unwrapped!</span>
            </div>
            <p className="mt-1 text-xs text-white/70">{result.message}</p>
            {result.unwrappedSol > 0 && (
              <p className="mt-2 text-xl font-black text-white">
                +{result.unwrappedSol.toFixed(4)} SOL
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          disabled={unwrapping}
          onClick={() => void unwrap()}
          className="mt-4 h-12 w-full rounded-2xl bg-white text-sm font-bold text-black disabled:opacity-40"
        >
          {unwrapping ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Unwrapping…
            </span>
          ) : (
            "Unwrap wSOL"
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
