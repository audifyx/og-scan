/**
 * OrbitXCity — Police module: the rap-sheet panel.
 *
 * One mount point, tabbed overlay (Bribe / Prison / Court / Record):
 *  - Bribe — burn REAL ORBITX (backend-signed, no popups) to wipe heat.
 *    Gated on the billing provider: absent/not-ready renders the auth gate
 *    ("coming soon / auth required" until tokenomics lands).
 *  - Prison — serve the sentence (live countdown), attempt a jailbreak, or
 *    have your crew post paper-CITY bail. Breakout re-adds heat.
 *  - Court — pay the paper-CITY fine, or play the talk-your-way-out
 *    minigame before the hearing starts. Missed hearings auto-convict.
 *  - Record — rap sheet + recent events.
 *
 * Billing rule honored: paper CITY fines/bail, REAL ORBITX bribes.
 * Mobile-first bottom-sheet on small screens, ≥44px touch targets.
 */

import { useEffect, useMemo, useState } from "react";
import { usePoliceStore } from "./usePolice";
import type { OrbitxBillingProvider, PaperLedgerPort } from "./types";
import { COURT_ROUNDS, courtThreshold, BRIBE_PRICE, CREW_BAIL_PER_STAR } from "./store";
import { COPY, CRIME_LABELS, fmtClock, fmtCountdown, heatColor, starGlyph } from "./ui";
import "./police.css";

export const POLICE_PANEL_ID = "police";

export interface PolicePanelProps {
  paper: PaperLedgerPort;
  billing?: OrbitxBillingProvider;
  onClose: () => void;
  initialTab?: "bribe" | "prison" | "court" | "record";
}

type Tab = "bribe" | "prison" | "court" | "record";

