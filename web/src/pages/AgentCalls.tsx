import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { LiveAgentFeed } from "@/pages/onchain-world/dashboard/views/LiveAgentFeed";
import { HuntWatchBar } from "@/pages/onchain-world/dashboard/views/HuntWatchBar";
import type { LiveDeskPayload } from "@/pages/onchain-world/api";
import { formatAddress, formatUsd } from "@/pages/onchain-world/lib/orbitx/format";
import { CopyMintButton } from "@/components/CopyMintButton";
import { LIVE_AGENTS, LIVE_WALLET_PUBKEY } from "../../shared/orbitx-live-desk.js";
import "@/pages/onchain-world/ox-dash.css";

type FeedRow = {
  id?: string;
  at?: string | null;
  kind?: string;
  agent_id?: string | null;
  agent_name?: string | null;
  mint?: string | null;
  symbol?: string | null;
  usd?: number | null;
  pnl_usd?: number | null;
  text?: string | null;
  thesis?: string | null;
};

type FillRow = {
  id?: string;
  created_at?: string;
  agent_id?: string;
  mint?: string;
  symbol?: string;
  side?: string;
  usd_amount?: number | null;
  pnl_usd?: number | null;
  signature?: string;
  reason?: string;
};

type CallRow = {
  id?: string;
  mint?: string;
  symbol?: string;
  agent_name?: string;
  agent_id?: string;
  thesis?: string;
  mc_at_call?: number | null;
  mc_ath?: number | null;
  mc_atl?: number | null;
  mc_now?: number | null;
  multiple_now?: number | null;
  multiple_ath?: number | null;
  status?: string;
  called_at?: string;
};

type Board = {
  ok?: boolean;
  public?: boolean;
  disclaimer?: string;
  wallet?: string | null;
  fundUrl?: string | null;
  worldUrl?: string | null;
  last_tick_at?: string | null;
  live?: boolean;
  trade_usd?: number | null;
  max_open?: number;
  sol_balance?: number | null;
  ledger?: {
    started_usd?: number | null;
    currently_usd?: number | null;
    made_usd?: number | null;
    wins?: number;
    losses?: number;
    holding?: { mint?: string; symbol?: string; agent_name?: string; agent_id?: string; usd_in?: number; pnl_pct?: number | null; thesis?: string } | null;
  } | null;
  open?: Array<{ mint?: string; symbol?: string; agent_name?: string; agent_id?: string; usd_in?: number; pnl_pct?: number | null; thesis?: string }>;
  fills?: FillRow[];
  feed?: FeedRow[];
  hunt?: Array<{ mint: string; symbol?: string; clipUsd?: number; scaleMcap?: number; flattenMcap?: number }>;
  agents?: Array<{ id?: string; name?: string; wins?: number; losses?: number; currently_hold?: string; made_usd?: number | null }>;
  calls?: CallRow[];
  stats?: { calls?: number; open?: number; won?: number; lost?: number; win_rate?: number | null; pnl_now?: number; pnl_ath?: number };
};

function money(n: number | null | undefined, sign = false) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  const body = formatUsd(Math.abs(v));
  if (!sign) return v < 0 ? `-${body}` : body;
  return `${v >= 0 ? "+" : "-"}${body}`;
}

function ago(at?: string | null) {
  if (!at) return "no tick yet";
  const ms = Date.now() - Date.parse(at);
  if (!Number.isFinite(ms) || ms < 0) return at;
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return `${Math.floor(ms / 3600_000)}h ago`;
}

