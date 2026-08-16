import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import {
  DEFAULT_MCP_ACCESS_PACKAGES,
  confirmMcpAccessBurn,
  confirmMcpAccessBurnUntilGranted,
  getMcpBurnAccess,
  mcpAccessSignUrl,
  takePendingMcpBurn,
  type McpAccessPackageId,
  type McpBurnAccessStatus,
} from "@/lib/mcpBurnAccess";

type Props = {
  walletAddress?: string | null;
  onAccessGranted?: (status: McpBurnAccessStatus) => void;
  compact?: boolean;
};

function liveRemaining(expiresAt: string | null, now: number): string {
  if (!expiresAt) return "No burn access";
  const left = Date.parse(expiresAt) - now;
  if (!Number.isFinite(left) || left <= 0) return "Expired";
  const totalMin = Math.floor(left / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const minutes = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  if (minutes > 0) return `${minutes}m remaining`;
  return "Under 1m remaining";
}

export function McpBurnAccessCard({ walletAddress, onAccessGranted, compact = false }: Props) {
  const { publicKey } = useWallet();
  const { pickable, signInWith, busy } = useWalletSignIn();
  const [status, setStatus] = useState<McpBurnAccessStatus | null>(null);
  const [selected, setSelected] = useState<McpAccessPackageId>("day");
  const [loading, setLoading] = useState(true);
  const [burning, setBurning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const wallet = walletAddress || publicKey?.toBase58() || "";
  const packages = status?.packages?.length ? status.packages : DEFAULT_MCP_ACCESS_PACKAGES;
  const selectedPkg = useMemo(
    () => packages.find((p) => p.id === selected) || packages[0],
    [packages, selected],
  );

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const pending = takePendingMcpBurn();
      if (pending?.signature) {
        try {
          const granted = await confirmMcpAccessBurnUntilGranted({
            signature: pending.signature,
            publicKey: pending.publicKey || wallet,
            packageId: pending.packageId,
            attempts: 4,
          });
          setStatus(granted);
          if (granted.active) onAccessGranted?.(granted);
          return;
        } catch {
          /* fall through to status — burn may still be indexing */
        }
      }
      const next = await getMcpBurnAccess(wallet);
      setStatus(next);
      if (next.active) onAccessGranted?.(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load MCP access");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet]);

  const onBurn = async () => {
    if (!selectedPkg) return;
    if (!wallet) {
      setError("Connect a Solana wallet first.");
      return;
    }
    setBurning(true);
    setError(null);
    try {
      window.location.href = mcpAccessSignUrl({
        packageId: selectedPkg.id,
        publicKey: wallet,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start burn");
      setBurning(false);
    }
  };

  const remaining = status?.active
    ? liveRemaining(status.expiresAt, now)
    : status?.expired
      ? "Expired"
      : "No timed access";

  return (
    <section className="ox-agent__panel">
      <div className="ox-agent__panel-h">
        <h2 className="ox-agent__panel-title">Burn $ORBITX for MCP access</h2>
        <span className="ox-agent__panel-hint">{status?.active ? remaining : "timed unlock"}</span>
      </div>
      <div className="ox-agent__panel-b">
        <div className={`ox-agent__access-status${status?.active ? " is-ok" : status?.expired ? " is-expired" : ""}`}>
          <div>
            <div className="ox-agent__label">Access time remaining</div>
            <div className="ox-agent__access-time">{loading ? "Checking…" : remaining}</div>
            {status?.expiresAt && status.active && (
              <p className="ox-agent__note" style={{ marginTop: 6 }}>
                Expires {new Date(status.expiresAt).toLocaleString()} · {selectedPkg ? "extend anytime" : ""}
              </p>
            )}
            {status?.expired && (
              <p className="ox-agent__note" style={{ marginTop: 6 }}>
                Previous burn access expired. Burn again or hold ≥$5 ORBITX.
              </p>
            )}
          </div>
          <span className={`ox-agent__chip${status?.active ? " is-ok" : ""}`}>
            {status?.active ? "Active" : status?.expired ? "Expired" : "Locked"}
          </span>
        </div>

        {!compact && (
          <p className="ox-agent__note">
            Burn the exact package amount. Tokens are destroyed on-chain. Access expires automatically
            when the clock runs out. From Claude/Grok call{" "}
            <code>orbitx_mcp_access_buy</code> or <code>x_mcp_access_buy</code> (or{" "}
            <code>x_buy what=access</code>), then <code>orbitx_mcp_access_confirm</code> /{" "}
            <code>x_mcp_access_confirm</code>. Status: <code>orbitx_mcp_access_status</code> /{" "}
            <code>x_mcp_access_status</code>.
          </p>
        )}

        <div className="ox-agent__pkg-grid">
          {packages.map((pkg) => {
            const on = selected === pkg.id;
            return (
              <button
                key={pkg.id}
                type="button"
                className={`ox-agent__pkg${on ? " is-on" : ""}`}
                onClick={() => setSelected(pkg.id)}
              >
                <span className="ox-agent__pkg-k">{pkg.id === "day" ? "Option A" : "Option B"}</span>
                <strong className="ox-agent__pkg-title">{pkg.label}</strong>
                <span className="ox-agent__pkg-cost">{pkg.tokens.toLocaleString()} $ORBITX</span>
                <span className="ox-agent__pkg-meta">{pkg.durationLabel}</span>
              </button>
            );
          })}
        </div>

        {(error || status?.schemaMissing) && (
          <div className="ox-agent__alert" style={{ marginTop: 12 }}>
            {error || "Apply sql/Aug_SQL/10_mcp_burn_access.sql in Supabase to enable burn access."}
          </div>
        )}

        <div className="ox-agent__btn-row">
          {!wallet &&
            pickable.slice(0, 3).map((w) => (
              <button
                key={w.name}
                type="button"
                className="ox-agent__btn"
                disabled={busy === w.name}
                onClick={() => signInWith(w.name, { replaceEmailSession: true }).catch((e) => setError(e.message))}
              >
                {busy === w.name ? "Connecting…" : `Connect ${w.name}`}
              </button>
            ))}
          <button
            type="button"
            className="ox-agent__btn ox-agent__btn--primary"
            disabled={burning || !wallet || !selectedPkg}
            onClick={() => void onBurn()}
          >
            {burning
              ? "Opening Jupiter…"
              : `Burn ${selectedPkg?.tokens.toLocaleString() || "—"} $ORBITX`}
          </button>
          <button type="button" className="ox-agent__btn" disabled={loading} onClick={() => void refresh()}>
            Refresh status
          </button>
        </div>
      </div>
    </section>
  );
}

/** Hidden helper so confirm can be reused from the sign page without a circular import. */
export async function finishMcpAccessBurn(opts: {
  signature: string;
  packageId?: McpAccessPackageId;
  publicKey?: string;
}): Promise<McpBurnAccessStatus> {
  return confirmMcpAccessBurn(opts);
}
