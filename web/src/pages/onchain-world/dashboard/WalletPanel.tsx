import { type FormEvent, type ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bookmark,
  Calendar,
  Clock,
  Copy,
  ExternalLink,
  Flame,
  Hash,
  Layers,
  ShoppingBag,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { EmptyState } from "@/pages/onchain-world/dashboard/EmptyState";
import { Button } from "@/pages/onchain-world/dashboard/ui/button";
import { clock } from "@/pages/onchain-world/format";
import { formatAddress, formatInt, formatToken, formatUsd } from "@/pages/onchain-world/lib/orbitx/format";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";
import type { KolCard } from "@/pages/onchain-world/api";

export function WalletPanel() {
  const selected = useOrbitxStore((s) => s.selectedWallet);
  const trackWallet = useOrbitxStore((s) => s.trackWallet);
  const wallet = useOrbitxStore((s) => s.snapshot.wallet);
  const kols = useOrbitxStore((s) => s.city.kols);
  const setCamCommand = useOrbitxStore((s) => s.setCamCommand);
  const nav = useNavigate();
  const [draft, setDraft] = useState("");

  function onTrack(e: FormEvent) {
    e.preventDefault();
    const next = draft.trim();
    if (!next) return;
    trackWallet(next);
    setCamCommand({ kind: "wallet", address: next });
    nav(`/on-chain/wallet/${next}`);
    setDraft("");
  }

  function pickKol(address: string) {
    trackWallet(address);
    setCamCommand({ kind: "wallet", address });
    nav(`/on-chain/wallet/${address}`);
  }

  return (
    <aside className="ox-panel flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <h2 className="ox-kicker text-fg">Wallet intelligence</h2>
        {selected ? (
          <span className="text-2xs font-semibold tracking-wider text-live">TRACKED</span>
        ) : (
          <Bookmark className="size-3.5 text-dim" />
        )}
      </header>

      {!selected ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <form onSubmit={onTrack} className="border-b border-line p-3">
            <label className="ox-kicker mb-1.5 block" htmlFor="wallet-track">
              Track wallet
            </label>
            <div className="flex gap-1.5">
              <input
                id="wallet-track"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Paste a Solana address"
                className="h-9 min-w-0 flex-1 rounded-md border border-line bg-bg-sunken px-2.5 text-xs text-fg outline-none placeholder:text-dim focus-visible:border-line-strong"
              />
              <Button type="submit" size="sm">
                Track
              </Button>
            </div>
          </form>
          <EmptyState
            icon={<Wallet className="size-5" />}
            title="No wallet selected"
            body="Paste an address or pick an assigned KOL. Balances stay blank until confirmed chain data lands."
          />
          <KolDirectory kols={kols} selected={selected} onPick={pickKol} />
        </div>
      ) : (
        <div className="ox-scroll min-h-0 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-sm bg-bg-hover text-accent">
                <Wallet className="size-3.5" />
              </span>
              <div>
                <p className="ox-stat text-sm text-fg">{formatAddress(selected)}</p>
                <p className="text-2xs tracking-wider text-live">TRACKED</p>
              </div>
            </div>
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Copy address"
                onClick={() => navigator.clipboard?.writeText(selected)}
              >
                <Copy className="size-3.5" />
              </Button>
              <Button variant="ghost" size="icon-xs" aria-label="Untrack" onClick={() => trackWallet(null)}>
                <ExternalLink className="size-3.5" />
              </Button>
            </div>
          </div>

          <Section title="Balances">
            {(wallet?.balances ?? []).length === 0 ? (
              <p className="px-3 py-2 text-xs text-dim">No holdings in snapshot.</p>
            ) : (
              <ul className="divide-y divide-line">
                {wallet?.balances.map((b) => (
                  <li key={`${b.symbol}-${b.mint || "native"}`} className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-xs text-muted">{b.symbol}</span>
                    <span className="flex gap-4">
                      <span className="ox-stat text-xs text-fg">{formatToken(b.amount)}</span>
                      <span className="ox-stat w-16 text-right text-xs text-muted">{formatUsd(b.usd)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Stats">
            <StatRow icon={Hash} label="Total transactions" value={formatInt(wallet?.totalTransactions ?? null)} />
            <StatRow icon={ArrowDownLeft} label="SOL received" value={formatToken(wallet?.solReceived ?? null)} />
            <StatRow icon={ArrowUpRight} label="SOL sent" value={formatToken(wallet?.solSent ?? null)} />
            <StatRow icon={Layers} label="Tokens traded" value={formatInt(wallet?.tokensTraded ?? null)} />
            <StatRow icon={Calendar} label="First seen" value={wallet?.firstSeen ?? "—"} />
            <StatRow
              icon={Clock}
              label="Wallet age"
              value={wallet?.walletAgeDays != null ? `${wallet.walletAgeDays} days` : "—"}
            />
          </Section>

          <Section title="OrbitX summary">
            <StatRow icon={ShoppingBag} label="Purchased" value={formatUsd(wallet?.orbitxPurchasedUsd ?? null)} />
            <StatRow icon={TrendingDown} label="Sold" value={formatUsd(wallet?.orbitxSoldUsd ?? null)} />
            <StatRow icon={Flame} label="Burned" value={formatInt(wallet?.orbitxBurned ?? null)} />
            <StatRow icon={Wallet} label="Current holdings" value={formatInt(wallet?.orbitxHoldings ?? null)} />
            <StatRow icon={Hash} label="Avg buy price" value={formatUsd(wallet?.orbitxAvgBuy ?? null)} />
          </Section>

          <Section title="Activity">
            <ActivityBars values={wallet?.activity ?? []} />
          </Section>

          <Section title="Top counterparties">
            {(wallet?.counterparties ?? []).length === 0 ? (
              <p className="px-3 py-2 text-xs text-dim">None yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {wallet?.counterparties.map((c) => (
                  <li key={c.address} className="flex items-center justify-between px-3 py-1.5">
                    <button
                      type="button"
                      className="ox-stat text-xs text-fg hover:text-accent"
                      onClick={() => {
                        trackWallet(c.address);
                        nav(`/on-chain/wallet/${c.address}`);
                      }}
                    >
                      {formatAddress(c.address)}
                    </button>
                    <span className="ox-stat text-2xs text-muted">
                      {c.txs} txs · {c.sol} SOL
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <KolDirectory kols={kols} selected={selected} onPick={pickKol} />
        </div>
      )}
    </aside>
  );
}

function KolDirectory({
  kols,
  selected,
  onPick,
}: {
  kols: KolCard[];
  selected: string | null;
  onPick: (address: string) => void;
}) {
  const setCamCommand = useOrbitxStore((s) => s.setCamCommand);
  const selectToken = useOrbitxStore((s) => s.selectToken);
  const nav = useNavigate();
  if (!kols.length) {
    return (
      <section className="border-t border-line px-3 py-3">
        <h3 className="ox-kicker mb-1.5">KOL directory</h3>
        <p className="text-2xs text-dim">Assigned KOL roster has not loaded yet.</p>
      </section>
    );
  }
  return (
    <section className="border-t border-line">
      <h3 className="ox-kicker px-3 pt-3 pb-1.5">KOL directory · {kols.length}</h3>
      <ul className="divide-y divide-line">
        {kols.map((k) => (
          <li key={k.address}>
            <button
              type="button"
              onClick={() => onPick(k.address)}
              className={`flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-bg-hover ${selected === k.address ? "bg-bg-hover" : ""}`}
            >
              <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-fg">
                      {k.name}
                      {k.status === "disputed" ? " · listed" : k.hits ? "" : " · idle"}
                    </span>
                <span className="block truncate text-2xs text-dim">
                  {k.last_type
                    ? `${k.last_type.replace(/_/g, " ")}${k.last_token ? ` · ${k.last_token}` : ""}`
                    : k.twitter || formatAddress(k.address)}
                </span>
                {k.last_at ? <span className="block text-2xs text-dim">{clock(k.last_at)}</span> : null}
              </span>
              <span className="ox-stat shrink-0 text-2xs text-muted">{k.hits ?? 0}</span>
            </button>
            {k.last_mint ? (
              <button
                type="button"
                className="w-full px-3 pb-1.5 text-left text-2xs text-cyan hover:text-fg"
                onClick={() => {
                  selectToken(k.last_mint!);
                  setCamCommand({ kind: "token", mint: k.last_mint! });
                  nav(`/on-chain/token/${k.last_mint}`);
                }}
              >
                Last mint {formatAddress(k.last_mint)}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-line">
      <h3 className="ox-kicker px-3 pt-3 pb-1.5">{title}</h3>
      {children}
    </section>
  );
}

function StatRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Hash;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-1">
      <span className="flex items-center gap-2 text-xs text-muted">
        <Icon className="size-3 text-dim" />
        {label}
      </span>
      <span className="ox-stat text-xs text-fg">{value}</span>
    </div>
  );
}

function ActivityBars({ values }: { values: number[] }) {
  const series = values.length > 0 ? values : Array.from({ length: 24 }, () => 0);
  const max = Math.max(1, ...series);
  return (
    <div className="flex h-12 items-end gap-px px-3 pb-3">
      {series.map((v, i) => (
        <span
          key={i}
          className="flex-1 rounded-t-sm bg-accent-2/70"
          style={{ height: `${Math.max(8, (v / max) * 100)}%`, opacity: values.length ? 1 : 0.18 }}
        />
      ))}
    </div>
  );
}
