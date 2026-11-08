// Verification tests for Team C HolderOverlapGraph (batch 4).
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HolderOverlapGraph, type OverlapWallet } from "./HolderOverlapGraph";

const wallets: OverlapWallet[] = [
  {
    address: "Aaaa11111111111111111111111111111111111111",
    supplyPct: 8,
    fundingSource: "Funder1111111111111111111111111111111111",
    holdings: [
      { mint: "TokA111111111111111111111111111111111111111", symbol: "TOKA", valueUsd: 5000 },
      { mint: "TokB222222222222222222222222222222222222222", symbol: "TOKB", valueUsd: 250 },
    ],
  },
  {
    address: "Bbbb22222222222222222222222222222222222222",
    supplyPct: 3,
    fundingSource: "Funder1111111111111111111111111111111111",
    holdings: [{ mint: "TokA111111111111111111111111111111111111111", symbol: "TOKA", valueUsd: 1200 }],
  },
  {
    address: "Cccc33333333333333333333333333333333333333",
    supplyPct: null,
    fundingSource: null,
    holdings: null, // unreadable — must render "holdings unknown", no invented tokens
  },
  {
    address: "Dddd44444444444444444444444444444444444444",
    supplyPct: 1,
    fundingSource: null,
    holdings: [], // read, holds nothing else
  },
];

describe("HolderOverlapGraph", () => {
  it("renders wallet + token nodes, edges only for observed holdings", () => {
    const { container } = render(<HolderOverlapGraph wallets={wallets} />);
    expect(screen.getByTestId("holder-overlap-graph")).toBeInTheDocument();
    expect(screen.getByTestId("overlap-wallet-Aaaa11111111111111111111111111111111111111")).toBeInTheDocument();
    expect(screen.getByTestId("overlap-token-TokA111111111111111111111111111111111111111")).toBeInTheDocument();
    expect(screen.getByText("TOKA")).toBeInTheDocument();
    // 3 observed holdings = 3 edges; the unreadable wallet contributes none.
    expect(container.querySelectorAll("line")).toHaveLength(3);
    // "holdings unknown" appears both on the unreadable wallet node and in
    // the legend (and in SVG <title> tooltips) — getAllByText, not getByText.
    expect(screen.getAllByText("holdings unknown").length).toBeGreaterThanOrEqual(1);
  });

  it("selecting a wallet shows its holdings; selecting an unreadable one says unknown", () => {
    render(<HolderOverlapGraph wallets={wallets} />);
    fireEvent.click(screen.getByTestId("overlap-wallet-Aaaa11111111111111111111111111111111111111"));
    // $5.0k appears in the detail panel and in the edge <title> tooltip.
    expect(screen.getAllByText(/\$5.0k/).length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByTestId("overlap-wallet-Cccc33333333333333333333333333333333333333"));
    // Also appears in the wallet node's <title> tooltip.
    expect(screen.getAllByText(/Holdings unknown/).length).toBeGreaterThanOrEqual(1);
  });

  it("selecting a token shows which wallets hold it", () => {
    render(<HolderOverlapGraph wallets={wallets} />);
    fireEvent.click(screen.getByTestId("overlap-token-TokA111111111111111111111111111111111111111"));
    // Text also appears in the token node's <title> tooltip.
    expect(screen.getAllByText(/Held by 2 of the shown wallets/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders loading and unavailable states", () => {
    const { rerender } = render(<HolderOverlapGraph wallets={[]} loading />);
    expect(screen.getByText(/Loading holder portfolios/)).toBeInTheDocument();
    rerender(<HolderOverlapGraph wallets={[]} />);
    expect(screen.getByText(/Holder overlap unavailable/)).toBeInTheDocument();
    rerender(<HolderOverlapGraph wallets={null} unavailableReason="RPC timeout" />);
    expect(screen.getByText(/RPC timeout/)).toBeInTheDocument();
  });

  it("a wallet read with no other holdings says so, without inventing tokens", () => {
    const { container } = render(<HolderOverlapGraph wallets={[wallets[3]]} />);
    expect(container.querySelectorAll("line")).toHaveLength(0);
    fireEvent.click(screen.getByTestId("overlap-wallet-Dddd44444444444444444444444444444444444444"));
    expect(screen.getByText(/Holds nothing else observed/)).toBeInTheDocument();
  });
});
