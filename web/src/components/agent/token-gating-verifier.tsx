import { useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { ExternalLink, Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import {
  AGENT_HOLD_MINT,
  AGENT_HOLD_MIN_USD,
  isTokenGateExemptWallet,
  resolveAuthWallet,
  verifyAgentHold,
  type HoldVerifyResult,
} from "@/lib/agentTokenGate";
import { linkAgentWallet } from "@/lib/orbitxMcp";

export function TokenGatingVerifier({
  onUnlocked,
}: {
  onUnlocked?: (result: HoldVerifyResult) => void;
}) {
  const { publicKey } = useWallet();
  const { user, profile } = useAuth();
  const { pickable, signInWith, busy } = useWalletSignIn();
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [last, setLast] = useState<HoldVerifyResult | null>(null);

  const walletAddress = useMemo(
    () =>
      resolveAuthWallet({
        connectedPk: publicKey?.toBase58() ?? null,
        email: user?.email,
        userMetadata: (user?.user_metadata as Record<string, unknown> | undefined) ?? null,
        profileWallet:
          (profile as { wallet_address?: string | null; sol_wallet?: string | null } | null)
            ?.wallet_address ||
          (profile as { sol_wallet?: string | null } | null)?.sol_wallet ||
          null,
      }),
    [publicKey, user?.email, user?.user_metadata, profile],
  );

  const short =
    walletAddress && walletAddress.length > 12
      ? `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`
      : walletAddress;

  const connectWallet = async (name: string) => {
    setError(null);
    try {
      await signInWith(name, { replaceEmailSession: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect wallet");
    }
  };

  const verify = async () => {
    setChecking(true);
    setError(null);
    try {
      const result = await verifyAgentHold(walletAddress);
      setLast(result);
      if (result.meetsRequirement || result.exempt) {
        if (walletAddress) {
          try {
            await linkAgentWallet(walletAddress);
          } catch {
            /* link optional — hold already verified */
          }
        }
        onUnlocked?.(result);
      } else {
        setError(result.message || "ORBITX hold requirement not met");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setChecking(false);
    }
  };

  if (isTokenGateExemptWallet(walletAddress)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05070d] text-white/50">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
        <span className="ml-3 text-sm">Unlocking exempt wallet…</span>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 50% -10%, rgba(245,158,11,0.14), transparent 55%), linear-gradient(180deg, #070a12 0%, #05070d 100%)",
        }}
      />
      <div className="relative mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-12">
        <div className="rounded-3xl border border-amber-400/20 bg-white/[0.03] p-7 backdrop-blur-sm">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/15">
            <ShieldAlert className="h-6 w-6 text-amber-300" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">Token hold required</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/45">
            Agent MCP is gated. Hold at least ${AGENT_HOLD_MIN_USD} of ORBITX, then verify. Exempt
            platform wallets skip this block.
          </p>

          <div className="mt-6 space-y-3">
            <div className="rounded-2xl border border-white/[0.07] bg-black/35 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">Wallet</p>
              <p className="mt-1 break-all font-mono text-sm text-white/80">
                {walletAddress || "None — connect below"}
              </p>
              {short && <p className="mt-1 text-xs text-white/30">{short}</p>}
            </div>
            <div className="rounded-2xl border border-white/[0.07] bg-black/35 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
                ORBITX mint
              </p>
              <p className="mt-1 break-all font-mono text-[11px] text-white/70">{AGENT_HOLD_MINT}</p>
              {last && !last.exempt && (
                <p className="mt-2 text-xs text-white/40">
                  Holding ~${Number(last.holdingUsd || 0).toFixed(2)} ({Number(last.holdingAmount || 0).toFixed(2)}{" "}
                  tokens)
                </p>
              )}
            </div>
          </div>

          {(error || (last && !last.meetsRequirement && last.message)) && (
            <div className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-200">
              {error || last?.message}
            </div>
          )}

          <div className="mt-5 space-y-2">
            {!walletAddress &&
              pickable.slice(0, 4).map((w) => (
                <button
                  key={w.name}
                  type="button"
                  disabled={busy === w.name}
                  onClick={() => connectWallet(w.name)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold hover:bg-white/[0.04] disabled:opacity-50"
                >
                  {w.icon ? <img src={w.icon} alt="" className="h-5 w-5 rounded" /> : null}
                  {busy === w.name ? `Connecting…` : `Connect ${w.name}`}
                </button>
              ))}
            <button
              type="button"
              disabled={checking || !walletAddress}
              onClick={verify}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-black disabled:opacity-50"
            >
              {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {checking ? "Checking holdings…" : "Verify holdings"}
            </button>
            <a
              href={`https://jup.ag/swap/SOL-${AGENT_HOLD_MINT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-200 hover:bg-amber-400/15"
            >
              Buy ORBITX on Jupiter <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a
              href={`/ORBITX_DEX/token/${AGENT_HOLD_MINT}`}
              className="block text-center text-xs text-white/35 hover:text-white/55"
            >
              View ORBITX on OrbitX DEX →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
