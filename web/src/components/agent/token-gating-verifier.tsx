import React, { useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAuth } from '@/hooks/useAuth';
import { useWalletSignIn } from '@/hooks/useWalletSignIn';
import { isTokenGateExemptWallet, resolveAuthWallet } from '@/lib/agentTokenGate';

export function TokenGatingVerifier() {
  const [tokenCA] = useState('13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9');
  const { publicKey } = useWallet();
  const { user, profile } = useAuth();
  const { pickable, signInWith, busy } = useWalletSignIn();
  const [error, setError] = useState<string | null>(null);

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
      // Parent AgentPage re-checks on auth/wallet change; force reload as fallback.
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    }
  };

  // If DEF wallet is already resolved, don't keep showing the gate (parent should unlock).
  if (isTokenGateExemptWallet(walletAddress)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin">Unlocking…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="bg-background border-2 border-destructive rounded-lg p-8 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0 4v2m0-14H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2h-7z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Token Verification Required</h1>
            <p className="text-muted-foreground">
              You need to hold a minimum of $10 worth of ORBITX tokens to access the Agent MCP system.
            </p>
          </div>

          <div className="bg-muted rounded-lg p-6 mb-6 space-y-4 text-left">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Detected wallet</p>
              <p className="font-mono text-sm break-all text-foreground bg-background p-3 rounded">
                {walletAddress || 'None — connect your Solana wallet below'}
              </p>
              {short && (
                <p className="mt-1 text-xs text-muted-foreground">Signed in as {short}</p>
              )}
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">Required Token</p>
              <p className="font-mono text-sm break-all text-foreground bg-background p-3 rounded">
                {tokenCA}
              </p>
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="font-semibold text-foreground mb-3">How to Unlock Access</h3>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <span className="text-primary font-semibold">1.</span> Connect the correct Solana wallet
                </li>
                <li>
                  <span className="text-primary font-semibold">2.</span> Hold at least $10 of ORBITX, or have $10+ cumulative buys
                </li>
                <li>
                  <span className="text-primary font-semibold">3.</span> Tap Verify Holdings after connecting
                </li>
              </ol>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-3">
            {pickable.slice(0, 4).map((w) => (
              <button
                key={w.name}
                type="button"
                disabled={busy === w.name}
                onClick={() => connectWallet(w.name)}
                className="flex w-full items-center justify-center gap-2 px-6 py-3 border border-border text-foreground rounded-lg font-semibold hover:bg-muted transition disabled:opacity-50"
              >
                {w.icon ? <img src={w.icon} alt="" className="h-5 w-5 rounded" /> : null}
                {busy === w.name ? `Connecting ${w.name}…` : `Connect ${w.name}`}
              </button>
            ))}
            <a
              href="https://jup.ag/swap/USDC-ORBITX"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition text-center"
            >
              Buy ORBITX on Jupiter
            </a>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-6 py-3 border border-border text-foreground rounded-lg font-semibold hover:bg-muted transition"
            >
              Verify Holdings
            </button>
          </div>

          <p className="text-xs text-muted-foreground mt-6">
            By accessing this system, you agree to hold and maintain the minimum token requirement. Violation may result in access revocation.
          </p>
        </div>
      </div>
    </div>
  );
}
