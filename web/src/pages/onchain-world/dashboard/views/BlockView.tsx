import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Cuboid, FileSearch } from "lucide-react";
import { EmptyState } from "@/pages/onchain-world/dashboard/EmptyState";
import { Button } from "@/pages/onchain-world/dashboard/ui/button";
import { fetchBlock, type BlockPayload } from "@/pages/onchain-world/api";
import { clock } from "@/pages/onchain-world/format";
import { formatAddress, formatInt } from "@/pages/onchain-world/lib/orbitx/format";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";

export function BlockView() {
  const nav = useNavigate();
  const params = useParams();
  const latest = useOrbitxStore((s) => s.snapshot.ticker.block);
  const setView = useOrbitxStore((s) => s.setActiveView);
  const slotParam = String(params.slot || "").trim();
  const slot = slotParam || (latest != null ? String(latest) : "");
  const [data, setData] = useState<BlockPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!slot) {
      setData(null);
      setErr(null);
      return;
    }
    let alive = true;
    setData(null);
    setErr(null);
    void fetchBlock(slot)
      .then((res) => {
        if (!alive) return;
        if (!res?.ok) {
          setErr(res?.error || "Slot not found.");
          setData(res);
          return;
        }
        setData(res);
      })
      .catch((e) => {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : "Block lookup failed.");
      });
    return () => {
      alive = false;
    };
  }, [slot]);

  if (!slot) {
    return (
      <EmptyState
        icon={<Cuboid className="size-5" />}
        title="Block explorer"
        body="Search a slot number or tap the live block in the ticker. Signatures in that slot open as transactions."
      />
    );
  }

  const sigs = data?.signatures || [];

  return (
    <div className="ox-scroll min-h-0 flex-1 overflow-auto bg-black">
      <header className="border-b border-line px-4 py-3">
        <p className="ox-kicker text-accent">Block</p>
        <h2 className="mt-1 font-display text-lg text-fg">Slot {slot}</h2>
        {latest != null && String(latest) !== slot ? (
          <Button
            variant="ghost"
            size="xs"
            className="mt-2"
            onClick={() => nav(`/on-chain/block/${latest}`)}
          >
            Jump to live slot {formatInt(latest)}
          </Button>
        ) : null}
      </header>

      <dl className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-3">
        <Stat label="Slot" value={formatInt(data?.slot ?? Number(slot) || null)} />
        <Stat label="Time" value={clock(data?.block_time)} />
        <Stat label="Transactions" value={formatInt(data?.transaction_count ?? sigs.length ?? null)} />
      </dl>

      {err ? (
        <p className="border-b border-line px-4 py-3 text-xs text-muted">
          {err} The slot is still addressable — RPC lookup needs the on-chain API.
        </p>
      ) : null}

      <section className="px-4 py-3">
        <h3 className="ox-kicker mb-2 text-fg">Signatures</h3>
        {sigs.length === 0 ? (
          <div className="flex items-center gap-2 text-2xs text-dim">
            <FileSearch className="size-3.5" />
            No signatures in this payload yet.
          </div>
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line">
            {sigs.map((sig) => (
              <li key={sig}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-bg-hover"
                  onClick={() => {
                    setView("tx");
                    nav(`/on-chain/tx/${sig}`);
                  }}
                >
                  <span className="truncate font-mono text-2xs text-fg">{sig}</span>
                  <span className="shrink-0 text-2xs text-dim">{formatAddress(sig)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg-panel px-3 py-2.5">
      <dt className="ox-kicker">{label}</dt>
      <dd className="ox-stat mt-0.5 text-xs text-fg">{value}</dd>
    </div>
  );
}