export function PolicePanel({ paper, billing, onClose, initialTab = "bribe" }: PolicePanelProps) {
  const store = usePoliceStore();
  const [tab, setTab] = useState<Tab>(initialTab);

  // Serving sentence countdown — tick the sentence clock while open.
  useEffect(() => {
    if (!store.servingTime) return;
    const id = window.setInterval(() => store.tickSentence(1), 1000);
    return () => window.clearInterval(id);
  }, [store, store.servingTime]);

  const tabs: { id: Tab; label: string; badge?: string }[] = [
    { id: "bribe", label: "💸 Bribe" },
    { id: "prison", label: "🔒 Prison", badge: store.servingTime ? "!" : undefined },
    { id: "court", label: "⚖️ Court", badge: store.court?.status === "pending" ? "!" : undefined },
    { id: "record", label: "📋 Record" },
  ];

  return (
    <div className="ox-pol-overlay" role="dialog" aria-modal="true" aria-label="Police options">
      <div className="ox-pol-sheet">
        <div className="ox-pol-head">
          <div>
            <div className="ox-pol-title">OrbitX PD</div>
            <div className="ox-pol-sub" style={{ color: heatColor(store.stars) }}>
              {store.stars === 0 ? "Clean — for now" : `${starGlyph(store.stars)} · ${store.stars} star${store.stars > 1 ? "s" : ""}`}
            </div>
          </div>
          <button type="button" className="ox-pol-x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="ox-pol-tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`ox-pol-tab${tab === t.id ? " ox-pol-tab-active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.badge && <span className="ox-pol-tab-badge">{t.badge}</span>}
            </button>
          ))}
        </div>

        <div className="ox-pol-body">
          {tab === "bribe" && <BribeTab billing={billing} onClose={onClose} />}
          {tab === "prison" && <PrisonTab paper={paper} />}
          {tab === "court" && <CourtTab paper={paper} />}
          {tab === "record" && <RecordTab />}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bribe                                                               */
/* ------------------------------------------------------------------ */

function BribeTab({ billing, onClose }: { billing?: OrbitxBillingProvider; onClose: () => void }) {
  const store = usePoliceStore();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const price = store.bribePrice;
  const ready = !!billing && billing.ready;

  async function pay() {
    if (price == null || busy) return;
    if (!window.confirm(COPY.bribeConfirm)) return;
    setBusy(true);
    setMsg(null);
    const r = await store.bribe(billing);
    setBusy(false);
    if (r.ok) {
      setMsg(`Burned ${r.amount} ORBITX — the heat is gone. Sig: ${(r.signature ?? "").slice(0, 16)}…`);
      window.setTimeout(onClose, 1200);
    } else if (r.error === "insufficient_balance") {
      setMsg(`Not enough ORBITX — the bribe costs ${price}.`);
    } else if (r.error === "billing_not_ready") {
      setMsg("ORBITX billing isn't authed yet.");
    } else {
      setMsg("The burn failed — heat unchanged. Try again.");
    }
  }

  if (store.stars === 0) {
    return <div className="ox-pol-empty">No heat on you. Nothing to bribe away.</div>;
  }

  return (
    <div>
      <p className="ox-pol-copy">
        A quiet word, a fat envelope. Burn <b>{price} ORBITX</b> and the case files
        disappear — heat wiped instantly, no record survives.
      </p>

      {!ready && (
        <div className="ox-pol-gate">
          <div className="ox-pol-gate-title">🔐 ORBITX billing required</div>
          <p className="ox-pol-copy">{COPY.bribeGate}</p>
          {billing ? (
            <button type="button" className="ox-pol-btn ox-pol-btn-primary" onClick={billing.beginAuth}>
              Auth ORBITX billing
            </button>
          ) : (
            <div className="ox-pol-soon">Coming soon — the tokenomics hook isn't wired yet.</div>
          )}
        </div>
      )}

      <button
        type="button"
        className="ox-pol-btn ox-pol-btn-primary"
        disabled={!ready || busy}
        onClick={pay}
      >
        {busy ? "Burning…" : `🔥 Burn ${price} ORBITX — wipe ${store.stars}★`}
      </button>

      {billing?.balance != null && (
        <div className="ox-pol-sub">Wallet: {billing.balance} ORBITX</div>
      )}
      {msg && <div className="ox-pol-msg">{msg}</div>}
      <p className="ox-pol-fine">
        Backend-signed burn, no wallet popup. The game never holds your keys or funds.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Prison                                                              */
/* ------------------------------------------------------------------ */

function PrisonTab({ paper }: { paper: PaperLedgerPort }) {
  const store = usePoliceStore();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const s = store.sentence;

  async function breakout() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const r = store.attemptJailbreak();
    setBusy(false);
    setMsg(
      r.escaped
        ? `You made it out! But the whole city is hunting you — 3 stars hot.`
        : `Caught mid-tunnel (odds were ${Math.round(r.odds * 100)}%). Guards doubled your remaining time.`,
    );
  }

  async function bail() {
    if (!s || busy) return;
    const cost = s.stars * CREW_BAIL_PER_STAR;
    if (!window.confirm(`${COPY.bailConfirm} Cost: ${cost} CITY.`)) return;
    setBusy(true);
    setMsg(null);
    const r = await store.crewBail(paper);
    setBusy(false);
    setMsg(r.ok ? `Your crew posted bail (${cost} CITY). You're out — 2 stars hot.` : "Not enough CITY for crew bail.");
  }

  if (!s || s.status !== "serving") {
    return (
      <div className="ox-pol-empty">
        {s?.status === "served"
          ? "Time served. You're a free citizen — stay clean."
          : "You're not inside. Commit a crime and get caught if you're that eager."}
      </div>
    );
  }

  const progress = 1 - s.remainingSec / Math.max(s.durationSec, 1);

  return (
    <div>
      <div className="ox-pol-sentence">
        <div className="ox-pol-sentence-top">
          <span>Serving {s.stars}★ sentence</span>
          <span className="ox-pol-clock">{fmtClock(s.remainingSec)}</span>
        </div>
        <div className="ox-pol-bar">
          <div className="ox-pol-bar-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>
      <p className="ox-pol-copy">
        Sit it out, tunnel out, or let your crew buy your freedom.
      </p>
      <div className="ox-pol-row">
        <button type="button" className="ox-pol-btn" disabled={busy} onClick={breakout}>
          ⛏️ Break out
        </button>
        <button type="button" className="ox-pol-btn" disabled={busy} onClick={bail}>
          🤝 Crew bail ({s.stars * CREW_BAIL_PER_STAR} CITY)
        </button>
      </div>
      {msg && <div className="ox-pol-msg">{msg}</div>}
      <p className="ox-pol-fine">
        Breakout odds drop with your star level. Failed breakouts double remaining time.
        Crew bail is paper CITY — no chain involved.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Court                                                               */
/* ------------------------------------------------------------------ */

function CourtTab({ paper }: { paper: PaperLedgerPort }) {
  const store = usePoliceStore();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [playing, setPlaying] = useState(false);
  const c = store.court;

  const threshold = useMemo(() => courtThreshold(store.rapSheet.convictions), [store]);

  useEffect(() => {
    store.markCourtMissed();
  }, [store]);

  async function payFine() {
    if (!c || busy) return;
    if (!window.confirm(COPY.fineConfirm)) return;
    setBusy(true);
    setMsg(null);
    const r = await store.payFine(paper);
    setBusy(false);
    setMsg(r.ok ? `Paid ${r.amount} CITY — case closed.` : "Not enough CITY to settle the fine.");
  }

  function answer(optionId: string) {
    const opt = COURT_ROUNDS[round]?.options.find((o) => o.id === optionId);
    const gained = opt?.points ?? 0;
    const newScore = score + gained;
    const done = round >= COURT_ROUNDS.length - 1;
    if (done) {
      const r = store.playCourtRound(round, optionId);
      setPlaying(false);
      setMsg(
        r.acquitted
          ? `Acquitted! The jury bought it (${r.total}/${r.threshold}). Charges dropped.`
          : `Convicted (${r.total}/${r.threshold} — needed ${r.threshold}). Fine raised; pay it or do time.`,
      );
    } else {
      store.playCourtRound(round, optionId);
      setScore(newScore);
      setRound(round + 1);
    }
  }

  if (!c || c.status === "paid" || c.status === "acquitted") {
    return <div className="ox-pol-empty">No pending cases. The docket is clear.</div>;
  }

  if (playing && c.status === "pending") {
    const q = COURT_ROUNDS[round];
    return (
      <div>
        <div className="ox-pol-sub">
          Round {round + 1}/{COURT_ROUNDS.length} · need {threshold} pts (prior convictions count against you)
        </div>
        <p className="ox-pol-copy"><b>{q.prompt}</b></p>
        <div className="ox-pol-col">
          {q.options.map((o) => (
            <button key={o.id} type="button" className="ox-pol-btn ox-pol-btn-opt" onClick={() => answer(o.id)}>
              {o.text}
            </button>
          ))}
        </div>
        <div className="ox-pol-sub">Running score: {score}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="ox-pol-case">
        <div className="ox-pol-case-top">
          <span>Case #{c.id.slice(-6)} · {c.stars}★</span>
          <span className={`ox-pol-pill ox-pol-pill-${c.status}`}>{c.status.toUpperCase()}</span>
        </div>
        <div className="ox-pol-sub">
          Hearing in {fmtCountdown(c.hearingAt - Date.now())} · fine {c.fineCity} CITY
        </div>
      </div>
      <p className="ox-pol-copy">
        Pay the paper fine and walk away — or face the judge and talk your way out.
        Silver tongue required: reach {threshold} points across 3 questions.
      </p>
      <div className="ox-pol-row">
        <button type="button" className="ox-pol-btn ox-pol-btn-primary" disabled={busy || c.status !== "pending"} onClick={() => { setPlaying(true); setRound(0); setScore(0); setMsg(null); }}>
          🎙️ Face the judge
        </button>
        <button type="button" className="ox-pol-btn" disabled={busy} onClick={payFine}>
          💵 Pay {c.fineCity} CITY
        </button>
      </div>
      {msg && <div className="ox-pol-msg">{msg}</div>}
      <p className="ox-pol-fine">
        Miss the hearing and you're auto-convicted with a raised fine. Fines are paper CITY.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Record                                                              */
/* ------------------------------------------------------------------ */

function RecordTab() {
  const store = usePoliceStore();
  const rap = store.rapSheet;
  const events = store.eventsFor(30);

  const rows: [string, string | number][] = [
    ["Lifetime offenses", rap.offenses],
    ["Convictions", rap.convictions],
    ["Escapes", rap.escapes],
    ["Bribes paid", rap.bribes],
    ["Court acquittals", rap.acquittals],
    ["ORBITX burned (bribes)", `${rap.orbitxBurnedOnBribes}`],
    ["CITY paid (fines/bail)", `${rap.cityPaidInFines}`],
    ["Repeat-offender heat ×", (1 + 0.25 * Math.min(rap.offenses, 4)).toFixed(2)],
  ];

  return (
    <div>
      <div className="ox-pol-rap">
        {rows.map(([k, v]) => (
          <div key={k} className="ox-pol-rap-row">
            <span>{k}</span>
            <b>{v}</b>
          </div>
        ))}
      </div>
      <div className="ox-pol-sub" style={{ marginTop: 12 }}>Recent activity</div>
      <div className="ox-pol-events">
        {events.length === 0 && <div className="ox-pol-empty">No history yet. Squeaky clean.</div>}
        {events.map((e) => (
          <div key={e.id} className="ox-pol-event">
            <span className="ox-pol-event-time">{new Date(e.at).toLocaleTimeString()}</span>
            <span>{e.detail}</span>
          </div>
        ))}
      </div>
      <div className="ox-pol-sub" style={{ marginTop: 12 }}>Open charges</div>
      {store.crimes.slice(-8).reverse().map((cr) => (
        <div key={cr.id} className="ox-pol-event">
          <span className="ox-pol-event-time">{new Date(cr.at).toLocaleTimeString()}</span>
          <span>
            {CRIME_LABELS[cr.kind]} — +{cr.heatAdded} heat{cr.witnessed ? "" : " (unwitnessed)"}
            {cr.label ? ` · ${cr.label}` : ""}
          </span>
        </div>
      ))}
      {store.crimes.length === 0 && <div className="ox-pol-empty">No charges on file.</div>}
    </div>
  );
}

/** Bribe prices, exported for HUD copy (e.g. badge tooltip). */
export { BRIBE_PRICE };
