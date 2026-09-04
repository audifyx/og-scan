import { McpBurnAccessCard } from "./McpBurnAccessCard";
import { McpCreditsBuyCard } from "./McpCreditsBuyCard";
import type { McpBurnAccessStatus } from "@/lib/mcpBurnAccess";
import type { XCreditsUsage } from "@/lib/xMcp";

export type McpShopVariant = "agent" | "x" | "both";

type Props = {
  variant?: McpShopVariant;
  walletAddress?: string | null;
  creditsUsage?: XCreditsUsage | null;
  onAccessGranted?: (status: McpBurnAccessStatus) => void;
  onCreditsPurchased?: () => void;
};

export function McpShop({
  variant = "both",
  walletAddress,
  creditsUsage,
  onAccessGranted,
  onCreditsPurchased,
}: Props) {
  const both = variant === "both";
  const agentTools = both || variant === "agent";
  const xTools = both || variant === "x";

  return (
    <div className="ox-mcp-shop">
      <div className="ox-agent__hero">
        <h1 className="ox-agent__title">{both ? "OrbitX Shop" : "Shop"}</h1>
        <p className="ox-agent__lead">
          Buy timed OrbitX MCP access by burning $ORBITX, or top up credits with SOL. One grant unlocks
          every connected channel. Credits are shared across the entire control plane.
        </p>
        {both && (
          <div className="ox-agent__steps">
            <span className="ox-agent__chip is-ok">All-channel shared access</span>
            <span className="ox-agent__chip">One checkout surface</span>
          </div>
        )}
      </div>

      <section className="ox-agent__panel">
        <div className="ox-agent__panel-h">
          <h2 className="ox-agent__panel-title">Catalog</h2>
          <span className="ox-agent__panel-hint">access · credits</span>
        </div>
        <div className="ox-agent__panel-b">
          <div className="ox-agent__pkg-grid">
            <div className="ox-agent__pkg">
              <span className="ox-agent__pkg-k">Access</span>
              <strong className="ox-agent__pkg-title">1 Hour</strong>
              <span className="ox-agent__pkg-cost">100 $ORBITX</span>
              <span className="ox-agent__pkg-meta">Burn · 1 hour</span>
            </div>
            <div className="ox-agent__pkg">
              <span className="ox-agent__pkg-k">Access</span>
              <strong className="ox-agent__pkg-title">1 Day</strong>
              <span className="ox-agent__pkg-cost">1,000 $ORBITX</span>
              <span className="ox-agent__pkg-meta">Burn · 24 hours</span>
            </div>
            <div className="ox-agent__pkg">
              <span className="ox-agent__pkg-k">Access</span>
              <strong className="ox-agent__pkg-title">1 Week</strong>
              <span className="ox-agent__pkg-cost">10,000 $ORBITX</span>
              <span className="ox-agent__pkg-meta">Burn · 7 days</span>
            </div>
            <div className="ox-agent__pkg">
              <span className="ox-agent__pkg-k">Access</span>
              <strong className="ox-agent__pkg-title">1 Month</strong>
              <span className="ox-agent__pkg-cost">1,000,000 $ORBITX</span>
              <span className="ox-agent__pkg-meta">Burn · 30 days</span>
            </div>
            <div className="ox-agent__pkg">
              <span className="ox-agent__pkg-k">Credits</span>
              <strong className="ox-agent__pkg-title">Any amount</strong>
              <span className="ox-agent__pkg-cost">10,000 / 1 SOL</span>
              <span className="ox-agent__pkg-meta">Desk wallet · all channels</span>
            </div>
          </div>
          <p className="ox-agent__note">
            {agentTools && (
              <>
                OrbitX MCP: <code>orbitx_mcp_access_buy</code> · <code>orbitx_credits_buy</code>
                {xTools ? " · " : ""}
              </>
            )}
            {xTools && (
              <>
                Channel aliases: <code>x_mcp_access_buy</code> / <code>x_buy what=access</code> ·{" "}
                <code>x_credits_buy</code>
              </>
            )}
          </p>
        </div>
      </section>

      <McpBurnAccessCard walletAddress={walletAddress} onAccessGranted={onAccessGranted} />
      <McpCreditsBuyCard
        usage={creditsUsage}
        onPurchased={onCreditsPurchased}
        toolHint={
          variant === "x"
            ? "In Grok/Claude: x_credits_buy or x_buy what=credits."
            : variant === "agent"
              ? "In Grok/Claude: orbitx_credits_buy."
              : undefined
        }
      />
    </div>
  );
}
