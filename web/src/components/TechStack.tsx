import { useEffect, useState } from "react";
import {
  Server,
  Network,
  Database,
  Zap,
  Eye,
  Radio,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Newspaper,
  AtSign,
  Globe2,
} from "lucide-react";
import {
  JUPITER_BASE,
  HELIUS_RPC,
  BIRDEYE_BASE,
  ALCHEMY_API_KEY,
  QUICKNODE_WSS,
  OGSCAN_SITE_URL,
  OGSCAN_TECH_POST_URL,
  OGSCAN_X_URL,
} from "@/lib/og";

type Status = "idle" | "checking" | "ok" | "down";

type Probe = {
  id: string;
  name: string;
  role: string;
  desc: string;
  endpoint: string;
  Icon: React.ComponentType<{ className?: string }>;
  color: string;
  check: () => Promise<boolean>;
};

const PROBES: Probe[] = [
  {
    id: "jupiter",
    name: "JUPITER",
    role: "AGGREGATOR · ROUTING",
    desc: "Token registry, pricing, organic score, swap quotes routed across every Solana DEX. The same engine that powers jup.ag.",
    endpoint: `${JUPITER_BASE}/tokens/v2/search?query=SOL`,
    Icon: Zap,
    color: "lime",
    check: async () => {
      const r = await fetch(`${JUPITER_BASE}/tokens/v2/search?query=SOL`);
      return r.ok;
    },
  },
  {
    id: "helius",
    name: "HELIUS",
    role: "RPC · PARSED TX",
    desc: "Solana mainnet RPC plus enriched, human-readable transaction history. Powers the live tape and whale tracker.",
    endpoint: HELIUS_RPC,
    Icon: Network,
    color: "cyan",
    check: async () => {
      const r = await fetch(HELIUS_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
      });
      return r.ok;
    },
  },
  {
    id: "birdeye",
    name: "BIRDEYE",
    role: "OHLCV · CHARTS",
    desc: "Historical candles, price points, and market depth used to render the live sparkline and volatility envelope.",
    endpoint: `${BIRDEYE_BASE}/defi/ohlcv`,
    Icon: Eye,
    color: "gold",
    check: async () => {
      // Birdeye blocks unauth probes — treat reachable origin as OK.
      try {
        await fetch(`${BIRDEYE_BASE}/defi/ohlcv?address=So11111111111111111111111111111111111111112&type=15m`, {
          mode: "no-cors",
        });
        return true;
      } catch {
        return false;
      }
    },
  },
  {
    id: "alchemy",
    name: "ALCHEMY",
    role: "RPC · BACKUP",
    desc: "Secondary Solana mainnet RPC for redundancy and rate-limit relief. Failover lane when Helius slows.",
    endpoint: `https://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    Icon: Server,
    color: "lime",
    check: async () => {
      const r = await fetch(`https://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
      });
      return r.ok;
    },
  },
  {
    id: "quicknode",
    name: "QUICKNODE",
    role: "WSS · STREAMING",
    desc: "WebSocket lane for low-latency block/log subscriptions. Feeds the real-time pair-detect pipeline.",
    endpoint: QUICKNODE_WSS,
    Icon: Radio,
    color: "cyan",
    check: () =>
      new Promise<boolean>((resolve) => {
        try {
          const ws = new WebSocket(QUICKNODE_WSS);
          const t = setTimeout(() => {
            try { ws.close(); } catch { /* noop */ }
            resolve(false);
          }, 4000);
          ws.onopen = () => {
            clearTimeout(t);
            ws.close();
            resolve(true);
          };
          ws.onerror = () => {
            clearTimeout(t);
            resolve(false);
          };
        } catch {
          resolve(false);
        }
      }),
  },
  {
    id: "rork",
    name: "RORK CACHE",
    role: "CLIENT · TANSTACK",
    desc: "TanStack Query handles cache, dedupe, refetch intervals and backoff for every API. Zero servers, all in-browser.",
    endpoint: "tanstack-query · in-memory",
    Icon: Database,
    color: "gold",
    check: async () => true,
  },
];

const colorMap: Record<string, { ring: string; text: string; chip: string }> = {
  lime: { ring: "border-og-lime/40", text: "text-og-lime", chip: "bg-og-lime/10 text-og-lime border-og-lime/40" },
  gold: { ring: "border-og-gold/40", text: "text-og-gold", chip: "bg-og-gold/10 text-og-gold border-og-gold/40" },
  cyan: { ring: "border-og-cyan/40", text: "text-og-cyan", chip: "bg-og-cyan/10 text-og-cyan border-og-cyan/40" },
};

