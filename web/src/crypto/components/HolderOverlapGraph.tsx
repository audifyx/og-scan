/**
 * HolderOverlapGraph — taste graph: what else the top holders hold (OG Scanner v2, batch 4).
 *
 * Pure SVG, no chart dependencies. Bipartite layout: wallet nodes on the
 * left, other-token nodes on the right, edges = observed holdings. A wallet
 * whose holdings could not be read is drawn dashed and labelled "holdings
 * unknown" — it gets NO edges and NO invented tokens. A wallet that was read
 * and holds nothing else observed says so in its detail panel. Token nodes
 * are sized by how many of the shown wallets hold them.
 *
 * Data arrives only via props (there is no overlap endpoint yet — Team B
 * passes holdings when the API lands). Nothing is fetched or invented here.
 *
 * Palette (standing rule): black / white / gold (#e8b84a) only, white text on
 * the component's own dark background. No emoji, no rainbow colors.
 * Responsive: SVG scales to its container down to 390px phone width.
 *
 * Team B usage:
 *   <HolderOverlapGraph wallets={wallets} />
 *   // wallets: [{ address, supplyPct, fundingSource, holdings: [{ mint, symbol, valueUsd }] | null }]
 *   // holdings: null = wallet unreadable ("holdings unknown"); [] = read, holds nothing else.
 */
import { useMemo, useState } from "react";
import { shortAddr } from "@/lib/og";

/** One observed holding of another token by a wallet. All fields are as-observed. */
export interface OverlapHolding {
  /** Mint address of the other token. */
  mint: string;
  /** Ticker when known; null/omitted = unknown (short mint is shown instead). */
  symbol?: string | null;
  /** Token name when known. */
  name?: string | null;
  /** USD value of the holding when known; null = unknown. */
  valueUsd?: number | null;
  /** Share of that token's supply held, when known. */
  supplyPct?: number | null;
}

/** One top holder of the scanned token, with what else it holds. */
export interface OverlapWallet {
  /** Wallet address. */
  address: string;
  /** Share of the scanned token's supply held; null = unknown. */
  supplyPct: number | null;
  /** Funding source when observed; null = unknown. */
  fundingSource?: string | null;
  /**
   * What else this wallet holds.
   * null = wallet could not be read — rendered as "holdings unknown", never
   *   filled in with guesses. [] = read successfully, nothing else observed.
   */
  holdings: OverlapHolding[] | null;
  devLinked?: boolean;
}

export interface HolderOverlapGraphProps {
  /** Top holders with their other holdings. */
  wallets?: OverlapWallet[] | null;
  /** True while a scan is in flight and no data is available yet. */
  loading?: boolean;
  /** Reason shown in the unavailable state when no wallets were provided. */
  unavailableReason?: string | null;
  /** Max wallet nodes drawn (largest holders first). Default 8. */
  maxWallets?: number;
  /** Max token nodes drawn (most-held first). Default 10. */
  maxTokens?: number;
  /** Controlled wallet selection; uncontrolled when omitted. */
  selectedAddress?: string | null;
  /** Fired when a wallet node is tapped/clicked (null = deselect). */
  onSelectWallet?: (address: string | null) => void;
  /** Controlled token selection; uncontrolled when omitted. */
  selectedMint?: string | null;
  /** Fired when a token node is tapped/clicked (null = deselect). */
  onSelectToken?: (mint: string | null) => void;
}

const GOLD = "#e8b84a";
const VIEW_W = 360;
const WALLET_X = 56;
const TOKEN_X = 304;
const ROW_H = 46;
const TOP_PAD = 14;

function fmtPct(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? "unknown" : `${v.toFixed(1)}%`;
}

