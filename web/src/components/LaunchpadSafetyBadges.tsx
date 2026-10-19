/**
 * LaunchpadSafetyBadges — trust signal pills for tokens on the OrbitX Launchpad.
 * Read-only component: no wallet, no trading. Shows the protections enforced
 * at launch time for a given token.
 */

interface SafetyToken {
  mint: string;
  name: string;
  symbol: string;
  max_tx_pct?: number | null;
  sniper_tax_bps?: number | null;
  status: string;
}

interface Props {
  token: SafetyToken;
}

interface Badge {
  key: string;
  label: string;
  tooltip: string;
  className: string;
  icon: string;
}

function statusColor(status: string): string {
  switch (status) {
    case "live":
      return "border-green-500/30 bg-green-500/10 text-green-300";
    case "trending":
      return "border-orange-500/30 bg-orange-500/10 text-orange-300";
    case "graduated":
      return "border-purple-500/30 bg-purple-500/10 text-purple-300";
    default:
      return "border-white/10 bg-white/5 text-white/50";
  }
}

export default function LaunchpadSafetyBadges({ token }: Props) {
  const maxTx = token.max_tx_pct ?? null;
  const sniperBps = token.sniper_tax_bps ?? null;

  const badges: Badge[] = [
    {
      key: "unique",
      label: "Anti-duplicate",
      tooltip:
        "This token's name and symbol are unique on the launchpad — no one can launch a copycat with the same name.",
      className: "border-blue-500/30 bg-blue-500/10 text-blue-300",
      icon: "🛡️",
    },
    {
      key: "maxtx",
      label: maxTx != null ? `Max TX: ${maxTx}%` : "No TX limit",
      tooltip:
        maxTx != null
          ? `No single buy or sell can exceed ${maxTx}% of the total supply. This caps whale dumps and front-running bots.`
          : "This token has no per-transaction limit set.",
      className:
        maxTx != null
          ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
          : "border-white/10 bg-white/5 text-white/40",
      icon: "📊",
    },
    {
      key: "sniper",
      label:
        sniperBps != null && sniperBps > 0
          ? `Sniper tax: ${(sniperBps / 100).toFixed(sniperBps % 100 === 0 ? 0 : 1)}%`
          : "No sniper tax",
      tooltip:
        sniperBps != null && sniperBps > 0
          ? `A ${(sniperBps / 100).toFixed(1)}% tax applies to trades in the first 5 minutes after launch. This punishes sniper bots that try to buy the first block and dump on everyone else.`
          : "This token launched without a sniper tax — early trades had no penalty.",
      className:
        sniperBps != null && sniperBps > 0
          ? "border-green-500/30 bg-green-500/10 text-green-300"
          : "border-white/10 bg-white/5 text-white/40",
      icon: "🎯",
    },
    {
      key: "status",
      label: token.status.charAt(0).toUpperCase() + token.status.slice(1),
      tooltip:
        token.status === "live"
          ? "Live on the launchpad bonding curve. Tradable right now."
          : token.status === "trending"
            ? "Trending — getting significant buy volume right now."
            : token.status === "graduated"
              ? "Graduated — this token moved to a real DEX pool with liquidity burned."
              : `Status: ${token.status}`,
      className: statusColor(token.status),
      icon:
        token.status === "live" ? "🟢" :
        token.status === "trending" ? "🔥" :
        token.status === "graduated" ? "🎓" : "⚪",
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {badges.map((b) => (
        <span
          key={b.key}
          title={b.tooltip}
          className={`inline-flex cursor-help items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${b.className}`}
        >
          <span aria-hidden="true">{b.icon}</span>
          {b.label}
        </span>
      ))}
    </div>
  );
}

/**
 * Usage example:
 *
 *   import LaunchpadSafetyBadges from "@/components/LaunchpadSafetyBadges";
 *
 *   <LaunchpadSafetyBadges
 *     token={{
 *       mint: t.mint,
 *       name: t.name,
 *       symbol: t.symbol,
 *       max_tx_pct: t.max_tx_pct,
 *       sniper_tax_bps: t.sniper_tax_bps,
 *       status: t.status,
 *     }}
 *   />
 */