const TECH_BULLETS: string[] = [
  "Narrative fingerprint clustering",
  "Earliest on-chain mint proof",
  "First liquidity + timeline graph",
  "Clone / relaunch probability",
  "Deployer trust fingerprint",
  "Migration and CTO risk separation",
];

export const TechStack = () => {
  const [statuses, setStatuses] = useState<Record<string, Status>>(
    Object.fromEntries(PROBES.map((p) => [p.id, "idle"]))
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      for (const p of PROBES) {
        if (cancelled) return;
        setStatuses((s) => ({ ...s, [p.id]: "checking" }));
        let ok = false;
        try { ok = await p.check(); } catch { ok = false; }
        if (cancelled) return;
        setStatuses((s) => ({ ...s, [p.id]: ok ? "ok" : "down" }));
      }
    };
    run();
    const id = window.setInterval(run, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return (
    <section id="tech" className="mx-auto grid w-full max-w-6xl gap-4 scroll-mt-32">
      <div className="relative mx-auto w-full max-w-4xl overflow-hidden border border-og-gold/35 bg-og-ink/80 p-3 shadow-og-gold sm:p-4">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-og-gold/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/2 h-36 w-36 -translate-x-1/2 rounded-full bg-og-lime/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-3xl gap-4 text-center">
          <div>
            <div className="mb-2 inline-flex items-center justify-center gap-2 border border-og-gold/45 bg-og-gold/10 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.26em] text-og-gold">
              <Newspaper className="h-3 w-3" /> Launch broadcast
            </div>
            <h2 className="mx-auto max-w-2xl font-display text-2xl font-bold leading-tight text-foreground sm:text-3xl">
              Find the <span className="text-og-gold text-glow-gold">OG</span> before the fake finds you.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Most traders do not lose because they are late. They lose because they buy the wrong version of the coin:
              same ticker, same logo, same hype — while the real OG gets buried under copycats.
            </p>
            <p className="mx-auto mt-2 max-w-2xl text-xs leading-relaxed text-foreground/80 sm:text-sm">
              OGScan verifies before you ape: search any ticker, reconstruct the origin timeline, and surface the contract with the earliest provable chain history.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <a href={OGSCAN_TECH_POST_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-og-gold bg-og-gold px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-widest text-og-ink transition hover:bg-og-gold/90">
                <Newspaper className="h-3.5 w-3.5" /> Read post
              </a>
              <a href={OGSCAN_X_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-og-lime/50 px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-widest text-og-lime transition hover:bg-og-lime hover:text-og-ink">
                <AtSign className="h-3.5 w-3.5" /> Follow X
              </a>
              <a href={OGSCAN_SITE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-og-grid px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-widest text-foreground/70 transition hover:border-og-lime hover:text-og-lime">
                <Globe2 className="h-3.5 w-3.5" /> ogscan.fun
              </a>
            </div>
          </div>

          <div className="mx-auto w-full max-w-2xl border border-og-grid bg-black/25 p-3">
            <div className="mb-2 flex items-center justify-center gap-3 border-b border-og-grid pb-2 font-mono text-[9px] uppercase tracking-[0.24em]">
              <span className="text-og-lime">Scanner checks</span>
              <span className="text-muted-foreground">before ape</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {TECH_BULLETS.map((item) => (
                <div key={item} className="flex items-center gap-2 border border-og-grid/70 bg-og-ink/65 px-2.5 py-1.5 text-left text-[11px] text-foreground/80">
                  <CheckCircle2 className="h-3 w-3 shrink-0 text-og-lime" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline diagram */}
      <div className="border border-og-grid bg-og-ink/70 p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-og-cyan">
          <span className="h-px w-10 bg-og-cyan" /> DATA · PIPELINE
        </div>
        <div className="mx-auto grid max-w-5xl items-center gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <PipeBlock title="CHAIN ORIGIN" lines={["Mint timestamps", "first tx · first holder"]} color="cyan" />
          <Arrow />
          <PipeBlock
            title="ATTRIBUTION"
            lines={["Jupiter · DexScreener", "Helius · Birdeye"]}
            color="lime"
          />
          <Arrow />
          <PipeBlock
            title="FORENSICS"
            lines={["deployer · liquidity", "clone · migration risk"]}
            color="gold"
          />
        </div>
        <div className="mx-auto mt-3 grid max-w-5xl items-center gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <PipeBlock title="CLUSTER" lines={["unicode normalized", "leet · emoji · symbol safe"]} color="cyan" />
          <Arrow />
          <PipeBlock title="SCORING" lines={["TRUE_OG_SCORE", "12-factor formula"]} color="gold" />
          <Arrow />
          <PipeBlock title="OUTPUT" lines={["TRUE OG · CLONE", "CTO · MIGRATION"]} color="lime" />
        </div>
      </div>

      {/* Probe cards */}
      <div className="mx-auto grid w-full max-w-5xl gap-3 md:grid-cols-2 xl:grid-cols-3">
        {PROBES.map((p) => {
          const st = statuses[p.id] ?? "idle";
          const c = colorMap[p.color];
          return (
            <div
              key={p.id}
              className={`relative border ${c.ring} bg-og-ink/70 p-4`}
            >
              <div className="flex items-center justify-between">
                <div className={`flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] ${c.text}`}>
                  <p.Icon className="h-3.5 w-3.5" />
                  {p.name}
                </div>
                <StatusPill status={st} />
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {p.role}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-foreground/70">{p.desc}</p>
              <div className="mt-3 truncate border-t border-og-grid/60 pt-2 font-mono text-[10px] text-muted-foreground">
                {p.endpoint}
              </div>
            </div>
          );
        })}
      </div>

      {/* Capability matrix */}
      <div className="mx-auto w-full max-w-5xl border border-og-grid bg-og-ink/70">
        <div className="border-b border-og-grid px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-og-gold">
          CAPABILITY · MATRIX
        </div>
        <div className="grid grid-cols-2 gap-px bg-og-grid sm:grid-cols-3 lg:grid-cols-4">
          {[
            { label: "TOKEN SEARCH", src: "JUPITER" },
            { label: "NARRATIVE CLUSTER", src: "OGSCAN" },
            { label: "TRUE OG SCORE", src: "12-FACTOR FUSION" },
            { label: "CLONE PROBABILITY", src: "ORIGIN GRAPH" },
            { label: "PARSED TX", src: "HELIUS" },
            { label: "FIRST LIQUIDITY", src: "DEXSCREENER" },
            { label: "ATH / CANDLES", src: "BIRDEYE" },
            { label: "DEPLOYER TRUST", src: "AUDIT + GRAPH" },
            { label: "MIGRATION RISK", src: "TIMELINE DELTA" },
            { label: "CTO RISK", src: "BEHAVIORAL MODEL" },
            { label: "RUG / AUTHORITY", src: "JUPITER AUDIT" },
            { label: "ROUTE QUOTES", src: "JUPITER" },
          ].map((row) => (
            <div key={row.label} className="bg-og-ink p-3">
              <div className="text-[10px] uppercase tracking-[0.3em] text-foreground/60">{row.label}</div>
              <div className="mt-1 font-mono text-[11px] uppercase tracking-widest text-og-lime">
                {row.src}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const StatusPill = ({ status }: { status: Status }) => {
  if (status === "checking" || status === "idle") {
    return (
      <span className="inline-flex items-center gap-1 border border-og-grid px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> PROBING
      </span>
    );
  }
  if (status === "ok") {
    return (
      <span className="inline-flex items-center gap-1 border border-og-lime/60 bg-og-lime/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-og-lime">
        <CheckCircle2 className="h-3 w-3" /> ONLINE
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 border border-og-blood/60 bg-og-blood/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-og-blood">
      <XCircle className="h-3 w-3" /> OFFLINE
    </span>
  );
};

const PipeBlock = ({
  title,
  lines,
  color,
}: {
  title: string;
  lines: string[];
  color: "lime" | "gold" | "cyan";
}) => {
  const c = colorMap[color];
  return (
    <div className={`h-full border ${c.ring} bg-og-ink/60 p-3 text-center sm:text-left`}>
      <div className={`text-[10px] uppercase tracking-[0.3em] ${c.text}`}>{title}</div>
      {lines.map((l) => (
        <div key={l} className="mt-1 font-mono text-[11px] text-foreground/70">{l}</div>
      ))}
    </div>
  );
};

const Arrow = () => (
  <div className="flex items-center justify-center text-og-grid">
    <ArrowRight className="h-5 w-5" />
  </div>
);
