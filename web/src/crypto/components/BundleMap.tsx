/**
 * BundleMap — visual map of bundle clusters for a token (OG Scanner v2).
 *
 * Pure SVG, no chart dependencies. Each cluster is one grouped node showing
 * member count, bundled supply %, funding source (when observed) and kind
 * (funding / window / funding+window). Clusters with no observed funding
 * source are drawn dashed and labelled "unlinked" — they are never grouped
 * by guess. Renders only what its props provide; missing values read
 * "unknown", never invented.
 *
 * Palette (standing rule): black / white / gold (#e8b84a) only, white text on
 * the component's own dark background. No emoji, no rainbow colors.
 * Responsive: SVG scales to its container down to 390px phone width.
 *
 * Team B usage:
 *   <BundleMap analysis={bundle} />
 *   // or, with pre-derived clusters:
 *   <BundleMap clusters={bundle.clusters} totalBundledPct={bundle.bundledSupplyPct} />
 */
import { useMemo, useState } from "react";
import { shortAddr } from "@/lib/og";
import type { BundleAnalysis, BundleCluster, BundleClusterKind } from "../bundle";

export interface BundleMapProps {
  /** Clusters to draw. Ignored when `analysis` is provided. */
  clusters?: BundleCluster[] | null;
  /** Live scan result — when provided, clusters + states come from it. */
  analysis?: BundleAnalysis | null;
  /** True while a scan is in flight and no data is available yet. */
  loading?: boolean;
  /** Total bundled supply %, shown in the header when known. */
  totalBundledPct?: number | null;
  /** Controlled selection; uncontrolled when omitted. */
  selectedClusterId?: string | null;
  /** Fired when a cluster is tapped/clicked (null = deselect). */
  onSelectCluster?: (clusterId: string | null) => void;
}

export const KIND_LABELS: Record<BundleClusterKind, string> = {
  funding: "funding",
  window: "window",
  "funding+window": "funding + window",
};

const GOLD = "#e8b84a";
const CELL_W = 172;
const CELL_H = 128;
const GAP_X = 8;
const GAP_Y = 10;
const COLS = 2;
const MAX_CLUSTERS = 8;

function fmtPct(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? "unknown" : `${v.toFixed(1)}%`;
}

function fmtWindow(c: BundleCluster): string {
  if (c.timeSpanSeconds == null) return "window unknown";
  if (c.timeSpanSeconds < 60) return `${c.timeSpanSeconds}s window`;
  return `${(c.timeSpanSeconds / 60).toFixed(1)}m window`;
}

