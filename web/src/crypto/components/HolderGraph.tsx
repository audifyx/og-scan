/**
 * HolderGraph — visual graph of top holders for a token (OG Scanner v2).
 *
 * Pure SVG, no chart dependencies. Nodes are wallets, sized by supply %;
 * edges are ONLY the observed links passed in via `edges` (shared funding
 * source or observed transfers) — nothing is invented. Tap/click a node to
 * highlight its funding chain; the chain string (holder → funder → funder's
 * funder…) is shown below the graph. A holder with no further observed links
 * says so explicitly instead of drawing a guessed chain.
 *
 * Data can arrive as `holders` (explicit nodes), as `traces` (HolderTrace
 * rows from @/crypto/bundle — fundingChain is used verbatim), or via the
 * `holdersFromAnalysis` helper below for a BundleAnalysis. `holders` wins
 * when more than one is given.
 *
 * Palette (standing rule): black / white / gold (#e8b84a) only, white text on
 * the component's own dark background. No emoji, no rainbow colors.
 * Responsive: SVG scales to its container down to 390px phone width.
 *
 * Team B usage:
 *   <HolderGraph holders={holdersFromAnalysis(bundle)} edges={edges} />
 *   <HolderGraph traces={traces} />   // edges derived from shared fundingSource
 */
import { useMemo, useState } from "react";
import { shortAddr } from "@/lib/og";
import type { BundleAnalysis, HolderTrace } from "../bundle";

export interface HolderGraphHolder {
  address: string;
  supplyPct: number | null;
  fundingSource: string | null;
  /** Full observed chain, holder first: [holder, funder, funder's funder, …]. */
  fundingChain: string[];
  devLinked?: boolean;
}

export interface HolderGraphEdge {
  from: string;
  to: string;
  kind: "funding" | "transfer";
}

export interface HolderGraphProps {
  /** Explicit nodes. Wins over `traces` when both are given. */
  holders?: HolderGraphHolder[] | null;
  /** HolderTrace rows — nodes + funding edges are derived from these. */
  traces?: HolderTrace[] | null;
  /** Observed links only. Omitted when `traces` is used (see below). */
  edges?: HolderGraphEdge[] | null;
  /** True while a scan is in flight and no data is available yet. */
  loading?: boolean;
  /** Max nodes drawn (largest holders first). Default 12. */
  maxHolders?: number;
  /** Controlled selection; uncontrolled when omitted. */
  selectedAddress?: string | null;
  /** Fired when a node is tapped/clicked (null = deselect). */
  onSelectHolder?: (address: string | null) => void;
}

const GOLD = "#e8b84a";
const VIEW_W = 360;
const VIEW_H = 280;
const CX = 180;
const CY = 138;
const RING_R = 96;

function fmtPct(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? "unknown" : `${v.toFixed(1)}%`;
}

/** Build HolderGraph nodes from raw HolderTrace rows (chain used verbatim). */
export function holdersFromTraces(traces: HolderTrace[]): HolderGraphHolder[] {
  return traces.map((t) => ({
    address: t.address,
    supplyPct: t.supplyPct,
    fundingSource: t.fundingSource,
    fundingChain: t.fundingChain && t.fundingChain.length > 0 ? t.fundingChain : [t.address],
    devLinked: t.devLinked,
  }));
}

/**
 * Build HolderGraph nodes from a BundleAnalysis. Each cluster member's chain
 * is the cluster fundingChain starting at that member when the member appears
 * in it; otherwise just the member itself (no further links observed — the
 * chain is NOT padded with a guessed funder).
 */
export function holdersFromAnalysis(analysis: BundleAnalysis | null | undefined): HolderGraphHolder[] {
  if (!analysis) return [];
  const out: HolderGraphHolder[] = [];
  for (const c of analysis.clusters ?? []) {
    for (const m of c.members ?? []) {
      if (out.some((h) => h.address === m.address)) continue;
      const at = (c.fundingChain ?? []).indexOf(m.address);
      out.push({
        address: m.address,
        supplyPct: m.supplyPct,
        fundingSource: m.fundingSource,
        fundingChain: at >= 0 ? c.fundingChain.slice(at) : [m.address],
        devLinked: m.devLinked,
      });
    }
  }
  return out.sort((a, b) => (b.supplyPct ?? 0) - (a.supplyPct ?? 0));
}

