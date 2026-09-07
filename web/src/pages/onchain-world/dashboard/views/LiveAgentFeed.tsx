import { useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import type { LiveDeskPayload } from "@/pages/onchain-world/api";
import { formatUsd, formatAddress } from "@/pages/onchain-world/lib/orbitx/format";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";
import { LIVE_AGENTS, LIVE_WALLET_PUBKEY, liveHuntList } from "../../../../../shared/orbitx-live-desk.js";
import { CopyMintButton } from "@/components/CopyMintButton";
import { useLiveDesk } from "../useLiveDesk";

type FeedRow = NonNullable<LiveDeskPayload["feed"]>[number];

function money(n: number | null | undefined, sign = false) {
  if (n == null || Number.isNaN(Number(n))) return null;
  const v = Number(n);
  const body = formatUsd(Math.abs(v));
  if (!sign) return v < 0 ? `-${body}` : body;
  return `${v >= 0 ? "+" : "-"}${body}`;
}

function timeAgo(at: string | null | undefined, now: number) {
  if (!at) return "";
  const ms = Math.max(0, now - Date.parse(at));
  if (ms < 15_000) return "now";
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`;
  return new Date(at).toISOString().slice(5, 16);
}

const CA_BTN =
  "rounded-full border-line bg-transparent px-2 py-0.5 text-[10px] font-semibold tracking-wide text-dim hover:border-fg hover:text-fg";

export function HuntWatchBar({ hunts }: { hunts?: LiveDeskPayload["hunt"] }) {
  const list = hunts?.length ? hunts : liveHuntList();
  if (!list.length) return null;
  return (
    <div className="border-b border-line bg-bg-sunken/80 px-4 py-2">
      {list.map((h) => (
        <div key={h.mint} className="flex flex-wrap items-center gap-2">
          <span className="ox-kicker text-accent">Hunt</span>
          <span className="text-2xs text-fg">${h.symbol}</span>
          <code className="truncate text-[10px] text-muted">{formatAddress(h.mint)}</code>
          <CopyMintButton mint={h.mint} label="copy CA" copiedLabel="copied" className={CA_BTN} iconClassName="h-3 w-3" />
          <span className="text-[10px] text-dim">
            ${Number(h.clipUsd || 1).toFixed(2)} clip now. Sell 41% at ${Math.round(Number(h.scaleMcap || 300000) / 1000)}k MC,
            flatten at ${Math.round(Number(h.flattenMcap || 600000) / 1000)}k.
          </span>
        </div>
      ))}
    </div>
  );
}

export function LiveAgentFeed({ snap: snapProp, now: nowProp }: { snap?: LiveDeskPayload | null; now?: number } = {}) {
  const hooked = useLiveDesk();
  const snap = snapProp ?? hooked.snap;
  const now = nowProp ?? hooked.now;
  const nav = useNavigate();
  const selectToken = useOrbitxStore((s) => s.selectToken);
  const setCam = useOrbitxStore((s) => s.setCamCommand);
  const setView = useOrbitxStore((s) => s.setActiveView);

  const wallet = snap?.wallet || LIVE_WALLET_PUBKEY;
  const feed = snap?.feed || [];
  const ledger = snap?.ledger;
  const made = money(ledger?.made_usd, true);

  function openMint(mint?: string | null) {
    if (!mint) return;
    selectToken(mint);
    setCam({ kind: "token", mint });
    setView("world");
    nav(`/on-chain/token/${mint}`);
  }

  return (
    <div className="ox-scroll min-h-0 flex-1 overflow-auto bg-black">
      <header className="sticky top-0 z-10 border-b border-line bg-black/90 px-4 py-3 backdrop-blur-xl">
        <p className="ox-kicker text-accent">Live feed</p>
        <h2 className="font-display text-lg text-fg">What the desk is doing</h2>
        <p className="mt-1 text-2xs text-muted">
          Neon, Warden, and Raid post every clip, every skip, every exit — in plain language, with Solscan proof.
          {made ? ` Desk is ${made} vs start.` : ""} Watched names get a copy-CA button. Not financial advice.
        </p>
      </header>
      <HuntWatchBar hunts={snap?.hunt} />
      {feed.length ? (
        <ol>
          {feed.map((row) => (
            <FeedPost key={row.id} row={row} now={now} wallet={wallet} onMint={openMint} />
          ))}
        </ol>
      ) : (
        <p className="px-4 py-8 text-sm text-dim">
          Quiet tape. Next armed tick they&apos;ll post a buy, a pass, or a sell right here.
        </p>
      )}
    </div>
  );
}

function FeedPost({
  row,
  now,
  wallet,
  onMint,
}: {
  row: FeedRow;
  now: number;
  wallet: string;
  onMint: (mint?: string | null) => void;
}) {
  const agent = LIVE_AGENTS.find((a) => a.id === row.agent_id);
  const color = row.agent_color || agent?.color || "#f5f5f5";
  const handle = row.agent_handle || (agent ? `@${agent.id.replace("-live", "")}` : "@desk");
  const name = row.agent_name || agent?.name || "Live desk";
  const text = row.text || row.thesis || row.reason || "On the desk.";
  const pnl = money(row.pnl_usd, true);
  const usd = money(row.usd);
  const kind = String(row.kind || "post");

  return (
    <li className="border-b border-line px-4 py-3 hover:bg-bg-hover/40">
      <div className="flex gap-3">
        <span
          className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold"
          style={{ background: `${color}22`, color }}
        >
          {(name.replace(/\s+LIVE$/i, "") || "A").slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold text-fg">{name.replace(/\s+LIVE$/i, "")}</span>
            <span className="text-2xs text-dim">{handle}</span>
            <span className="text-2xs text-faint">· {timeAgo(row.at, now)}</span>
            <span className="rounded-full border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-dim">
              {kind}
            </span>
          </div>
          <p className="mt-1 text-[15px] leading-relaxed text-fg">{text}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-2xs">
            {row.symbol ? (
              <button type="button" className="rounded-full border border-line px-2 py-0.5 text-fg hover:bg-bg-hover" onClick={() => onMint(row.mint)}>
                ${String(row.symbol).replace(/^\$/, "")}
              </button>
            ) : null}
            {usd ? <span className="text-muted">{usd} clipped</span> : null}
            {pnl ? <span className={Number(row.pnl_usd) >= 0 ? "text-live" : "text-dim"}>{pnl} made</span> : null}
            {row.solscan_tx || row.signature ? (
              <a className="inline-flex items-center gap-1 text-dim hover:text-fg" href={row.solscan_tx || `https://solscan.io/tx/${row.signature}`} target="_blank" rel="noreferrer">
                Solscan tx <ExternalLink className="size-3" />
              </a>
            ) : null}
            {row.mint ? (
              <>
                <CopyMintButton mint={row.mint} label="CA" copiedLabel="copied" className={CA_BTN} iconClassName="h-3 w-3" />
                <a className="inline-flex items-center gap-1 text-dim hover:text-fg" href={row.solscan_token || `https://solscan.io/token/${row.mint}`} target="_blank" rel="noreferrer">
                  token
                </a>
              </>
            ) : null}
            <a className="inline-flex items-center gap-1 text-dim hover:text-fg" href={row.solscan_account || `https://solscan.io/account/${wallet}`} target="_blank" rel="noreferrer">
              wallet
            </a>
          </div>
        </div>
      </div>
    </li>
  );
}
