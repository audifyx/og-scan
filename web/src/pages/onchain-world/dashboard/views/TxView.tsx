import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Copy, Cuboid, FileSearch } from "lucide-react";
import { EmptyState } from "@/pages/onchain-world/dashboard/EmptyState";
import { Button } from "@/pages/onchain-world/dashboard/ui/button";
import { fetchTx, type TxPayload } from "@/pages/onchain-world/api";
import { clock } from "@/pages/onchain-world/format";
import { formatAddress, formatUsd } from "@/pages/onchain-world/lib/orbitx/format";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";

export function TxView() {
  const nav = useNavigate();
  const params = useParams();
  const signature = String(params.signature || "").trim();
  const setView = useOrbitxStore((s) => s.setActiveView);
  const selectToken = useOrbitxStore((s) => s.selectToken);
  const trackWallet = useOrbitxStore((s) => s.trackWallet);
  const [data, setData] = useState<TxPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rawOpen, setRawOpen] = useState(false);

  useEffect(() => {
    if (!signature) {
      setData(null);
      setErr(null);
      return;
    }
    let alive = true;
    setData(null);
    setErr(null);
    void fetchTx(signature)
      .then((res) => {
        if (!alive) return;
        if (!res?.ok) {
          setErr(res?.error || "Signature not found.");
          setData(res);
          return;
        }
        setData(res);
      })
      .catch((e) => {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : "Transaction lookup failed.");
      });
    return () => {
      alive = false;
    };
  }, [signature]);

  if (!signature) {
    return (
      <EmptyState
        icon={<FileSearch className="size-5" />}
        title="Transaction explorer"
        body="Paste a Solana signature in search, or open a row from the live tape. This desk decodes status, fee, slot, and indexed events."
      />
    );
  }

  const events = data?.events || [];
  const status = data?.status || (err ? "UNKNOWN" : "LOADING");

  return (
    <div className="ox-scroll min-h-0 flex-1 overflow-auto bg-black">
      <header className="border-b border-line px-4 py-3">
        <p className="ox-kicker text-accent">Transaction</p>
        <h2 className="mt-1 break-all font-mono text-xs text-fg sm:text-sm">{signature}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => void navigator.clipboard?.writeText(signature)}
          >
            <Copy className="size-3" />
            Copy
          </Button>
          {data?.slot != null ? (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setView("block");
                nav(`/on-chain/block/${data.slot}`);
              }}
            >
              <Cuboid className="size-3" />
              Slot {data.slot}
            </Button>
          ) : null}
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-4">
        <Stat label="Status" value={status} />
        <Stat label="Slot" value={data?.slot != null ? String(data.slot) : "—"} />
        <Stat label="Fee" value={data?.fee != null ? `${data.fee.toFixed(9)} SOL` : "—"} />
        <Stat label="Time" value={clock(data?.block_time)} />
      </dl>

      {err ? (
        <p className="border-b border-line px-4 py-3 text-xs text-muted">
          {err} Live lookup needs the indexer API — the signature is still valid to share.
        </p>
      ) : null}

      <section className="border-b border-line px-4 py-3">
        <h3 className="ox-kicker mb-2 text-fg">Indexed events</h3>
        {events.length === 0 ? (
          <p className="text-2xs text-dim">No decoded events for this signature yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line">
            {events.map((e) => (
              <li key={e.event_id} className="px-3 py-2 text-2xs">
                <p className="font-medium text-fg">{(e.event_type || "EVENT").replace(/_/g, " ")}</p>
                <p className="mt-0.5 text-dim">
                  {e.wallet ? (
                    <button
                      type="button"
                      className="hover:text-fg"
                      onClick={() => {
                        trackWallet(e.wallet);
                        setView("wallets");
                        nav(`/on-chain/wallet/${e.wallet}`);
                      }}
                    >
                      {formatAddress(e.wallet)}
                    </button>
                  ) : (
                    "—"
                  )}
                  {e.token_ca ? (
                    <>
                      {" · "}
                      <button
                        type="button"
                        className="hover:text-fg"
                        onClick={() => {
                          selectToken(e.token_ca);
                          setView("world");
                          nav(`/on-chain/token/${e.token_ca}`);
                        }}
                      >
                        {e.token_symbol || formatAddress(e.token_ca)}
                      </button>
                    </>
                  ) : null}
                  {e.usd_value != null ? ` · ${formatUsd(e.usd_value)}` : ""}
                  {e.sol_amount != null ? ` · ${e.sol_amount} SOL` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="px-4 py-3">
        <button
          type="button"
          className="ox-kicker text-muted hover:text-fg"
          onClick={() => setRawOpen((v) => !v)}
        >
          {rawOpen ? "Hide raw JSON" : "Show raw / parsed"}
        </button>
        {rawOpen ? (
          <pre className="mt-2 max-h-80 overflow-auto rounded-md border border-line bg-bg-sunken p-3 font-mono text-[10px] leading-4 text-muted">
            {JSON.stringify({ parsed: data?.parsed ?? null, raw: data?.raw ?? null }, null, 2)}
          </pre>
        ) : null}
        <p className="mt-3 text-2xs text-dim">
          Need the mint instead?{" "}
          <Link to="/on-chain" className="text-fg underline-offset-2 hover:underline">
            Return to the living universe
          </Link>
          .
        </p>
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
