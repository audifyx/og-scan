import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Crosshair } from "lucide-react";
import { fetchAgents, type PaperAgent, type PaperDeskPayload, type PaperFill } from "@/pages/onchain-world/api";
import { formatAddress, formatPct, formatUsd } from "@/pages/onchain-world/lib/orbitx/format";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";
import { simulatePaperDesk } from "../../../../../shared/orbitx-paper-desk.js";

export function AgentsView() {
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
    <div className="ox-scroll min-h-0 flex-1 overflow-auto bg-black">
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg-panel px-3 py-2">
      <dt className="ox-kicker">{label}</dt>
      <dd className="ox-stat mt-0.5 text-xs text-fg">{value}</dd>
    </div>
  );
}
