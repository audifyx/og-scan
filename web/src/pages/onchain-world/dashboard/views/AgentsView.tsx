import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Copy, Crosshair, ExternalLink } from "lucide-react";
import {
  fetchAgents,
  fetchLiveDesk,
  type LiveDeskPayload,
  type PaperAgent,
  type PaperDeskPayload,
  type PaperFill,
} from "@/pages/onchain-world/api";
import { formatAddress, formatPct, formatUsd } from "@/pages/onchain-world/lib/orbitx/format";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";
import { simulatePaperDesk } from "../../../../../shared/orbitx-paper-desk.js";
import { LIVE_AGENTS, LIVE_WALLET_PUBKEY } from "../../../../../shared/orbitx-live-desk.js";
import { LiveAgentFeed } from "./LiveAgentFeed";
import { LiveAgentCity } from "./LiveAgentCity";

export function AgentsView() {
  const [desk, setDesk] = useState<"paper" | "live">("live");
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-black">
      <div className="flex shrink-0 gap-1 border-b border-line px-4 py-2">
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-2xs font-semibold uppercase tracking-wide ${desk === "live" ? "bg-fg text-bg" : "text-dim hover:text-fg"}`}
          onClick={() => setDesk("live")}
        >
          Live SOL
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-2xs font-semibold uppercase tracking-wide ${desk === "paper" ? "bg-fg text-bg" : "text-dim hover:text-fg"}`}
          onClick={() => setDesk("paper")}
        >
          Paper 10k
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {desk === "live" ? <LiveDeskView /> : <PaperDeskView />}
      </div>
    </div>
  );
}

