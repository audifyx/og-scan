/**
 * GET /api/mcps — machine-readable OrbitX MCP marketplace registry.
 * Agents: fetch this, pick an MCP, connect to its `endpoint` with the
 * MCP Streamable-HTTP handshake (initialize → tools/list → tools/call).
 * No auth on any endpoint.
 */
const REGISTRY = [
  { slug: "orbitx", name: "OrbitX", endpoint: "https://orbitx.world/api/mcp", category: "official", tagline: "The official OrbitX MCP", auth: "none" },
  { slug: "apogee", name: "Apogee", endpoint: "https://apogeemcp.digital/api/mcp", category: "official", tagline: "Robinhood Chain intel for agents", auth: "none" },
  { slug: "jupiter", name: "Jupiter", endpoint: "https://jupiter-mcp.vercel.app/api/mcp", category: "chains", tagline: "Solana intelligence for agents", auth: "none" },
  { slug: "mercury", name: "Mercury", endpoint: "https://mercury-mcp.vercel.app/api/mcp", category: "chains", tagline: "Base intelligence for agents", auth: "none" },
  { slug: "saturn", name: "Saturn", endpoint: "https://saturn-mcp.vercel.app/api/mcp", category: "chains", tagline: "Arc chain intelligence for agents", auth: "none" },
  { slug: "terra", name: "Terra", endpoint: "https://terra-mcp.vercel.app/api/mcp", category: "chains", tagline: "Ethereum intelligence for agents", auth: "none" },
  { slug: "luna", name: "Luna", endpoint: "https://luna-mcp.vercel.app/api/mcp", category: "chains", tagline: "Bitcoin intelligence for agents", auth: "none" },
  { slug: "venus", name: "Venus", endpoint: "https://venus-mcp.vercel.app/api/mcp", category: "chains", tagline: "Robinhood stock tokens for agents", auth: "none" },
  { slug: "comet", name: "Comet", endpoint: "https://comet-mcp.vercel.app/api/mcp", category: "chains", tagline: "BSC intelligence for agents", auth: "none" },
  { slug: "io", name: "Io", endpoint: "https://io-mcp.vercel.app/api/mcp", category: "chains", tagline: "Polygon intelligence for agents", auth: "none" },
  { slug: "nebula", name: "Nebula", endpoint: "https://nebula-mcp.vercel.app/api/mcp", category: "chains", tagline: "Arbitrum intelligence for agents", auth: "none" },
  { slug: "quasar", name: "Quasar", endpoint: "https://quasar-mcp.vercel.app/api/mcp", category: "chains", tagline: "Sui intelligence for agents", auth: "none" },
  { slug: "orion", name: "Orion", endpoint: "https://orion-mcp.vercel.app/api/mcp", category: "market", tagline: "Stock market data for agents", auth: "none" },
  { slug: "europa", name: "Europa", endpoint: "https://europa-mcp.vercel.app/api/mcp", category: "market", tagline: "FX rates for agents", auth: "none" },
  { slug: "neptune", name: "Neptune", endpoint: "https://neptune-mcp.vercel.app/api/mcp", category: "market", tagline: "DeFi yields for agents", auth: "none" },
  { slug: "pulse", name: "Pulse", endpoint: "https://pulse-mcp.vercel.app/api/mcp", category: "market", tagline: "Market sentiment for agents", auth: "none" },
  { slug: "harbor", name: "Harbor", endpoint: "https://harbor-mcp.vercel.app/api/mcp", category: "market", tagline: "Stablecoin intel for agents", auth: "none" },
  { slug: "titan", name: "Titan", endpoint: "https://titan-mcp.vercel.app/api/mcp", category: "market", tagline: "Gas prices for agents", auth: "none" },
  { slug: "mars", name: "Mars", endpoint: "https://mars-mcp.vercel.app/api/mcp", category: "verticals", tagline: "Sports data for agents", auth: "none" },
  { slug: "aurora", name: "Aurora", endpoint: "https://aurora-mcp.vercel.app/api/mcp", category: "verticals", tagline: "Weather for agents", auth: "none" },
  { slug: "herald", name: "Herald", endpoint: "https://herald-mcp.vercel.app/api/mcp", category: "verticals", tagline: "Crypto news for agents", auth: "none" },
  { slug: "drop", name: "Drop", endpoint: "https://drop-mcp.vercel.app/api/mcp", category: "verticals", tagline: "Trending discovery for agents", auth: "none" },
];

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  res.status(200).json({
    marketplace: "OrbitX MCP Marketplace",
    human: "https://orbitx.world/orbitxmcp",
    protocol: "mcp-streamable-http",
    auth: "none — all endpoints are public",
    count: REGISTRY.length,
    mcps: REGISTRY,
  });
}
