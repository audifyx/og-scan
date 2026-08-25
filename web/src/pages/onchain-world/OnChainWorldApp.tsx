import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { CamCommand, WorldPick } from "./WorldCanvas";
import type { ChainEvent, CityDistricts, FilterState, KolCard, LivePayload, OrbitxPayload, TokenPayload, WalletPayload } from "./api";
import { fetchDistricts, fetchKols, fetchLive, fetchSearch, fetchToken, fetchTx, fetchWallet } from "./api";
import { ago, clock, eventTitle, eventTone, fmtNum, fmtSol, fmtUsd, shortAddr, utcNow } from "./format";
import CssCity from "./CssCity";
import LivingMap from "./LivingMap";
import { loadCityDistricts } from "../../../shared/orbitx-chain-districts.js";
import { activeOrbitxKols } from "../../../shared/orbitx-kol-directory.js";
import "./onchain-world.css";

const WorldCanvas = lazy(() => import("./WorldCanvas"));

const DIRECTORY_KOLS: KolCard[] = activeOrbitxKols().map((k) => ({
  address: k.address,
  name: k.name,
  twitter: k.twitter,
  status: k.status,
  hits: 0,
  last_type: null,
  last_token: null,
  last_usd: null,
  last_at: null,
}));

const EMPTY_LIVE: LivePayload = {
  ok: true,
  live: false,
  live_label: "INDEXING DELAY",
  live_reason: "Waiting for the first confirmed index run.",
  chain_slot: null,
  last_slot: null,
  lag_slots: null,
  last_ingest_at: null,
  ingest_age_sec: null,
  websocket_status: "polling",
  sol_usd: null,
  stats: { events_per_sec: 0, transactions_per_min: 0, orbitx_buys: 0, orbitx_burned: 0, whale_usd: 0, active_wallets: 0, assigned_kols: DIRECTORY_KOLS.length },
  breakdown: [],
  eps_series: [],
  districts: { orbitx: { mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9", symbol: "ORBITX", name: "OrbitX", kind: "orbitx" }, hubs: [], tokens: [] },
  events: [],
  kols: DIRECTORY_KOLS,
  flows: [],
};

const FILTER0: FilterState = { type: "", orbitx: false, whale: false, kol: false, tracked: false, minUsd: "", source: "", token: "", wallet: "", window: "live" };

type Mode = "world" | "terminal" | "map" | "orbitx" | "wallets" | "analytics";
type IntelTab = "OVERVIEW" | "TX" | "TOKENS" | "ORBITX" | "FLOWS";
type TermTab = "TAPE" | "ORBITX" | "WHALES" | "KOLS" | "WALLETS";
type Detail =
  | { kind: "event"; event: ChainEvent }
  | { kind: "wallet"; data: WalletPayload }
  | { kind: "token"; data: TokenPayload }
  | { kind: "tx"; data: Record<string, unknown> }
  | { kind: "orbitx"; data: OrbitxPayload }
  | null;

const TONES: Record<string, string> = { BUY: "#34d399", TRANSFER: "#38bdf8", SELL: "#fb7185", ORBITX: "#c084fc", BURN: "#f59e0b", OTHER: "#64748b" };

class ErrorCatch extends Component<{ children: ReactNode; fallback: () => void }, { fail: boolean }> {
  state = { fail: false };
  static getDerivedStateFromError() { return { fail: true }; }
  componentDidCatch() { this.props.fallback(); }
  render() { return this.state.fail ? null : this.props.children; }
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

function iconFor(type: string): string {
  if (type.includes("BURN")) return "B";
  if (type.includes("BUY")) return "↑";
  if (type.includes("SELL")) return "↓";
  if (type.includes("SOL")) return "◎";
  if (type.includes("LAUNCH")) return "✦";
  return "•";
}

function Donut({ parts }: { parts: { kind: string; count: number; pct: number }[] }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const total = parts.reduce((s, p) => s + p.count, 0);
  let acc = 0;
  return (
    <svg className="oxw-donut-svg" viewBox="0 0 120 120" aria-label="Event breakdown">
      <circle cx="60" cy="60" r={r} fill="none" stroke="#1a1430" strokeWidth="12" />
      {total > 0 ? parts.filter((p) => p.count).map((p) => {
        const len = (p.pct / 100) * c;
        const rot = -90 + acc * 3.6;
        acc += p.pct;
        return (
          <circle
            key={p.kind}
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={TONES[p.kind] || "#64748b"}
            strokeWidth="12"
            strokeDasharray={`${len} ${c - len}`}
            strokeLinecap="butt"
            transform={`rotate(${rot} 60 60)`}
          />
        );
      }) : null}
      <text x="60" y="56" textAnchor="middle" className="oxw-donut-n">{total}</text>
      <text x="60" y="70" textAnchor="middle" className="oxw-donut-l">EVENTS</text>
    </svg>
  );
}

function seedWallet(k: KolCard): WalletPayload {
  return {
    ok: false,
    address: k.address,
    kol: { address: k.address, name: k.name, twitter: k.twitter, status: k.status },
    assigned_kol: true,
    label: k.name,
    label_kind: "KOL",
  };
}

export default function OnChainWorldApp() {
  const nav = useNavigate();
  const params = useParams();
  const [mode, setMode] = useState<Mode>("world");
  const [paused, setPaused] = useState(false);
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<FilterState>(FILTER0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [live, setLive] = useState<LivePayload>(EMPTY_LIVE);
  const [kols, setKols] = useState<KolCard[]>(DIRECTORY_KOLS);
  const [districts, setDistricts] = useState<CityDistricts>(EMPTY_LIVE.districts || {});
  const [detail, setDetail] = useState<Detail>(DIRECTORY_KOLS[0] ? { kind: "wallet", data: seedWallet(DIRECTORY_KOLS[0]) } : null);
  const [intelTab, setIntelTab] = useState<IntelTab>("OVERVIEW");
  const [termTab, setTermTab] = useState<TermTab>("TAPE");
  const [err, setErr] = useState<string | null>(null);
  const [worldOk, setWorldOk] = useState(() => {
    if (typeof document === "undefined") return true;
    try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl2", { failIfMajorPerformanceCaveat: false })
        || c.getContext("webgl", { failIfMajorPerformanceCaveat: false });
      const ok = Boolean(gl);
      const lose = gl && "getExtension" in gl ? gl.getExtension("WEBGL_lose_context") : null;
      lose?.loseContext();
      return ok;
    } catch {
      return false;
    }
  });
  const [webglLive, setWebglLive] = useState(false);
  const [worldKey, setWorldKey] = useState(0);
  const [followId, setFollowId] = useState<string | null>(null);
  const [followWallet, setFollowWallet] = useState<string | null>(DIRECTORY_KOLS[0]?.address || null);
  const [cinematic, setCinematic] = useState(true);
  const [cam, setCam] = useState<CamCommand>(null);
  const [clocks, setClocks] = useState(utcNow());
  const seen = useRef(new Set<string>());
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  const loadLive = useCallback(async () => {
    if (paused) return;
    try {
      const [data, roster, city] = await Promise.all([
        fetchLive(filters),
        fetchKols().catch(() => null),
        fetchDistricts().catch(() => null),
      ]);
      setLive(data.ok ? data : { ...EMPTY_LIVE, live_reason: "Indexer has not completed a run. Assigned KOLs are still on the map." });
      if (roster?.ok && roster.kols.length) setKols(roster.kols);
      else if (data.kols?.length) setKols(data.kols);
      else setKols(DIRECTORY_KOLS);
      if (city?.ok || city?.tokens || city?.orbitx) setDistricts(city);
      else if (data.districts) setDistricts(data.districts);
      setErr(null);
      const news = new Set<string>();
      for (const ev of data.events || []) if (!seen.current.has(ev.event_id)) news.add(ev.event_id);
      if (news.size) {
        seen.current = new Set((data.events || []).map((e) => e.event_id));
        setFresh(news);
        window.setTimeout(() => setFresh(new Set()), 1800);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Live feed failed.");
    }
  }, [filters, paused]);

  useEffect(() => {
    void loadLive();
    const id = window.setInterval(() => void loadLive(), 5000);
    return () => window.clearInterval(id);
  }, [loadLive]);

  useEffect(() => {
    const id = window.setInterval(() => setClocks(utcNow()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    void loadCityDistricts().then((city) => {
      if (city?.orbitx || city?.tokens?.length) setDistricts(city);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (params.signature) {
      void fetchTx(params.signature).then((data) => { if (data?.signature) setDetail({ kind: "tx", data }); }).catch(() => undefined);
      return;
    }
    if (params.address && location.pathname.includes("/wallet/")) {
      const address = params.address;
      setFollowWallet(address);
      const known = DIRECTORY_KOLS.find((k) => k.address === address);
      if (known) setDetail({ kind: "wallet", data: seedWallet(known) });
      void fetchWallet(address).then((data) => { if (data?.ok) setDetail({ kind: "wallet", data }); }).catch(() => undefined);
      return;
    }
    if (params.address && location.pathname.includes("/token/")) {
      void fetchToken(params.address).then((data) => { if (data?.ok) setDetail({ kind: "token", data }); }).catch(() => undefined);
    }
  }, [params.address, params.signature]);

  useEffect(() => {
    const first = DIRECTORY_KOLS[0];
    if (!first || params.address || params.signature) return;
    void fetchWallet(first.address).then((data) => { if (data?.ok) setDetail({ kind: "wallet", data }); }).catch(() => undefined);
  }, [params.address, params.signature]);

  const events = live.events || [];
  const flows = live.flows || [];
  const roster = kols.length ? kols : DIRECTORY_KOLS;
  const wallet = detail?.kind === "wallet" ? detail.data : null;
  const token = detail?.kind === "token" ? detail.data : null;
  const selected = detail?.kind === "event" ? detail.event : null;
  const orbitx = detail?.kind === "orbitx" ? detail.data : null;
  const delay = !live.live;

  const tape = useMemo(() => {
    if (mode === "orbitx") return events.filter((e) => e.orbitx_related);
    if (mode === "wallets" && followWallet) {
      return events.filter((e) => e.wallet === followWallet || e.source_wallet === followWallet || e.destination_wallet === followWallet);
    }
    return events;
  }, [events, mode, followWallet]);

  const termRows = useMemo(() => {
    if (termTab === "ORBITX") return events.filter((e) => e.orbitx_related);
    if (termTab === "WHALES") return events.filter((e) => e.whale_related);
    if (termTab === "KOLS") return events.filter((e) => e.kol_related);
    if (termTab === "WALLETS" && followWallet) {
      return events.filter((e) => e.wallet === followWallet || e.source_wallet === followWallet || e.destination_wallet === followWallet);
    }
    return events;
  }, [events, termTab, followWallet]);

  const openEvent = useCallback((event: ChainEvent) => {
    setDetail({ kind: "event", event });
    setFollowId(event.event_id);
    setFollowWallet(event.wallet || event.source_wallet);
    setCam({ kind: "follow" });
    if (event.wallet) {
      void fetchWallet(event.wallet).then((data) => { if (data?.ok) setDetail({ kind: "wallet", data }); }).catch(() => undefined);
    }
  }, []);

  const openWallet = useCallback((address: string) => {
    setFollowWallet(address);
    setFollowId(null);
    setCam({ kind: "wallet", address });
    nav(`/on-chain/wallet/${address}`);
    const known = DIRECTORY_KOLS.find((k) => k.address === address) || kols.find((k) => k.address === address);
    setDetail({
      kind: "wallet",
      data: known ? seedWallet(known) : { ok: false, address, assigned_kol: false, label: null, label_kind: "Wallet" },
    });
    void fetchWallet(address).then((data) => { if (data?.ok) setDetail({ kind: "wallet", data }); }).catch(() => undefined);
  }, [nav, kols]);

  const onPick = useCallback((pick: WorldPick) => {
    if (pick.kind === "event") return openEvent(pick.event);
    if (pick.kind === "wallet") return openWallet(pick.address);
    if (pick.kind === "hub") {
      setCam({ kind: "reset" });
      return;
    }
    nav(`/on-chain/token/${pick.mint}`);
    setCam({ kind: "token", mint: pick.mint });
    void fetchToken(pick.mint).then((data) => { if (data?.ok) setDetail({ kind: "token", data }); }).catch(() => undefined);
  }, [nav, openEvent, openWallet]);

  async function onSearch(ev?: FormEvent) {
    ev?.preventDefault();
    const query = q.trim();
    if (!query) return;
    const data = await fetchSearch(query);
    if (data.signature) { nav(`/on-chain/tx/${String(data.signature)}`); setDetail({ kind: "tx", data }); return; }
    if (data.address) { openWallet(String(data.address)); return; }
    if (data.mint) {
      nav(`/on-chain/token/${String(data.mint)}`);
      void fetchToken(String(data.mint)).then((row) => { if (row?.ok) setDetail({ kind: "token", data: row }); }).catch(() => undefined);
    }
  }

  const breakdown = live.breakdown || [];
  const series = live.eps_series || [];
  const maxEps = Math.max(...series.map((p) => p.eps), 0.01);
  const spark = series.map((p, i) => `${(i / Math.max(series.length - 1, 1)) * 240},${86 - (p.eps / maxEps) * 68}`).join(" ");
  const sparkArea = `0,86 ${spark || "0,86 240,86"} 240,86`;
  const usdIndexed = events.reduce((s, e) => s + (typeof e.usd_value === "number" ? e.usd_value : 0), 0);
  const useMap = mode === "map";
  const tokenCount = districts.tokens?.length || 0;
  const balances = wallet?.holdings || [];

  return (
    <div className="oxw">
      <header className="oxw-top">
        <div className="oxw-brand">
          <b>ORBITX</b>
          <span>ON-CHAIN</span>
        </div>
        <div className="oxw-live">
          <i className={`oxw-dot${delay ? " delay" : ""}`} />
          {live.live_label}
        </div>
        <div className="oxw-stats">
          <div className="oxw-stat"><em>Events</em><b>{fmtNum(events.length, 0)}</b></div>
          <div className="oxw-stat"><em>EPS</em><b>{fmtNum(live.stats.events_per_sec)}</b></div>
          <div className="oxw-stat"><em>Confirmed</em><b>{fmtNum(events.length, 0)}</b></div>
          <div className="oxw-stat"><em>USD</em><b>{usdIndexed ? fmtUsd(usdIndexed) : events.length ? "UNKNOWN" : "0"}</b></div>
          <div className="oxw-stat"><em>KOLs</em><b>{fmtNum(roster.length, 0)}</b></div>
          <div className="oxw-stat"><em>Tokens</em><b>{fmtNum(tokenCount, 0)}</b></div>
        </div>
        <form className="oxw-search" onSubmit={onSearch}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="wallet · CA · sig · $ORBITX" spellCheck={false} />
          <button type="submit">Search</button>
        </form>
        <div className="oxw-meta">
          <span>{clocks}</span>
          <span>SOLANA</span>
          <button className="oxw-btn" type="button" onClick={() => setPaused((p) => !p)}>{paused ? "Resume" : "Pause"}</button>
        </div>
      </header>

      <aside className="oxw-left">
        <div className="oxw-pane-h">
          <span>Live events · {tape.length}</span>
          <button className={`oxw-btn${filterOpen ? " active" : ""}`} type="button" onClick={() => setFilterOpen((v) => !v)}>Filters</button>
        </div>
        {filterOpen && (
          <div className="oxw-filters">
            <label>Event
              <select value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
                <option value="">All</option>
                {["BUY", "SELL", "SWAP", "SOL_TRANSFER", "TOKEN_TRANSFER", "TOKEN_BURN", "TOKEN_MINT", "TOKEN_LAUNCH", "LIQUIDITY_ADD", "ORBITX_BUY", "ORBITX_BURN"].map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                ))}
              </select>
            </label>
            <div className="oxw-chips">
              {[["", "All"], ["100", "$100+"], ["1000", "$1K+"], ["10000", "$10K+"], ["100000", "$100K+"]].map(([v, l]) => (
                <button key={l} type="button" className={filters.minUsd === v ? "on" : ""} onClick={() => setFilters((f) => ({ ...f, minUsd: v }))}>{l}</button>
              ))}
            </div>
            <div className="oxw-chips">
              {(["live", "1m", "5m", "15m", "1h", "24h"] as const).map((w) => (
                <button key={w} type="button" className={filters.window === w ? "on" : ""} onClick={() => setFilters((f) => ({ ...f, window: w }))}>{w}</button>
              ))}
            </div>
            <label className="oxw-chips">
              <button type="button" className={filters.orbitx ? "on" : ""} onClick={() => setFilters((f) => ({ ...f, orbitx: !f.orbitx }))}>OrbitX</button>
              <button type="button" className={filters.kol ? "on" : ""} onClick={() => setFilters((f) => ({ ...f, kol: !f.kol }))}>KOL</button>
              <button type="button" className={filters.whale ? "on" : ""} onClick={() => setFilters((f) => ({ ...f, whale: !f.whale }))}>Whale</button>
              <button type="button" className={filters.tracked ? "on" : ""} onClick={() => setFilters((f) => ({ ...f, tracked: !f.tracked }))}>Tracked</button>
            </label>
            <label>Source
              <select value={filters.source} onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}>
                <option value="">All</option>
                <option value="jupiter">Jupiter</option>
                <option value="pump">Pump.fun</option>
                <option value="raydium">Raydium</option>
              </select>
            </label>
            <label>Token
              <input value={filters.token} onChange={(e) => setFilters((f) => ({ ...f, token: e.target.value }))} placeholder="symbol or CA" />
            </label>
          </div>
        )}
        <div className="oxw-feed">
          {tape.length === 0 ? (
            <div className="oxw-empty">{err || live.live_reason || "Waiting for confirmed movement."}</div>
          ) : tape.slice(0, 80).map((ev) => (
            <button key={ev.event_id} type="button" className={`oxw-card ${eventTone(ev.event_type)}${fresh.has(ev.event_id) ? " fresh" : ""}${followId === ev.event_id ? " on" : ""}`} onClick={() => openEvent(ev)}>
              <span className="oxw-ico">{iconFor(ev.event_type)}</span>
              <span>
                <b>{eventTitle(ev.event_type)}</b>
                <i>
                  {ev.wallet_label || shortAddr(ev.wallet || ev.source_wallet)}
                  {ev.token_symbol ? ` · $${ev.token_symbol}` : ""}
                  {ev.kol_related ? " · KOL" : ev.whale_related ? " · WHALE" : ""}
                </i>
              </span>
              <em>
                {ev.amount != null ? fmtNum(ev.amount) : ev.sol_amount != null ? fmtSol(ev.sol_amount) : fmtUsd(ev.usd_value)}
                <i>{ago(ev.block_time)}</i>
              </em>
            </button>
          ))}
        </div>
        <div className="oxw-break">
          <div className="oxw-pane-h"><span>Event breakdown</span></div>
          <div className="oxw-donut-row">
            <Donut parts={breakdown} />
            <div className="oxw-leg">
              {breakdown.filter((b) => b.count).map((b) => (
                <span key={b.kind}><i style={{ background: TONES[b.kind] || "#64748b" }} />{b.kind} <b>{b.pct}%</b></span>
              ))}
              {!breakdown.some((b) => b.count) ? <span>No indexed composition yet.</span> : null}
            </div>
          </div>
        </div>
      </aside>

      <section className="oxw-world-wrap">
        <div className="oxw-world">
          {useMap ? (
            <LivingMap events={events} kols={roster} flows={flows} followWallet={followWallet} onWallet={openWallet} onEvent={openEvent} />
          ) : (
            <>
              <CssCity
                kols={roster}
                districts={districts}
                events={events}
                followWallet={followWallet}
                cinematic={cinematic && !webglLive}
                paused={webglLive}
                onWallet={openWallet}
                onToken={(mint) => {
                  nav(`/on-chain/token/${mint}`);
                  setCam({ kind: "token", mint });
                  void fetchToken(mint).then((data) => { if (data?.ok) setDetail({ kind: "token", data }); }).catch(() => undefined);
                }}
              />
              {worldOk ? (
                <div className={`oxw-gl${webglLive ? " on" : ""}`}>
                  <ErrorCatch key={worldKey} fallback={() => { setWorldOk(false); setWebglLive(false); }}>
                    <Suspense fallback={null}>
                      <WorldCanvas
                        events={mode === "orbitx" ? events.filter((e) => e.orbitx_related) : events}
                        kols={roster}
                        flows={flows}
                        districts={districts}
                        followId={followId}
                        followWallet={followWallet}
                        cinematic={cinematic}
                        cam={cam}
                        onPick={onPick}
                        onReady={() => setWebglLive(true)}
                      />
                    </Suspense>
                  </ErrorCatch>
                </div>
              ) : null}
            </>
          )}
        </div>
        <div className="oxw-cam">
          <button className="oxw-btn" type="button" onClick={() => { setCam({ kind: "reset" }); setFollowWallet(null); setFollowId(null); }}>Reset</button>
          <button className="oxw-btn" type="button" onClick={() => setCam({ kind: "orbitx" })}>Focus OrbitX</button>
          <button className="oxw-btn" type="button" onClick={() => setCam({ kind: "follow" })}>Follow</button>
          <button className={`oxw-btn${cinematic ? " active" : ""}`} type="button" onClick={() => setCinematic((v) => !v)}>Cinematic</button>
          <button className={`oxw-btn${mode === "map" ? " active" : ""}`} type="button" onClick={() => setMode((m) => m === "map" ? "world" : "map")}>Map</button>
          {!worldOk ? (
            <button className="oxw-btn" type="button" onClick={() => { setWorldOk(true); setWorldKey((k) => k + 1); }}>Retry 3D</button>
          ) : null}
        </div>
      </section>

      <aside className="oxw-right">
        <div className="oxw-pane-h">
          <span>{wallet ? "Wallet intelligence" : token ? "Token intelligence" : orbitx ? "OrbitX layer" : "World intelligence"}</span>
          {wallet?.assigned_kol ? <span className="oxw-badge">TRACKED</span> : null}
        </div>
        {wallet ? (
          <div className="oxw-subject">
            <b>{wallet.kol?.name || wallet.label || shortAddr(wallet.address)}</b>
            <i>{wallet.kol?.twitter || "UNKNOWN"}</i>
            <i><a href={`https://solscan.io/account/${wallet.address}`} target="_blank" rel="noreferrer">{shortAddr(wallet.address, 6, 4)}</a> · {wallet.assigned_kol ? "ASSIGNED KOL" : wallet.label_kind || "Wallet"}</i>
          </div>
        ) : null}
        <div className="oxw-tabs">
          {(["OVERVIEW", "TX", "TOKENS", "ORBITX", "FLOWS"] as const).map((t) => (
            <button key={t} className={`oxw-btn${intelTab === t ? " active" : ""}`} type="button" onClick={() => setIntelTab(t)}>{t}</button>
          ))}
        </div>
        {intelTab === "OVERVIEW" && (
          <>
            <div className="oxw-kvg">
              {wallet ? (
                <>
                  <Kv k="SOL" v={fmtSol(wallet.sol)} />
                  <Kv k="$ORBITX now" v={fmtNum(wallet.orbitx?.amount ?? wallet.orbitx?.balance)} />
                  <Kv k="Holdings" v={fmtNum(wallet.holdings?.length, 0)} />
                  <Kv k="Indexed txs" v={fmtNum(wallet.events?.length, 0)} />
                </>
              ) : selected ? (
                <>
                  <Kv k="Type" v={selected.event_type} />
                  <Kv k="Amount" v={selected.amount != null ? `${fmtNum(selected.amount)} ${selected.token_symbol || ""}` : "UNKNOWN"} />
                  <Kv k="USD" v={fmtUsd(selected.usd_value)} />
                  <Kv k="From" v={shortAddr(selected.source_wallet || selected.wallet)} />
                  <Kv k="To" v={shortAddr(selected.destination_wallet || selected.counterparty)} />
                  <Kv k="Signature" v={shortAddr(selected.signature, 8, 6)} href={`https://solscan.io/tx/${selected.signature}`} />
                </>
              ) : token ? (
                <>
                  <Kv k="Token" v={token.token?.symbol || shortAddr(token.mint)} />
                  <Kv k="Mint" v={shortAddr(token.mint, 8, 6)} href={`https://solscan.io/token/${token.mint}`} />
                  <Kv k="Price" v={fmtUsd(token.token?.price_usd)} />
                  <Kv k="Market cap" v={fmtUsd(token.token?.market_cap)} />
                </>
              ) : orbitx ? (
                <>
                  <Kv k="Burned" v={fmtNum(orbitx.totals?.burned)} />
                  <Kv k="Burn events" v={fmtNum(orbitx.totals?.burn_events, 0)} />
                  <Kv k="Buy USD" v={fmtUsd(orbitx.totals?.buy_usd)} />
                  <Kv k="Sell USD" v={fmtUsd(orbitx.totals?.sell_usd)} />
                </>
              ) : (
                <>
                  <Kv k="Assigned KOLs" v={fmtNum(roster.length, 0)} />
                  <Kv k="Token districts" v={fmtNum(tokenCount, 0)} />
                  <Kv k="Indexed events" v={fmtNum(events.length, 0)} />
                  <Kv k="SOL/USD" v={fmtUsd(live.sol_usd)} />
                </>
              )}
            </div>
            {wallet ? (
              <>
                <div className="oxw-pane-h"><span>Balances</span></div>
                <div className="oxw-hold">
                  <div><span>SOL</span><b>{fmtSol(wallet.sol)}</b></div>
                  <div><span>$ORBITX</span><b>{fmtNum(wallet.orbitx?.amount ?? wallet.orbitx?.balance)}</b></div>
                  {balances.slice(0, 6).map((h) => (
                    <div key={h.mint}><span>${h.symbol || shortAddr(h.mint)}</span><b>{fmtNum(h.amount)}</b></div>
                  ))}
                </div>
                <div className="oxw-pane-h"><span>OrbitX lifetime</span></div>
                <div className="oxw-kvg">
                  <Kv k="Bought" v={fmtNum(wallet.orbitx?.bought ?? wallet.orbitx?.bought_amount)} />
                  <Kv k="Sold" v={fmtNum(wallet.orbitx?.sold ?? wallet.orbitx?.sold_amount)} />
                  <Kv k="Burned" v={fmtNum(wallet.orbitx?.burned ?? wallet.orbitx?.burned_amount)} />
                  <Kv k="Counterparties" v={fmtNum(wallet.flows?.length, 0)} />
                </div>
              </>
            ) : null}
          </>
        )}
        {intelTab === "TOKENS" && (
          <div className="oxw-hold">
            {(wallet?.holdings || districts.tokens || []).slice(0, 12).map((h) => (
              <div key={"mint" in h ? h.mint : h.symbol}>
                <span>{"symbol" in h ? `$${h.symbol || shortAddr("mint" in h ? h.mint : "")}` : ""}</span>
                <b>{"amount" in h ? fmtNum(h.amount) : fmtUsd("market_cap" in h ? h.market_cap : null)}</b>
              </div>
            ))}
            {!(wallet?.holdings || districts.tokens || []).length ? <div className="oxw-empty">No token metadata yet.</div> : null}
          </div>
        )}
        {intelTab === "TX" && (
          <div className="oxw-feed">
            {(wallet?.events || tape).slice(0, 16).map((ev) => (
              <button key={ev.event_id} type="button" className={`oxw-card ${eventTone(ev.event_type)}`} onClick={() => openEvent(ev)}>
                <span className="oxw-ico">{iconFor(ev.event_type)}</span>
                <span><b>{eventTitle(ev.event_type)}</b><i>{shortAddr(ev.wallet)}</i></span>
                <em>{fmtNum(ev.amount)}</em>
              </button>
            ))}
          </div>
        )}
        {intelTab === "ORBITX" && wallet && (
          <div className="oxw-kvg">
            <Kv k="Current" v={fmtNum(wallet.orbitx?.amount ?? wallet.orbitx?.balance)} />
            <Kv k="Bought" v={fmtNum(wallet.orbitx?.bought ?? wallet.orbitx?.bought_amount)} />
            <Kv k="Sold" v={fmtNum(wallet.orbitx?.sold ?? wallet.orbitx?.sold_amount)} />
            <Kv k="Burned" v={fmtNum(wallet.orbitx?.burned ?? wallet.orbitx?.burned_amount)} />
          </div>
        )}
        {intelTab === "FLOWS" && (
          <div className="oxw-hold">
            {(wallet?.flows || flows).slice(0, 10).map((f) => (
              <div key={`${f.from_address}-${f.to_address}-${f.last_signature || ""}`}>
                <span>{shortAddr(f.from_address)} → {shortAddr(f.to_address)}</span>
                <b>{f.transfer_count} hits</b>
              </div>
            ))}
            {!(wallet?.flows || flows).length ? <div className="oxw-empty">Flows appear when counterparties repeat.</div> : null}
          </div>
        )}
        <div className="oxw-pane-h"><span>KOL directory · {roster.length}</span></div>
        <div className="oxw-kol">
          {roster.map((k) => (
            <button key={k.address} type="button" className={followWallet === k.address ? "on" : ""} onClick={() => openWallet(k.address)}>
              <span><b>{k.name}</b><i>{k.twitter || shortAddr(k.address)}</i></span>
              <em>{k.hits ?? 0}</em>
            </button>
          ))}
        </div>
      </aside>

      <section className="oxw-term">
        <div className="oxw-term-main">
          <div className="oxw-pane-h">
            <span>Transaction terminal</span>
            <div className="oxw-term-tabs">
              {([["TAPE", "LIVE TAPE"], ["ORBITX", "ORBITX"], ["WHALES", "WHALES"], ["KOLS", "KOLS"], ["WALLETS", "WALLETS"]] as const).map(([t, label]) => (
                <button key={t} className={termTab === t ? "active" : ""} type="button" onClick={() => setTermTab(t)}>{label}</button>
              ))}
            </div>
          </div>
          <table className="oxw-table">
            <thead>
              <tr><th>Time</th><th>Type</th><th>Wallet</th><th>Token / action</th><th>Amount</th><th>Value</th><th>Tx</th></tr>
            </thead>
            <tbody>
              {termRows.slice(0, 40).map((ev) => (
                <tr key={ev.event_id} className={followId === ev.event_id ? "on" : ""} onClick={() => openEvent(ev)}>
                  <td>{clock(ev.block_time)}</td>
                  <td>{eventTitle(ev.event_type)}</td>
                  <td>{ev.wallet_label || shortAddr(ev.wallet)}</td>
                  <td>{ev.token_symbol ? `$${ev.token_symbol}` : ev.event_type.includes("SOL") ? "SOL" : "—"}</td>
                  <td>{fmtNum(ev.amount)}</td>
                  <td>{fmtUsd(ev.usd_value)}</td>
                  <td>{shortAddr(ev.signature, 4, 3)}</td>
                </tr>
              ))}
              {!termRows.length ? <tr><td colSpan={7} className="oxw-empty">No indexed rows in this layer yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="oxw-term-chart">
          <div className="oxw-pane-h"><span>Events / second</span><span>{fmtNum(live.stats.events_per_sec)}</span></div>
          <svg className="oxw-spark" viewBox="0 0 240 92" aria-label="Events per second">
            <polygon className="fill" points={sparkArea} />
            <polyline className="line" points={spark || "0,86 240,86"} />
          </svg>
          <div className="oxw-leg">
            <span>Tx/min <b>{fmtNum(live.stats.transactions_per_min, 0)}</b></span>
            <span>OrbitX buys <b>{fmtNum(live.stats.orbitx_buys, 0)}</b></span>
            <span>Whale <b>{fmtUsd(live.stats.whale_usd)}</b></span>
          </div>
        </div>
      </section>

      <footer className="oxw-foot">
        <span>NETWORK <b>SOLANA MAINNET</b></span>
        <span>RPC STATUS <b className={live.chain_slot != null ? "ok" : "warn"}>{live.chain_slot != null ? "HEALTHY" : "UNKNOWN"}</b></span>
        <span>LAST INDEXED BLOCK <b>{fmtNum(live.last_slot ?? live.chain_slot, 0)}</b></span>
        <span>INDEXING DELAY <b className={delay ? "warn" : "ok"}>{delay ? live.live_label : `${live.ingest_age_sec ?? "UNKNOWN"}s`}</b></span>
        <span>WS CONNECTION <b>{live.websocket_status || "polling"}</b></span>
        <span>ORBITX ON-CHAIN v1.1.0</span>
      </footer>
    </div>
  );
}
