import { useEffect, useState } from "react";
import {
  getEnabledWidgets,
  getWhaleAlerts,
  getGasReading,
  getFearGreed,
  type WhaleAlert,
  type GasReading,
  type FngReading,
  type WidgetId,
} from "../themes/widgets";
import "./oshome.css";

/**
 * OS home widgets (idea 32) — the WidgetStrip renders every enabled
 * widget as a compact card: whale alert ticker, gas tracker dial,
 * fear/greed gauge. Data refreshes every 60s; widgets degrade to an
 * "unavailable" note instead of breaking the home screen.
 */

function useWidgetPrefs(): WidgetId[] {
  const [ids, setIds] = useState<WidgetId[]>(() => getEnabledWidgets());
  useEffect(() => {
    const fn = () => setIds(getEnabledWidgets());
    window.addEventListener("orbitx:widgets", fn);
    return () => window.removeEventListener("orbitx:widgets", fn);
  }, []);
  return ids;
}

function WhaleTicker() {
  const [alerts, setAlerts] = useState<WhaleAlert[] | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => getWhaleAlerts().then((a) => alive && setAlerts(a));
    load();
    const t = setInterval(load, 120_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  if (alerts === null) return <WidgetCard title="🐋 Whale alerts" body={<span className="osh-w-dim">loading…</span>} />;
  if (alerts.length === 0) return <WidgetCard title="🐋 Whale alerts" body={<span className="osh-w-dim">unavailable</span>} />;
  const line = [...alerts, ...alerts];
  return (
    <WidgetCard
      title="🐋 Whale alerts"
      wide
      body={
        <div className="osh-w-ticker" aria-label="Boosted tokens">
          <div className="osh-w-ticker-inner">
            {line.map((a, i) => (
              <a key={`${a.id}-${i}`} className="osh-w-tick" href={a.url} target="_blank" rel="noreferrer">
                <b>{a.symbol}</b>
                <span className="osh-w-dim">{a.chain}</span>
                <span className="osh-w-boost">{a.amount}</span>
              </a>
            ))}
          </div>
        </div>
      }
    />
  );
}

const GAS_LABEL: Record<GasReading["level"], string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  extreme: "Extreme",
};

function GasWidget() {
  const [gas, setGas] = useState<GasReading | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => getGasReading().then((g) => alive && setGas(g));
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const pct = gas ? Math.min(100, (Math.log10(gas.medianMicroLamports + 1) / 6) * 100) : 0;
  return (
    <WidgetCard
      title="⛽ Solana gas"
      body={
        gas ? (
          <div>
            <div className="osh-w-big">
              {(gas.medianMicroLamports / 1000).toFixed(1)}
              <small>k µL/CU</small>
            </div>
            <div className="osh-w-bar"><i style={{ width: `${pct}%` }} data-level={gas.level} /></div>
            <div className="osh-w-dim">{GAS_LABEL[gas.level]} fees</div>
          </div>
        ) : (
          <span className="osh-w-dim">unavailable</span>
        )
      }
    />
  );
}

function FngWidget() {
  const [fng, setFng] = useState<FngReading | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => getFearGreed().then((f) => alive && setFng(f));
    load();
    const t = setInterval(load, 300_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return (
    <WidgetCard
      title="😱 Fear / Greed"
      body={
        fng ? (
          <div>
            <div className="osh-w-big">
              {fng.value}
              <small>/ 100</small>
            </div>
            <div className="osh-w-bar"><i style={{ width: `${fng.value}%` }} data-fng={fng.value} /></div>
            <div className="osh-w-dim">{fng.label}</div>
          </div>
        ) : (
          <span className="osh-w-dim">unavailable</span>
        )
      }
    />
  );
}

function WidgetCard({ title, body, wide }: { title: string; body: React.ReactNode; wide?: boolean }) {
  return (
    <div className="osh-widget" data-wide={wide || undefined}>
      <div className="osh-widget-title">{title}</div>
      {body}
    </div>
  );
}

export function WidgetStrip() {
  const ids = useWidgetPrefs();
  if (ids.length === 0) return null;
  return (
    <div className="osh-widget-strip" aria-label="Market widgets">
      {ids.includes("whales") && <WhaleTicker />}
      {ids.includes("gas") && <GasWidget />}
      {ids.includes("fng") && <FngWidget />}
    </div>
  );
}
