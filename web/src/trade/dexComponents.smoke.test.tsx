import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DexFilters from "./DexFilters";
import DexTrending from "./DexTrending";
import DexBoosts from "./DexBoosts";
import DexListings from "./DexListings";
import { DEFAULT_DEX_FILTERS } from "./dexFeed";

const coins = [
  {
    mint: "Mint111111111111111111111111111111111111",
    symbol: "TEST",
    name: "Test",
    image: "https://example.com/img.png",
    price: 0.5,
    mcap: 1000000,
    change24h: 12.5,
    volume24h: 500000,
    liquidity: 200000,
    chain: "solana",
    dexId: "raydium",
    txns24h: 1000,
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
];

describe("dex components smoke", () => {
  it("renders filters, trending, listings and boosts without crashing", () => {
    render(<DexFilters value={DEFAULT_DEX_FILTERS} onChange={vi.fn()} />);
    expect(screen.getByText("Filters")).toBeTruthy();
    render(<DexTrending coins={coins} />);
    expect(screen.getByText("TEST")).toBeTruthy();
    render(<DexListings coins={coins} />);
    expect(screen.getByText("NEW")).toBeTruthy();
    render(
      <DexBoosts
        boosts={[{ id: "1", mint: coins[0].mint, tier: "turbo", starts_at: new Date().toISOString(), ends_at: null, status: "active" }]}
      />,
    );
    expect(screen.getByText("Turbo")).toBeTruthy();
  });

  it("boosts empty state renders when none are active", () => {
    render(<DexBoosts boosts={[]} />);
    expect(screen.getByText(/No boosted tokens/i)).toBeTruthy();
  });
});
