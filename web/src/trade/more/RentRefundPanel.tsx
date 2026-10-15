import { useState } from "react";
import { Loader2, Coins, ExternalLink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useActiveTradingWallet } from "@/hooks/useActiveTradingWallet";
import { callSupercomputerTool } from "@/tokenomics/mcpClient";
import { getBillingAuthCode } from "@/tokenomics/auth";

export default function RentRefundPanel() {
  const { publicKey, ready, label } = useActiveTradingWallet();
  const [scanning, setScanning] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [sig, setSig] = useState("");

  const runRefund = async () => {
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
      const res = await callSupercomputerTool("orbitx_app_rent_refund", { authCode });
      if (!res.ok) {
        throw new Error(res.message || res.error || "Rent refund failed");
      }
      setResult(res);
      if (res.signature) setSig(res.signature);
      toast.success(res.message || `Reclaimed ${res.reclaimedSol?.toFixed(4) || 0} SOL`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || "Refund failed");
    } finally {
      setClaiming(false);
    }
  };

  if (!ready || !publicKey) {
    return (
      <div className="rounded-2xl border border-white/20 bg-black/60 p-6 text-center">
        <Coins className="mx-auto h-8 w-8 text-white/50" />
        <p className="mt-3 text-sm text-white/80">
          Link your in-app wallet to scan and reclaim rent
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
          <Coins className="h-5 w-5 text-white" />
          <span className="text-base font-bold text-white">Rent Refund</span>
        </div>
        <p className="mt-2 text-sm text-white/70">
          Scans your in-app wallet for empty token accounts and closes them,
          returning the rent SOL to you. Backend-signed — no popups.
        </p>
        
        {result && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-300" />
              <span className="text-sm font-bold text-emerald-200">
                {result.accountsClosed ? `${result.accountsClosed} accounts closed` : "Scan complete"}
              </span>
            </div>
            {result.reclaimedSol > 0 && (
              <p className="mt-2 text-2xl font-black text-white">
                +{result.reclaimedSol.toFixed(4)} SOL
              </p>
            )}
            <p className="mt-1 text-xs text-white/70">{result.message}</p>
          </div>
        )}

        <button
          type="button"
          disabled={claiming}
          onClick={() => void runRefund()}
          className="mt-4 h-12 w-full rounded-2xl bg-white text-sm font-bold text-black disabled:opacity-40"
        >
          {claiming ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Scanning & claiming…
            </span>
          ) : (
            "Scan & reclaim rent"
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