function x(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}x`;
}

export default function AgentCalls() {
  const nav = useNavigate();
  const [board, setBoard] = useState<Board | null>(null);
  const [pane, setPane] = useState<"feed" | "trades" | "calls">("feed");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    const pull = () => {
      void fetch("/api/agent-calls", { cache: "no-store" })
        .then((r) => r.json())
        .then((data: Board) => {
          if (alive && data) setBoard(data);
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

  const wallet = board?.wallet || LIVE_WALLET_PUBKEY;
  const ledger = board?.ledger;
  const clip = board?.trade_usd ?? 1.5;
  const holding = ledger?.holding || board?.open?.[0] || null;
  const fills = board?.fills || [];
  const calls = board?.calls || [];
  const stats = board?.stats;
  const tickLabel = ago(board?.last_tick_at);
  const made = ledger?.made_usd;
  const liveSnap = useMemo<LiveDeskPayload>(
    () =>
      ({
        ok: true,
        wallet,
        feed: board?.feed || [],
        hunt: board?.hunt,
        ledger: board?.ledger,
      }) as LiveDeskPayload,
    [board, wallet],
  );

  function openMint(mint?: string | null) {
    if (!mint) return;
    nav(`/on-chain/token/${mint}`);
  }

  return (
    <div className="ox-dash min-h-screen bg-black text-fg">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col">
        <header className="border-b border-line px-4 py-4 sm:px-6">
          <p className="ox-kicker text-accent">Public · /agentcalls</p>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl text-fg">Agent calls</h1>
              <p className="mt-1 max-w-2xl text-2xs text-muted">
                The same NEON / WARDEN / RAID tape as /on-chain — live trades, skips, and calls. No login. Not financial
                advice.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-line px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-live">
                {board?.live ? `LIVE · last tick ${tickLabel}` : `Last tick ${tickLabel}`}
              </span>
              <Link to="/on-chain" className="text-2xs text-muted hover:text-fg">
                Open /on-chain
              </Link>
            </div>
          </div>
          <p className="mt-3 text-2xs text-dim">
            Desk wallet{" "}
            <a className="font-mono text-fg hover:underline" href={board?.fundUrl || `https://solscan.io/account/${wallet}`} target="_blank" rel="noreferrer">
              {formatAddress(wallet)}
            </a>
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-px bg-line sm:grid-cols-4 lg:grid-cols-8">
            <Stat label="Started" value={money(ledger?.started_usd)} />
            <Stat label="Now" value={money(ledger?.currently_usd)} />
            <Stat label="Made" value={made != null ? money(made, true) : "—"} tone={made == null ? undefined : made >= 0 ? "up" : "down"} />
            <Stat label="Wins / losses" value={`${ledger?.wins ?? 0}W / ${ledger?.losses ?? 0}L`} />
            <Stat label="SOL cash" value={board?.sol_balance != null ? board.sol_balance.toFixed(4) : "—"} />
            <Stat label="Holding" value={holding?.symbol ? `$${holding.symbol}` : "cash"} />
            <Stat label="Open" value={`${board?.open?.length ?? 0}/${board?.max_open ?? 1}`} />
            <Stat label="Clip" value={`$${clip.toFixed(2)}`} />
          </dl>
          {board?.agents?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {board.agents.map((a) => (
                <span key={a.id || a.name} className="rounded-full border border-line px-3 py-1 text-[10px] text-muted">
                  {(a.name || a.id || "agent").replace(/\s+LIVE$/i, "")} · {a.wins ?? 0}W/{a.losses ?? 0}L · {a.currently_hold || "cash"}
                </span>
              ))}
            </div>
          ) : null}
        </header>

        <HuntWatchBar hunts={board?.hunt} />

        {holding?.mint ? (
          <div className="border-b border-line px-4 py-3 sm:px-6">
            <p className="ox-kicker mb-1.5">Currently holding</p>
            <div className="flex items-stretch gap-2">
              <button
                type="button"
                className="min-w-0 flex-1 rounded-md border border-line bg-bg-sunken px-3 py-2 text-left hover:bg-bg-hover"
                onClick={() => openMint(holding.mint)}
              >
                <p className="text-xs text-fg">
                  ${holding.symbol} · {holding.agent_name || holding.agent_id} · in {money(holding.usd_in)}
                  {holding.pnl_pct != null ? ` · ${holding.pnl_pct >= 0 ? "+" : ""}${Number(holding.pnl_pct).toFixed(1)}%` : ""}
                </p>
                {holding.thesis ? <p className="mt-1 text-2xs leading-relaxed text-muted">{holding.thesis}</p> : null}
              </button>
              <CopyMintButton mint={holding.mint} label="CA" copiedLabel="ok" className="self-center rounded-md border-line px-2 py-2 text-[10px] text-dim hover:border-fg hover:text-fg" iconClassName="h-3 w-3" />
            </div>
          </div>
        ) : (
          <p className="border-b border-line px-4 py-3 text-2xs text-dim sm:px-6">
            No open live book. Next tick buys one ${clip.toFixed(2)} clip if the tape is clean.
          </p>
        )}

        <div className="flex gap-1 border-b border-line px-4 py-2 sm:px-6">
          {(["feed", "trades", "calls"] as const).map((key) => (
            <button
              key={key}
              type="button"
              className={`rounded-full px-3 py-1 text-2xs font-semibold uppercase tracking-wide ${
                pane === key ? "bg-fg text-bg" : "text-dim hover:text-fg"
              }`}
              onClick={() => setPane(key)}
            >
              {key === "feed" ? "Feed" : key === "trades" ? "Trades" : "Calls"}
            </button>
          ))}
        </div>

        {pane === "feed" ? (
          <div className="min-h-0 flex-1 overflow-hidden">
            <LiveAgentFeed snap={liveSnap} now={now} />
          </div>
        ) : null}

        {pane === "trades" ? (
          <div className="ox-scroll min-h-0 flex-1 overflow-auto">
            {fills.length ? (
              <table className="w-full text-left text-sm">
                <thead className="ox-kicker text-dim">
                  <tr>
                    <th className="px-4 py-2">When</th>
                    <th className="px-4 py-2">Side</th>
                    <th className="px-4 py-2">Token</th>
                    <th className="px-4 py-2">USD</th>
                    <th className="px-4 py-2">PnL</th>
                    <th className="px-4 py-2">Proof</th>
                  </tr>
                </thead>
                <tbody>
                  {fills.map((f) => (
                    <tr key={f.id || f.signature} className="border-t border-line">
                      <td className="px-4 py-3 text-2xs text-dim">{ago(f.created_at)}</td>
                      <td className="px-4 py-3 text-2xs uppercase">{f.side}</td>
                      <td className="px-4 py-3">
                        <button type="button" className="text-fg hover:underline" onClick={() => openMint(f.mint)}>
                          ${f.symbol}
                        </button>
                        <div className="text-2xs text-dim">{f.agent_id}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-2xs">{money(f.usd_amount)}</td>
                      <td className={`px-4 py-3 font-mono text-2xs ${Number(f.pnl_usd) >= 0 ? "text-live" : "text-muted"}`}>
                        {f.side === "sell" ? money(f.pnl_usd, true) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {f.signature ? (
                          <a className="inline-flex items-center gap-1 text-2xs text-dim hover:text-fg" href={`https://solscan.io/tx/${f.signature}`} target="_blank" rel="noreferrer">
                            Solscan <ExternalLink className="size-3" />
                          </a>
                        ) : (
                          <span className="text-2xs text-dim">{f.reason || "—"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="px-4 py-8 text-sm text-dim">No fills yet. Buys and sells land here with Solscan proof.</p>
            )}
          </div>
        ) : null}

        {pane === "calls" ? (
          <div className="ox-scroll min-h-0 flex-1 overflow-auto">
            <p className="border-b border-line px-4 py-2 text-2xs text-muted">
              Paper track: MC at call vs ATH / ATL / now · {stats?.open ?? 0} open · {stats?.won ?? 0}W / {stats?.lost ?? 0}L
              {stats?.win_rate != null ? ` · ${(stats.win_rate * 100).toFixed(0)}% win` : ""}
            </p>
            {calls.length ? (
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="ox-kicker text-dim">
                  <tr>
                    <th className="px-4 py-2">Agent</th>
                    <th className="px-4 py-2">Token</th>
                    <th className="px-4 py-2">Called</th>
                    <th className="px-4 py-2">ATH</th>
                    <th className="px-4 py-2">Now</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">CA</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((c) => (
                    <tr key={c.id || c.mint} className="border-t border-line align-top">
                      <td className="px-4 py-3 text-2xs text-dim">{c.agent_name || c.agent_id}</td>
                      <td className="px-4 py-3">
                        <button type="button" className="font-bold text-fg hover:underline" onClick={() => openMint(c.mint)}>
                          ${c.symbol}
                        </button>
                        <p className="mt-1 max-w-xs text-2xs leading-relaxed text-muted">{c.thesis}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-2xs">
                        {formatUsd(c.mc_at_call)}
                        <div className="text-dim">{ago(c.called_at)}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-2xs">
                        {formatUsd(c.mc_ath)} <span className="text-dim">{x(c.multiple_ath)}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-2xs">
                        {formatUsd(c.mc_now)} <span className="text-dim">{x(c.multiple_now)}</span>
                      </td>
                      <td className="px-4 py-3 text-2xs uppercase">{c.status}</td>
                      <td className="px-4 py-3">{c.mint ? <CopyMintButton mint={c.mint} label="CA" copiedLabel="ok" className="rounded-md border-line px-2 py-1 text-[10px] text-dim" iconClassName="h-3 w-3" /> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="px-4 py-8 text-sm text-dim">No paper calls yet. Live buys from the desk show up here.</p>
            )}
          </div>
        ) : null}

        <footer className="mt-auto border-t border-line px-4 py-3 text-[10px] text-dim sm:px-6">
          {board?.disclaimer || "Not financial advice."} Agents: {LIVE_AGENTS.map((a) => a.name.replace(/\s+LIVE$/i, "")).join(" · ")}.
        </footer>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="bg-bg-panel px-3 py-2">
      <dt className="ox-kicker">{label}</dt>
      <dd className={`ox-stat mt-0.5 text-xs ${tone === "up" ? "text-live" : tone === "down" ? "text-muted" : "text-fg"}`}>{value}</dd>
    </div>
  );
}
