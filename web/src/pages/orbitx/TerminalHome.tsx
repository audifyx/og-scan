/**
 * Terminal Home - Trending tokens, new pairs, migration status
 */

import { TrendingUp, TrendingDown, Clock, AlertCircle } from "lucide-react";

interface Token {
  name: string;
  ticker: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  status: "trending" | "new" | "migrated" | "migrating" | "clone";
  holders: number;
}

const mockTokens: Token[] = [
  { name: "ORBITX", ticker: "OBX", price: 0.0234, change24h: 45.2, volume24h: 125000, marketCap: 2340000, status: "trending", holders: 1250 },
  { name: "Degen Tower", ticker: "DEGEN", price: 0.012, change24h: -12.5, volume24h: 85000, marketCap: 1250000, status: "trending", holders: 3400 },
  { name: "Fresh Launch", ticker: "FRESH", price: 0.00001, change24h: 0, volume24h: 5000, marketCap: 100000, status: "new", holders: 120 },
];

function TokenRow({ token }: { token: Token }) {
  const isPositive = token.change24h >= 0;
  const statusColors = {
    trending: "text-green-400",
    new: "text-blue-400",
    migrated: "text-amber-400",
    migrating: "text-purple-400",
    clone: "text-red-400",
  };

  return (
    <div className="border-b border-green-500/10 hover:bg-green-500/5 transition p-4">
      <div className="grid grid-cols-12 gap-4 items-center text-xs">
        {/* Name & Status */}
        <div className="col-span-3">
          <div className="font-bold text-green-400">{token.name}</div>
          <div className="text-gray-500 text-[10px]">{token.ticker}</div>
          <span className={`text-[10px] ${statusColors[token.status]}`}>
            [{token.status.toUpperCase()}]
          </span>
        </div>

        {/* Price */}
        <div className="col-span-2">
          <div className="text-white">${token.price.toFixed(8)}</div>
          <div className={`text-xs ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{token.change24h.toFixed(2)}%
          </div>
        </div>

        {/* Volume */}
        <div className="col-span-2">
          <div className="text-gray-400">${(token.volume24h / 1000).toFixed(1)}K</div>
          <div className="text-[10px] text-gray-600">24h vol</div>
        </div>

        {/* MarketCap */}
        <div className="col-span-2">
          <div className="text-gray-400">${(token.marketCap / 1000000).toFixed(2)}M</div>
          <div className="text-[10px] text-gray-600">cap</div>
        </div>

        {/* Holders */}
        <div className="col-span-2">
          <div className="text-gray-400">{token.holders}</div>
          <div className="text-[10px] text-gray-600">holders</div>
        </div>

        {/* Action */}
        <div className="col-span-1">
          <button className="text-green-400 hover:text-green-300 transition text-xs font-bold">
            &gt;
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TerminalHome() {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-green-500/10 to-amber-500/10 border border-green-500/20 rounded p-8">
        <div className="max-w-2xl">
          <h2 className="text-4xl font-bold text-green-400 mb-2">LAUNCH YOUR COIN</h2>
          <p className="text-gray-400 mb-6">No coding. No vectors. Just degen energy.</p>
          <button className="bg-green-500 hover:bg-green-600 text-black font-bold px-6 py-3 rounded transition">
            LAUNCH NOW →
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Live Tokens", value: "12,453", color: "green" },
          { label: "24h Volume", value: "$2.5M", color: "blue" },
          { label: "Total Holders", value: "185.2K", color: "purple" },
          { label: "Avg MCap", value: "$845K", color: "amber" },
        ].map((stat, i) => (
          <div key={i} className="bg-black/50 border border-green-500/20 rounded p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</div>
            <div className={`text-2xl font-bold mt-2 text-${stat.color}-400`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Sections */}
      {[
        { title: "🔥 TRENDING (24H)", tokens: mockTokens.filter(t => t.status === "trending") },
        { title: "⭐ NEW PAIRS (LAST 1H)", tokens: mockTokens.filter(t => t.status === "new") },
        { title: "📈 JUST MIGRATED", tokens: mockTokens.filter(t => t.status === "migrated") },
        { title: "⏱️ CLOSE TO MIGRATION", tokens: mockTokens.filter(t => t.status === "migrating") },
      ].map((section, i) => (
        <div key={i}>
          <h3 className="text-sm font-bold text-green-400 mb-4 uppercase tracking-wider">
            {section.title}
          </h3>
          <div className="bg-black/50 border border-green-500/20 rounded overflow-hidden">
            <div className="grid grid-cols-12 gap-4 p-4 text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-green-500/10">
              <div className="col-span-3">Token</div>
              <div className="col-span-2">Price</div>
              <div className="col-span-2">Volume</div>
              <div className="col-span-2">MarketCap</div>
              <div className="col-span-2">Holders</div>
              <div className="col-span-1"></div>
            </div>
            {section.tokens.map((token, i) => (
              <TokenRow key={i} token={token} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
