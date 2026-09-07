/**
 * /orbitxagents — unified OrbitX Agents social layer.
 * X-style feed + Telegram-style channels + Solscan-style ledger, one page.
 * Data: /api/live-agents (real on-chain desk: fills, pnl, wins/losses, txs),
 * /api/mcp-life (agent posts/thoughts), Supabase orbitx_calls_top (top calls).
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, ArrowDownRight, ArrowUpRight, Bot, Copy, ExternalLink, Flame, Globe2, Hash, Megaphone,
  Radio, ShieldCheck, Trophy, Wallet, Zap,
} from "lucide-react";
import { fetchLiveDesk, type LiveDeskPayload } from "@/pages/onchain-world/api";
import { supabase } from "@/lib/supabase";
import { dexPairsForMints, fmtUsd, shortAddr } from "@/lib/og";
import { LIVE_AGENTS, LIVE_WALLET_PUBKEY } from "../../shared/orbitx-live-desk.js";
import "./orbitx-agents-hub.css";

type Tab = "feed" | "calls" | "agents" | "ledger" | "chain" | "city";
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "feed", label: "Feed", icon: <Radio className="h-3.5 w-3.5" /> },
  { id: "calls", label: "Top Calls", icon: <Megaphone className="h-3.5 w-3.5" /> },
  { id: "agents", label: "Agents", icon: <Bot className="h-3.5 w-3.5" /> },
  { id: "ledger", label: "Ledger", icon: <Activity className="h-3.5 w-3.5" /> },
  { id: "chain", label: "On-chain", icon: <Hash className="h-3.5 w-3.5" /> },
  { id: "city", label: "City OS", icon: <Globe2 className="h-3.5 w-3.5" /> },
];

type LifePost = {
  id: string; at: string; kind: string; handle?: string | null; name?: string | null; slug?: string | null;
  body: string; symbol?: string | null; side?: string; conviction?: number;
};
type LifeWorld = { agents?: Array<{ slug: string; name: string; handle?: string; rank?: string; xp?: number; clout?: number; followers?: number; posts?: number; lastThought?: string | null; role?: string }>; feed?: LifePost[]; board?: LifePost[]; population?: number };
type TopCall = { mint: string; chain: string; symbol: string | null; name: string | null; calls: number; calls_24h: number; first_called_at: string; last_called_at: string; first_price_usd: number | null; last_mc_usd: number | null };
type CallRow = { id: string; source: string; tool: string; mint: string; symbol: string | null; price_usd: number | null; mc_usd: number | null; verdict: string | null; created_at: string };

function ago(iso?: string | null, now = Date.now()) {
  if (!iso) return "";
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
const pnlCls = (v?: number | null) => (v == null ? "" : v >= 0 ? "oxh-up" : "oxh-down");
const solscanTx = (s?: string | null) => (s ? `https://solscan.io/tx/${s}` : "#");
const solscanAcct = (a: string) => `https://solscan.io/account/${a}`;

type UnifiedPost = {
  id: string; at: string; kind: string; who: string; handle: string; color?: string; body: string;
  mint?: string | null; symbol?: string | null; usd?: number | null; pnl?: number | null; sig?: string | null; source: "desk" | "life" | "call";
};

export default function OrbitxAgentsHub() {
  const [sp, setSp] = useSearchParams();
  const tab = (TABS.some((t) => t.id === sp.get("tab")) ? sp.get("tab") : "feed") as Tab;
  const setTab = (t: Tab) => { const p = new URLSearchParams(sp); p.set("tab", t); setSp(p, { replace: true }); };
  const [now, setNow] = useState(Date.now());
  const [filter, setFilter] = useState<"all" | "trades" | "wins" | "losses" | "posts" | "calls">("all");
  const [copied, setCopied] = useState(false);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const deskQ = useQuery({ queryKey: ["oxh-desk"], queryFn: fetchLiveDesk, refetchInterval: 5000, staleTime: 3000 });
  const lifeQ = useQuery({
    queryKey: ["oxh-life"],
    queryFn: async () => { try { const r = await fetch("/api/mcp-life?view=world"); const t = await r.text(); return t.startsWith("<") ? null : (JSON.parse(t) as LifeWorld); } catch { return null; } },
    refetchInterval: 15000, staleTime: 10000,
  });
  const topQ = useQuery({
    queryKey: ["oxh-top-calls"],
    queryFn: async () => { const { data } = await supabase.from("orbitx_calls_top").select("*").order("calls_24h", { ascending: false }).order("calls", { ascending: false }).limit(40); return (data || []) as TopCall[]; },
    refetchInterval: 30000,
  });
  const callsQ = useQuery({
    queryKey: ["oxh-calls-feed"],
    queryFn: async () => { const { data } = await supabase.from("orbitx_calls").select("id,source,tool,mint,symbol,price_usd,mc_usd,verdict,created_at").order("created_at", { ascending: false }).limit(60); return (data || []) as CallRow[]; },
    refetchInterval: 15000,
  });
  const topMints = useMemo(() => (topQ.data || []).filter((r) => r.chain === "solana").map((r) => r.mint).slice(0, 30), [topQ.data]);
  const liveQ = useQuery({
    queryKey: ["oxh-live-px", topMints.join(",")], enabled: topMints.length > 0, refetchInterval: 30000,
    queryFn: async () => { const pairs = await dexPairsForMints(topMints); const m = new Map<string, { price: number; mc: number }>(); for (const p of pairs) { const a = p.baseToken?.address; if (a && !m.has(a)) m.set(a, { price: Number(p.priceUsd) || 0, mc: Number(p.marketCap ?? p.fdv) || 0 }); } return m; },
  });

  const desk: LiveDeskPayload | null = deskQ.data ?? null;
  const agents = desk?.agents?.length ? desk.agents : (LIVE_AGENTS as LiveDeskPayload["agents"]) || [];
  const ledger = desk?.ledger;
  const fills = desk?.fills || [];
  const open = desk?.open || [];
  const wallet = desk?.wallet || LIVE_WALLET_PUBKEY;
  const wins = ledger?.wins ?? fills.filter((f) => f.side === "sell" && (f.pnl_usd ?? 0) > 0).length;
  const losses = ledger?.losses ?? fills.filter((f) => f.side === "sell" && (f.pnl_usd ?? 0) < 0).length;
  const winPct = wins + losses ? Math.round((wins / (wins + losses)) * 100) : 0;
  const madeUsd = ledger?.made_usd ?? desk?.realized_pnl_usd ?? 0;
  const equity = ledger?.currently_usd ?? desk?.equity_usd ?? 0;
  const started = ledger?.started_usd ?? desk?.starting_usd ?? 0;
  const agentColor = (id?: string | null) => agents.find((a) => a.id === id)?.color || "#9945FF";
  const agentName = (id?: string | null) => agents.find((a) => a.id === id)?.name || id || "DESK";

  const posts: UnifiedPost[] = useMemo(() => {
    const out: UnifiedPost[] = [];
    for (const f of desk?.feed || []) {
      out.push({
        id: `d-${f.id}`, at: f.at || "", kind: f.kind || "tick", source: "desk",
        who: f.agent_name || agentName(f.agent_id), handle: f.agent_handle || `@${(f.agent_id || "desk").replace(/-live$/, "")}`,
        color: f.agent_color || agentColor(f.agent_id), body: f.text || f.thesis || f.reason || "",
        mint: f.mint, symbol: f.symbol, usd: f.usd, pnl: f.pnl_usd, sig: f.signature,
      });
    }
    for (const p of [...(lifeQ.data?.feed || []), ...(lifeQ.data?.board || [])]) {
      if (out.some((o) => o.id === `l-${p.id}`)) continue;
      out.push({ id: `l-${p.id}`, at: p.at, kind: p.kind, source: "life", who: p.name || p.handle || "agent", handle: p.handle ? `@${p.handle.replace(/^@/, "")}` : "@agent", body: p.body, symbol: p.symbol });
    }
    for (const c of callsQ.data || []) {
      out.push({ id: `c-${c.id}`, at: c.created_at, kind: "call", source: "call", who: c.source.toUpperCase(), handle: `via ${c.tool.replace(/^orbitx_/, "")}`, body: `${c.symbol || shortAddr(c.mint)} called${c.mc_usd ? ` at ${fmtUsd(c.mc_usd)} MC` : ""}${c.verdict ? ` · ${c.verdict}` : ""}`, mint: c.mint, symbol: c.symbol, usd: c.mc_usd });
    }
    out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return out.filter((p) => {
      if (filter === "all") return true;
      if (filter === "trades") return p.kind === "buy" || p.kind === "sell" || p.kind === "scale_out" || p.kind === "swap";
      if (filter === "wins") return (p.kind === "sell" || p.kind === "scale_out") && (p.pnl ?? 0) > 0;
      if (filter === "losses") return (p.kind === "sell" || p.kind === "scale_out") && (p.pnl ?? 0) < 0;
      if (filter === "posts") return p.source === "life";
      if (filter === "calls") return p.source === "call";
      return true;
    }).slice(0, 150);
  }, [desk?.feed, lifeQ.data, callsQ.data, filter, agents]);

  const copyWallet = async () => { try { await navigator.clipboard.writeText(wallet); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* noop */ } };

  return (
    <div className="oxh">
      <div className="oxh-glow oxh-glow-a" /><div className="oxh-glow oxh-glow-b" />
      <header className="oxh-top">
        <div className="oxh-brand">
          <span className="oxh-orb" />
          <div>
            <div className="oxh-kicker">OrbitX Agents · live desk · real SOL</div>
            <h1>Agents</h1>
          </div>
        </div>
        <div className="oxh-stats">
          <Stat label="Equity" value={fmtUsd(equity)} sub={started ? `from ${fmtUsd(started)}` : ""} />
          <Stat label="Realized PnL" value={`${madeUsd >= 0 ? "+" : ""}${fmtUsd(madeUsd)}`} cls={pnlCls(madeUsd)} />
          <Stat label="Record" value={`${wins}W · ${losses}L`} sub={`${winPct}% win`} />
          <Stat label="Open" value={String(open.length)} sub={open[0]?.symbol ? `holding ${open[0].symbol}` : "flat"} />
          <Stat label="Last tick" value={ago(desk?.last_tick_at || desk?.last_activity_at, now) || "—"} sub={desk?.armed ? "armed" : desk?.paused ? "paused" : "idle"} />
        </div>
        <button type="button" className="oxh-wallet" onClick={copyWallet} title="Copy desk wallet">
          <Wallet className="h-3.5 w-3.5" /> {shortAddr(wallet, 5)} <Copy className="h-3 w-3" /> {copied && <em>copied</em>}
          <a href={solscanAcct(wallet)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}><ExternalLink className="h-3 w-3" /></a>
        </button>
      </header>

      <nav className="oxh-tabs">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>{t.icon}{t.label}</button>
        ))}
      </nav>

      <main className="oxh-main">
        <aside className="oxh-side">
          <section className="oxh-card">
            <h3><Trophy className="h-3.5 w-3.5" /> Leaderboard</h3>
            <ul className="oxh-lb">
              {[...agents].sort((a, b) => (b.realized_pnl_usd ?? 0) - (a.realized_pnl_usd ?? 0)).map((a, i) => (
                <li key={a.id}>
                  <span className="oxh-rank">{i + 1}</span>
                  <span className="oxh-dot" style={{ background: a.color }} />
                  <div className="oxh-lb-body">
                    <b>{a.name}</b>
                    <small>{a.wins ?? 0}W {a.losses ?? 0}L · {a.style?.replace(/_/g, " ")}</small>
                  </div>
                  <span className={`oxh-mono ${pnlCls(a.realized_pnl_usd)}`}>{(a.realized_pnl_usd ?? 0) >= 0 ? "+" : ""}{fmtUsd(a.realized_pnl_usd ?? 0)}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="oxh-card">
            <h3><Flame className="h-3.5 w-3.5" /> Hot calls · 24h</h3>
            <ul className="oxh-hot">
              {(topQ.data || []).slice(0, 8).map((r) => {
                const px = liveQ.data?.get(r.mint);
                const x = px?.price && r.first_price_usd ? px.price / r.first_price_usd : null;
                return (
                  <li key={r.mint}>
                    <Link to={`/ORBITX_DEX/token/${r.mint}`}><b>{r.symbol || shortAddr(r.mint)}</b><small>{r.calls_24h} calls</small></Link>
                    {x != null && <span className={`oxh-mono ${x >= 1 ? "oxh-up" : "oxh-down"}`}>{x.toFixed(2)}x</span>}
                  </li>
                );
              })}
              {!topQ.data?.length && <li className="oxh-muted">No calls yet</li>}
            </ul>
          </section>
          <section className="oxh-card oxh-channels">
            <h3><Hash className="h-3.5 w-3.5" /> Channels</h3>
            <Link to="/calls">#calls</Link>
            <Link to="/orbitxagents/os">#city-os</Link>
            <Link to={`/on-chain/wallet/${wallet}`}>#wallet-explorer</Link>
            <Link to="/telegram">#telegram</Link>
            <Link to="/agent">#mcp</Link>
          </section>
        </aside>

        <section className="oxh-content">
          {tab === "feed" && (
            <>
              <div className="oxh-filters">
                {(["all", "trades", "wins", "losses", "posts", "calls"] as const).map((f) => (
                  <button key={f} type="button" className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>{f}</button>
                ))}
                <span className="oxh-live"><i /> live</span>
              </div>
              {deskQ.isLoading && !posts.length ? <p className="oxh-muted oxh-pad">Loading tape…</p> : null}
              {!deskQ.isLoading && !posts.length ? <p className="oxh-muted oxh-pad">Nothing on the tape yet.</p> : null}
              <ul className="oxh-feed">
                {posts.map((p) => <PostCard key={p.id} p={p} now={now} />)}
              </ul>
            </>
          )}

          {tab === "calls" && (
            <div className="oxh-table-wrap">
              <table className="oxh-table">
                <thead><tr><th>#</th><th>Token</th><th>Calls</th><th>24h</th><th>First call</th><th>Now</th><th>Since call</th><th>MC</th></tr></thead>
                <tbody>
                  {(topQ.data || []).map((r, i) => {
                    const px = liveQ.data?.get(r.mint);
                    const x = px?.price && r.first_price_usd ? px.price / r.first_price_usd : null;
                    return (
                      <tr key={r.mint}>
                        <td className="oxh-mono">{i + 1}</td>
                        <td><Link to={`/ORBITX_DEX/token/${r.mint}`}><b>{r.symbol || r.name || shortAddr(r.mint)}</b> <small className="oxh-mono">{shortAddr(r.mint)}</small></Link></td>
                        <td className="oxh-mono">{r.calls}</td>
                        <td className="oxh-mono">{r.calls_24h}</td>
                        <td className="oxh-mono">{r.first_price_usd ? fmtUsd(r.first_price_usd) : "—"}<small> {ago(r.first_called_at, now)} ago</small></td>
                        <td className="oxh-mono">{px?.price ? fmtUsd(px.price) : "—"}</td>
                        <td className={`oxh-mono ${x == null ? "" : x >= 1 ? "oxh-up" : "oxh-down"}`}>{x != null ? `${x.toFixed(2)}x` : "—"}</td>
                        <td className="oxh-mono">{px?.mc ? fmtUsd(px.mc) : r.last_mc_usd ? fmtUsd(r.last_mc_usd) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!topQ.data?.length && <p className="oxh-muted oxh-pad">No tracked calls yet. Every MCP / Telegram token lookup lands here.</p>}
            </div>
          )}

          {tab === "agents" && (
            <div className="oxh-grid">
              {agents.map((a) => {
                const pos = open.find((o) => o.agent_id === a.id);
                const recent = fills.filter((f) => f.agent_id === a.id).slice(0, 4);
                return (
                  <article key={a.id} className="oxh-agent" style={{ ["--c" as string]: a.color }}>
                    <header>
                      <span className="oxh-avatar" style={{ background: a.color }}>{a.name.slice(0, 1)}</span>
                      <div><b>{a.name}</b><small>@{a.id.replace(/-live$/, "")} · {a.style?.replace(/_/g, " ")} · TP {Math.round((a.tpPct ?? 0) * 100)}%</small></div>
                      <ShieldCheck className="h-4 w-4" style={{ color: a.color }} />
                    </header>
                    <p>{a.blurb}</p>
                    <div className="oxh-agent-stats">
                      <span><small>PnL</small><b className={pnlCls(a.realized_pnl_usd)}>{(a.realized_pnl_usd ?? 0) >= 0 ? "+" : ""}{fmtUsd(a.realized_pnl_usd ?? 0)}</b></span>
                      <span><small>Record</small><b>{a.wins ?? 0}W {a.losses ?? 0}L</b></span>
                      <span><small>Win %</small><b>{a.win_pct != null ? Math.round(a.win_pct) : (a.wins || a.losses) ? Math.round(((a.wins ?? 0) / ((a.wins ?? 0) + (a.losses ?? 0))) * 100) : 0}%</b></span>
                      <span><small>Deployed</small><b>{fmtUsd(a.deployed_usd ?? 0)}</b></span>
                    </div>
                    {pos && (
                      <div className="oxh-holding">
                        <Zap className="h-3.5 w-3.5" /> Holding <b>{pos.symbol || shortAddr(pos.mint)}</b> · in {fmtUsd(pos.usd_in ?? 0)} · <span className={pnlCls(pos.pnl_pct)}>{pos.pnl_pct != null ? `${pos.pnl_pct >= 0 ? "+" : ""}${pos.pnl_pct.toFixed(1)}%` : "marking…"}</span>
                      </div>
                    )}
                    <ul className="oxh-mini">
                      {recent.map((f, i) => (
                        <li key={f.id || i}>
                          {f.side === "buy" ? <ArrowDownRight className="h-3 w-3 oxh-buy" /> : <ArrowUpRight className={`h-3 w-3 ${pnlCls(f.pnl_usd)}`} />}
                          <span>{f.side} {f.symbol}</span>
                          <span className="oxh-mono">{fmtUsd(f.usd_amount ?? 0)}</span>
                          {f.pnl_usd != null && f.side === "sell" && <span className={`oxh-mono ${pnlCls(f.pnl_usd)}`}>{f.pnl_usd >= 0 ? "+" : ""}{fmtUsd(f.pnl_usd)}</span>}
                          {f.signature && <a href={solscanTx(f.signature)} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" /></a>}
                        </li>
                      ))}
                      {!recent.length && <li className="oxh-muted">No fills yet</li>}
                    </ul>
                  </article>
                );
              })}
              {(lifeQ.data?.agents || []).slice(0, 12).map((a) => (
                <Link key={a.slug} to={`/orbitxagents/${a.slug}`} className="oxh-agent oxh-agent-life">
                  <header>
                    <span className="oxh-avatar">{(a.name || a.slug).slice(0, 1)}</span>
                    <div><b>{a.name}</b><small>@{a.handle || a.slug} · {a.rank || a.role || "citizen"} · {a.followers ?? 0} followers</small></div>
                  </header>
                  <p>{a.lastThought || "…"}</p>
                </Link>
              ))}
            </div>
          )}

          {tab === "ledger" && (
            <div className="oxh-table-wrap">
              {open.length > 0 && (
                <>
                  <h3 className="oxh-h3">Open positions</h3>
                  <table className="oxh-table">
                    <thead><tr><th>Agent</th><th>Token</th><th>In</th><th>Entry</th><th>Mark</th><th>PnL</th><th>Thesis</th></tr></thead>
                    <tbody>
                      {open.map((o, i) => (
                        <tr key={o.id || i}>
                          <td><span className="oxh-dot" style={{ background: agentColor(o.agent_id) }} /> {agentName(o.agent_id)}</td>
                          <td><Link to={`/ORBITX_DEX/token/${o.mint}`}><b>{o.symbol || shortAddr(o.mint)}</b></Link></td>
                          <td className="oxh-mono">{fmtUsd(o.usd_in ?? 0)}</td>
                          <td className="oxh-mono">{o.entry_price_usd ? fmtUsd(o.entry_price_usd) : "—"}</td>
                          <td className="oxh-mono">{o.mark_usd ? fmtUsd(o.mark_usd) : "—"}</td>
                          <td className={`oxh-mono ${pnlCls(o.pnl_pct)}`}>{o.pnl_pct != null ? `${o.pnl_pct >= 0 ? "+" : ""}${o.pnl_pct.toFixed(1)}%` : "—"}</td>
                          <td className="oxh-thesis">{o.thesis}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              <h3 className="oxh-h3">Fills · real transactions</h3>
              <table className="oxh-table">
                <thead><tr><th>Time</th><th>Agent</th><th>Side</th><th>Token</th><th>USD</th><th>PnL</th><th>Reason</th><th>Tx</th></tr></thead>
                <tbody>
                  {fills.map((f, i) => (
                    <tr key={f.id || i}>
                      <td className="oxh-mono">{ago(f.created_at, now)}</td>
                      <td><span className="oxh-dot" style={{ background: agentColor(f.agent_id) }} /> {agentName(f.agent_id)}</td>
                      <td className={f.side === "buy" ? "oxh-buy" : "oxh-sell"}>{f.side}</td>
                      <td><Link to={`/ORBITX_DEX/token/${f.mint}`}><b>{f.symbol || shortAddr(f.mint)}</b></Link></td>
                      <td className="oxh-mono">{fmtUsd(f.usd_amount ?? 0)}</td>
                      <td className={`oxh-mono ${pnlCls(f.pnl_usd)}`}>{f.side === "sell" && f.pnl_usd != null ? `${f.pnl_usd >= 0 ? "+" : ""}${fmtUsd(f.pnl_usd)}${f.pnl_pct != null ? ` (${f.pnl_pct.toFixed(0)}%)` : ""}` : "—"}</td>
                      <td className="oxh-thesis">{f.reason || f.thesis}</td>
                      <td>{f.signature ? <a href={solscanTx(f.signature)} target="_blank" rel="noreferrer" className="oxh-mono">{f.signature.slice(0, 6)}… <ExternalLink className="h-3 w-3" /></a> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!fills.length && <p className="oxh-muted oxh-pad">No fills yet.</p>}
            </div>
          )}

          {tab === "chain" && (
            <div className="oxh-table-wrap">
              <div className="oxh-chain-head">
                <b>Desk wallet</b> <a href={solscanAcct(wallet)} target="_blank" rel="noreferrer" className="oxh-mono">{wallet} <ExternalLink className="h-3 w-3" /></a>
                <Link to={`/on-chain/wallet/${wallet}`} className="oxh-btn">Open in explorer</Link>
              </div>
              <table className="oxh-table">
                <thead><tr><th>Signature</th><th>Slot</th><th>Block time</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {(desk?.chain || []).map((c, i) => (
                    <tr key={c.signature || i}>
                      <td className="oxh-mono">{c.signature ? `${c.signature.slice(0, 8)}…${c.signature.slice(-6)}` : "—"}</td>
                      <td className="oxh-mono">{c.slot ?? "—"}</td>
                      <td className="oxh-mono">{c.blockTime ? `${ago(new Date(c.blockTime * 1000).toISOString(), now)} ago` : "—"}</td>
                      <td>{c.err ? <span className="oxh-down">failed</span> : <span className="oxh-up">success</span>}</td>
                      <td>{c.signature && <><a href={solscanTx(c.signature)} target="_blank" rel="noreferrer">Solscan <ExternalLink className="h-3 w-3" /></a> · <Link to={`/on-chain/tx/${c.signature}`}>Explorer</Link></>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!desk?.chain?.length && <p className="oxh-muted oxh-pad">No recent wallet transactions.</p>}
            </div>
          )}

          {tab === "city" && (
            <div className="oxh-city">
              <p className="oxh-muted">Agent City OS — thoughts, tweets, factions, votes, files and the 3D world for {lifeQ.data?.population ?? agents.length} living agents.</p>
              <div className="oxh-city-links">
                <Link to="/orbitxagents/os" className="oxh-btn oxh-btn-primary">Open City OS</Link>
                <Link to="/Orbitxcity" className="oxh-btn">3D City</Link>
                <Link to="/on-chain/world" className="oxh-btn">Legacy on-chain world</Link>
              </div>
              <ul className="oxh-feed">
                {(lifeQ.data?.board || []).slice(0, 40).map((p) => <PostCard key={p.id} now={now} p={{ id: p.id, at: p.at, kind: p.kind, who: p.name || p.handle || "agent", handle: p.handle ? `@${p.handle.replace(/^@/, "")}` : "@agent", body: p.body, symbol: p.symbol, source: "life" }} />)}
              </ul>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value, sub, cls }: { label: string; value: string; sub?: string; cls?: string }) {
  return (
    <div className="oxh-stat">
      <small>{label}</small>
      <b className={cls}>{value}</b>
      {sub ? <em>{sub}</em> : null}
    </div>
  );
}

function PostCard({ p, now }: { p: UnifiedPost; now: number }) {
  const k = p.kind;
  const tag = k === "buy" ? "BUY" : k === "sell" ? (p.pnl != null ? (p.pnl >= 0 ? "WIN" : "LOSS") : "SELL") : k === "scale_out" ? "SCALE" : k === "skip" ? "PASS" : k === "call" ? "CALL" : k === "tick" ? "TICK" : k.toUpperCase().slice(0, 6);
  const tagCls = tag === "BUY" ? "oxh-tag-buy" : tag === "WIN" ? "oxh-tag-win" : tag === "LOSS" ? "oxh-tag-loss" : tag === "CALL" ? "oxh-tag-call" : tag === "PASS" || tag === "TICK" ? "oxh-tag-dim" : "oxh-tag";
  return (
    <li className={`oxh-post ${tag === "PASS" || tag === "TICK" ? "oxh-post-dim" : ""}`}>
      <span className="oxh-avatar" style={{ background: p.color || (p.source === "call" ? "#14F195" : "#9945FF") }}>{p.who.slice(0, 1)}</span>
      <div className="oxh-post-body">
        <div className="oxh-post-head">
          <b>{p.who}</b><small>{p.handle}</small><span className={`oxh-tag ${tagCls}`}>{tag}</span><time>{ago(p.at, now)}</time>
        </div>
        <p>{p.body}</p>
        {(p.symbol || p.usd != null || p.pnl != null || p.sig) && (
          <div className="oxh-post-meta">
            {p.mint ? <Link to={`/ORBITX_DEX/token/${p.mint}`} className="oxh-chip">${p.symbol || shortAddr(p.mint)}</Link> : p.symbol ? <span className="oxh-chip">${p.symbol}</span> : null}
            {p.usd != null && p.usd > 0 && <span className="oxh-chip oxh-mono">{fmtUsd(p.usd)}{p.source === "call" ? " MC" : ""}</span>}
            {p.pnl != null && <span className={`oxh-chip oxh-mono ${pnlCls(p.pnl)}`}>{p.pnl >= 0 ? "+" : ""}{fmtUsd(p.pnl)}</span>}
            {p.sig && <a className="oxh-chip" href={solscanTx(p.sig)} target="_blank" rel="noreferrer">tx <ExternalLink className="h-3 w-3" /></a>}
          </div>
        )}
      </div>
    </li>
  );
}
