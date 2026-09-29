/**
 * JobsModule — React shell for the jobs module: floating 💼 button, unified
 * job board sheet, active job panel, and the global toast stack.
 * Kept in .tsx (index.ts must stay JSX-free for the esbuild ts loader).
 */
import { useEffect, useState } from "react";
import type { GtaApi } from "../../core";
import type { JobId, JobProps, Toast } from "./types";
import { JOBS, getJob } from "./index";
import { subscribeToasts, subscribeWallet, getCity, getBuffs, fmtCity, jobLevel, jobXp } from "./wallet";
import "./jobs.css";

function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="oj-toast-stack" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`oj-toast ${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

function JobBoard({
  onStart,
  onClose,
}: {
  onStart: (id: JobId) => void;
  onClose: () => void;
}) {
  const [city, setCity] = useState(() => getCity());
  useEffect(
    () =>
      subscribeWallet(() => {
        setCity(getCity());
      }),
    [],
  );
  const buffs = getBuffs();
  return (
    <div className="oj-board" onClick={onClose}>
      <div className="oj-board-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="oj-board-top">
          <h2>💼 Job Board</h2>
          <button className="oj-board-close" onClick={onClose} aria-label="Close job board">
            ✕
          </button>
        </div>
        <div className="oj-wallet">
          <span>Paper wallet</span>
          <b>{fmtCity(city)}</b>
          {buffs.map((b) => (
            <span key={b.id} className="oj-buff">
              ✨ {b.label}
            </span>
          ))}
        </div>
        <div className="oj-grid">
          {JOBS.map(({ meta }) => (
            <div key={meta.id} className="oj-card">
              <div className="oj-card-icon">{meta.icon}</div>
              <div className="oj-card-main">
                <b>
                  {meta.name}
                  <span className="oj-card-lvl">
                    Lv {jobLevel(meta.id)} · {jobXp(meta.id)} XP
                  </span>
                </b>
                <div className="oj-card-tag">{meta.tagline}</div>
                <div className="oj-card-pay">{meta.payInfo}</div>
                <div className="oj-row">
                  <button className="oj-btn small primary" onClick={() => onStart(meta.id)}>
                    Start shift
                  </button>
                </div>
                <div className="oj-howto">{meta.howTo}</div>
                {meta.premium && (
                  <div className="oj-card-tag">🔥 Premium: {meta.premium} (ORBITX soon)</div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="oj-howto">
          Wages are paper CITY (gameplay only). Premium upgrades will burn real ORBITX once the
          tokenomics billing primitives land — until then they stay locked.
        </div>
      </div>
    </div>
  );
}

export default function JobsModule({ api }: { api: GtaApi }) {
  const [boardOpen, setBoardOpen] = useState(false);
  const [activeId, setActiveId] = useState<JobId | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(
    () =>
      subscribeToasts((t) => {
        setToasts((prev) => [...prev.slice(-3), t]);
        window.setTimeout(() => {
          setToasts((prev) => prev.filter((x) => x.id !== t.id));
        }, 3600);
      }),
    [],
  );

  const active = activeId ? getJob(activeId) : undefined;
  const ActiveComp = active?.Component as React.ComponentType<JobProps> | undefined;

  return (
    <>
      <ToastStack toasts={toasts} />
      {!active && (
        <button
          className="oj-fab"
          data-hud
          onClick={() => setBoardOpen((o) => !o)}
          aria-label="Open job board"
        >
          💼
        </button>
      )}
      {boardOpen && !active && (
        <JobBoard
          onStart={(id) => {
            setActiveId(id);
            setBoardOpen(false);
          }}
          onClose={() => setBoardOpen(false)}
        />
      )}
      {ActiveComp && (
        <ActiveComp
          api={api}
          onEndShift={() => {
            setActiveId(null);
            setBoardOpen(false);
          }}
        />
      )}
    </>
  );
}
