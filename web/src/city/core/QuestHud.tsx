/**
 * QuestHud — daily quests display + claim UI.
 * Tracks walk distance from the world; POI scans and shop visits
 * are fed in by the integration layer (CityAppsShell).
 */
import { useCallback, useEffect, useState } from "react";
import { Trophy, X } from "lucide-react";
import {
  QUESTS,
  questProgress,
  claimQuest,
  type QuestProgress,
  type SessionStats,
} from "./quests";
import { useCityWallet } from "./useCityWallet";
import type { GtaApi } from "./useGtaGame";

export function QuestHud({ api }: { api: GtaApi }) {
  const wallet = useCityWallet();
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<QuestProgress[]>([]);
  const [claimedMsg, setClaimedMsg] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const world = api.getWorld();
    const session: SessionStats = {
      dist: world?.getWalkDistance() ?? 0,
      scanned: [],
      visited: [],
    };
    setProgress(questProgress(wallet.address, session));
  }, [api, wallet.address]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const doneCount = progress.filter((p) => p.done && !p.claimed).length;

  const doClaim = (id: string) => {
    const paid = claimQuest(wallet.address, id);
    if (paid > 0) {
      const def = QUESTS.find((q) => q.id === id);
      setClaimedMsg(`+${paid} CITY — ${def?.name} claimed!`);
      refresh();
      setTimeout(() => setClaimedMsg(null), 3000);
    }
  };

  return (
    <>
      <button
        data-hud
        onClick={() => setOpen((o) => !o)}
        className="ocg-iconbtn relative"
        title="Daily quests"
        aria-label="Daily quests"
      >
        <Trophy size={15} />
        {doneCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-black">
            {doneCount}
          </span>
        )}
      </button>
      {open && (
        <div
          data-hud
          className="fixed bottom-20 left-4 z-40 w-72 rounded-2xl border border-white/10 bg-zinc-900/95 p-4 text-white shadow-xl"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Daily Quests</h3>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-zinc-400 hover:bg-white/10"
              aria-label="Close quests"
            >
              <X size={16} />
            </button>
          </div>
          {claimedMsg && (
            <p className="mt-2 rounded-lg bg-emerald-500/20 px-3 py-2 text-sm text-emerald-300">
              {claimedMsg}
            </p>
          )}
          <div className="mt-3 space-y-3">
            {progress.map((p) => (
              <div key={p.def.id} className="rounded-xl bg-white/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{p.def.name}</span>
                  <span className="text-xs text-zinc-400">
                    {p.have}/{p.def.target}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-zinc-500">{p.def.desc}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full ${p.done ? "bg-emerald-500" : "bg-amber-500"}`}
                    style={{ width: `${Math.min(100, (p.have / p.def.target) * 100)}%` }}
                  />
                </div>
                {p.done && !p.claimed && (
                  <button
                    onClick={() => doClaim(p.def.id)}
                    className="mt-2 w-full rounded-lg bg-emerald-500 py-1.5 text-sm font-bold text-black hover:bg-emerald-400"
                  >
                    Claim +{p.def.reward} CITY
                  </button>
                )}
                {p.claimed && (
                  <p className="mt-2 text-xs text-emerald-400">✓ Claimed</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
