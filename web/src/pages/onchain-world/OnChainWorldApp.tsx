import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { ChainEvent, FilterState, LivePayload } from "./api";
import { fetchLive, fetchOrbitx, fetchSearch, fetchToken, fetchTx, fetchWallet } from "./api";
import { clock, eventTitle, eventTone, fmtNum, fmtSol, fmtUsd, shortAddr } from "./format";
import "./onchain-world.css";

const WorldCanvas = lazy(() => import("./WorldCanvas"));

const EMPTY_LIVE: LivePayload = {
  ok: true,
  live: false,
  live_label: "INDEXING DELAY",
  live_reason: "Waiting for the first confirmed index run.",
  chain_slot: null,
  last_slot: null,
  lag_slots: null,
  last_ingest_at: null,
  websocket_status: "polling",
  sol_usd: null,
  stats: { events_per_sec: 0, transactions_per_min: 0, orbitx_buys: 0, orbitx_burned: 0, whale_usd: 0, active_wallets: 0 },
  events: [],
};

const FILTER0: FilterState = { type: "", orbitx: false, whale: false, kol: false, minUsd: "", source: "", token: "", wallet: "" };

type Mode = "world" | "terminal" | "orbitx" | "wallets";
type Detail =
  | { kind: "event"; event: ChainEvent }
  | { kind: "wallet"; data: Record<string, unknown> }
  | { kind: "token"; data: Record<string, unknown> }
  | { kind: "tx"; data: Record<string, unknown> }
  | { kind: "orbitx"; data: Record<string, unknown> }
  | null;

class ErrorCatch extends Component<{ children: ReactNode; fallback: () => void }, { fail: boolean }> {
  state = { fail: false };
  static getDerivedStateFromError() { return { fail: true }; }
  componentDidCatch() { this.props.fallback(); }
  render() { return this.state.fail ? null : this.props.children; }
}

function isMobile() {
  if (typeof window === "undefined") return true;
  return window.innerWidth < 1100 || window.matchMedia?.("(pointer: coarse)")?.matches;
}

function Kv({ k, v, href }: { k: string; v?: unknown; href?: string }) {
  const text = v == null || v === "" ? "UNKNOWN" : String(v);
  return (
    <div className="oxw-kv">
      <em>{k}</em>
      {href ? <a href={href} target="_blank" rel="noreferrer">{text}</a> : <b>{text}</b>}
    </div>
  );
}

