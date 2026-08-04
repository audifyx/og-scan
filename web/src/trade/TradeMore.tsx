import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
  ArrowLeft,
  Coins,
  HandCoins,
  Flame,
  Droplets,
  ExternalLink,
  Wrench,
} from "lucide-react";
import { TRADE_TOOLS, TOOL_CATEGORIES, TOOL_COUNT, type TradeTool } from "./more/toolCatalog";
import RentRefundPanel from "./more/RentRefundPanel";
import CreatorFeeClaimPanel from "./more/CreatorFeeClaimPanel";
import TokenBurnerPanel from "./more/TokenBurnerPanel";
import UnwrapWsolPanel from "./more/UnwrapWsolPanel";
import AdvancedToolHost from "./more/AdvancedToolHost";
import ActiveTradingWalletChip from "./ActiveTradingWalletChip";

const FEATURED_ICONS: Record<string, typeof Coins> = {
  "rent-refund": Coins,
  "creator-fee-claim": HandCoins,
  "token-burner": Flame,
  "unwrap-wsol": Droplets,
};

function PanelFor({ id }: { id: string }) {
  if (id === "rent-refund") return <RentRefundPanel />;
  if (id === "creator-fee-claim") return <CreatorFeeClaimPanel />;
  if (id === "token-burner") return <TokenBurnerPanel />;
  if (id === "unwrap-wsol") return <UnwrapWsolPanel />;
  return null;
}

export default function TradeMore() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("All");
  const activeId = params.get("tool");

  const active = useMemo(
    () => (activeId ? TRADE_TOOLS.find((t) => t.id === activeId) || null : null),
    [activeId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TRADE_TOOLS.filter((t) => {
      if (cat !== "All" && t.category !== cat) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });
  }, [query, cat]);

  const byCategory = useMemo(() => {
    const map = new Map<string, TradeTool[]>();
    for (const t of filtered) {
      if (t.featured) continue;
      const list = map.get(t.category) || [];
      list.push(t);
      map.set(t.category, list);
    }
    return TOOL_CATEGORIES.map((c) => ({ cat: c, tools: map.get(c) || [] })).filter((g) => g.tools.length);
  }, [filtered]);

  const openTool = (tool: TradeTool) => {
    if (tool.kind === "link" && tool.href) {
      navigate(tool.href);
      return;
    }
    setParams({ tool: tool.id });
  };

  if (active) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-[#060606]">
        <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2.5">
          <button
            type="button"
            onClick={() => setParams({})}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/15 px-3 text-xs text-white/70"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> More
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">{active.name}</div>
            <div className="truncate text-[10px] text-white/40">{active.description}</div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          {active.kind === "panel" && (
            <div className="mb-3">
              <ActiveTradingWalletChip />
            </div>
          )}
          {active.kind === "panel" && <PanelFor id={active.id} />}
          {active.kind === "advanced" && active.advancedKey && (
            <AdvancedToolHost toolKey={active.advancedKey} />
          )}
        </div>
      </div>
    );
  }

  const featured = TRADE_TOOLS.filter((t) => t.featured);

  return (
    <div className="h-full overflow-y-auto bg-[#060606] px-4 pb-8 pt-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-black tracking-tight" style={{ fontFamily: '"Bricolage Grotesque", system-ui' }}>
            More
          </h1>
          <p className="mt-0.5 text-[12px] text-white/40">{TOOL_COUNT} tools · structured by category</p>
        </div>
        <Wrench className="h-5 w-5 text-white/25" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {featured.map((t) => {
          const Icon = FEATURED_ICONS[t.id] || Coins;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => openTool(t)}
              className="rounded-2xl border border-white/12 bg-white/[0.03] p-4 text-left transition hover:border-white/25 hover:bg-white/[0.05]"
            >
              <Icon className="h-5 w-5 text-white" />
              <div className="mt-2 text-sm font-bold">{t.name}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-white/45">{t.description}</div>
            </button>
          );
        })}
      </div>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tools…"
          className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] pl-10 pr-3 text-sm outline-none focus:border-white/25"
        />
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {["All", ...TOOL_CATEGORIES].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-semibold ${
              cat === c ? "bg-white text-black" : "border border-white/10 text-white/45"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-6">
        {byCategory.map((g) => (
          <section key={g.cat}>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
              {g.cat}
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {g.tools.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openTool(t)}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 text-left transition hover:border-white/20"
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-[13px] font-bold leading-tight">{t.name}</span>
                    {t.kind === "link" ? <ExternalLink className="h-3 w-3 shrink-0 text-white/25" /> : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-white/40">{t.description}</p>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {!filtered.length && <p className="mt-10 text-center text-sm text-white/35">No tools match</p>}

      <p className="mt-8 text-center text-[10px] text-white/25">
        Full rescue suite →{" "}
        <Link to="/orbitxlaunch/rescue" className="underline hover:text-white/45">
          Rescue Console
        </Link>
      </p>
    </div>
  );
}
