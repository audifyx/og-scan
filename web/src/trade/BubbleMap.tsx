/**
 * /trade bubble map — same advanced canvas graph as OrbitX DEX / trading terminal.
 * Merges x-ray clusters + top holders (no WebGL / R3F dependency).
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Sparkles } from "lucide-react";
import AdvancedBubbleMap, {
  type BubbleHolder,
  type XrayReport,
} from "@/components/trading/BubbleMap";

export type BubbleXray = XrayReport & {
  ok?: boolean;
};

export type { BubbleHolder };

function toReport(xray: BubbleXray | null | undefined, mint?: string): XrayReport | null {
  if (!xray) return null;
  return {
    ok: xray.ok !== false,
    mint: xray.mint || mint,
    traced: xray.traced,
    verdict: xray.verdict,
    tone: xray.tone,
    score: xray.score,
    summary: xray.summary,
    note: xray.note,
    earlyBuyers: xray.earlyBuyers,
    snipers: xray.snipers,
    bundles: xray.bundles,
    insiders: xray.insiders,
    concentration: xray.concentration,
    dev: xray.dev,
  };
}

function nodePreviewCount(xray?: BubbleXray | null, holders?: BubbleHolder[] | null) {
  const early = xray?.earlyBuyers?.length || 0;
  const snipers = xray?.snipers?.wallets?.length || 0;
  const hold = holders?.length || 0;
  return Math.max(early + snipers, hold, early);
}

export function BubbleMapPreview({
  xray,
  holders,
  holderCount,
  onOpen,
}: {
  xray?: BubbleXray | null;
  holders?: BubbleHolder[] | null;
  holderCount?: number | null;
  onOpen: () => void;
}) {
  const n = nodePreviewCount(xray, holders);
  const sniper = xray?.snipers?.pct;
  const bundle = xray?.bundles?.pct;
  const score = xray?.score;
  const colors = ["#ff5c5c", "#ff9f1c", "#ffd60a", "#2dd4bf", "#c084fc", "#f0abfc", "#22d3ee"];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-[#0a0a12] to-[#050508] text-left transition hover:border-cyan-400/30"
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/55">
          <Sparkles className="h-3.5 w-3.5 text-cyan-300/80" />
          Bubble map
        </div>
        <span className="text-[10px] text-cyan-300/70 group-hover:text-cyan-200">Open full map →</span>
      </div>
      <div className="relative h-36 px-3 py-3">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.08),transparent_65%)]" />
        <div className="relative flex h-full flex-wrap content-center items-center justify-center gap-1.5">
          {n > 0 ? (
            Array.from({ length: Math.min(18, Math.max(6, n)) }).map((_, i) => (
              <span
                key={i}
                className="rounded-full shadow-[0_0_12px_rgba(0,0,0,0.45)]"
                style={{
                  width: 10 + ((i * 7) % 28),
                  height: 10 + ((i * 7) % 28),
                  background: colors[i % colors.length],
                  opacity: 0.9,
                }}
              />
            ))
          ) : (
            <span className="text-[11px] text-white/35">Pulling cluster data…</span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 border-t border-white/10 px-3 py-2 text-[10px]">
        <div>
          <p className="text-white/30">Nodes</p>
          <p className="font-mono text-white/80">{n || "—"}</p>
        </div>
        <div>
          <p className="text-white/30">Snipers</p>
          <p className="font-mono text-white/80">{sniper != null ? `${Number(sniper).toFixed(0)}%` : "—"}</p>
        </div>
        <div>
          <p className="text-white/30">Holders</p>
          <p className="font-mono text-white/80">{holderCount ?? holders?.length ?? "—"}</p>
        </div>
        <div>
          <p className="text-white/30">Score</p>
          <p className="font-mono text-white/80">{score ?? "—"}</p>
        </div>
        {bundle != null && (
          <div className="col-span-4 text-[10px] text-white/35">
            Bundle concentration {Number(bundle).toFixed(0)}% · same map engine as OrbitX DEX
          </div>
        )}
      </div>
    </button>
  );
}

export function BubbleMap({
  address,
  chain = "solana",
  xray,
  holders,
  holderCount,
  height = 640,
  onRefresh,
  refreshing,
}: {
  address: string;
  chain?: string;
  xray?: BubbleXray | null;
  holders?: BubbleHolder[] | null;
  holderCount?: number | null;
  height?: number;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const report = useMemo(() => {
    const base = toReport(xray, address);
    if (base) return base;
    if (holders?.length) {
      return {
        ok: true,
        mint: address,
        traced: false,
        earlyBuyers: [],
        note: "Showing top holders — x-ray cluster trace not ready yet.",
      } as XrayReport;
    }
    return null;
  }, [xray, address, holders]);
  const ext = address
    ? `https://iframe.bubblemaps.io/map?chain=${encodeURIComponent(
        chain === "sol" ? "solana" : chain,
      )}&address=${encodeURIComponent(address)}&partnerId=orbitx`
    : "";

  if (!address) {
    return <p className="py-10 text-center text-xs text-white/35">No token address for map</p>;
  }

  if (!report) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/40 p-8 text-center text-xs text-white/40">
        Waiting on x-ray / holder data…
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="mt-3 block w-full rounded-md border border-white/15 px-3 py-1.5 text-[11px] text-white/70 hover:bg-white/5"
          >
            Pull latest data
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
        <p className="text-[11px] text-white/35">
          OrbitX advanced cluster map · force / radial / timeline / hulls · PNG export
        </p>
        <div className="flex items-center gap-3">
          <Link to={`/trade/token/${address}`} className="text-[10px] text-white/35 hover:text-white/60">
            Token
          </Link>
          {ext && (
            <a
              href={ext}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-white/40 hover:text-white"
            >
              Bubblemaps.io <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
      <AdvancedBubbleMap
        report={report}
        holders={holders}
        holderCount={holderCount}
        height={height}
        onRefresh={onRefresh}
        refreshing={refreshing}
        walletHref={(w) => `/trade/wallet/${w}`}
      />
    </div>
  );
}

export default BubbleMap;