function LiveDeskView() {
  const nav = useNavigate();
  const selectToken = useOrbitxStore((s) => s.selectToken);
  const setCam = useOrbitxStore((s) => s.setCamCommand);
  const setView = useOrbitxStore((s) => s.setActiveView);
  const [snap, setSnap] = useState<LiveDeskPayload | null>(null);
  const [copied, setCopied] = useState(false);
  const [tapeFilter, setTapeFilter] = useState<"all" | "buy" | "sell" | "skip" | "swap">("all");
  const [now, setNow] = useState(() => Date.now());
  const [pane, setPane] = useState<"desk" | "feed" | "city">("feed");

  useEffect(() => {
    let alive = true;
    const pull = () => {
      void fetchLiveDesk()
        .then((data) => {
          if (alive && data) setSnap(data);
        })
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 4_000);
    const clock = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.clearInterval(clock);
    };
  }, []);

  const wallet = snap?.wallet || LIVE_WALLET_PUBKEY;
  const open = snap?.open || [];
  const fills = snap?.fills || [];
  const agents = snap?.agents?.length ? snap.agents : LIVE_AGENTS;
  const ledger = snap?.ledger;
  const clip = snap?.trade_usd ?? 1.5;
  const startedUsd = ledger?.started_usd ?? snap?.starting_usd;
  const nowUsd = ledger?.currently_usd ?? snap?.equity_usd ?? snap?.usd_balance;
  const madeUsd = ledger?.made_usd;
  const wins = ledger?.wins ?? 0;
  const losses = ledger?.losses ?? 0;
  const holding = ledger?.holding || open[0] || null;
  const feed = (snap?.feed || []).length ? snap.feed : [];
  const tickAgo = snap?.last_tick_at ? Math.max(0, now - Date.parse(snap.last_tick_at)) : null;
  const tickLabel =
    tickAgo == null
      ? "no tick yet"
      : tickAgo < 60_000
        ? `${Math.floor(tickAgo / 1000)}s ago`
        : `${Math.floor(tickAgo / 60_000)}m ${Math.floor((tickAgo % 60_000) / 1000)}s ago`;
  const visibleFeed = feed.filter((row) => {
    if (tapeFilter === "all") return true;
    if (tapeFilter === "buy") return row.kind === "buy";
    if (tapeFilter === "sell") return row.kind === "sell";
    if (tapeFilter === "skip") return row.kind === "skip" || row.kind === "tick";
    if (tapeFilter === "swap") return row.kind === "swap" || row.source === "chain";
    return true;
  });

  function openMint(mint?: string | null) {
    if (!mint) return;
    selectToken(mint);
    setCam({ kind: "token", mint });
    setView("world");
    nav(`/on-chain/token/${mint}`);
  }

  async function copyWallet() {
    try {
      await navigator.clipboard.writeText(wallet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  const status = !snap?.configured
    ? "Wallet secret not on the server yet — set LIVE_AGENT_WALLET_SECRET on Vercel to start fills"
    : !snap.enabled
      ? "Waiting on LIVE_AGENT_ENABLED=1"
      : snap.paused
        ? "Paused"
        : snap.armed
          ? `LIVE · $${clip.toFixed(2)} clips · max 1 open · last tick ${tickLabel}`
          : "Funded wallet waiting to arm";

  function money(n: number | null | undefined, sign = false) {
    if (n == null || Number.isNaN(Number(n))) return "—";
    const v = Number(n);
    const body = formatUsd(Math.abs(v));
    if (!sign) return v < 0 ? `-${body}` : body;
    return `${v >= 0 ? "+" : "-"}${body}`;
  }

  const paneTabs = (
    <div className="flex gap-1 border-b border-line px-4 py-2">
      {(["feed", "city", "desk"] as const).map((key) => (
        <button
          key={key}
          type="button"
          className={`rounded-full px-3 py-1 text-2xs font-semibold uppercase tracking-wide ${
            pane === key ? "bg-fg text-bg" : "text-dim hover:text-fg"
          }`}
          onClick={() => setPane(key)}
        >
          {key === "feed" ? "Feed" : key === "city" ? "City" : "Desk"}
        </button>
      ))}
    </div>
  );

  if (pane === "feed") {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {paneTabs}
        <LiveAgentFeed snap={snap} now={now} />
      </div>
    );
  }
  if (pane === "city") {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {paneTabs}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <LiveAgentCity snap={snap} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {paneTabs}
      <div className="ox-scroll min-h-0 flex-1 overflow-auto">
      <header className="border-b border-line px-4 py-3">
        <p className="ox-kicker text-accent">Live desk · real SOL</p>
        <h2 className="font-display text-lg text-fg">${clip.toFixed(2)} clips · one book at a time</h2>
        <p className="mt-1 max-w-3xl text-2xs text-muted">
          Three agents share one Solana wallet. Each fill is ${clip.toFixed(2)}. Max one open position. They research
          every 5 minutes, hunt low-cap trending coins with real social/community tape — not paid boosts — then take
          profit around +$0.30 (or +$1 if it rips). High-MC names are too late for this book. Jupiter must be able to
          sell. Not financial advice — this bank can go to zero.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-line bg-bg-sunken px-3 py-2">
          <span className="text-2xs text-dim">Deposit</span>
          <code className="text-2xs text-fg">{wallet}</code>
          <button type="button" className="text-dim hover:text-fg" onClick={() => void copyWallet()} aria-label="Copy wallet">
            <Copy className="size-3.5" />
          </button>
          {copied ? <span className="text-2xs text-live">copied</span> : null}
          <a
            className="ml-auto inline-flex items-center gap-1 text-2xs text-muted hover:text-fg"
            href={snap?.fundUrl || `https://solscan.io/account/${wallet}`}
            target="_blank"
            rel="noreferrer"
          >
            Solscan <ExternalLink className="size-3" />
          </a>
        </div>
        <p className="mt-2 text-2xs text-accent">{status}</p>
        <dl className="mt-3 grid grid-cols-2 gap-px bg-line sm:grid-cols-4 lg:grid-cols-8">
          <Stat label="Started" value={money(startedUsd)} />
          <Stat label="Now" value={money(nowUsd)} />
          <Stat
            label="Made"
            value={madeUsd != null ? money(madeUsd, true) : "—"}
            tone={madeUsd == null ? undefined : madeUsd >= 0 ? "up" : "down"}
          />
          <Stat label="Wins / losses" value={`${wins}W / ${losses}L`} />
          <Stat label="SOL cash" value={snap?.sol_balance != null ? snap.sol_balance.toFixed(4) : "—"} />
          <Stat label="Holding" value={holding ? `$${holding.symbol}` : "cash"} />
          <Stat label="Open" value={`${open.length}/${snap?.max_open ?? 1}`} />
          <Stat label="Clip" value={`$${clip.toFixed(2)}`} />
        </dl>
      </header>

      {holding ? (
        <div className="border-b border-line px-4 py-2">
          <p className="ox-kicker mb-1.5">Currently holding</p>
          <button
            type="button"
            className="w-full rounded-md border border-line bg-bg-sunken px-3 py-2 text-left hover:bg-bg-hover"
            onClick={() => openMint(holding.mint)}
          >
            <p className="text-xs text-fg">
              ${holding.symbol} · {holding.agent_name || holding.agent_id} · in {money(holding.usd_in)}
              {holding.pnl_pct != null ? ` · ${holding.pnl_pct >= 0 ? "+" : ""}${holding.pnl_pct.toFixed(1)}%` : ""}
              {holding.tp_pct != null ? ` · TP +${Number(holding.tp_pct).toFixed(0)}%` : ""}
            </p>
            <p className="mt-1 text-2xs leading-relaxed text-muted">{holding.thesis}</p>
          </button>
        </div>
      ) : (
        <p className="border-b border-line px-4 py-3 text-2xs text-dim">
          No open live book. Next armed tick buys one ${clip.toFixed(2)} clip if Jupiter can sell. Ticks run every 5
          minutes.
        </p>
      )}

      <section className="border-b border-line px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="ox-kicker text-accent">Live tape · thesis · buys · sells · swaps</p>
          <p className="text-[10px] uppercase tracking-wide text-dim">
            poll 4s · last tick {tickLabel} · {feed.length} rows
          </p>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {(["all", "buy", "sell", "skip", "swap"] as const).map((key) => (
            <button
              key={key}
              type="button"
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                tapeFilter === key ? "bg-fg text-bg" : "text-dim hover:text-fg"
              }`}
              onClick={() => setTapeFilter(key)}
            >
              {key}
            </button>
          ))}
        </div>
        {visibleFeed.length ? (
          <ol className="mt-2 max-h-72 space-y-1 overflow-auto">
            {visibleFeed.slice(0, 40).map((row) => (
              <li key={row.id} className="rounded-sm border border-line/80 bg-bg-sunken px-2 py-1.5">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="min-w-0 truncate text-left text-2xs text-fg hover:text-accent"
                    onClick={() => openMint(row.mint)}
                  >
                    <span className="text-dim">
                      {row.at ? new Date(row.at).toISOString().slice(11, 19) : "--:--:--"} UTC
                    </span>
                    {" · "}
                    {(row.kind || "").toUpperCase()}
                    {row.symbol ? ` · $${row.symbol}` : ""}
                    {row.agent_id ? ` · ${row.agent_id}` : ""}
                    {row.usd != null ? ` · ${money(row.usd)}` : ""}
                    {row.pnl_usd != null ? ` · ${money(row.pnl_usd, true)}` : ""}
                  </button>
                  {row.signature ? (
                    <a
                      className="shrink-0 text-[10px] text-dim hover:text-fg"
                      href={`https://solscan.io/tx/${row.signature}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      tx
                    </a>
                  ) : null}
                </div>
                {row.thesis ? <p className="mt-1 text-2xs leading-relaxed text-muted">{row.thesis}</p> : null}
                {row.reason && row.reason !== row.kind ? (
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-dim">{row.reason}</p>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-2xs text-dim">
            Tape is empty until the next armed tick. Buys, sells, skip reasons, theses, and on-chain swaps land here.
          </p>
        )}
      </section>

      <ul className="divide-y divide-line">
        {agents.map((a, i) => (
          <li key={a.id} className="px-4 py-3">
            <div className="flex items-start gap-3">
              <span
                className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full"
                style={{ background: `${a.color}22`, color: a.color }}
              >
                <Bot className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-sm text-fg">
                    <span className="mr-2 text-2xs text-dim">#{i + 1}</span>
                    {a.name}
                  </h3>
                  <p className={`ox-stat text-xs ${(a.made_usd || 0) >= 0 ? "text-live" : "text-muted"}`}>
                    {money(a.made_usd, true)} made
                  </p>
                </div>
                <p className="text-2xs text-dim">
                  Hold {a.currently_hold || (a.open ? `$${a.open.symbol}` : "cash")} · {a.wins ?? 0}W / {a.losses ?? 0}L
                  {a.trades ? ` · ${Number(a.win_pct || 0).toFixed(0)}% hit` : ""} · take ~$0.30 · ${clip.toFixed(2)} clips
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
                  <Stat label="Currently hold" value={a.currently_hold || "cash"} />
                  <Stat
                    label="Unrealized"
                    value={a.unrealized_pnl_usd != null ? money(a.unrealized_pnl_usd, true) : "—"}
                    tone={(a.unrealized_pnl_usd || 0) >= 0 ? "up" : "down"}
                  />
                  <Stat
                    label="Realized"
                    value={a.realized_pnl_usd != null ? money(a.realized_pnl_usd, true) : "—"}
                    tone={(a.realized_pnl_usd || 0) >= 0 ? "up" : "down"}
                  />
                  <Stat label="Deployed" value={money(a.deployed_usd)} />
                </dl>
                <p className="mt-2 text-2xs text-dim">{a.blurb}</p>
                {a.open ? (
                  <button
                    type="button"
                    className="mt-2 w-full rounded-md border border-line bg-bg-sunken px-3 py-2 text-left hover:bg-bg-hover"
                    onClick={() => openMint(a.open?.mint)}
                  >
                    <p className="ox-kicker text-accent">Open book</p>
                    <p className="mt-0.5 text-xs text-fg">
                      ${a.open.symbol} · {money(a.open.usd_in)}
                      {a.open.pnl_pct != null ? ` · ${a.open.pnl_pct >= 0 ? "+" : ""}${a.open.pnl_pct.toFixed(1)}%` : ""}
                    </p>
                    <p className="mt-1 text-2xs leading-relaxed text-muted">{a.open.thesis}</p>
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {fills.length ? (
        <ol className="border-t border-line px-4 py-3 space-y-1">
          <p className="ox-kicker mb-1">Fills</p>
          {fills.slice(0, 12).map((f) => (
            <li key={f.id || `${f.signature}-${f.created_at}`} className="flex justify-between gap-2 text-2xs">
              <button type="button" className="truncate text-left text-muted hover:text-fg" onClick={() => openMint(f.mint)}>
                {(f.side || "").toUpperCase()} · ${f.symbol} · {f.reason || ""}
              </button>
              <span className={Number(f.pnl_usd || 0) >= 0 ? "text-fg" : "text-dim"}>
                {f.pnl_usd != null ? `${Number(f.pnl_usd) >= 0 ? "+" : ""}${formatUsd(f.pnl_usd)}` : formatUsd(f.usd_amount)}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      <p className="px-4 py-3 text-2xs text-dim">{snap?.disclaimer || "Not financial advice."}</p>
      </div>
    </div>
  );
}

function PaperDeskView() {
  const nav = useNavigate();
  const tokens = useOrbitxStore((s) => s.city.districts.tokens || []);
  const orbitx = useOrbitxStore((s) => s.city.districts.orbitx);
  const kols = useOrbitxStore((s) => s.city.kols);
  const selectToken = useOrbitxStore((s) => s.selectToken);
  const setCam = useOrbitxStore((s) => s.setCamCommand);
  const setView = useOrbitxStore((s) => s.setActiveView);
  const local = useMemo(
    () => simulatePaperDesk([orbitx, ...tokens].filter(Boolean), { kols, now: Date.now() }),
    [tokens, orbitx, kols],
  );
  const [remote, setRemote] = useState<PaperDeskPayload | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    const pull = () => {
      void fetchAgents()
        .then((data) => {
          if (alive && data?.ok && data.agents?.length) setRemote(data);
        })
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 60_000);
    const clock = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.clearInterval(clock);
    };
  }, []);

  const desk = remote?.agents?.length ? remote : local;
  const agents = desk.agents || [];
  const buying = agents.filter((a) => a.live?.mint);
  const remainMs = desk.next_hour_at ? Math.max(0, Date.parse(desk.next_hour_at) - now) : 0;
  const remain = `${String(Math.floor(remainMs / 60000)).padStart(2, "0")}:${String(Math.floor((remainMs % 60000) / 1000)).padStart(2, "0")}`;

  function openMint(mint?: string | null) {
    if (!mint) return;
    selectToken(mint);
    setCam({ kind: "token", mint });
    setView("world");
    nav(`/on-chain/token/${mint}`);
  }

  return (
    <div className="ox-scroll min-h-0 flex-1 overflow-auto">
      <header className="border-b border-line px-4 py-3">
        <p className="ox-kicker text-accent">Paper desk · mock SOL</p>
        <h2 className="font-display text-lg text-fg">10k mock SOL agent network</h2>
        <p className="mt-1 max-w-3xl text-2xs text-muted">
          Ten autonomous books, 10,000 virtual SOL each. Size, win rate, and P&amp;L come from the real 1h/24h tape
          on live coins. The hour book rebalances every UTC hour. Nothing here can withdraw.
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-px bg-line sm:grid-cols-5">
          <Stat label="Desk equity" value={`${(desk.desk_equity_sol || 0).toFixed(1)} SOL`} />
          <Stat
            label="Desk P&L"
            value={`${(desk.desk_pnl_sol || 0) >= 0 ? "+" : ""}${(desk.desk_pnl_sol || 0).toFixed(1)}`}
          />
          <Stat label="Agents" value={String(desk.agent_count || agents.length)} />
          <Stat label="Live books" value={String(buying.length)} />
          <Stat label="Next hour" value={remain} />
        </dl>
      </header>

      {buying.length ? (
        <div className="border-b border-line px-4 py-2">
          <p className="ox-kicker mb-1.5">Currently buying</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {buying.map((a) => (
              <button
                key={a.id}
                type="button"
                className="flex min-w-[11.5rem] items-center gap-2 rounded-full border border-line bg-bg-sunken px-2.5 py-1.5 text-left hover:bg-bg-hover"
                onClick={() => openMint(a.live?.mint)}
              >
                {a.live?.image ? (
                  <img src={a.live.image} alt="" className="size-5 rounded-full object-cover" />
                ) : (
                  <span className="size-5 rounded-full border border-line" />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-2xs text-fg">${a.live?.symbol}</span>
                  <span className="block truncate text-[10px] text-dim">
                    {a.name} · {a.live?.sol.toFixed(0)} SOL
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <ul className="divide-y divide-line">
        {agents.map((a, i) => (
          <AgentCard key={a.id} agent={a} rank={i + 1} onOpen={openMint} />
        ))}
      </ul>
      <p className="px-4 py-3 text-2xs text-dim">
        Mock fills never broadcast. Ids: {agents.map((a) => a.id).join(" · ") || "—"} · last mint{" "}
        {formatAddress(agents[0]?.live?.mint || "")}.
      </p>
    </div>
  );
}

function AgentCard({
  agent: a,
  rank,
  onOpen,
}: {
  agent: PaperAgent;
  rank: number;
  onOpen: (mint?: string | null) => void;
}) {
  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: `${a.color}22`, color: a.color }}
        >
          <Bot className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-sm text-fg">
              <span className="mr-2 text-2xs text-dim">#{rank}</span>
              {a.name}
            </h3>
            <p className={`ox-stat text-xs ${a.pnl_sol >= 0 ? "text-live" : "text-muted"}`}>
              {a.equity_sol.toFixed(1)} SOL · {a.pnl_sol >= 0 ? "+" : ""}
              {a.pnl_pct.toFixed(1)}%
            </p>
          </div>
          <p className="text-2xs text-dim">
            {a.blurb} · {a.wins}W / {a.losses}L · {a.win_pct.toFixed(0)}% hit · {a.style.replace(/_/g, " ")} · 10,000
            mock SOL start
          </p>
          <Spark fills={a.fills || []} up={a.pnl_sol >= 0} />
          {a.live ? (
            <button
              type="button"
              className="mt-2 w-full rounded-md border border-line bg-bg-sunken px-3 py-2 text-left hover:bg-bg-hover"
              onClick={() => onOpen(a.live?.mint)}
            >
              <p className="ox-kicker text-accent">Currently buying</p>
              <p className="mt-0.5 flex items-center gap-2 text-xs text-fg">
                {a.live.image ? (
                  <img src={a.live.image} alt="" className="size-5 rounded-full object-cover" />
                ) : null}
                ${a.live.symbol} · {a.live.sol.toFixed(1)} mock SOL
                {a.live.change_1h != null ? ` · ${formatPct(a.live.change_1h)} 1h` : ""}
                {a.live.volume_24h != null ? ` · ${formatUsd(a.live.volume_24h)} vol` : ""}
              </p>
              <p className="mt-1 text-2xs leading-relaxed text-muted">{a.live.thesis}</p>
            </button>
          ) : (
            <p className="mt-2 text-2xs text-dim">Waiting for a live catalog to size the next hour.</p>
          )}
          {a.fills?.length ? (
            <ol className="mt-2 space-y-1">
              {a.fills.slice(0, 6).map((f) => (
                <li key={`${a.id}-${f.hour}`} className="flex items-center justify-between gap-2 text-2xs">
                  <button
                    type="button"
                    className="truncate text-left text-muted hover:text-fg"
                    onClick={() => onOpen(f.mint)}
                  >
                    {f.current ? "NOW" : new Date(f.at).toISOString().slice(11, 16)} · ${f.symbol} · {f.sol.toFixed(1)}{" "}
                    SOL
                  </button>
                  <span className={f.pnl_sol >= 0 ? "text-fg" : "text-dim"}>
                    {f.pnl_sol >= 0 ? "+" : ""}
                    {f.pnl_sol.toFixed(2)}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
        {a.live?.mint ? (
          <button
            type="button"
            className="text-dim hover:text-fg"
            aria-label="Focus token"
            onClick={() => onOpen(a.live?.mint)}
          >
            <Crosshair className="size-3.5" />
          </button>
        ) : null}
      </div>
    </li>
  );
}

function Spark({ fills, up }: { fills: PaperFill[]; up: boolean }) {
  if (fills.length < 2) return null;
  const chrono = [...fills].reverse();
  const pts = chrono.map((f) => f.pnl_sol);
  const min = Math.min(0, ...pts);
  const max = Math.max(0, ...pts);
  const span = max - min || 1;
  const d = pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * 100;
      const y = 18 - ((v - min) / span) * 16;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 20" className="mt-1.5 h-5 w-full" aria-hidden>
      <path d={d} fill="none" stroke={up ? "#f5f5f5" : "#737373"} strokeWidth="1.4" />
    </svg>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="bg-bg-panel px-3 py-2">
      <dt className="ox-kicker">{label}</dt>
      <dd
        className={`ox-stat mt-0.5 text-xs ${
          tone === "up" ? "text-live" : tone === "down" ? "text-muted" : "text-fg"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