export default function OnChainWorldApp() {
  const nav = useNavigate();
  const params = useParams();
  const [mode, setMode] = useState<Mode>("world");
  const [paused, setPaused] = useState(false);
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<FilterState>(FILTER0);
  const [live, setLive] = useState<LivePayload>(EMPTY_LIVE);
  const [detail, setDetail] = useState<Detail>(null);
  const [tab, setTab] = useState("SUMMARY");
  const [err, setErr] = useState<string | null>(null);
  const [worldOk, setWorldOk] = useState(() => !isMobile());
  const seen = useRef(new Set<string>());

  const loadLive = useCallback(async () => {
    if (paused) return;
    try {
      const data = await fetchLive(filters);
      setLive(data.ok ? data : { ...EMPTY_LIVE, live_reason: data.error || "Indexer unavailable." });
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Live feed failed.");
    }
  }, [filters, paused]);

  useEffect(() => {
    void loadLive();
    const id = window.setInterval(() => void loadLive(), 4000);
    return () => window.clearInterval(id);
  }, [loadLive]);

  useEffect(() => {
    const onResize = () => { if (isMobile()) setWorldOk(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (params.signature) {
      void fetchTx(params.signature).then((data) => setDetail({ kind: "tx", data })).catch(() => setDetail(null));
    } else if (params.address && location.pathname.includes("/wallet/")) {
      void fetchWallet(params.address).then((data) => setDetail({ kind: "wallet", data })).catch(() => setDetail(null));
    } else if (params.address && location.pathname.includes("/token/")) {
      void fetchToken(params.address).then((data) => setDetail({ kind: "token", data })).catch(() => setDetail(null));
    }
  }, [params.address, params.signature]);

  const events = live.events || [];
  const incoming = useMemo(() => events.filter((e) => {
    if (seen.current.has(e.event_id)) return false;
    seen.current.add(e.event_id);
    return true;
  }), [events]);
  void incoming;

  async function onSearch(ev?: FormEvent) {
    ev?.preventDefault();
    const query = q.trim();
    if (!query) return;
    const data = await fetchSearch(query);
    if (data.signature) {
      nav(`/on-chain/tx/${data.signature}`);
      setDetail({ kind: "tx", data });
      return;
    }
    if (data.address && data.holdings) {
      nav(`/on-chain/wallet/${data.address}`);
      setDetail({ kind: "wallet", data });
      return;
    }
    if (data.mint) {
      nav(`/on-chain/token/${data.mint}`);
      setDetail({ kind: "token", data });
      return;
    }
    setDetail({ kind: "tx", data });
  }

  function openEvent(event: ChainEvent) {
    setDetail({ kind: "event", event });
    setTab("SUMMARY");
  }

  async function openOrbitx() {
    setMode("orbitx");
    const data = await fetchOrbitx();
    setDetail({ kind: "orbitx", data });
  }

  const selected = detail?.kind === "event" ? detail.event : null;

  return (
    <div className="oxw">
      <header className="oxw-top">
        <div className="oxw-brand">
          <b>ORBITX ON-CHAIN</b>
          <span>Living intelligence world</span>
        </div>
        <div className="oxw-live">
          <i className={`oxw-dot${live.live ? "" : " delay"}`} />
          {live.live_label}
          {live.live_reason ? <span style={{ color: "var(--muted)", letterSpacing: 0 }}>{live.live_reason}</span> : null}
        </div>
        <div className="oxw-stats">
          <div className="oxw-stat"><em>Live block</em><b>{fmtNum(live.chain_slot, 0)}</b></div>
          <div className="oxw-stat"><em>Events / sec</em><b>{fmtNum(live.stats.events_per_sec)}</b></div>
          <div className="oxw-stat"><em>OrbitX buys</em><b>{fmtNum(live.stats.orbitx_buys, 0)}</b></div>
          <div className="oxw-stat"><em>OrbitX burned</em><b>{fmtNum(live.stats.orbitx_burned)}</b></div>
        </div>
      </header>

      <form className="oxw-search" onSubmit={onSearch}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Wallet · token CA · signature · slot · $ORBITX"
          spellCheck={false}
        />
        <button type="submit">Search</button>
        <button type="button" className={paused ? "oxw-btn active" : "oxw-btn"} onClick={() => setPaused((p) => !p)}>
          {paused ? "Resume" : "Pause"}
        </button>
      </form>

      <div className="oxw-modes">
        {([
          ["world", "World"],
          ["terminal", "Terminal"],
          ["orbitx", "OrbitX"],
          ["wallets", "Wallets"],
        ] as [Mode, string][]).map(([m, label]) => (
          <button key={m} className={`oxw-btn${mode === m ? " active" : ""}`} onClick={() => (m === "orbitx" ? void openOrbitx() : setMode(m))}>
            {label}
          </button>
        ))}
        <button className="oxw-btn" onClick={() => void loadLive()}>Refresh</button>
      </div>

      <div className="oxw-body">
        <aside className="oxw-col">
          <h3>Filters</h3>
          <div className="oxw-filters">
            <label>Event
              <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
                <option value="">All observed</option>
                {["BUY", "SELL", "SWAP", "SOL_TRANSFER", "TOKEN_TRANSFER", "TOKEN_BURN", "ORBITX_BUY", "ORBITX_SELL", "ORBITX_BURN", "WHALE_BUY", "TOKEN_LAUNCH", "UNKNOWN"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>Min USD
              <select value={filters.minUsd} onChange={(e) => setFilters({ ...filters, minUsd: e.target.value })}>
                <option value="">Any</option>
                <option value="100">$100</option>
                <option value="1000">$1K</option>
                <option value="10000">$10K</option>
                <option value="100000">$100K</option>
                <option value="1000000">$1M</option>
              </select>
            </label>
            <label>Source
              <input value={filters.source} onChange={(e) => setFilters({ ...filters, source: e.target.value })} placeholder="Jupiter · Pump · UNKNOWN" />
            </label>
            <label className="oxw-check"><input type="checkbox" checked={filters.orbitx} onChange={(e) => setFilters({ ...filters, orbitx: e.target.checked })} /> OrbitX only</label>
            <label className="oxw-check"><input type="checkbox" checked={filters.whale} onChange={(e) => setFilters({ ...filters, whale: e.target.checked })} /> Whale</label>
            <label className="oxw-check"><input type="checkbox" checked={filters.kol} onChange={(e) => setFilters({ ...filters, kol: e.target.checked })} /> Explicit KOL</label>
            <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.45 }}>
              KOL is never inferred. USD is hidden when price is unknown. The world only renders indexed events.
            </p>
          </div>
        </aside>

        <section className="oxw-col oxw-stage">
          {mode === "world" && worldOk ? (
            <Suspense fallback={<div className="oxw-stage-fallback">Constructing world…</div>}>
              <ErrorCatch fallback={() => setWorldOk(false)}>
                <WorldCanvas events={events} onPick={openEvent} followId={selected?.event_id} />
              </ErrorCatch>
            </Suspense>
          ) : (
            <div className="oxw-term">
              {events.length === 0 ? (
                <div className="oxw-empty">
                  {err || live.live_reason || "No confirmed events in the index yet. Search a real signature, wallet, or the $ORBITX mint to pull chain data."}
                </div>
              ) : events.map((e) => (
                <div key={e.event_id} className="oxw-term-row" onClick={() => openEvent(e)}>
                  <span>{clock(e.block_time)}</span>
                  <b className={`oxw-ev ${eventTone(e.event_type)}`} style={{ background: "none", border: 0, padding: 0 }}>{eventTitle(e.event_type)}</b>
                  <span>{e.token_symbol ? `$${e.token_symbol}` : e.sol_amount != null ? fmtSol(e.sol_amount) : shortAddr(e.wallet)}</span>
                  <span>{e.usd_value != null ? fmtUsd(e.usd_value) : e.amount != null ? fmtNum(e.amount) : "UNKNOWN"}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="oxw-col oxw-feed">
          <h3>Live stream · {live.stats.active_wallets} wallets</h3>
          <div className="oxw-feed-list">
            {events.length === 0 ? (
              <div className="oxw-empty">Stream is empty until real transactions are indexed.</div>
            ) : events.map((e) => (
              <button key={e.event_id} className={`oxw-ev ${eventTone(e.event_type)}${selected?.event_id === e.event_id ? " on" : ""}`} onClick={() => openEvent(e)}>
                <time>{clock(e.block_time)}</time>
                <div>
                  <b>{eventTitle(e.event_type)}</b>
                  <i>{e.token_symbol ? `$${e.token_symbol}` : shortAddr(e.wallet)} · {e.attribution}</i>
                </div>
                <em>{e.usd_value != null ? fmtUsd(e.usd_value) : e.sol_amount != null ? fmtSol(e.sol_amount) : "UNKNOWN"}</em>
              </button>
            ))}
          </div>
        </aside>
      </div>

      <section className="oxw-pane">
        <h3>{detail ? "Intelligence" : "Select an event, wallet, token, or transaction"}</h3>
        {!detail ? (
          <div className="oxw-empty">Click the stream, the world, or search. Nothing here is simulated.</div>
        ) : (
          <DetailPane detail={detail} tab={tab} setTab={setTab} onWallet={(a) => nav(`/on-chain/wallet/${a}`)} onToken={(a) => nav(`/on-chain/token/${a}`)} />
        )}
      </section>

      <nav className="oxw-nav">
        <Link to="/app">Hub</Link>
        <Link to="/intel">Intel</Link>
        <Link to="/ORBITX_DEX">DEX</Link>
        <Link to="/trade">Trade</Link>
        <a href="https://solscan.io" target="_blank" rel="noreferrer">Solscan</a>
      </nav>
    </div>
  );
}

function DetailPane({
  detail,
  tab,
  setTab,
  onWallet,
  onToken,
}: {
  detail: Exclude<Detail, null>;
  tab: string;
  setTab: (t: string) => void;
  onWallet: (a: string) => void;
  onToken: (a: string) => void;
}) {
  if (detail.kind === "event") {
    const e = detail.event;
    return (
      <>
        <div className="oxw-grid">
          <Kv k="Type" v={e.event_type} />
          <Kv k="Status" v={e.status} />
          <Kv k="Wallet" v={shortAddr(e.wallet)} />
          <Kv k="Token" v={e.token_symbol ? `$${e.token_symbol}` : e.token_ca ? shortAddr(e.token_ca) : "UNKNOWN"} />
          <Kv k="Amount" v={e.amount != null ? fmtNum(e.amount) : "UNKNOWN"} />
          <Kv k="SOL" v={fmtSol(e.sol_amount)} />
          <Kv k="USD" v={fmtUsd(e.usd_value)} />
          <Kv k="Market cap" v={fmtUsd(e.market_cap)} />
          <Kv k="Source" v={e.source || "UNKNOWN"} />
          <Kv k="Attribution" v={e.attribution} />
          <Kv k="Confidence" v={e.confidence} />
          <Kv k="Signature" v={shortAddr(e.signature, 6, 6)} href={`https://solscan.io/tx/${e.signature}`} />
        </div>
        <div className="oxw-tabs">
          {e.wallet ? <button className="oxw-btn" onClick={() => onWallet(e.wallet!)}>Wallet</button> : null}
          {e.token_ca ? <button className="oxw-btn" onClick={() => onToken(e.token_ca!)}>Token</button> : null}
          <a className="oxw-btn" href={`https://solscan.io/tx/${e.signature}`} target="_blank" rel="noreferrer">Open tx</a>
        </div>
      </>
    );
  }

  const data = detail.data;
  const events = Array.isArray(data.events) ? data.events as ChainEvent[] : [];
  const token = (data.token || {}) as Record<string, unknown>;
  const wallet = (data.wallet || {}) as Record<string, unknown>;
  const totals = (data.totals || {}) as Record<string, unknown>;

  return (
    <>
      <div className="oxw-tabs">
        {["SUMMARY", "FLOW", "EVENTS", "RAW"].map((t) => (
          <button key={t} className={`oxw-btn${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === "RAW" ? (
        <pre style={{ margin: "0 14px", maxHeight: 280, overflow: "auto", fontSize: 11, color: "var(--muted)" }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : tab === "EVENTS" ? (
        <div className="oxw-term" style={{ maxHeight: 280 }}>
          {events.map((e) => (
            <div key={e.event_id} className="oxw-term-row">
              <span>{clock(e.block_time)}</span>
              <b>{eventTitle(e.event_type)}</b>
              <span>{e.token_symbol || shortAddr(e.wallet)}</span>
              <span>{fmtUsd(e.usd_value)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="oxw-grid">
          {"address" in data ? <Kv k="Wallet" v={String(data.address)} /> : null}
          {"mint" in data ? <Kv k="Mint" v={String(data.mint)} /> : null}
          {"sol" in data ? <Kv k="SOL" v={fmtSol(Number(data.sol))} /> : null}
          {token.symbol ? <Kv k="Symbol" v={`$${String(token.symbol)}`} /> : null}
          {token.price_usd != null ? <Kv k="Price" v={fmtUsd(Number(token.price_usd))} /> : null}
          {token.market_cap != null ? <Kv k="Market cap" v={fmtUsd(Number(token.market_cap))} /> : null}
          {totals.burned != null ? <Kv k="Indexed burned" v={fmtNum(Number(totals.burned))} /> : null}
          {totals.unique_wallets != null ? <Kv k="Unique wallets" v={fmtNum(Number(totals.unique_wallets), 0)} /> : null}
          {wallet.tx_count != null ? <Kv k="Indexed txs" v={fmtNum(Number(wallet.tx_count), 0)} /> : null}
          {data.signature ? <Kv k="Signature" v={shortAddr(String(data.signature), 8, 8)} href={`https://solscan.io/tx/${String(data.signature)}`} /> : null}
          {data.kind ? <Kv k="Kind" v={String(data.kind)} /> : null}
          {data.label_kind ? <Kv k="Label" v={String(data.label_kind)} /> : null}
        </div>
      )}
    </>
  );
}
