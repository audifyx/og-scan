/**
 * Pulse — the social DEX feed for the Trade Terminal.
 *
 * Cloned from the ogdex Pulse feed (web/ogdex/src/pages/Pulse.tsx, read-only):
 * signal cards with type label/icon, strength bar, mcap/liq/change, bonding
 * progress for graduating tokens, stat deck, type filters, auto-refresh
 * (30s), honest empty state. Whales + sentiment live INSIDE Pulse as a
 * social feed of coins, folded in from the KolWhaleActivity pattern
 * (web/ogdex/src/components/KolWhaleActivity.tsx):
 *  - Buy/sell pressure per coin: the signal's own metric (buys vs sells in
 *    the last 5m, from /api/ogdex/signals) + real tracked KOL/whale rows for
 *    the selected token from /api/ogdex/kols?feed=1&token=<mint>.
 *  - KOL mentions: the global tracked-KOL feed
 *    (/api/ogdex/kols?feed=1&limit=50) — real rows only, newest first.
 *  - Sentiment: the mood meter is computed from the live signal set
 *    (bullish-type share), never a guessed number.
 * Nothing is invented: if a feed returns nothing, the honest empty state
 * shows instead. Self-contained — takes no required props, fetches its own
 * data — so it mounts in place of the Discover "Trending" list.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  Crown,
  ExternalLink,
  Flame,
  Gauge,
  LayoutGrid,
  List,
  Loader2,
  Radio,
  RefreshCw,
  Rocket,
  Sparkles,
  TrendingUp,
  Users,
  Waves,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  buySellPressure,
  fetchKolFeed,
  fetchSignals,
  filterSignals,
  mergeKolRows,
  moodOf,
  sortSignals,
  toneFor,
  typeMetaFor,
  type KolFeedRow,
  type PulseSignal,
  type PulseSort,
  type SignalIconKey,
} from "./pulseApi";
import { fmtPct, fmtUsd, shortAddr, timeAgo } from "./tradeFmt";
import TokenAvatar from "./TokenAvatar";
import "./pulse-feed.css";

const ICONS: Record<SignalIconKey, LucideIcon> = {
  rocket: Rocket,
  badge: BadgeCheck,
  waves: Waves,
  users: Users,
  trending: TrendingUp,
  gauge: Gauge,
  sparkles: Sparkles,
  alert: AlertTriangle,
  zap: Zap,
};

const FILTER_CHIPS: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "graduating", label: "Graduating" },
  { id: "graduated", label: "Graduated" },
  { id: "volume_surge", label: "Volume" },
  { id: "buyer_surge", label: "Buyers" },
  { id: "momentum", label: "Momentum" },
  { id: "velocity_spike", label: "Velocity" },
  { id: "fresh_runner", label: "Fresh" },
  { id: "selloff", label: "Sell-Off" },
];

function pctClass(v?: number | null): string {
  if (v == null) return "pf__muted";
  return v >= 0 ? "pf__up" : "pf__down";
}

function SignalCard({
  s,
  selected,
  onSelect,
}: {
  s: PulseSignal;
  selected: boolean;
  onSelect: (mint: string) => void;
}) {
  const meta = typeMetaFor(s.type, s.label);
  const tone = toneFor(s.tone);
  const Icon = ICONS[meta.icon] || Zap;
  const strength = s.strength ?? 50;
  const sym = (s.symbol || "").trim() || shortAddr(s.mint, 4);
  return (
    <button
      type="button"
      onClick={() => onSelect(s.mint)}
      aria-pressed={selected}
      className={`pf__card pf__tone--${tone}${selected ? " pf__card--on" : ""}`}
    >
      <span
        className="pf__card-bar"
        style={{ height: `${Math.min(100, Math.max(4, strength))}%` }}
        aria-hidden
      />
      <span className="pf__card-main">
        <TokenAvatar image={s.icon} symbol={sym} mint={s.mint} size={40} className="pf__logo" />
        <span className="pf__card-body">
          <span className="pf__card-top">
            <span className="pf__sym">{sym}</span>
            <span className={`pf__type pf__type--${tone}`}>
              <Icon className="pf__type-icon" />
              {meta.label}
            </span>
            {strength > 0 && <span className="pf__str">STR {Math.round(strength)}</span>}
          </span>
          <span className="pf__metric">{s.metric || s.name || "—"}</span>
          {s.type === "graduating" && s.bondingPct != null && (
            <span className="pf__bond">
              <span className="pf__bond-track">
                <span className="pf__bond-fill" style={{ width: `${Math.min(100, s.bondingPct)}%` }} />
              </span>
              <span className="pf__bond-label">{s.bondingPct}% bonded</span>
            </span>
          )}
        </span>
        <span className="pf__card-side">
          <span className="pf__mcap">{s.mcap ? fmtUsd(s.mcap) : s.priceUsd ? fmtUsd(s.priceUsd) : "—"}</span>
          <span className="pf__sub">
            {s.type === "graduating" && s.bondingPct != null ? (
              <span className="pf__up">{s.bondingPct}% bonded</span>
            ) : (
              <>
                {s.liq ? `$${fmtUsd(s.liq).replace("$", "")} liq` : ""}
                {s.ch24h != null && (
                  <span className={pctClass(s.ch24h)}> {fmtPct(s.ch24h)}</span>
                )}
              </>
            )}
          </span>
        </span>
      </span>
    </button>
  );
}

function KolRow({ r }: { r: KolFeedRow }) {
  const isBuy = r.side === "buy";
  const name = (r.name || "").trim();
  return (
    <div className="pf__kol-row">
      <span className={`pf__kol-side ${isBuy ? "pf__kol-side--buy" : "pf__kol-side--sell"}`}>
        {isBuy ? <ArrowUpRight className="pf__kol-side-icon" /> : <ArrowDownRight className="pf__kol-side-icon" />}
      </span>
      <span className="pf__kol-body">
        <span className="pf__kol-who">
          {name ? (
            <span className="pf__kol-name">{name}</span>
          ) : (
            <span className="pf__kol-whale">
              <Crown className="pf__kol-crown" />
              Whale {shortAddr(r.kolAddress || "", 4)}
            </span>
          )}
          {r.symbol && <span className="pf__kol-token">${r.symbol}</span>}
          <span className="pf__kol-action">{isBuy ? "bought" : "sold"}</span>
        </span>
        <span className="pf__kol-amount">
          {r.tokenAmount != null && Number.isFinite(Number(r.tokenAmount))
            ? `${Number(r.tokenAmount).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${r.symbol || "tokens"}`
            : ""}
          {r.usdValue != null && (
            <span className="pf__kol-usd"> · {fmtUsd(Number(r.usdValue))}</span>
          )}
        </span>
      </span>
      <span className="pf__kol-right">
        <span className="pf__kol-time">{r.time ? `${timeAgo(r.time)} ago` : "—"}</span>
        {r.txHash && (
          <a
            href={`https://solscan.io/tx/${r.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="pf__kol-tx"
            onClick={(e) => e.stopPropagation()}
          >
            tx <ExternalLink className="pf__kol-tx-icon" />
          </a>
        )}
      </span>
    </div>
  );
}

export default function PulseFeed() {
  const navigate = useNavigate();
  const [signals, setSignals] = useState<PulseSignal[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<PulseSort>("strength");
  const [view, setView] = useState<"grid" | "list">("list");
  const [updated, setUpdated] = useState("");
  const [selectedMint, setSelectedMint] = useState<string | null>(null);
  const [kolRows, setKolRows] = useState<KolFeedRow[]>([]);
  const [kolLoading, setKolLoading] = useState(false);
  const [globalKol, setGlobalKol] = useState<KolFeedRow[]>([]);
  const [globalKolLoading, setGlobalKolLoading] = useState(true);
  const timer = useRef<number | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    const { signals: sig, counts: c } = await fetchSignals();
    setSignals(sig);
    setCounts(c);
    setUpdated(new Date().toLocaleTimeString());
    setLoading(false);
    setRefreshing(false);
  }, []);

  const loadGlobalKol = useCallback(async () => {
    const rows = await fetchKolFeed({ limit: 50 });
    setGlobalKol(mergeKolRows(rows));
    setGlobalKolLoading(false);
  }, []);

  useEffect(() => {
    void load();
    void loadGlobalKol();
    timer.current = window.setInterval(() => {
      void load();
      void loadGlobalKol();
    }, 30000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [load, loadGlobalKol]);

  // Per-token KOL / whale feed when a signal is selected.
  useEffect(() => {
    if (!selectedMint) {
      setKolRows([]);
      return;
    }
    let on = true;
    setKolLoading(true);
    fetchKolFeed({ token: selectedMint, limit: 50 }).then((rows) => {
      if (!on) return;
      setKolRows(mergeKolRows(rows));
      setKolLoading(false);
    });
    return () => {
      on = false;
    };
  }, [selectedMint]);

  const filtered = useMemo(() => filterSignals(signals, filter), [signals, filter]);
  const shown = useMemo(() => sortSignals(filtered, sort), [filtered, sort]);
  const mood = useMemo(() => moodOf(signals), [signals]);
  const selected = useMemo(
    () => signals.find((s) => s.mint === selectedMint) || null,
    [signals, selectedMint],
  );
  const pressure = useMemo(() => buySellPressure(kolRows), [kolRows]);

  const chips = FILTER_CHIPS.filter((c) => c.id === "all" || (counts[c.id] || 0) > 0).map((c) => ({
    ...c,
    n: c.id === "all" ? signals.length : counts[c.id] || 0,
  }));

  const openCoin = (mint: string) => navigate(`/trade/token/${mint}`);

  return (
    <div className="pf">
      <div className="pf__head">
        <div>
          <p className="pf__kicker">Live anomaly detection</p>
          <h2 className="pf__title">Pulse</h2>
          <p className="pf__sub">
            Volume spikes, buyer surges, momentum, fresh runners, graduations, and sell-offs — refreshed every 30s.
          </p>
        </div>
        <div className="pf__head-actions">
          <span className="pf__live">
            <Flame className="pf__live-icon" /> Live
          </span>
          <button
            type="button"
            className="pf__refresh"
            onClick={() => {
              void load();
              void loadGlobalKol();
            }}
            aria-label="Refresh Pulse"
          >
            <RefreshCw className={`pf__refresh-icon${refreshing ? " pf__spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="pf__deck" role="list" aria-label="Pulse stats">
        <div className="pf__stat" role="listitem">
          <span className="pf__stat-label">Signals</span>
          <span className="pf__stat-value">{signals.length}</span>
          <span className="pf__stat-sub">active now</span>
        </div>
        <div className="pf__stat" role="listitem">
          <span className="pf__stat-label">Mood</span>
          <span className={`pf__stat-value ${mood.pct >= 55 ? "pf__up" : mood.pct <= 45 ? "pf__down" : ""}`}>
            {signals.length ? `${mood.pct}%` : "—"}
          </span>
          <span className="pf__stat-sub">bullish bias · {mood.bull} bull / {mood.bear} bear</span>
        </div>
        <div className="pf__stat" role="listitem">
          <span className="pf__stat-label">Graduating</span>
          <span className="pf__stat-value pf__up">{counts.graduating || 0}</span>
          <span className="pf__stat-sub">near migration</span>
        </div>
        <div className="pf__stat" role="listitem">
          <span className="pf__stat-label">Surges</span>
          <span className="pf__stat-value">{(counts.volume_surge || 0) + (counts.buyer_surge || 0)}</span>
          <span className="pf__stat-sub">vol + buyers</span>
        </div>
        <div className="pf__stat" role="listitem">
          <span className="pf__stat-label">Sell-offs</span>
          <span className="pf__stat-value">{counts.selloff || 0}</span>
          <span className="pf__stat-sub">distribution</span>
        </div>
        <div className="pf__stat" role="listitem">
          <span className="pf__stat-label">Updated</span>
          <span className="pf__stat-value pf__stat-value--sm">{updated || "—"}</span>
          <span className="pf__stat-sub">local time</span>
        </div>
      </div>

      <div className="pf__controls">
        <div className="pf__chips" role="tablist" aria-label="Signal types">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={filter === c.id}
              onClick={() => setFilter(c.id)}
              className={`pf__chip${filter === c.id ? " pf__chip--on" : ""}`}
            >
              {c.label}
              {c.n > 0 && <span className="pf__chip-n">{c.n}</span>}
            </button>
          ))}
        </div>
        <div className="pf__sorts" role="tablist" aria-label="Sort signals">
          {(["strength", "mcap", "change"] as PulseSort[]).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={sort === s}
              onClick={() => setSort(s)}
              className={`pf__sort${sort === s ? " pf__sort--on" : ""}`}
            >
              {s === "strength" ? "Strength" : s === "mcap" ? "MCap" : "24h %"}
            </button>
          ))}
          <button
            type="button"
            className="pf__view"
            onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}
            aria-label={view === "grid" ? "Switch to list view" : "Switch to grid view"}
          >
            {view === "grid" ? <List className="pf__view-icon" /> : <LayoutGrid className="pf__view-icon" />}
          </button>
        </div>
      </div>

      {loading && signals.length === 0 ? (
        <div className="pf__loading">
          <Loader2 className="pf__spin pf__loading-icon" />
          <p>Scanning on-chain anomalies…</p>
        </div>
      ) : shown.length === 0 ? (
        <div className="pf__empty">
          <p className="pf__empty-title">No active signals — market is quiet</p>
          <p className="pf__empty-copy">Auto-refreshing every 30 seconds.</p>
        </div>
      ) : (
        <div className={view === "grid" ? "pf__grid" : "pf__list"}>
          {shown.map((s) => (
            <SignalCard
              key={`${s.mint}:${s.type}`}
              s={s}
              selected={selectedMint === s.mint}
              onSelect={(mint) => setSelectedMint((cur) => (cur === mint ? null : mint))}
            />
          ))}
        </div>
      )}

      {/* Selected coin — whales, KOLs & buy/sell pressure (real data only) */}
      {selected && (
        <section className="pf__detail" aria-label="Whale and KOL activity">
          <div className="pf__detail-head">
            <div className="pf__detail-title">
              <TokenAvatar image={selected.icon} symbol={selected.symbol} mint={selected.mint} size={32} className="pf__logo" />
              <div className="min-w-0">
                <p className="pf__detail-sym">${(selected.symbol || "").trim() || shortAddr(selected.mint, 4)}</p>
                <p className="pf__detail-sub">{selected.metric || selected.name || "Selected signal"}</p>
              </div>
            </div>
            <div className="pf__detail-actions">
              <button type="button" className="pf__open" onClick={() => openCoin(selected.mint)}>
                Open coin
              </button>
              <button
                type="button"
                className="pf__close"
                onClick={() => setSelectedMint(null)}
                aria-label="Close whale activity"
              >
                <X className="pf__close-icon" />
              </button>
            </div>
          </div>

          <div className="pf__pressure">
            <span className="pf__pressure-item">
              <span className="pf__pressure-label">5m</span>
              <span className={pctClass(selected.ch5m)}>{selected.ch5m != null ? fmtPct(selected.ch5m) : "—"}</span>
            </span>
            <span className="pf__pressure-item">
              <span className="pf__pressure-label">1h</span>
              <span className={pctClass(selected.ch1h)}>{selected.ch1h != null ? fmtPct(selected.ch1h) : "—"}</span>
            </span>
            <span className="pf__pressure-item">
              <span className="pf__pressure-label">KOL buys</span>
              <span className="pf__up">{kolLoading ? "…" : pressure.buys}</span>
            </span>
            <span className="pf__pressure-item">
              <span className="pf__pressure-label">KOL sells</span>
              <span>{kolLoading ? "…" : pressure.sells}</span>
            </span>
            <span className="pf__pressure-item">
              <span className="pf__pressure-label">Buy $</span>
              <span>{kolLoading ? "…" : pressure.buyUsd > 0 ? fmtUsd(pressure.buyUsd) : "—"}</span>
            </span>
            <span className="pf__pressure-item">
              <span className="pf__pressure-label">Sell $</span>
              <span>{kolLoading ? "…" : pressure.sellUsd > 0 ? fmtUsd(pressure.sellUsd) : "—"}</span>
            </span>
          </div>

          {kolLoading ? (
            <div className="pf__loading pf__loading--sm">
              <Loader2 className="pf__spin pf__loading-icon" />
              <p>Loading KOL &amp; whale trades…</p>
            </div>
          ) : kolRows.length ? (
            <div className="pf__kol-list">
              {kolRows.map((r, i) => (
                <KolRow key={r.txHash || `${r.kolAddress || ""}-${r.time || ""}-${i}`} r={r} />
              ))}
            </div>
          ) : (
            <p className="pf__empty pf__empty--sm">
              No tracked KOL or whale trades found for this token yet.
            </p>
          )}
        </section>
      )}

      {/* Global social feed — latest tracked KOL & whale trades, all tokens */}
      <section className="pf__social" aria-label="Latest KOL and whale trades">
        <div className="pf__social-head">
          <h3 className="pf__social-title">
            <Radio className="pf__social-icon" />
            KOL &amp; Whale Trades
          </h3>
          <span className="pf__live pf__live--sm">
            <Radio className="pf__live-icon pf__pulse" /> Live
          </span>
        </div>
        <p className="pf__social-sub">Tracked KOL wallets only — trades from the live KOL feed, newest first.</p>
        {globalKolLoading ? (
          <div className="pf__loading pf__loading--sm">
            <Loader2 className="pf__spin pf__loading-icon" />
            <p>Loading feed…</p>
          </div>
        ) : globalKol.length ? (
          <div className="pf__kol-list">
            {globalKol.slice(0, 20).map((r, i) => (
              <div
                key={r.txHash || `${r.kolAddress || ""}-${r.time || ""}-${i}`}
                className="pf__kol-link"
                role="button"
                tabIndex={0}
                onClick={() => r.mint && openCoin(r.mint)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && r.mint) openCoin(r.mint);
                }}
              >
                <KolRow r={r} />
              </div>
            ))}
          </div>
        ) : (
          <p className="pf__empty pf__empty--sm">No tracked KOL or whale trades right now.</p>
        )}
      </section>

      <p className="pf__foot">
        <Activity className="pf__foot-icon" />
        Signals from live GeckoTerminal + pump.fun data via /api/ogdex/signals · KOL trades via /api/ogdex/kols
      </p>
    </div>
  );
}
