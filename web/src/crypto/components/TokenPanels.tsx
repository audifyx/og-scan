import type { ForensicsPayload, SafetyPayload, TokenPayload } from "../api/client";

function short(addr?: string | null) {
  if (!addr) return "—";
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function fmtUsd(n?: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export function TokenOverview({
  mint,
  token,
  safety,
  forensics,
}: {
  mint: string;
  token: TokenPayload | null;
  safety: SafetyPayload | null;
  forensics: ForensicsPayload | null;
}) {
  const symbol = (token?.symbol as string) || "TOKEN";
  const name = (token?.name as string) || "Unknown";
  const price = Number(token?.priceUsd ?? token?.price ?? NaN);
  const liq = Number(token?.liquidityUsd ?? token?.liquidity ?? NaN);
  const mcap = Number(token?.marketCap ?? token?.mcap ?? NaN);
  const vol = Number(token?.volume24h ?? NaN);

  return (
    <div className="oxc-grid oxc-grid-3">
      <div className="oxc-panel" style={{ gridColumn: "span 1" }}>
        <h3>Token overview</h3>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {token?.image ? (
            <img src={String(token.image)} alt="" width={44} height={44} style={{ borderRadius: 8 }} />
          ) : (
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 8,
                background: "var(--oxc-cyan-dim)",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                color: "var(--oxc-cyan)",
              }}
            >
              {symbol.slice(0, 2)}
            </div>
          )}
          <div>
            <div style={{ fontFamily: "var(--oxc-display)", fontWeight: 800, fontSize: "1.15rem" }}>${symbol}</div>
            <div className="oxc-muted" style={{ fontSize: "0.8rem" }}>
              {name}
            </div>
          </div>
        </div>
        <div className="oxc-mono oxc-muted" style={{ marginTop: "0.75rem", wordBreak: "break-all" }}>
          {mint}
        </div>
        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <a className="oxc-link" href={`/ORBITX_DEX/token/${mint}`} target="_blank" rel="noreferrer">
            Open in DEX →
          </a>
          <a className="oxc-link" href={`https://solscan.io/token/${mint}`} target="_blank" rel="noreferrer">
            Solscan →
          </a>
        </div>
      </div>

      <div className="oxc-panel">
        <h3>Market</h3>
        <div className="oxc-grid oxc-grid-2">
          <div className="oxc-stat">
            <div className="label">Price</div>
            <div className="value">{Number.isFinite(price) ? `$${price < 0.01 ? price.toExponential(2) : price.toFixed(4)}` : "—"}</div>
          </div>
          <div className="oxc-stat">
            <div className="label">Liquidity</div>
            <div className="value">{fmtUsd(Number.isFinite(liq) ? liq : null)}</div>
          </div>
          <div className="oxc-stat">
            <div className="label">MCap</div>
            <div className="value">{fmtUsd(Number.isFinite(mcap) ? mcap : null)}</div>
          </div>
          <div className="oxc-stat">
            <div className="label">Vol 24h</div>
            <div className="value">{fmtUsd(Number.isFinite(vol) ? vol : null)}</div>
          </div>
        </div>
      </div>

      <div className="oxc-panel">
        <h3>Contract & tradeability</h3>
        <div className="oxc-factor">
          <span>Mint authority</span>
          <span>{forensics?.safetyFlags?.mintRenounced === true ? "Renounced" : forensics?.safetyFlags?.mintRenounced === false ? "Live" : "—"}</span>
        </div>
        <div className="oxc-factor">
          <span>Freeze authority</span>
          <span>{forensics?.safetyFlags?.freezeRenounced === true ? "Renounced" : forensics?.safetyFlags?.freezeRenounced === false ? "Live" : "—"}</span>
        </div>
        <div className="oxc-factor">
          <span>LP locked</span>
          <span>{forensics?.safetyFlags?.lpLockedPct != null ? `${forensics.safetyFlags.lpLockedPct.toFixed(0)}%` : "—"}</span>
        </div>
        <div className="oxc-factor">
          <span>Jupiter route</span>
          <span>{safety?.verdict || "—"}</span>
        </div>
        <div className="oxc-factor">
          <span>Launchpad</span>
          <span>{forensics?.launchpad || "—"}</span>
        </div>
        <div className="oxc-factor">
          <span>Dev wallet</span>
          <span className="oxc-mono">{short(forensics?.dev?.wallet)}</span>
        </div>
      </div>
    </div>
  );
}

export function HolderTable({
  token,
  forensics,
}: {
  token: TokenPayload | null;
  forensics: ForensicsPayload | null;
}) {
  const holders = token?.holders || [];
  return (
    <div className="oxc-panel">
      <h3>Top holders</h3>
      <div className="oxc-muted" style={{ fontSize: "0.8rem", marginBottom: "0.75rem" }}>
        Top 10 concentration: {forensics?.concentration?.top10Pct != null ? `${forensics.concentration.top10Pct.toFixed(1)}%` : "—"}
        {" · "}
        Whales (≥1%): {forensics?.concentration?.whales ?? "—"}
        {" · "}
        Holders: {forensics?.concentration?.totalHolders ?? (holders.length || "—")}
      </div>
      {holders.length === 0 ? (
        <p className="oxc-empty">Holder list unavailable for this mint.</p>
      ) : (
        <table className="oxc-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Wallet</th>
              <th>%</th>
              <th>Track</th>
            </tr>
          </thead>
          <tbody>
            {holders.slice(0, 15).map((h, i) => (
              <tr key={h.owner || i}>
                <td>{h.rank ?? i + 1}</td>
                <td className="oxc-mono">{short(h.owner)}</td>
                <td>{h.pct != null ? `${h.pct.toFixed(2)}%` : "—"}</td>
                <td>
                  {h.owner ? (
                    <a className="oxc-link" href={`/intel/wallet/${h.owner}`}>
                      Track
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function DevHistoryPanel({ forensics }: { forensics: ForensicsPayload | null }) {
  const dev = forensics?.dev;
  return (
    <div className="oxc-panel">
      <h3>Dev history</h3>
      {!dev ? (
        <p className="oxc-empty">No deployer attribution yet.</p>
      ) : (
        <>
          <div className="oxc-factor">
            <span>Creator</span>
            <a className="oxc-link oxc-mono" href={`/intel/wallet/${dev.wallet}`}>
              {short(dev.wallet)}
            </a>
          </div>
          <div className="oxc-factor">
            <span>Previous launches</span>
            <span>{dev.tokensCreated ?? "—"}</span>
          </div>
          <div className="oxc-factor">
            <span>Serial deployer</span>
            <span>{dev.serial ? "Yes" : "No"}</span>
          </div>
          <div className="oxc-factor">
            <span>Dev holding</span>
            <span>{dev.holding?.pct != null ? `${dev.holding.pct.toFixed(2)}%` : dev.sold ? "Exited" : "—"}</span>
          </div>
          <div className="oxc-factor">
            <span>Dev sold</span>
            <span>{dev.sold == null ? "—" : dev.sold ? "Likely" : "Still holding"}</span>
          </div>
        </>
      )}
    </div>
  );
}