/** Edges implied by shared fundingSource across traces — observed only. */
export function edgesFromTraces(traces: HolderTrace[]): HolderGraphEdge[] {
  const bySource = new Map<string, string[]>();
  for (const t of traces) {
    if (!t.fundingSource || t.fundingSource === t.address) continue;
    const list = bySource.get(t.fundingSource) ?? [];
    list.push(t.address);
    bySource.set(t.fundingSource, list);
  }
  const edges: HolderGraphEdge[] = [];
  for (const [source, addrs] of bySource) {
    if (addrs.length < 2) continue;
    // Star through the shared funder: funder -> each member. The funder node
    // itself is only drawn when it is also a holder; otherwise the edge is
    // dropped at render time (never invent a node).
    for (const a of addrs) edges.push({ from: source, to: a, kind: "funding" });
  }
  return edges;
}

interface PlacedNode extends HolderGraphHolder {
  x: number;
  y: number;
  r: number;
}

export const HolderGraph: React.FC<HolderGraphProps> = ({
  holders: holdersProp = null,
  traces = null,
  edges: edgesProp = null,
  loading = false,
  maxHolders = 12,
  selectedAddress,
  onSelectHolder,
}) => {
  const [internalSelected, setInternalSelected] = useState<string | null>(null);
  const selected = selectedAddress !== undefined ? selectedAddress : internalSelected;

  const allHolders = useMemo<HolderGraphHolder[]>(() => {
    if (holdersProp && holdersProp.length > 0) return holdersProp;
    if (traces && traces.length > 0) return holdersFromTraces(traces);
    return holdersProp ?? [];
  }, [holdersProp, traces]);

  const sorted = useMemo(
    () => [...allHolders].sort((a, b) => (b.supplyPct ?? 0) - (a.supplyPct ?? 0)),
    [allHolders],
  );
  const shown = sorted.slice(0, maxHolders);
  const hiddenCount = sorted.length - shown.length;
  const shownSet = useMemo(() => new Set(shown.map((h) => h.address)), [shown]);

  const edges = useMemo<HolderGraphEdge[]>(() => {
    if (edgesProp) return edgesProp;
    if (traces) return edgesFromTraces(traces);
    return [];
  }, [edgesProp, traces]);

  // Deterministic ring layout: largest holder at the top, rest clockwise.
  const maxPct = Math.max(0, ...shown.map((h) => h.supplyPct ?? 0));
  const placed: PlacedNode[] = shown.map((h, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(1, shown.length);
    const r =
      maxPct > 0 && h.supplyPct != null
        ? 7 + Math.sqrt(h.supplyPct / maxPct) * 13
        : 8;
    return {
      ...h,
      x: CX + RING_R * Math.cos(angle),
      y: CY + RING_R * Math.sin(angle),
      r,
    };
  });
  const byAddr = useMemo(() => new Map(placed.map((p) => [p.address, p])), [placed]);

  const selectedHolder = selected ? placed.find((p) => p.address === selected) ?? null : null;
  const selectedChain = selectedHolder ? selectedHolder.fundingChain : [];
  const chainSet = useMemo(() => new Set(selectedChain), [selectedChain]);

  // Only edges whose BOTH ends are drawn nodes are rendered — never invent nodes.
  const drawableEdges = edges.filter((e) => byAddr.has(e.from) && byAddr.has(e.to));
  const edgeInChain = (e: HolderGraphEdge) => {
    if (!selected) return false;
    for (let i = 0; i + 1 < selectedChain.length; i++) {
      if (
        (selectedChain[i] === e.from && selectedChain[i + 1] === e.to) ||
        (selectedChain[i] === e.to && selectedChain[i + 1] === e.from)
      ) {
        return true;
      }
    }
    return false;
  };

  const select = (addr: string) => {
    const next = selected === addr ? null : addr;
    if (onSelectHolder) onSelectHolder(next);
    else setInternalSelected(next);
  };

  const card = (children: React.ReactNode) => (
    <div
      data-testid="holder-graph"
      className="rounded-xl border border-white/10 bg-[#0b0b10] p-3 text-white"
    >
      {children}
    </div>
  );

  if (loading && allHolders.length === 0) {
    return card(
      <>
        <p className="text-xs font-bold text-white">Holder graph</p>
        <p className="mt-1 animate-pulse text-[11px] text-white/60">
          Loading holders — tracing funding chains…
        </p>
      </>,
    );
  }

  if (allHolders.length === 0) {
    return card(
      <>
        <p className="text-xs font-bold text-white">Holder graph</p>
        <p className="mt-1 text-[11px] text-white/60">
          Holder data unavailable — no holders were provided to graph.
        </p>
      </>,
    );
  }

  return card(
    <>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-bold text-white">Holder graph</p>
        <p className="text-[11px] text-white/60">
          top {shown.length} holder{shown.length !== 1 ? "s" : ""}
          {hiddenCount > 0 ? ` (+${hiddenCount} more)` : ""}
        </p>
      </div>

      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        role="img"
        aria-label={`Holder graph with ${shown.length} top holders`}
        className="mt-1 block"
      >
        {/* Edges first so nodes draw on top */}
        {drawableEdges.map((e, i) => {
          const a = byAddr.get(e.from)!;
          const b = byAddr.get(e.to)!;
          const hot = edgeInChain(e);
          return (
            <line
              key={`${e.from}-${e.to}-${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={hot ? GOLD : e.kind === "funding" ? "rgba(232,184,74,0.55)" : "rgba(255,255,255,0.35)"}
              strokeWidth={hot ? 2.5 : 1.25}
              strokeDasharray={e.kind === "transfer" ? "4 3" : undefined}
            >
              <title>
                {shortAddr(e.from)} → {shortAddr(e.to)} ({e.kind === "funding" ? "shared funding" : "observed transfer"})
              </title>
            </line>
          );
        })}
        {placed.map((p) => {
          const isSelected = selected === p.address;
          const inChain = chainSet.has(p.address) && selected != null;
          return (
            <g
              key={p.address}
              data-testid={`holder-graph-node-${p.address}`}
              role="button"
              tabIndex={0}
              aria-label={`${shortAddr(p.address)}, ${fmtPct(p.supplyPct)} of supply${p.fundingSource ? `, funded by ${shortAddr(p.fundingSource)}` : ", funding source unknown"}`}
              onClick={() => select(p.address)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  select(p.address);
                }
              }}
              style={{ cursor: "pointer", outline: "none" }}
            >
              <title>
                {shortAddr(p.address)} — {fmtPct(p.supplyPct)} of supply
                {p.fundingSource ? `\nFunded by ${p.fundingSource}` : "\nFunding source unknown"}
                {p.devLinked ? "\nDev-linked" : ""}
              </title>
              {inChain && (
                <circle cx={p.x} cy={p.y} r={p.r + 5} fill="none" stroke={GOLD} strokeWidth={2} />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={p.r}
                fill={isSelected ? GOLD : p.devLinked ? "rgba(232,184,74,0.45)" : "rgba(255,255,255,0.85)"}
                stroke={isSelected || inChain ? GOLD : "rgba(255,255,255,0.4)"}
                strokeWidth={isSelected ? 2.5 : 1}
              />
              <text
                x={p.x}
                y={p.y + p.r + 12}
                fontSize={9}
                fill={isSelected ? GOLD : "rgba(255,255,255,0.7)"}
                textAnchor="middle"
              >
                {shortAddr(p.address)}
              </text>
              <text x={p.x} y={p.y + p.r + 23} fontSize={8} fill="rgba(255,255,255,0.45)" textAnchor="middle">
                {fmtPct(p.supplyPct)}
              </text>
            </g>
          );
        })}
      </svg>

      {drawableEdges.length === 0 && (
        <p className="text-[11px] text-white/60">
          No observed links between these holders — edges are only drawn from observed shared funding or
          transfers, never guessed.
        </p>
      )}

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-white/60">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-white" /> holder (size = supply %)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-[2px] w-4 bg-[#e8b84a]" /> shared funding
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-[2px] w-4 border-t border-dashed border-white/60" /> observed transfer
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-[#e8b84a] bg-transparent" />
          in selected chain
        </span>
      </div>

      {/* Selected-holder funding chain */}
      {selectedHolder ? (
        <div className="mt-3 rounded-lg border border-[#e8b84a]/40 bg-[#e8b84a]/10 p-3">
          <p className="text-xs font-bold text-white">
            Funding chain — <span className="font-mono">{shortAddr(selectedHolder.address)}</span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {selectedChain.map((addr, i) => (
              <span key={`${addr}-${i}`} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-[#e8b84a]">→</span>}
                <span
                  className={
                    i === 0
                      ? "rounded-md bg-[#e8b84a] px-2 py-1 font-mono text-[11px] font-bold text-black"
                      : "rounded-md border border-white/20 bg-white/5 px-2 py-1 font-mono text-[11px] text-white"
                  }
                  title={addr}
                >
                  {shortAddr(addr)}
                </span>
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-white/70">
            {selectedChain.length <= 1
              ? "No further funding links observed for this holder."
              : `${selectedChain.length} hops observed — holder → funder → funder's funder.`}
            {selectedHolder.fundingSource
              ? ` Direct funder: ${shortAddr(selectedHolder.fundingSource)}.`
              : " Direct funder unknown."}
            {selectedHolder.devLinked ? " Dev-linked." : ""}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-white/60">Select a holder to highlight its funding chain.</p>
      )}
    </>
  );
};

export default HolderGraph;
