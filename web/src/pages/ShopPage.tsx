import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAuth } from "@/hooks/useAuth";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { AgentLoading, AgentShell } from "@/components/agent/AgentShell";
import { McpShop } from "@/components/agent/McpShop";
import { DeskShop } from "@/components/agent/DeskShop";
import { fetchXCreditsUsage, type XCreditsUsage } from "@/lib/xMcp";

/** /shop — Solana-betting desk catalog (buy $ORBITX + burn) plus Agent/X MCP seats. */
export default function ShopPage() {
  const { user, loading: authLoading } = useAuth();
  const { publicKey } = useWallet();
  const { pickable, signInWith, busy } = useWalletSignIn();
  const [credits, setCredits] = useState<XCreditsUsage | null>(null);

  const refreshCredits = useCallback(async () => {
    if (!user) return;
    try {
      setCredits(await fetchXCreditsUsage(20, "30d"));
    } catch {
      /* credits table may not be migrated yet */
    }
  }, [user]);

  useEffect(() => {
    void refreshCredits();
  }, [refreshCredits]);

  if (authLoading) {
    return <AgentLoading label="Opening shop…" />;
  }

  return (
    <AgentShell
      showTabs={false}
      brandHref="/shop"
      brandSub="Shop"
      footerBrand="OrbitX Shop"
      footerNote="One Phantom sign buys $ORBITX and burns it. Same items as the Solana-betting shop. Then copy the note and send it to the team."
      siblingHref="/supercomputer?tab=shop"
      siblingLabel="Super Computer"
      siblingIcon="◆"
      statusLabel={user ? "Shop ready" : "Sign in to buy"}
      statusWarn={!user}
    >
      {!user && (
        <section className="ox-agent__panel">
          <div className="ox-agent__panel-h">
            <h2 className="ox-agent__panel-title">Sign in</h2>
            <span className="ox-agent__panel-hint">wallet</span>
          </div>
          <div className="ox-agent__panel-b">
            <p className="ox-agent__note" style={{ marginTop: 0 }}>
              Connect your Solana wallet. Desk shop items buy $ORBITX and burn in one Phantom transaction.
            </p>
            <div className="ox-agent__btn-row">
              {pickable.slice(0, 3).map((w) => (
                <button
                  key={w.name}
                  type="button"
                  className="ox-agent__btn"
                  disabled={busy === w.name}
                  onClick={() => void signInWith(w.name, { replaceEmailSession: true })}
                >
                  {busy === w.name ? "Connecting…" : `Connect ${w.name}`}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
      <DeskShop />
      <McpShop
        variant="both"
        walletAddress={publicKey?.toBase58()}
        creditsUsage={credits}
        onCreditsPurchased={() => void refreshCredits()}
      />
    </AgentShell>
  );
}
