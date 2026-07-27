import { Link } from "react-router-dom";
import { Rocket, ArrowRight, ShieldCheck, Zap, Sparkles, ExternalLink } from "lucide-react";
import { PageHero, DexPanel } from "../components/PageShell";
import { VANITY_SUFFIX } from "../lib/vanity-mint";

/**
 * Launchpad tab — gateway to the real OrbitX Launchpad at /orbitxlaunch.
 * Multi-chain create lives under Tools → Create.
 */
export default function Launchpad() {
  return (
    <div className="max-w-[1100px] mx-auto space-y-6">
      <PageHero
        kicker="OrbitX Launchpad"
        title="Launch on the metal desk"
        sub={`Create coins, claim fees, and rescue tokens on the real OrbitX Launchpad — Solana bonding curves, custom …${VANITY_SUFFIX} vanity CAs, and Anti-Vamp protection.`}
        icon={Rocket}
      >
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="/orbitxlaunch" className="dex-btn">
            <Rocket className="h-4 w-4" /> Open Launchpad <ExternalLink className="h-3.5 w-3.5 opacity-70" />
          </a>
          <a href="/orbitxlaunch/create" className="dex-btn dex-btn--blue">
            <Zap className="h-4 w-4" /> Create coin
          </a>
          <Link to="/tools?tab=create" className="dex-btn dex-btn--ghost">
            DEX multi-chain create <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </PageHero>

      <div className="grid gap-4 sm:grid-cols-3">
        <DexPanel>
          <ShieldCheck className="h-5 w-5 text-[var(--ox-gold-hi)] mb-2" />
          <h3 className="font-display font-bold">Anti-Vamp</h3>
          <p className="mt-1 text-sm text-[var(--ox-silver)]">Originality checks and recognizable obx vanity addresses.</p>
        </DexPanel>
        <DexPanel>
          <Sparkles className="h-5 w-5 text-[var(--ox-blue-hi)] mb-2" />
          <h3 className="font-display font-bold">Board + feed</h3>
          <p className="mt-1 text-sm text-[var(--ox-silver)]">Live token board, leaderboard, portfolio, and claim desk.</p>
        </DexPanel>
        <DexPanel>
          <Zap className="h-5 w-5 text-[var(--ox-gold-hi)] mb-2" />
          <h3 className="font-display font-bold">Claim & rescue</h3>
          <p className="mt-1 text-sm text-[var(--ox-silver)]">Fee claim, rescue tools, and owner admin desk on launchpad.</p>
        </DexPanel>
      </div>

      <DexPanel className="text-center py-10">
        <p className="text-[var(--ox-silver)] text-sm mb-4">Launchpad moved out of the DEX terminal — it lives on its own metal desk now.</p>
        <a href="/orbitxlaunch" className="dex-btn inline-flex">
          Go to /orbitxlaunch <ArrowRight className="h-4 w-4" />
        </a>
      </DexPanel>
    </div>
  );
}