export const BundleMap: React.FC<BundleMapProps> = ({
  clusters: clustersProp = null,
  analysis = null,
  loading = false,
  totalBundledPct = null,
  selectedClusterId,
  onSelectCluster,
}) => {
  const [internalSelected, setInternalSelected] = useState<string | null>(null);
  const selectedId = selectedClusterId !== undefined ? selectedClusterId : internalSelected;

  const clusters = useMemo(
    () => (analysis ? analysis.clusters : clustersProp ?? []),
    [analysis, clustersProp],
  );
  const totalPct = analysis ? analysis.bundledSupplyPct : totalBundledPct;
  const isUnknown = Boolean(analysis) && analysis?.state === "unknown";
  const isPartial = Boolean(analysis) && analysis?.state === "partial";

  const shown = clusters.slice(0, MAX_CLUSTERS);
  const hiddenCount = clusters.length - shown.length;
  const rows = Math.max(1, Math.ceil(shown.length / COLS));
  const viewHeight = 8 + rows * CELL_H + (rows - 1) * GAP_Y;

  const select = (id: string) => {
    const next = selectedId === id ? null : id;
    if (onSelectCluster) onSelectCluster(next);
    else setInternalSelected(next);
  };

  const selected = selectedId ? clusters.find((c) => c.id === selectedId) ?? null : null;

  const card = (children: React.ReactNode) => (
    <div
      data-testid="bundle-map"
      className="rounded-xl border border-white/10 bg-[#0b0b10] p-3 text-white"
    >
      {children}
    </div>
  );

  if (loading && clusters.length === 0 && !analysis) {
    return card(
      <>
        <p className="text-xs font-bold text-white">Bundle map</p>
        <p className="mt-1 animate-pulse text-[11px] text-white/60">
          Scanning bundles — tracing holder funding…
        </p>
      </>,
    );
  }

  if (isUnknown) {
    return card(
      <>
        <p className="text-xs font-bold text-white">Bundle map</p>
        <p className="mt-1 text-[11px] text-white/60">
          Bundle data unavailable — {analysis?.reason ?? "the bundle scan did not return data."} Nothing is
          assumed clean.
        </p>
      </>,
    );
  }

  if (clusters.length === 0) {
    return card(
      <>
        <p className="text-xs font-bold text-white">Bundle map</p>
        <p className="mt-1 text-[11px] text-white/60">
          No bundle clusters observed in the data provided.
        </p>
      </>,
    );
  }

  return card(
    <>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-bold text-white">Bundle map</p>
        <p className="text-[11px] text-white/60">
          {totalPct != null ? `${totalPct.toFixed(1)}% bundled` : "bundled % unknown"} ·{" "}
          {clusters.length} cluster{clusters.length !== 1 ? "s" : ""}
        </p>
      </div>
      {isPartial && (
        <p className="mt-1 text-[11px] text-[#e8b84a]">
          Partial scan — some holders could not be traced. Bundled % is a lower bound.
        </p>
      )}

      <svg
        viewBox={`0 0 360 ${viewHeight}`}
        width="100%"
        role="img"
        aria-label={`Bundle map with ${clusters.length} clusters`}
        className="mt-2 block"
      >
        {shown.map((cluster, i) => {
          const col = i % COLS;
          const row = Math.floor(i / COLS);
          const x = 4 + col * (CELL_W + GAP_X);
          const y = 4 + row * (CELL_H + GAP_Y);
          const isSelected = selectedId === cluster.id;
          const linked = cluster.fundingSource != null;
          const members = cluster.members ?? [];
          const dots = members.slice(0, 8);
          const title =
            `Cluster ${i + 1} — ${KIND_LABELS[cluster.kind]}\n` +
            `${members.length} wallets · ${fmtPct(cluster.supplyPct)} of supply\n` +
            (linked
              ? `Funding source: ${cluster.fundingSource}`
              : "Unlinked — no shared funding source observed") +
            `\n${fmtWindow(cluster)}`;
          return (
            <g
              key={cluster.id}
              data-testid={`bundle-map-cluster-${cluster.id}`}
              role="button"
              tabIndex={0}
              aria-label={title.replace(/\n/g, ", ")}
              onClick={() => select(cluster.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  select(cluster.id);
                }
              }}
              style={{ cursor: "pointer", outline: "none" }}
            >
              <title>{title}</title>
              <rect
                x={x}
                y={y}
                width={CELL_W}
                height={CELL_H}
                rx={10}
                fill={isSelected ? "rgba(232,184,74,0.12)" : "rgba(255,255,255,0.03)"}
                stroke={isSelected ? GOLD : linked ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.35)"}
                strokeWidth={isSelected ? 2 : 1}
                strokeDasharray={linked ? undefined : "5 4"}
              />
              {/* Header: cluster number + kind */}
              <text x={x + 10} y={y + 18} fontSize={11} fontWeight={700} fill="#ffffff">
                Cluster {i + 1}
              </text>
              <text x={x + CELL_W - 10} y={y + 18} fontSize={9} fill={GOLD} textAnchor="end">
                {KIND_LABELS[cluster.kind]}
              </text>
              {/* Supply + member count */}
              <text x={x + 10} y={y + 36} fontSize={11} fontWeight={700} fill="#ffffff">
                {fmtPct(cluster.supplyPct)} of supply
              </text>
              <text x={x + 10} y={y + 52} fontSize={10} fill="rgba(255,255,255,0.6)">
                {members.length} wallet{members.length !== 1 ? "s" : ""} · {fmtWindow(cluster)}
              </text>
              {/* Member dots, sized by supply % when known */}
              {dots.map((m, di) => {
                const r =
                  m.supplyPct != null && m.supplyPct > 0
                    ? Math.max(4, Math.min(9, 4 + Math.sqrt(m.supplyPct) * 1.6))
                    : 4;
                return (
                  <g key={m.address}>
                    <title>
                      {shortAddr(m.address)} — {fmtPct(m.supplyPct)} of supply
                    </title>
                    <circle
                      cx={x + 16 + di * 19}
                      cy={y + 72}
                      r={r}
                      fill={m.supplyPct != null && m.supplyPct >= 5 ? GOLD : "rgba(255,255,255,0.55)"}
                      stroke={GOLD}
                      strokeOpacity={m.supplyPct != null && m.supplyPct >= 5 ? 1 : 0.25}
                      strokeWidth={1}
                    />
                  </g>
                );
              })}
              {members.length > dots.length && (
                <text x={x + 16 + dots.length * 19} y={y + 76} fontSize={10} fill="rgba(255,255,255,0.6)">
                  +{members.length - dots.length}
                </text>
              )}
              {/* Funding footer: linked source, or explicit "unlinked" */}
              {linked ? (
                <g>
                  <line
                    x1={x + 10}
                    y1={y + 92}
                    x2={x + 10}
                    y2={y + 100}
                    stroke={GOLD}
                    strokeWidth={1}
                  />
                  <circle cx={x + 10} cy={y + 90} r={2.5} fill={GOLD} />
                  <text x={x + 18} y={y + 104} fontSize={9} fill="rgba(255,255,255,0.6)">
                    funded by {shortAddr(cluster.fundingSource ?? undefined)}
                  </text>
                </g>
              ) : (
                <text x={x + 10} y={y + 104} fontSize={9} fill="rgba(255,255,255,0.6)">
                  unlinked — no shared funding observed
                </text>
              )}
              {cluster.devLinked && (
                <text x={x + 10} y={y + 118} fontSize={9} fill={GOLD}>
                  dev-linked
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hiddenCount > 0 && (
        <p className="mt-1 text-[11px] text-white/60">+{hiddenCount} more cluster{hiddenCount !== 1 ? "s" : ""} not shown</p>
      )}

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-white/60">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border border-white/40 bg-white/5" />
          funding-linked cluster
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border border-dashed border-white/40 bg-white/5" />
          unlinked cluster
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#e8b84a]" />
          5%+ of supply
        </span>
      </div>

      {/* Selected-cluster detail */}
      {selected ? (
        <div className="mt-3 rounded-lg border border-[#e8b84a]/40 bg-[#e8b84a]/10 p-3">
          <p className="text-xs font-bold text-white">
            Cluster {clusters.indexOf(selected) + 1} — {KIND_LABELS[selected.kind]}
          </p>
          <p className="mt-0.5 text-[11px] text-white/70">
            {fmtPct(selected.supplyPct)} of supply · {selected.members.length} wallet
            {selected.members.length !== 1 ? "s" : ""} · {fmtWindow(selected)}
          </p>
          <p className="mt-0.5 text-[11px] text-white/70">
            Funding source:{" "}
            {selected.fundingSource ? (
              <span className="font-mono text-white">{shortAddr(selected.fundingSource)}</span>
            ) : (
              "unknown — unlinked"
            )}
          </p>
          {selected.sourceBehindOtherLaunches ? (
            <p className="mt-0.5 text-[11px] text-[#e8b84a]">
              Funding source is behind other launches ({selected.sourceOtherLaunches ?? "unknown"} known).
            </p>
          ) : null}
          <ul className="mt-2 space-y-1">
            {selected.members.map((m) => (
              <li key={m.address} className="flex justify-between gap-2 text-[11px]">
                <span className="font-mono text-white/80" title={m.address}>
                  {shortAddr(m.address)}
                </span>
                <span className="text-white/60">{fmtPct(m.supplyPct)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-white/60">Select a cluster to inspect its members.</p>
      )}
    </>
  );
};

export default BundleMap;