function fmtUsd(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "value unknown";
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

function tokenLabel(h: OverlapHolding): string {
  return h.symbol ? h.symbol : shortAddr(h.mint);
}

interface TokenNode {
  mint: string;
  symbol: string | null;
  name: string | null;
  holderCount: number;
  totalValueUsd: number | null;
  holders: OverlapWallet[];
}

export const HolderOverlapGraph: React.FC<HolderOverlapGraphProps> = ({
  wallets: walletsProp = null,
  loading = false,
  unavailableReason = null,
  maxWallets = 8,
  maxTokens = 10,
  selectedAddress,
  onSelectWallet,
  selectedMint,
  onSelectToken,
}) => {
  const [internalWallet, setInternalWallet] = useState<string | null>(null);
  const [internalToken, setInternalToken] = useState<string | null>(null);
  const selectedWalletAddr = selectedAddress !== undefined ? selectedAddress : internalWallet;
  const selectedTokenMint = selectedMint !== undefined ? selectedMint : internalToken;

  const sorted = useMemo(
    () => [...(walletsProp ?? [])].sort((a, b) => (b.supplyPct ?? 0) - (a.supplyPct ?? 0)),
    [walletsProp],
  );
  const shownWallets = sorted.slice(0, maxWallets);
  const hiddenWallets = sorted.length - shownWallets.length;

  // Token nodes: aggregate holdings across shown wallets only.
  const tokens = useMemo<TokenNode[]>(() => {
    const byMint = new Map<string, TokenNode>();
    for (const w of shownWallets) {
      for (const h of w.holdings ?? []) {
        const node = byMint.get(h.mint) ?? {
          mint: h.mint,
          symbol: h.symbol ?? null,
          name: h.name ?? null,
          holderCount: 0,
          totalValueUsd: null,
          holders: [],
        };
        node.holderCount += 1;
        node.holders.push(w);
        if (h.symbol && !node.symbol) node.symbol = h.symbol;
        if (h.name && !node.name) node.name = h.name;
        if (h.valueUsd != null) {
          node.totalValueUsd = (node.totalValueUsd ?? 0) + h.valueUsd;
        }
        byMint.set(h.mint, node);
      }
    }
    return [...byMint.values()].sort(
      (a, b) => b.holderCount - a.holderCount || (b.totalValueUsd ?? 0) - (a.totalValueUsd ?? 0),
    );
  }, [shownWallets]);
  const shownTokens = tokens.slice(0, maxTokens);
  const hiddenTokens = tokens.length - shownTokens.length;
  const shownTokenSet = useMemo(() => new Set(shownTokens.map((t) => t.mint)), [shownTokens]);

  const rows = Math.max(shownWallets.length, shownTokens.length, 1);
  const viewHeight = TOP_PAD + rows * ROW_H + 8;

  const maxPct = Math.max(0, ...shownWallets.map((w) => w.supplyPct ?? 0));
  const maxHolders = Math.max(1, ...shownTokens.map((t) => t.holderCount));

  const walletY = (i: number) => TOP_PAD + i * ROW_H + ROW_H / 2;
  const tokenY = (i: number) => TOP_PAD + i * ROW_H + ROW_H / 2;
  const walletR = (w: OverlapWallet) =>
    maxPct > 0 && w.supplyPct != null ? 6 + Math.sqrt(w.supplyPct / maxPct) * 8 : 7;
  const tokenR = (t: TokenNode) => 6 + Math.sqrt(t.holderCount / maxHolders) * 8;

  const selectedWallet = selectedWalletAddr
    ? shownWallets.find((w) => w.address === selectedWalletAddr) ?? null
    : null;
  const selectedToken = selectedTokenMint
    ? shownTokens.find((t) => t.mint === selectedTokenMint) ?? null
    : null;

  const selectWallet = (addr: string) => {
    const next = selectedWalletAddr === addr ? null : addr;
    if (onSelectWallet) onSelectWallet(next);
    else setInternalWallet(next);
    // Selecting a wallet clears the token selection (and vice versa) so the
    // detail panel below always shows one thing.
    if (next != null) {
      if (onSelectToken) onSelectToken(null);
      else setInternalToken(null);
    }
  };

  const selectToken = (mint: string) => {
    const next = selectedTokenMint === mint ? null : mint;
    if (onSelectToken) onSelectToken(next);
    else setInternalToken(next);
    if (next != null) {
      if (onSelectWallet) onSelectWallet(null);
      else setInternalWallet(null);
    }
  };

  // An edge is "hot" when it touches the current selection.
  const edgeHot = (walletAddr: string, mint: string) =>
    (selectedWalletAddr != null && walletAddr === selectedWalletAddr) ||
    (selectedTokenMint != null && mint === selectedTokenMint);
  const edgeDim = (walletAddr: string, mint: string) =>
    (selectedWalletAddr != null && walletAddr !== selectedWalletAddr) ||
    (selectedTokenMint != null && mint !== selectedTokenMint);

  const card = (children: React.ReactNode) => (
    <div
      data-testid="holder-overlap-graph"
      className="rounded-xl border border-white/10 bg-[#0b0b10] p-3 text-white"
    >
      {children}
    </div>
  );

  if (loading && (walletsProp == null || walletsProp.length === 0)) {
    return card(
      <>
        <p className="text-xs font-bold text-white">Holder overlap</p>
        <p className="mt-1 animate-pulse text-[11px] text-white/60">
          Loading holder portfolios — checking what else top holders hold…
        </p>
      </>,
    );
  }

  if (!walletsProp || walletsProp.length === 0) {
    return card(
      <>
        <p className="text-xs font-bold text-white">Holder overlap</p>
        <p className="mt-1 text-[11px] text-white/60">
          Holder overlap unavailable —{" "}
          {unavailableReason ?? "no holder portfolios were provided to graph."} Nothing is assumed.
        </p>
      </>,
    );
  }

  const unknownCount = shownWallets.filter((w) => w.holdings == null).length;

  return card(
    <>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-bold text-white">Holder overlap</p>
        <p className="text-[11px] text-white/60">
          {shownWallets.length} wallet{shownWallets.length !== 1 ? "s" : ""} · {shownTokens.length} other
          token{shownTokens.length !== 1 ? "s" : ""}
        </p>
      </div>
      <p className="mt-0.5 text-[11px] text-white/60">
        What else the top holders hold — shared holdings hint at coordinated taste, not proof of it.
      </p>

      <svg
        viewBox={`0 0 ${VIEW_W} ${viewHeight}`}
        width="100%"
        role="img"
        aria-label={`Holder overlap graph with ${shownWallets.length} wallets and ${shownTokens.length} other tokens`}
        className="mt-1 block"
      >
        {/* Edges first so nodes draw on top */}
        {shownWallets.map((w) =>
          (w.holdings ?? [])
            .filter((h) => shownTokenSet.has(h.mint))
            .map((h) => {
              const ti = shownTokens.findIndex((t) => t.mint === h.mint);
              const wi = shownWallets.indexOf(w);
              const hot = edgeHot(w.address, h.mint);
              const dim = edgeDim(w.address, h.mint);
              const width =
                h.valueUsd != null && h.valueUsd > 0
                  ? Math.max(1, Math.min(4, 1 + Math.log10(h.valueUsd + 1) / 2))
                  : 1.25;
              return (
                <line
                  key={`${w.address}-${h.mint}`}
                  x1={WALLET_X}
                  y1={walletY(wi)}
                  x2={TOKEN_X}
                  y2={tokenY(ti)}
                  stroke={hot ? GOLD : "rgba(232,184,74,0.55)"}
                  strokeWidth={hot ? width + 1 : width}
                  opacity={dim ? 0.15 : 0.9}
                >
                  <title>
                    {shortAddr(w.address)} holds {tokenLabel(h)} ({fmtUsd(h.valueUsd)})
                  </title>
                </line>
              );
            }),
        )}

        {/* Wallet nodes (left) */}
        {shownWallets.map((w, i) => {
          const isSelected = selectedWalletAddr === w.address;
          const unknown = w.holdings == null;
          const r = walletR(w);
          return (
            <g
              key={w.address}
              data-testid={`overlap-wallet-${w.address}`}
              role="button"
              tabIndex={0}
              aria-label={`${shortAddr(w.address)}, ${fmtPct(w.supplyPct)} of supply${unknown ? ", holdings unknown" : `, holds ${w.holdings!.length} other tokens`}${w.fundingSource ? `, funded by ${shortAddr(w.fundingSource)}` : ", funding source unknown"}`}
              onClick={() => selectWallet(w.address)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectWallet(w.address);
                }
              }}
              style={{ cursor: "pointer", outline: "none" }}
            >
              <title>
                {shortAddr(w.address)} — {fmtPct(w.supplyPct)} of supply
                {unknown
                  ? "\nHoldings unknown — wallet could not be read"
                  : `\nHolds ${w.holdings!.length} other token${w.holdings!.length === 1 ? "" : "s"}`}
                {w.fundingSource ? `\nFunded by ${w.fundingSource}` : "\nFunding source unknown"}
                {w.devLinked ? "\nDev-linked" : ""}
              </title>
              <circle
                cx={WALLET_X}
                cy={walletY(i)}
                r={isSelected ? r + 4 : r}
                fill="none"
                stroke={isSelected ? GOLD : "transparent"}
                strokeWidth={2}
              />
              <circle
                cx={WALLET_X}
                cy={walletY(i)}
                r={r}
                fill={isSelected ? GOLD : w.devLinked ? "rgba(232,184,74,0.45)" : "rgba(255,255,255,0.85)"}
                stroke={unknown ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.4)"}
                strokeWidth={1}
                strokeDasharray={unknown ? "3 2" : undefined}
              />
              <text
                x={WALLET_X + r + 6}
                y={walletY(i) - 1}
                fontSize={9}
                fill={isSelected ? GOLD : "rgba(255,255,255,0.85)"}
                style={{ paintOrder: "stroke", stroke: "#0b0b10", strokeWidth: 3 }}
              >
                {shortAddr(w.address)}
              </text>
              <text
                x={WALLET_X + r + 6}
                y={walletY(i) + 11}
                fontSize={8}
                fill={unknown ? GOLD : "rgba(255,255,255,0.45)"}
                style={{ paintOrder: "stroke", stroke: "#0b0b10", strokeWidth: 3 }}
              >
                {unknown ? "holdings unknown" : fmtPct(w.supplyPct)}
              </text>
            </g>
          );
        })}

        {/* Token nodes (right) */}
        {shownTokens.map((t, i) => {
          const isSelected = selectedTokenMint === t.mint;
          const r = tokenR(t);
          return (
            <g
              key={t.mint}
              data-testid={`overlap-token-${t.mint}`}
              role="button"
              tabIndex={0}
              aria-label={`${t.symbol ?? shortAddr(t.mint)}, held by ${t.holderCount} of the shown wallets${t.totalValueUsd != null ? `, ${fmtUsd(t.totalValueUsd)} combined` : ""}`}
              onClick={() => selectToken(t.mint)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectToken(t.mint);
                }
              }}
              style={{ cursor: "pointer", outline: "none" }}
            >
              <title>
                {t.symbol ?? shortAddr(t.mint)}
                {t.name ? ` (${t.name})` : ""}
                {`\nHeld by ${t.holderCount} of the shown wallets`}
                {t.totalValueUsd != null ? `\n${fmtUsd(t.totalValueUsd)} combined` : "\nCombined value unknown"}
              </title>
              <circle
                cx={TOKEN_X}
                cy={tokenY(i)}
                r={isSelected ? r + 4 : r}
                fill="none"
                stroke={isSelected ? GOLD : "transparent"}
                strokeWidth={2}
              />
              <circle
                cx={TOKEN_X}
                cy={tokenY(i)}
                r={r}
                fill={isSelected ? GOLD : "rgba(232,184,74,0.55)"}
                stroke={GOLD}
                strokeWidth={1}
              />
              <text
                x={TOKEN_X - r - 6}
                y={tokenY(i) - 1}
                fontSize={9}
                fontWeight={700}
                fill={isSelected ? GOLD : "#ffffff"}
                textAnchor="end"
                style={{ paintOrder: "stroke", stroke: "#0b0b10", strokeWidth: 3 }}
              >
                {t.symbol ?? shortAddr(t.mint)}
              </text>
              <text
                x={TOKEN_X - r - 6}
                y={tokenY(i) + 11}
                fontSize={8}
                fill="rgba(255,255,255,0.45)"
                textAnchor="end"
                style={{ paintOrder: "stroke", stroke: "#0b0b10", strokeWidth: 3 }}
              >
                {t.holderCount} holder{t.holderCount !== 1 ? "s" : ""}
              </text>
            </g>
          );
        })}
      </svg>

      {shownTokens.length === 0 && (
        <p className="text-[11px] text-white/60">
          {unknownCount === shownWallets.length
            ? "Every shown wallet's holdings are unknown — no overlap could be drawn. No tokens were invented."
            : "No shared holdings observed among these wallets — each holds only this token, as far as observed."}
        </p>
      )}
      {(hiddenWallets > 0 || hiddenTokens > 0) && (
        <p className="mt-1 text-[11px] text-white/60">
          {hiddenWallets > 0 ? `+${hiddenWallets} more wallet${hiddenWallets !== 1 ? "s" : ""} not shown` : ""}
          {hiddenWallets > 0 && hiddenTokens > 0 ? " · " : ""}
          {hiddenTokens > 0 ? `+${hiddenTokens} more token${hiddenTokens !== 1 ? "s" : ""} not shown` : ""}
        </p>
      )}

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-white/60">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-white" /> wallet (size = supply %)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#e8b84a]" /> other token (size = holders)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-[2px] w-4 bg-[#e8b84a]" /> holding (thicker = larger value)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-dashed border-white/60 bg-transparent" />
          holdings unknown
        </span>
      </div>

      {/* Selected-wallet detail */}
      {selectedWallet ? (
        <div className="mt-3 rounded-lg border border-[#e8b84a]/40 bg-[#e8b84a]/10 p-3">
          <p className="text-xs font-bold text-white">
            <span className="font-mono">{shortAddr(selectedWallet.address)}</span> — {fmtPct(selectedWallet.supplyPct)} of supply
          </p>
          <p className="mt-0.5 text-[11px] text-white/70">
            Funding source:{" "}
            {selectedWallet.fundingSource ? (
              <span className="font-mono text-white">{shortAddr(selectedWallet.fundingSource)}</span>
            ) : (
              "unknown"
            )}
            {selectedWallet.devLinked ? " · Dev-linked." : ""}
          </p>
          {selectedWallet.holdings == null ? (
            <p className="mt-2 text-[11px] text-[#e8b84a]">
              Holdings unknown — this wallet could not be read, so no other tokens are listed.
            </p>
          ) : selectedWallet.holdings.length === 0 ? (
            <p className="mt-2 text-[11px] text-white/70">
              Holds nothing else observed — this wallet was read and no other token holdings were found.
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {selectedWallet.holdings.map((h) => (
                <li key={h.mint} className="flex justify-between gap-2 text-[11px]">
                  <span className="text-white" title={h.mint}>
                    {h.symbol ?? shortAddr(h.mint)}
                    {h.name ? <span className="text-white/50"> · {h.name}</span> : null}
                  </span>
                  <span className="shrink-0 text-white/60">
                    {fmtUsd(h.valueUsd)}
                    {h.supplyPct != null ? ` · ${h.supplyPct.toFixed(1)}%` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : selectedToken ? (
        <div className="mt-3 rounded-lg border border-[#e8b84a]/40 bg-[#e8b84a]/10 p-3">
          <p className="text-xs font-bold text-white">
            {selectedToken.symbol ?? shortAddr(selectedToken.mint)}
            {selectedToken.name ? <span className="font-normal text-white/60"> · {selectedToken.name}</span> : null}
          </p>
          <p className="mt-0.5 text-[11px] text-white/70">
            Held by {selectedToken.holderCount} of the shown wallets
            {selectedToken.totalValueUsd != null ? ` · ${fmtUsd(selectedToken.totalValueUsd)} combined` : " · combined value unknown"}.
          </p>
          <ul className="mt-2 space-y-1">
            {selectedToken.holders.map((w) => {
              const h = (w.holdings ?? []).find((x) => x.mint === selectedToken.mint);
              return (
                <li key={w.address} className="flex justify-between gap-2 text-[11px]">
                  <span className="font-mono text-white/80" title={w.address}>
                    {shortAddr(w.address)}
                  </span>
                  <span className="text-white/60">{fmtUsd(h?.valueUsd)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-white/40">
          Select a wallet to see its other holdings, or a token to see who holds it.
        </p>
      )}
    </>
  );
};

export default HolderOverlapGraph;
