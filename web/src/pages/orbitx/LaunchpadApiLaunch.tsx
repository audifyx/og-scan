// OrbitX Launchpad — THIRD LANE: API LAUNCH. Multi-chain, provider-API driven.
// Solana is live today (PumpPortal + OrbitX Token-2022). Every other chain and
// provider is registered in lib/orbitx/chains.ts and flips live as its adapter
// + config lands — the UI is entirely data-driven.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Clock3, FlaskConical, Globe2, Plug, ShieldCheck } from "lucide-react";
import { CHAINS, chainById, providersForChain, type RolloutStatus } from "@/lib/orbitx/chains";

const STATUS_META: Record<RolloutStatus, { label: string; cls: string; Icon: React.ComponentType<{ className?: string }> }> = {
  live: { label: "Live",  cls: "border-[hsl(var(--og-lime))]/40 bg-[hsl(var(--og-lime))]/10 text-[hsl(var(--og-lime))]", Icon: CheckCircle2 },
  beta: { label: "Beta",  cls: "border-[hsl(var(--og-cyan))]/40 bg-[hsl(var(--og-cyan))]/10 text-[hsl(var(--og-cyan))]", Icon: FlaskConical },
  soon: { label: "Soon",  cls: "border-white/15 bg-white/5 text-muted-foreground", Icon: Clock3 },
};

function StatusChip({ status }: { status: RolloutStatus }) {
  const { label, cls, Icon } = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest ${cls}`}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

export default function LaunchpadApiLaunch() {
  const [chainId, setChainId] = useState("solana");
  const chain = chainById(chainId) ?? CHAINS[0];
  const providers = useMemo(() => providersForChain(chain.id), [chain.id]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.34em] text-[hsl(var(--og-gold))]">// third lane — api launch</div>
        <h1 className="mt-2 font-display text-3xl font-black tracking-tight">
          LAUNCH VIA <span className="lpx-glow text-[hsl(var(--og-gold))]">API</span> · ANY CHAIN
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          pump.fun-style launch APIs, one console — <span className="text-[hsl(var(--og-lime))]">Solana live now</span>, EVM chains coming online per provider.
        </p>
      </div>

      {/* chain rail */}
      <div className="lpx-panel mb-6 p-4">
        <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <Globe2 className="h-3.5 w-3.5" /> Select chain · {CHAINS.length} registered
        </div>
        <div className="flex flex-wrap gap-2">
          {CHAINS.map((c) => (
            <button
              key={c.id}
              onClick={() => setChainId(c.id)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-[11px] font-bold transition ${
                c.id === chain.id
                  ? "border-[hsl(var(--og-gold))]/60 bg-[hsl(var(--og-gold))]/10 text-foreground"
                  : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/25 hover:text-foreground"
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
              {c.name}
              <StatusChip status={c.status} />
            </button>
          ))}
        </div>
      </div>

      {/* providers for the selected chain */}
      <div className="space-y-4">
        {providers.length === 0 && (
          <div className="lpx-panel p-6 text-center text-sm text-muted-foreground">
            No launch APIs registered for {chain.name} yet — the OrbitX EVM Factory will cover it.
          </div>
        )}
        {providers.map((p) => (
          <div key={p.id} className="lpx-panel relative flex flex-col gap-4 p-6 md:flex-row md:items-center">
            <div className="md:min-w-[240px]">
              <div className="mb-1 flex items-center gap-2">
                <Plug className="h-4 w-4 text-[hsl(var(--og-gold))]" />
                <span className="font-display text-base font-black">{p.name}</span>
              </div>
              <StatusChip status={p.status} />
            </div>
            <div className="flex-1">
              <p className="text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">API: {p.api}</p>
              {p.requires && p.requires.length > 0 && (
                <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[hsl(var(--og-gold))]/80">
                  Goes live with: {p.requires.join(" · ")}
                </p>
              )}
            </div>
            {p.status === "live" && p.route ? (
              <Link to={p.route} className="lpx-btn w-full !border-[hsl(var(--og-lime))]/50 !text-[hsl(var(--og-lime))] hover:!bg-[hsl(var(--og-lime))]/15 md:w-auto">
                Launch now <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="inline-flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-5 py-3 font-display text-xs font-black uppercase tracking-wider text-muted-foreground md:w-auto">
                <Clock3 className="h-4 w-4" /> Coming online
              </span>
            )}
          </div>
        ))}
      </div>

      <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-[hsl(var(--og-lime))]" />
        every lane is non-custodial — transactions are built by the provider API and signed only in your wallet
      </p>
    </div>
  );
}
