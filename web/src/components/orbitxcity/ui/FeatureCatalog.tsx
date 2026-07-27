/**
 * Browse all 168 capabilities for a city system (live / beta / planned).
 */
import { useMemo, useState } from "react";
import {
  countByStatus,
  getSystemFeatures,
  getSystemMeta,
  type CitySystemId,
  type FeatureStatus,
} from "@/lib/orbitxcity/cityFeatureCatalog";

const FILTERS: Array<FeatureStatus | "all"> = ["all", "live", "beta", "planned"];

export function FeatureCatalog({ system }: { system: CitySystemId }) {
  const meta = getSystemMeta(system);
  const counts = countByStatus(system);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 24;

  const filtered = useMemo(() => {
    const all = getSystemFeatures(system);
    return all.filter((f) => {
      if (filter !== "all" && f.status !== filter) return false;
      if (!q.trim()) return true;
      const hay = `${f.title} ${f.blurb} ${f.lane}`.toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    });
  }, [system, filter, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const slice = filtered.slice(page * pageSize, page * pageSize + pageSize);

  return (
    <div className="oxc-feat-catalog">
      <div className="oxc-feat-head">
        <div>
          <div className="oxc-kicker" style={{ color: meta.accent }}>
            {meta.label} · {meta.count} capabilities
          </div>
          <p className="oxc-muted">{meta.tagline}</p>
        </div>
        <div className="oxc-feat-counts">
          <span className="oxc-pill on">{counts.live} live</span>
          <span className="oxc-pill">{counts.beta} beta</span>
          <span className="oxc-pill">{counts.planned} planned</span>
        </div>
      </div>

      <div className="oxc-feat-tools">
        <input
          className="oxc-feat-search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          placeholder={`Search ${meta.count} ${meta.label} features…`}
          aria-label={`Search ${meta.label} features`}
        />
        <div className="oxc-menu-segmented" role="tablist" aria-label="Feature status">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={filter === f ? "on" : ""}
              onClick={() => {
                setFilter(f);
                setPage(0);
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="oxc-feat-grid" role="list">
        {slice.map((f) => (
          <article key={f.id} className={`oxc-feat-card is-${f.status}`} role="listitem">
            <header>
              <span className="oxc-feat-idx">#{f.index.toString().padStart(3, "0")}</span>
              <span className={`oxc-pill ${f.status === "live" ? "on" : ""}`}>{f.status}</span>
            </header>
            <h4>{f.title}</h4>
            <p>{f.blurb}</p>
            <footer>{f.lane}</footer>
          </article>
        ))}
      </div>

      <div className="oxc-feat-pager">
        <button type="button" className="oxc-btn ghost compact" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>
          Prev
        </button>
        <span className="oxc-muted">
          {filtered.length} shown · page {page + 1}/{pages}
        </span>
        <button
          type="button"
          className="oxc-btn ghost compact"
          disabled={page >= pages - 1}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function SystemTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: string; label: string }>;
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="oxc-menu-segmented oxc-sys-tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} type="button" className={active === t.id ? "on" : ""} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
