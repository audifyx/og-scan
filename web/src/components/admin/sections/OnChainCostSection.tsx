import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { SolscanLink } from "@/components/onchain/SolscanLink";
import { TARGET_LAMPORTS } from "../../../../shared/orbitx-onchain.js";

type Costs = {
  ok?: boolean;
  error?: string;
  sample?: number;
  average_lamports?: number | null;
  median_lamports?: number | null;
  lowest_lamports?: number | null;
  highest_lamports?: number | null;
  under_target?: number;
  by_kind?: Record<string, { count: number; lamports: number; min: number; max: number }>;
  note?: string;
};

type EventRow = {
  tx_signature: string;
  kind?: string;
  fee_lamports?: number | null;
  wallet?: string | null;
  created_at?: string;
};

function sol(lamports?: number | null) {
  if (lamports == null) return "—";
  return `${(Number(lamports) / 1e9).toFixed(9)} SOL`;
}

export function OnChainCostSection() {
  const [costs, setCosts] = useState<Costs | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sign in as the owner account");
      const [cRes, eRes] = await Promise.all([
        fetch("/api/orbitx-onchain?action=costs", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/orbitx-onchain?action=events"),
      ]);
      const cJson = (await cRes.json().catch(() => ({}))) as Costs;
      const eJson = await eRes.json().catch(() => ({}));
      if (!cRes.ok || cJson.ok === false) throw new Error(cJson.error || `Costs ${cRes.status}`);
      setCosts(cJson);
      setEvents(Array.isArray(eJson.events) ? eJson.events : []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load on-chain costs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-white/55">
          Fees are Solana <code className="text-white/80">meta.fee</code> from confirmed signatures. Target is &lt; {(TARGET_LAMPORTS / 1e9).toFixed(5)} SOL for memo-only txs. Swaps, creates, and new accounts will sit above that — not padded.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/80"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </button>
      </div>
      {error && <p className="text-sm text-[#ff4d6d]">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Average", sol(costs?.average_lamports)],
          ["Median", sol(costs?.median_lamports)],
          ["Lowest", sol(costs?.lowest_lamports)],
          ["Highest", sol(costs?.highest_lamports)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-[10px] uppercase tracking-widest text-white/40">{label}</div>
            <div className="mt-1 font-mono text-sm text-[#F0C75E]">{value}</div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">
        Sample {costs?.sample ?? 0} · under target {costs?.under_target ?? 0}
        {costs?.note && <p className="mt-2 text-xs text-white/45">{costs.note}</p>}
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/[0.04] text-white/45">
            <tr>
              <th className="px-3 py-2 font-medium">Kind</th>
              <th className="px-3 py-2 font-medium">Count</th>
              <th className="px-3 py-2 font-medium">Avg</th>
              <th className="px-3 py-2 font-medium">Min</th>
              <th className="px-3 py-2 font-medium">Max</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(costs?.by_kind || {}).map(([kind, row]) => (
              <tr key={kind} className="border-t border-white/5">
                <td className="px-3 py-2 font-mono text-white">{kind}</td>
                <td className="px-3 py-2 text-white/70">{row.count}</td>
                <td className="px-3 py-2 text-white/70">{sol(row.count ? Math.round(row.lamports / row.count) : null)}</td>
                <td className="px-3 py-2 text-white/70">{sol(row.min === Infinity ? null : row.min)}</td>
                <td className="px-3 py-2 text-white/70">{sol(row.max)}</td>
              </tr>
            ))}
            {!Object.keys(costs?.by_kind || {}).length && (
              <tr><td className="px-3 py-4 text-white/40" colSpan={5}>No indexed fees yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="space-y-2">
        <h3 className="text-[10px] uppercase tracking-widest text-white/40">Recent indexed signatures</h3>
        {events.slice(0, 20).map((e) => (
          <div key={e.tx_signature} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/8 px-3 py-2">
            <span className="font-mono text-[11px] text-white/70">{e.kind || "tx"}</span>
            <span className="font-mono text-[11px] text-white/45">{sol(e.fee_lamports)}</span>
            <SolscanLink signature={e.tx_signature} />
          </div>
        ))}
      </div>
    </div>
  );
}
