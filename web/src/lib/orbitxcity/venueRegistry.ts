import type { BuildingDefinition, InteractionKind } from "@/lib/orbitxcity/types";

export interface VenueAction {
  id: string;
  label: string;
  description: string;
  route: string;
  tag: string;
}

export interface VenueDefinition {
  eyebrow: string;
  title: string;
  description: string;
  actions: VenueAction[];
}

const DEX_ACTIONS: VenueAction[] = [
  { id: "discover", label: "Discover tokens", description: "Live Pump.fun, Jupiter, Moonshot and market discovery from OrbitX DEX.", route: "/ORBITX_DEX", tag: "Live market" },
  { id: "trade", label: "Buy & sell", description: "Open the complete OrbitX trading terminal with quotes, charts and execution.", route: "/ORBITX_DEX/tools", tag: "Trading" },
  { id: "pulse", label: "Market pulse", description: "Track movers, liquidity, volume, risk signals and current momentum.", route: "/ORBITX_DEX/pulse", tag: "Intelligence" },
  { id: "wallet", label: "Portfolio", description: "Review wallet positions, balances, activity and token exposure.", route: "/ORBITX_DEX/wallet", tag: "Account" },
  { id: "alerts", label: "Alerts", description: "Manage real price, wallet and market alerts from the DEX.", route: "/ORBITX_DEX/alerts", tag: "Monitoring" },
];

const LAUNCH_ACTIONS: VenueAction[] = [
  { id: "launch-home", label: "Launchpad", description: "Browse live OrbitX launches and creator activity.", route: "/orbitxlaunch", tag: "Live" },
  { id: "pump", label: "Launch on Pump", description: "Create a Pump.fun token through the existing launch workflow.", route: "/orbitxlaunch/create/pump", tag: "Pump.fun" },
  { id: "custom", label: "Custom token", description: "Configure and deploy a custom token with OrbitX launch tools.", route: "/orbitxlaunch/create/custom", tag: "Create" },
  { id: "curves", label: "Curve markets", description: "Explore active bonding-curve markets and trade supported launches.", route: "/orbitxlaunch/curves", tag: "Markets" },
  { id: "launch-portfolio", label: "Launch portfolio", description: "View tokens, creator positions and launch history.", route: "/orbitxlaunch/portfolio", tag: "Account" },
  { id: "claim", label: "Claims", description: "Open the live token claim center.", route: "/orbitxlaunch/claim", tag: "Rewards" },
];

const SOCIAL_ACTIONS: VenueAction[] = [
  { id: "social", label: "OrbitX Social", description: "Open your real feed, communities and creator network.", route: "/orbitx-social", tag: "Social" },
  { id: "messages", label: "Messages", description: "Continue account conversations in OrbitX Social.", route: "/hq/messages", tag: "Inbox" },
  { id: "spaces", label: "Voice spaces", description: "Join live account-based rooms and community spaces.", route: "/hq/spaces", tag: "Voice" },
  { id: "profile", label: "My profile", description: "Open your signed-in OrbitX identity and activity.", route: "/hq/profile", tag: "Account" },
];

const BY_INTERACTION: Record<InteractionKind, VenueDefinition> = {
  marketplace: { eyebrow: "Meme Market", title: "Meme Market Exchange", description: "The complete OrbitX discovery, trading and token launch gateway.", actions: [...DEX_ACTIONS, ...LAUNCH_ACTIONS] },
  trading: { eyebrow: "OrbitX DEX", title: "Trading Floor", description: "Live market intelligence and execution powered by the existing OrbitX DEX.", actions: DEX_ACTIONS },
  launch: { eyebrow: "Launch Arena", title: "Token Launch Center", description: "Create, discover and manage real launches through OrbitX production tools.", actions: LAUNCH_ACTIONS },
  community: { eyebrow: "Social District", title: "Community Hub", description: "Your OrbitX account, network, messages and spaces in one place.", actions: SOCIAL_ACTIONS },
  voice: { eyebrow: "Voice Tower", title: "Live Voice Lobby", description: "Join account-based conversations and active OrbitX spaces.", actions: SOCIAL_ACTIONS.slice(1, 3) },
  hq: { eyebrow: "OrbitX HQ", title: "Operations Center", description: "Enter the core OrbitX social, intelligence and account systems.", actions: [SOCIAL_ACTIONS[0], DEX_ACTIONS[2], SOCIAL_ACTIONS[3]] },
  games: { eyebrow: "Play District", title: "OrbitX Gaming Studio", description: "Launch the complete OrbitX Play experience.", actions: [{ id: "play", label: "Enter Play Studio", description: "Open live OrbitX games and gaming tools.", route: "/play", tag: "Games" }] },
  nft: { eyebrow: "NFT Gallery", title: "Digital Asset Market", description: "Explore, create and manage assets in the OrbitX NFT marketplace.", actions: [
    { id: "nft-market", label: "Explore marketplace", description: "Browse live collections, drops and listed assets.", route: "/nft", tag: "Marketplace" },
    { id: "nft-create", label: "Create NFT", description: "Open the production NFT creation workflow.", route: "/nft/create", tag: "Create" },
    { id: "nft-profile", label: "My assets", description: "View your connected wallet's NFT profile.", route: "/nft/me", tag: "Account" },
  ] },
  token: { eyebrow: "Token Terminal", title: "Token Intelligence", description: "Inspect live token data in OrbitX DEX before trading.", actions: DEX_ACTIONS.slice(0, 3) },
  billboard: { eyebrow: "Media Tower", title: "OrbitX Live", description: "Open live community and market activity.", actions: [DEX_ACTIONS[2], SOCIAL_ACTIONS[0]] },
};

export function getVenueDefinition(building: BuildingDefinition): VenueDefinition | null {
  if (!building.interaction) return null;
  const venue = BY_INTERACTION[building.interaction];
  return { ...venue, eyebrow: building.label || venue.eyebrow, title: building.name || venue.title };
}
