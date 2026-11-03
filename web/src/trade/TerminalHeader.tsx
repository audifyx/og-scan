/**
 * OrbitX Terminal — redesigned DEX header.
 *
 * Replaces the `.th__top` brand block in TradeHome.tsx (kicker / title /
 * subtitle / Live badge). It does NOT own the spotlight, category tabs,
 * sub-tabs, or the list column header — those stay in TradeHome and are
 * passed in through the slots below, so the swap is a pure header swap.
 *
 * MOUNT CONTRACT (see report for the exact TradeHome patch):
 *   import TerminalHeader from "./TerminalHeader";
 *   // inside TradeHome's return, replacing <div className="th__top"> …
 *   // </div>'s brand-row + live badge only:
 *   <TerminalHeader
 *     countLabel={loading || searching ? "Syncing…" : searchingMode
 *       ? `${list.length} results`
 *       : `Top ${list.length} in ${subTabs.find((t) => t.id === tab)?.label || "feed"}`}
 *     live
 *     isLoading={loading || searching}
 *     stats={[{ label: "Feed", value: subTabs.find((t) => t.id === tab)?.label ?? "—" }]}
 *     searchValue={q}
 *     onSearchChange={setQ}
 *     searchSlot={…}   // optional: pass your own search box instead
 *     navSlot={…}      // optional: category + sub-tab rows
 *   />
 *   // …then keep the spotlight / cats / subs / search / .th__cols rows
 *   // (or the corrected .txth__cols row) inside the same .th__top wrapper.
 *
 * Props are all optional except the count label; every slot renders only
 * when provided. Data-only: no trading, no wallet, no execution.
 */
import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import "./terminal-theme.css";

export interface TerminalStat {
  label: string;
  value: string;
  /** e.g. "+2.4%" — rendered in gold; a leading "-" renders red. */
  delta?: string;
}

export interface TerminalHeaderProps {
  /** Subtitle line under the title, e.g. "Top 200 in Trending". */
  countLabel?: string;
  /** Show the pulsing Live pill. Defaults to true. */
  live?: boolean;
  /** While loading, the Live pill dims (still rendered, never hidden). */
  isLoading?: boolean;
  /** Small data-only stat chips rendered under the brand row. */
  stats?: TerminalStat[];
  /** Controlled search value. Omit both search props to hide search. */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  /** Placeholder for the search input. */
  searchPlaceholder?: string;
  /** Replace the built-in search box entirely. */
  searchSlot?: ReactNode;
  /** Category / sub-tab rows (TradeHome's .th__cats + .th__subs). */
  navSlot?: ReactNode;
  /** Extra class(es) on the header wrapper. */
  className?: string;
}

export default function TerminalHeader({
  countLabel,
  live = true,
  isLoading = false,
  stats,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search ticker or paste mint",
  searchSlot,
  navSlot,
  className,
}: TerminalHeaderProps) {
  const showSearch = searchSlot !== undefined || onSearchChange !== undefined;
  return (
    <div className={`txth__header orbitx-terminal${className ? ` ${className}` : ""}`}>
      <div className="txth__brand-row">
        <div className="txth__brand">
          <p className="txth__kicker">Solana · Non-custodial · Data only</p>
          <div className="txth__title-row">
            <h1 className="txth__title">OrbitX</h1>
            {/* Handwriting accent: the wordmark only, never body copy. */}
            <span className="txth__wordmark" aria-hidden="true">
              Terminal
            </span>
            <span className="sr-only">Terminal</span>
          </div>
          {countLabel ? <p className="txth__subtitle">{countLabel}</p> : null}
        </div>
        {live ? (
          <div className="txth__live" aria-live="polite" style={isLoading ? { opacity: 0.55 } : undefined}>
            <span className="txth__live-dot" />
            Live
          </div>
        ) : null}
      </div>

      {stats && stats.length > 0 ? (
        <div className="txth__stats-strip" role="group" aria-label="Market summary">
          {stats.map((s) => (
            <div key={s.label} className="txth__stat">
              <span className="txth__stat-label">{s.label}</span>
              <span className="txth__stat-value">
                {s.value}
                {s.delta ? (
                  <span
                    className={
                      s.delta.trim().startsWith("-")
                        ? " txth__stat-delta--down"
                        : " txth__stat-delta--up"
                    }
                  >
                    {" "}
                    {s.delta}
                  </span>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {navSlot}

      {showSearch ? (
        searchSlot ?? (
          <div className="txth__search-wrap">
            <Search className="txth__search-icon" strokeWidth={2} />
            <input
              className="txth__search"
              value={searchValue ?? ""}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder={searchPlaceholder}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Search ticker or paste mint"
            />
            {searchValue ? (
              <button
                type="button"
                className="txth__search-clear"
                onClick={() => onSearchChange?.("")}
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        )
      ) : null}
    </div>
  );
}
