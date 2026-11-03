/* DexFilters — filter controls for the DEX token list.
 * Controlled component: local state only. Persisting to
 * `dex_saved_filters` is out of scope (another worker owns SQL/admin).
 */
import type { DexFilterState } from "./dexFeed";
import { countActiveFilters, DEFAULT_DEX_FILTERS } from "./dexFeed";

export type { DexFilterState };

export type DexFiltersProps = {
  value: DexFilterState;
  onChange: (next: DexFilterState) => void;
};

const CHAINS = ["", "solana", "ethereum", "base", "bsc", "arbitrum", "polygon"];
const DEXES = ["", "raydium", "pumpfun", "meteora", "orca", "uniswap", "pancakeswap"];
const AGE_OPTIONS: Array<{ label: string; hours: number | null }> = [
  { label: "Any age", hours: null },
  { label: "Under 1h", hours: 1 },
  { label: "Under 6h", hours: 6 },
  { label: "Under 24h", hours: 24 },
  { label: "Under 7d", hours: 168 },
];

const field: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  minWidth: 0,
};

const label: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: "var(--txth-muted, rgba(244,244,242,.55))",
};

const control: React.CSSProperties = {
  width: "100%",
  background: "var(--txth-surface, #101010)",
  border: "1px solid var(--txth-silver-line, rgba(201,209,217,.16))",
  borderRadius: 8,
  color: "var(--txth-ink, #f4f4f2)",
  fontSize: 12,
  padding: "7px 9px",
  outline: "none",
};

function numOrNull(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export default function DexFilters({ value, onChange }: DexFiltersProps) {
  const active = countActiveFilters(value);
  const set = (patch: Partial<DexFilterState>) => onChange({ ...value, ...patch });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        background: "var(--txth-surface, #101010)",
        border: "1px solid var(--txth-line, rgba(232,184,74,.18))",
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span
          style={{
            fontFamily: "var(--txth-hand, cursive)",
            fontSize: 20,
            fontWeight: 600,
            color: "var(--txth-gold, #e8b84a)",
          }}
        >
          Filters
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {active > 0 && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "#050505",
                background: "var(--txth-gold, #e8b84a)",
                borderRadius: 99,
                padding: "2px 8px",
              }}
            >
              {active} active
            </span>
          )}
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_DEX_FILTERS })}
            disabled={active === 0}
            style={{
              background: "transparent",
              border: "1px solid var(--txth-silver-line, rgba(201,209,217,.16))",
              borderRadius: 8,
              color: active === 0 ? "var(--txth-faint, rgba(244,244,242,.22))" : "var(--txth-silver, #c9d1d9)",
              fontSize: 11,
              fontWeight: 700,
              padding: "5px 10px",
              cursor: active === 0 ? "default" : "pointer",
            }}
          >
            Clear all
          </button>
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
        }}
      >
        <label style={field}>
          <span style={label}>Chain</span>
          <select style={control} value={value.chain} onChange={(e) => set({ chain: e.target.value })}>
            {CHAINS.map((c) => (
              <option key={c || "all"} value={c}>
                {c ? c.charAt(0).toUpperCase() + c.slice(1) : "All chains"}
              </option>
            ))}
          </select>
        </label>

        <label style={field}>
          <span style={label}>DEX</span>
          <select style={control} value={value.dexId} onChange={(e) => set({ dexId: e.target.value })}>
            {DEXES.map((d) => (
              <option key={d || "all"} value={d}>
                {d ? d.charAt(0).toUpperCase() + d.slice(1) : "All DEXes"}
              </option>
            ))}
          </select>
        </label>

        <label style={field}>
          <span style={label}>Min liquidity ($)</span>
          <input
            style={control}
            type="number"
            min={0}
            inputMode="decimal"
            placeholder="0"
            value={value.minLiquidity ?? ""}
            onChange={(e) => set({ minLiquidity: numOrNull(e.target.value) })}
          />
        </label>

        <label style={field}>
          <span style={label}>Min market cap ($)</span>
          <input
            style={control}
            type="number"
            min={0}
            inputMode="decimal"
            placeholder="0"
            value={value.minMcap ?? ""}
            onChange={(e) => set({ minMcap: numOrNull(e.target.value) })}
          />
        </label>

        <label style={field}>
          <span style={label}>Min 24h volume ($)</span>
          <input
            style={control}
            type="number"
            min={0}
            inputMode="decimal"
            placeholder="0"
            value={value.minVolume24h ?? ""}
            onChange={(e) => set({ minVolume24h: numOrNull(e.target.value) })}
          />
        </label>

        <label style={field}>
          <span style={label}>Min 24h txns</span>
          <input
            style={control}
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="0"
            value={value.minTxns24h ?? ""}
            onChange={(e) => set({ minTxns24h: numOrNull(e.target.value) })}
          />
        </label>

        <label style={field}>
          <span style={label}>Max age</span>
          <select
            style={control}
            value={value.maxAgeHours == null ? "" : String(value.maxAgeHours)}
            onChange={(e) =>
              set({ maxAgeHours: e.target.value === "" ? null : Number(e.target.value) })
            }
          >
            {AGE_OPTIONS.map((o) => (
              <option key={o.label} value={o.hours == null ? "" : String(o.hours)}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
