import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ChainEvent, FilterState, KolCard, LivePayload, OrbitxPayload, TokenPayload, WalletPayload } from "./api";
import { fetchKols, fetchLive, fetchOrbitx, fetchSearch, fetchToken, fetchTx, fetchWallet } from "./api";
import { clock, eventTitle, eventTone, fmtNum, fmtSol, fmtUsd, shortAddr } from "./format";
import LivingMap from "./LivingMap";
import type { WorldPick } from "./WorldCanvas";
import { activeOrbitxKols } from "../../../shared/orbitx-kol-directory.js";
import "./onchain-world.css";

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
  stats: { events_per_sec: 0, transactions_per_min: 0, orbitx_buys: 0, orbitx_burned: 0, whale_usd: 0, active_wallets: 0, assigned_kols: DIRECTORY_KOLS.length },
  events: [],
  kols: DIRECTORY_KOLS,
  flows: [],
};

const FILTER0: FilterState = { type: "", orbitx: false, whale: false, kol: false, minUsd: "", source: "", token: "", wallet: "" };

type Mode = "world" | "terminal" | "orbitx" | "wallets";
type Tab = "SUMMARY" | "FLOW" | "EVENTS" | "RAW";
type Detail =
  | { kind: "event"; event: ChainEvent }
  | { kind: "wallet"; data: WalletPayload }
  | { kind: "token"; data: TokenPayload }
  | { kind: "tx"; data: Record<string, unknown> }
  | { kind: "orbitx"; data: OrbitxPayload }
  | null;

class ErrorCatch extends Component<{ children: ReactNode; fallback: () => void }, { fail: boolean }> {
  state = { fail: false };
  static getDerivedStateFromError() { return { fail: true }; }
  componentDidCatch() { this.props.fallback(); }
  render() { return this.state.fail ? null : this.props.children; }
}

