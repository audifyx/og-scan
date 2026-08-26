import { Copy, Crosshair, ExternalLink, Radio } from "lucide-react";
import { EmptyState } from "@/pages/onchain-world/dashboard/EmptyState";
import { Button } from "@/pages/onchain-world/dashboard/ui/button";
import { clock } from "@/pages/onchain-world/format";
import { buySellRatio, kolEventsFor, recentLargeEvents, tokenActivity, windowedTokenActivity } from "@/pages/onchain-world/activityStats";
import { mergeChainEvents } from "@/pages/onchain-world/lib/mapLive";
import { formatAddress, formatInt, formatPct, formatPrice, formatUsd } from "@/pages/onchain-world/lib/orbitx/format";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";
import { CLUSTER_META, classifyToken } from "@/pages/onchain-world/universeLayout";
import { tokenLabel, tokenTicker } from "../../../../shared/orbitx-chain-districts.js";
import { isOrbitxMint } from "../../../../shared/orbitx-chain-intel.js";

export function TokenPanel() {
  const selected = useOrbitxStore((s) => s.selectedToken);
  const detail = useOrbitxStore((s) => s.tokenDetail);
  const districts = useOrbitxStore((s) => s.city.districts);
  const events = useOrbitxStore((s) => s.city.rawEvents);
  const setCamCommand = useOrbitxStore((s) => s.setCamCommand);
  const setView = useOrbitxStore((s) => s.setActiveView);
  const live = useOrbitxStore((s) =>
    selected && isOrbitxMint(selected)
      ? s.city.districts.orbitx
      : (s.city.districts.tokens || []).find((t) => t.mint === selected) || null,
  );

  if (!selected) {
    return (
      <aside className="ox-panel flex h-full min-h-0 flex-col overflow-hidden">
        <header className="border-b border-line px-3 py-2.5">
          <h2 className="ox-kicker text-fg">Token depth</h2>
        </header>
        <EmptyState
          icon={<Radio className="size-5" />}
          title="Pick a coin"
          body="Search or tap a planet in space. The first slice is the day's 250 high-volume trending coins — open one for holders, KOL flow, and swaps."
        />
      </aside>
    );
  }

  const token = {
    mint: selected,
    ...live,
    ...detail?.token,
  };
  const name = tokenLabel(token);
  const ticker = tokenTicker(token);
  const cluster = classifyToken(token);
  const related = (detail?.events?.length ? detail.events : events.filter((e) => e.token_ca === selected)).slice(0, 12);
  const buyers = (detail?.buyers || []).slice(0, 8);
  const catalog = mergeChainEvents(events, detail?.events);
  const indexed = tokenActivity(catalog, selected);
  const day = windowedTokenActivity(catalog, selected, 86_400_000);
  const week = windowedTokenActivity(catalog, selected, 604_800_000);
  const ratio = buySellRatio(indexed);
  const large = recentLargeEvents(catalog, selected, 6);
  const kolHits = kolEventsFor(catalog, selected, 6);

  return (
    <aside className="ox-panel flex h-full min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-line">
        {token.banner ? (
          <img src={token.banner} alt="" className="h-20 w-full object-cover" />
        ) : (
          <div className="h-12 bg-gradient-to-r from-accent-2/30 to-cyan/10" />
        )}
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          {token.image ? (
            <img src={token.image} alt="" className="size-10 rounded-full object-cover" />
          ) : (
            <span className="size-10 rounded-full bg-bg-hover" />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-sm font-semibold text-fg">{name}</h2>
            <p className="truncate text-2xs text-muted">
              {ticker ? `$${ticker}` : "Solana token"} · {CLUSTER_META[cluster].label}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Focus in universe"
            onClick={() => {
              setView("world");
              setCamCommand({ kind: "token", mint: selected });
            }}
          >
            <Crosshair className="size-3.5" />
          </Button>
        </div>
      </header>

      <div className="ox-scroll min-h-0 flex-1 overflow-y-auto">
        <dl className="grid grid-cols-2 gap-px border-b border-line bg-line">
          <Stat label="Price" value={formatPrice(token.price_usd ?? null)} />
          <Stat label="24h" value={formatPct(token.change_24h ?? null)} />
          <Stat label="Volume" value={formatUsd(token.volume_24h ?? null)} />
          <Stat label="Liquidity" value={formatUsd(token.liquidity_usd ?? null)} />
          <Stat label="Market cap" value={formatUsd(token.market_cap ?? null)} />
          <Stat label="Holders" value={formatInt(token.holder_count ?? null)} />
        </dl>

        <dl className="grid grid-cols-2 gap-px border-b border-line bg-line">
          <Stat label="24h buys" value={formatInt(token.buys_24h ?? null)} />
          <Stat label="24h sells" value={formatInt(token.sells_24h ?? null)} />
          <Stat label="24h traders" value={formatInt(token.traders_24h ?? null)} />
          <Stat label="Buy vol 24h" value={formatUsd(token.buy_volume_24h ?? null)} />
          <Stat label="Sell vol 24h" value={formatUsd(token.sell_volume_24h ?? null)} />
          <Stat label="Launch" value={token.launch_platform || token.dex || "—"} />
        </dl>

        <dl className="grid grid-cols-2 gap-px border-b border-line bg-line">
          <Stat label="Indexed txs" value={formatInt(indexed.total)} />
          <Stat label="Buy / sell" value={ratio || "—"} />
          <Stat label="Buys" value={formatInt(indexed.buys)} />
          <Stat label="Sells" value={formatInt(indexed.sells)} />
          <Stat label="Swaps" value={formatInt(indexed.swaps)} />
          <Stat label="Transfers" value={formatInt(indexed.transfers)} />
          <Stat label="24h indexed" value={formatInt(day.total)} />
          <Stat label="7d indexed" value={formatInt(week.total)} />
        </dl>

        <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
          <span className="truncate font-mono text-2xs text-dim">{formatAddress(selected)}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Copy mint"
            onClick={() => void navigator.clipboard?.writeText(selected)}
          >
            <Copy className="size-3" />
          </Button>
          {token.twitter ? (
            <a href={token.twitter} target="_blank" rel="noreferrer" className="text-2xs text-cyan">
              X
            </a>
          ) : null}
          {token.telegram ? (
            <a href={token.telegram} target="_blank" rel="noreferrer" className="text-2xs text-cyan">
              TG
            </a>
          ) : null}
          {token.website ? (
            <a href={token.website} target="_blank" rel="noreferrer" className="text-2xs text-cyan">
              Web
            </a>
          ) : null}
          <a
            href={`/intel/scan?ca=${encodeURIComponent(selected)}`}
            className="ml-auto inline-flex items-center gap-1 text-2xs text-cyan"
          >
            Intel <ExternalLink className="size-3" />
          </a>
        </div>

        {buyers.length > 0 ? (
          <section className="border-b border-line px-3 py-2.5">
            <h3 className="ox-kicker mb-2 text-fg">Observed wallets</h3>
            <ul className="space-y-1.5">
              {buyers.map((b) => (
                <li key={b.wallet || b.token_ca} className="flex items-center justify-between text-2xs">
                  <span className="font-mono text-muted">{formatAddress(b.wallet || "")}</span>
                  <span className="ox-stat text-fg">{formatUsd(b.bought_usd ?? null)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="border-b border-line px-3 py-2.5">
          <h3 className="ox-kicker mb-2 text-fg">KOL interactions</h3>
          {kolHits.length === 0 ? (
            <p className="text-2xs text-dim">No assigned KOL hits indexed for this mint yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {kolHits.map((e) => (
                <li key={e.event_id} className="text-2xs">
                  <p className="text-fg">
                    {e.wallet_label || formatAddress(e.wallet)} · {e.event_type.replace(/_/g, " ")}
                  </p>
                  <p className="text-dim">
                    {clock(e.block_time)}
                    {e.usd_value != null ? ` · ${formatUsd(e.usd_value)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border-b border-line px-3 py-2.5">
          <h3 className="ox-kicker mb-2 text-fg">Large indexed txs</h3>
          {large.length === 0 ? (
            <p className="text-2xs text-dim">No whale-flagged or large-value rows in the live window.</p>
          ) : (
            <ul className="space-y-1.5">
              {large.map((e) => (
                <li key={e.event_id} className="text-2xs">
                  <p className="text-fg">{e.event_type.replace(/_/g, " ")}</p>
                  <p className="text-dim">
                    {formatAddress(e.wallet)}
                    {e.usd_value != null ? ` · ${formatUsd(e.usd_value)}` : e.sol_amount != null ? ` · ${e.sol_amount} SOL` : ""}
                    {` · ${clock(e.block_time)}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="px-3 py-2.5">
          <h3 className="ox-kicker mb-2 text-fg">Recent activity</h3>
          {related.length === 0 ? (
            <p className="text-2xs text-dim">
              No indexed movement for this mint yet. The galaxy still places it from today's volume rank
              {districts.window ? ` (${districts.window})` : ""}.
            </p>
          ) : (
            <ul className="space-y-2">
              {related.map((e) => (
                <li key={e.event_id} className="text-2xs">
                  <p className="text-fg">{e.event_type.replace(/_/g, " ")}</p>
                  <p className="text-dim">
                    {e.wallet_label || formatAddress(e.wallet)}
                    {e.amount != null ? ` · ${e.amount}` : e.sol_amount != null ? ` · ${e.sol_amount} SOL` : ""}
                    {` · ${clock(e.block_time)}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg-panel px-3 py-2">
      <dt className="ox-kicker">{label}</dt>
      <dd className="ox-stat mt-0.5 text-xs text-fg">{value}</dd>
    </div>
  );
}