function isMobile() {
  if (typeof window === "undefined") return true;
  return window.innerWidth < 1100 || Boolean(window.matchMedia?.("(pointer: coarse)")?.matches);
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

function eventKind(type: string): string {
  if (type.includes("BURN")) return "BURN";
  if (type.includes("BUY")) return "BUY";
  if (type.includes("SELL")) return "SELL";
  if (type.includes("SOL")) return "SOL";
  if (type.includes("TRANSFER")) return "XFER";
  if (type.includes("SWAP")) return "SWAP";
  return type.replace(/_/g, " ").slice(0, 8);
}

export default function OnChainWorldApp() {
  const nav = useNavigate();
  const params = useParams();
  const [mode, setMode] = useState<Mode>("world");
  const [paused, setPaused] = useState(false);
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<FilterState>(FILTER0);
  const [live, setLive] = useState<LivePayload>(EMPTY_LIVE);
  const [kols, setKols] = useState<KolCard[]>(DIRECTORY_KOLS);
  const [detail, setDetail] = useState<Detail>(null);
  const [tab, setTab] = useState<Tab>("SUMMARY");
  const [err, setErr] = useState<string | null>(null);
  const [worldOk, setWorldOk] = useState(() => !isMobile());
  const [followId, setFollowId] = useState<string | null>(null);
  const [followWallet, setFollowWallet] = useState<string | null>(null);
  const [hudOpen, setHudOpen] = useState(true);
  const seen = useRef(new Set<string>());
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  const loadLive = useCallback(async () => {
    if (paused) return;
    try {
      const [data, roster] = await Promise.all([fetchLive(filters), fetchKols().catch(() => null)]);
      setLive(data.ok ? data : {
        ...EMPTY_LIVE,
        live_reason: "Indexer has not completed a run. Assigned KOLs are still on the map.",
      });
      if (roster?.ok && roster.kols.length) setKols(roster.kols);
      else if (data.kols?.length) setKols(data.kols);
      else setKols(DIRECTORY_KOLS);
      setErr(null);
      const news = new Set<string>();
      for (const ev of data.events || []) {
        if (!seen.current.has(ev.event_id)) news.add(ev.event_id);
      }
      if (news.size) {
        seen.current = new Set((data.events || []).map((e) => e.event_id));
        setFresh(news);
        window.setTimeout(() => setFresh(new Set()), 2200);
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
    const onResize = () => { if (isMobile()) setWorldOk(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (params.signature) {
      void fetchTx(params.signature).then((data) => {
        if (data && data.signature) setDetail({ kind: "tx", data });
      }).catch(() => undefined);
      return;
    }
    if (params.address && location.pathname.includes("/wallet/")) {
      const address = params.address;
      setFollowWallet(address);
      const known = DIRECTORY_KOLS.find((k) => k.address === address);
      if (known) {
        setDetail({
          kind: "wallet",
          data: {
            ok: false,
            address,
            kol: { address: known.address, name: known.name, twitter: known.twitter, status: known.status },
            assigned_kol: true,
            label: known.name,
            label_kind: "KOL",
          },
        });
      }
      void fetchWallet(address).then((data) => {
        if (data?.ok) setDetail({ kind: "wallet", data });
      }).catch(() => undefined);
      return;
    }
    if (params.address && location.pathname.includes("/token/")) {
      void fetchToken(params.address).then((data) => {
        if (data?.ok) setDetail({ kind: "token", data });
      }).catch(() => undefined);
    }
  }, [params.address, params.signature]);

  const events = live.events || [];
  const flows = live.flows || [];
  const roster = kols.length ? kols : live.kols || [];

  const tape = useMemo(() => {
    if (mode === "orbitx") return events.filter((e) => e.orbitx_related);
    if (mode === "wallets" && followWallet) {
      return events.filter((e) => e.wallet === followWallet || e.source_wallet === followWallet || e.destination_wallet === followWallet);
    }
    if (mode === "wallets") return events.filter((e) => e.kol_related);
    return events;
  }, [events, mode, followWallet]);

  async function onSearch(ev?: FormEvent) {
    ev?.preventDefault();
    const query = q.trim();
    if (!query) return;
    const data = await fetchSearch(query);
    if (data.signature) {
      nav(`/on-chain/tx/${String(data.signature)}`);
      setDetail({ kind: "tx", data });
      return;
    }
    if (data.address && (data.holdings || data.assigned_kol || data.wallet)) {
      nav(`/on-chain/wallet/${String(data.address)}`);
      setDetail({ kind: "wallet", data: data as unknown as WalletPayload });
      setFollowWallet(String(data.address));
      return;
    }
    if (data.mint) {
      nav(`/on-chain/token/${String(data.mint)}`);
      setDetail({ kind: "token", data: data as unknown as TokenPayload });
      return;
    }
    setDetail({ kind: "tx", data });
  }

  const openEvent = useCallback((event: ChainEvent) => {
    setDetail({ kind: "event", event });
    setFollowId(event.event_id);
    setFollowWallet(event.wallet || event.source_wallet);
    setTab("SUMMARY");
    if (event.wallet) {
      void fetchWallet(event.wallet).then((data) => setDetail({ kind: "wallet", data })).catch(() => undefined);
    }
  }, []);

  const openWallet = useCallback((address: string) => {
    setFollowWallet(address);
    setFollowId(null);
    setTab("SUMMARY");
    nav(`/on-chain/wallet/${address}`);
    const known = DIRECTORY_KOLS.find((k) => k.address === address) || kols.find((k) => k.address === address);
    const fallback: WalletPayload = {
      ok: false,
      address,
      kol: known ? { address: known.address, name: known.name, twitter: known.twitter, status: known.status } : null,
      assigned_kol: Boolean(known),
      label: known?.name || null,
      label_kind: known ? "KOL" : "Wallet",
    };
    setDetail({ kind: "wallet", data: fallback });
    void fetchWallet(address).then((data) => {
      if (data?.ok) setDetail({ kind: "wallet", data });
    }).catch(() => undefined);
  }, [nav, kols]);

  const onPick = useCallback((pick: WorldPick) => {
    if (pick.kind === "event") return openEvent(pick.event);
    if (pick.kind === "wallet") return openWallet(pick.address);
    nav(`/on-chain/token/${pick.mint}`);
    void fetchToken(pick.mint).then((data) => setDetail({ kind: "token", data })).catch(() => setDetail(null));
  }, [nav, openEvent, openWallet]);

  async function openOrbitx() {
    setMode("orbitx");
    const data = await fetchOrbitx();
    setDetail({ kind: "orbitx", data });
    setTab("SUMMARY");
  }

  const selected = detail?.kind === "event" ? detail.event : null;
  const wallet = detail?.kind === "wallet" ? detail.data : null;
  const token = detail?.kind === "token" ? detail.data : null;
  const orbitx = detail?.kind === "orbitx" ? detail.data : null;
  const delay = !live.live;

  return (
    <div className="oxw">
      {mode === "world" && worldOk ? (
        <div className="oxw-world">
          <ErrorCatch fallback={() => setWorldOk(false)}>
            <Suspense fallback={null}>
              <WorldCanvas
                events={events}
                kols={roster}
                flows={flows}
                followId={followId}
                followWallet={followWallet}
                onPick={onPick}
              />
            </Suspense>
          </ErrorCatch>
        </div>
      ) : (
        <div className="oxw-world oxw-world-flat">
          <LivingMap
            events={events}
            kols={roster}
            flows={flows}
            followWallet={followWallet}
            onWallet={openWallet}
            onEvent={openEvent}
          />
        </div>
      )}

      <header className="oxw-hud-top">
        <div className="oxw-brand">
          <b>ORBITX ON-CHAIN</b>
          <span>Living intelligence world · Solscan × Arkham × Nansen</span>
        </div>
        <div className="oxw-live">
          <i className={`oxw-dot${delay ? " delay" : ""}`} />
          {live.live_label}
          {live.live_reason ? <em>{live.live_reason}</em> : null}
        </div>
        <div className="oxw-stats">
          <div className="oxw-stat"><em>Slot</em><b>{fmtNum(live.chain_slot, 0)}</b></div>
          <div className="oxw-stat"><em>Events / sec</em><b>{fmtNum(live.stats.events_per_sec)}</b></div>
          <div className="oxw-stat"><em>$ORBITX buys</em><b>{fmtNum(live.stats.orbitx_buys, 0)}</b></div>
          <div className="oxw-stat"><em>Burned</em><b>{fmtNum(live.stats.orbitx_burned)}</b></div>
          <div className="oxw-stat"><em>KOLs</em><b>{fmtNum(live.stats.assigned_kols ?? roster.length, 0)}</b></div>
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
        <button className="oxw-btn" type="button" onClick={() => void loadLive()}>Refresh</button>
        <button className="oxw-btn" type="button" onClick={() => nav("/intel")}>Intel</button>
      </div>

      {hudOpen ? (
        <aside className="oxw-hud-left">
          <h3>Layers</h3>
          <div className="oxw-filters">
            <label>
              Event
              <select value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
                <option value="">All observed types</option>
                {["BUY", "SELL", "TOKEN_BURN", "SOL_TRANSFER", "TOKEN_TRANSFER", "SWAP", "ORBITX_BUY", "ORBITX_SELL", "ORBITX_BURN", "KOL_BUY", "WHALE_BUY"].map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                ))}
              </select>
            </label>
            <label className="oxw-check"><input type="checkbox" checked={filters.orbitx} onChange={(e) => setFilters((f) => ({ ...f, orbitx: e.target.checked }))} /> $ORBITX layer only</label>
            <label className="oxw-check"><input type="checkbox" checked={filters.kol} onChange={(e) => setFilters((f) => ({ ...f, kol: e.target.checked }))} /> Assigned KOLs</label>
            <label className="oxw-check"><input type="checkbox" checked={filters.whale} onChange={(e) => setFilters((f) => ({ ...f, whale: e.target.checked }))} /> Whale-sized</label>
            <button type="button" className="oxw-btn" onClick={() => setHudOpen(false)}>Hide HUD</button>
          </div>
          <h3>KOL directory · {roster.length}</h3>
          <div className="oxw-kol">
            {roster.length === 0 ? (
              <div className="oxw-empty">Assigned KOL directory is loading.</div>
            ) : roster.map((k) => (
              <button key={k.address} type="button" className={followWallet === k.address ? "on" : ""} onClick={() => openWallet(k.address)}>
                <span>
                  <b>{k.name}</b>
                  <i>{k.twitter || shortAddr(k.address)}</i>
                </span>
                <em>{k.hits ?? 0} hits · {k.last_type ? eventKind(k.last_type) : "quiet"}</em>
              </button>
            ))}
          </div>
        </aside>
      ) : (
        <button className="oxw-btn oxw-show-hud" type="button" onClick={() => setHudOpen(true)}>HUD</button>
      )}

      <aside className="oxw-hud-right">
        <h3>Live tape · {tape.length}</h3>
        <div className="oxw-feed-list">
          {tape.length === 0 ? (
            <div className="oxw-empty">
              {err || live.live_reason || (delay
                ? "Indexer is quiet. The world stays empty until confirmed signatures land."
                : "Waiting for the next confirmed movement.")}
            </div>
          ) : tape.slice(0, 80).map((ev) => (
            <button
              key={ev.event_id}
              type="button"
              className={`oxw-ev ${eventTone(ev.event_type)}${fresh.has(ev.event_id) ? " fresh" : ""}${followId === ev.event_id ? " on" : ""}`}
              onClick={() => openEvent(ev)}
            >
              <time>{clock(ev.block_time)}</time>
              <span>
                <b>{eventTitle(ev.event_type)}</b>
                <i>{ev.wallet_label || shortAddr(ev.wallet || ev.source_wallet)}{ev.kol_related ? " · KOL" : ev.whale_related ? " · WHALE" : ""}</i>
              </span>
              <em>{ev.amount != null ? fmtNum(ev.amount) : ev.sol_amount != null ? fmtSol(ev.sol_amount) : fmtUsd(ev.usd_value)} {ev.token_symbol || ""}</em>
            </button>
          ))}
        </div>
      </aside>

      {mode === "terminal" && (
        <section className="oxw-term-layer">
          <div className="oxw-term">
            {tape.map((ev) => (
              <button key={ev.event_id} type="button" className="oxw-term-row" onClick={() => openEvent(ev)}>
                <span>{clock(ev.block_time)}</span>
                <span>{eventTitle(ev.event_type)}</span>
                <span>{ev.description || `${shortAddr(ev.wallet)} → ${shortAddr(ev.destination_wallet || ev.token_ca)}`}</span>
                <span>{fmtUsd(ev.usd_value)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="oxw-hud-bottom">
        <div className="oxw-tabs">
          {(["SUMMARY", "FLOW", "EVENTS", "RAW"] as const).map((id) => (
            <button key={id} type="button" className={`oxw-btn${tab === id ? " active" : ""}`} onClick={() => setTab(id)}>{id}</button>
          ))}
          {detail && (
            <button
              type="button"
              className="oxw-btn"
              onClick={() => {
                setDetail(null);
                setFollowId(null);
                setFollowWallet(null);
                nav("/on-chain");
              }}
            >
              Clear
            </button>
          )}
        </div>

        {tab === "SUMMARY" && (
          <div className="oxw-grid">
            {wallet ? (
              <>
                <Kv k="Subject" v={wallet.kol?.name || wallet.label || shortAddr(wallet.address)} />
                <Kv k="Kind" v={wallet.assigned_kol ? "ASSIGNED KOL" : wallet.label_kind || wallet.kind || "Wallet"} />
                <Kv k="Twitter" v={wallet.kol?.twitter || "UNKNOWN"} />
                <Kv k="Address" v={shortAddr(wallet.address, 8, 6)} href={`https://solscan.io/account/${wallet.address}`} />
                <Kv k="SOL" v={fmtSol(wallet.sol)} />
                <Kv k="$ORBITX now" v={fmtNum(wallet.orbitx?.amount ?? wallet.orbitx?.balance)} />
                <Kv k="Lifetime bought" v={fmtNum(wallet.orbitx?.bought ?? wallet.orbitx?.bought_amount)} />
                <Kv k="Lifetime sold" v={fmtNum(wallet.orbitx?.sold ?? wallet.orbitx?.sold_amount)} />
                <Kv k="Burned" v={fmtNum(wallet.orbitx?.burned ?? wallet.orbitx?.burned_amount)} />
                <Kv k="Holdings known" v={fmtNum(wallet.holdings?.length, 0)} />
              </>
            ) : selected ? (
              <>
                <Kv k="Type" v={selected.event_type} />
                <Kv k="Amount" v={selected.amount != null ? `${fmtNum(selected.amount)} ${selected.token_symbol || ""}` : "UNKNOWN"} />
                <Kv k="SOL" v={fmtSol(selected.sol_amount)} />
                <Kv k="USD" v={fmtUsd(selected.usd_value)} />
                <Kv k="From" v={shortAddr(selected.source_wallet || selected.wallet)} />
                <Kv k="To" v={shortAddr(selected.destination_wallet || selected.counterparty)} />
                <Kv k="Token" v={selected.token_symbol || shortAddr(selected.token_ca)} />
                <Kv k="Slot" v={fmtNum(selected.slot, 0)} />
                <Kv k="Signature" v={shortAddr(selected.signature, 8, 6)} href={`https://solscan.io/tx/${selected.signature}`} />
                <Kv k="Attribution" v={selected.attribution} />
              </>
            ) : token ? (
              <>
                <Kv k="Token" v={token.token?.symbol || shortAddr(token.mint)} />
                <Kv k="Mint" v={shortAddr(token.mint, 8, 6)} href={`https://solscan.io/token/${token.mint}`} />
                <Kv k="Price" v={fmtUsd(token.token?.price_usd)} />
                <Kv k="Market cap" v={fmtUsd(token.token?.market_cap)} />
                <Kv k="Indexed txs" v={fmtNum(token.events?.length, 0)} />
              </>
            ) : orbitx ? (
              <>
                <Kv k="Layer" v="$ORBITX" />
                <Kv k="Burned" v={fmtNum(orbitx.totals?.burned)} />
                <Kv k="Burn events" v={fmtNum(orbitx.totals?.burn_events, 0)} />
                <Kv k="Buy USD" v={fmtUsd(orbitx.totals?.buy_usd)} />
                <Kv k="Sell USD" v={fmtUsd(orbitx.totals?.sell_usd)} />
                <Kv k="Wallets" v={fmtNum(orbitx.totals?.unique_wallets, 0)} />
              </>
            ) : (
              <div className="oxw-empty">Click a KOL character, a token district, or a transit orb. Camera follows the subject. Confirmed Solana only.</div>
            )}
          </div>
        )}

        {tab === "FLOW" && (
          <div className="oxw-term">
            {selected ? (
              <>
                <div className="oxw-term-row"><span>ORIGIN</span><span>{shortAddr(selected.source_wallet || selected.wallet, 8, 6)}</span><span>{selected.wallet_label || "unlabeled"}</span><span /></div>
                <div className="oxw-term-row"><span>ASSET</span><span>{fmtNum(selected.amount)} {selected.token_symbol || ""}</span><span>{fmtSol(selected.sol_amount)}</span><span>{fmtUsd(selected.usd_value)}</span></div>
                <div className="oxw-term-row"><span>DEST</span><span>{shortAddr(selected.destination_wallet || selected.counterparty, 8, 6)}</span><span>{selected.event_type.includes("BURN") ? "burn" : selected.source || "program"}</span><span /></div>
                <div className="oxw-term-row"><span>SIG</span><span>{shortAddr(selected.signature, 10, 8)}</span><span>slot {fmtNum(selected.slot, 0)}</span><span /></div>
              </>
            ) : (wallet?.flows || flows).slice(0, 10).map((f) => (
              <div key={`${f.from_address}-${f.to_address}-${f.last_signature || ""}`} className="oxw-term-row">
                <span>{shortAddr(f.from_address)}</span>
                <span>→ {shortAddr(f.to_address)}</span>
                <span>{fmtNum(f.total_amount)} {f.token_symbol || ""} · {fmtSol(f.total_sol)}</span>
                <span>{f.transfer_count} hits</span>
              </div>
            ))}
            {!selected && !(wallet?.flows || flows).length ? <div className="oxw-empty">Flow corridors appear when the same counterparties repeat.</div> : null}
          </div>
        )}

        {tab === "EVENTS" && (
          <div className="oxw-feed-list" style={{ maxHeight: 180 }}>
            {(wallet?.events || token?.events || orbitx?.events || tape).slice(0, 16).map((ev) => (
              <button key={ev.event_id} type="button" className={`oxw-ev ${eventTone(ev.event_type)}`} onClick={() => openEvent(ev)}>
                <time>{clock(ev.block_time)}</time>
                <span><b>{eventTitle(ev.event_type)}</b><i>{shortAddr(ev.wallet)}</i></span>
                <em>{fmtNum(ev.amount)} {ev.token_symbol || ""}</em>
              </button>
            ))}
          </div>
        )}

        {tab === "RAW" && (
          <pre className="oxw-raw">
            {JSON.stringify(
              wallet
                ? { address: wallet.address, kol: wallet.kol, orbitx: wallet.orbitx, sol: wallet.sol }
                : selected
                  ? { signature: selected.signature, slot: selected.slot, type: selected.event_type, amount: selected.amount, from: selected.source_wallet, to: selected.destination_wallet }
                  : token || orbitx || { hint: "select a subject" },
              null,
              2,
            )}
          </pre>
        )}
      </section>
    </div>
  );
}
