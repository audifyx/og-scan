import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  addNote,
  buildScanFeedPost,
  castVote,
  deleteNote,
  loadNotes,
  loadTally,
  relativeTime,
  scanAlertDeepLink,
  scanSignalAlertSupport,
  scanUrl,
} from "../hooks/useScanSocial";
import { CommunityNotes, ScanCard, ScanFeedAlerts, SignalVoting } from "./SocialPanels";

/** Real Solana-shaped mint (44 base58 chars) for storage-key tests. */
const MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
const DEV = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";

beforeEach(() => {
  window.localStorage.clear();
});

describe("useScanSocial helpers (local-first, no fake data)", () => {
  it("scanUrl points at the scanner route for the mint", () => {
    expect(scanUrl(MINT)).toBe(`http://localhost:3000/intel/scan/${MINT}`);
  });

  it("notes start empty, add + newest-first + delete round-trips", () => {
    expect(loadNotes(MINT)).toEqual([]);
    const a = addNote(MINT, "first note", "alice");
    const b = addNote(MINT, "second note");
    expect(a && b).toBeTruthy();
    const notes = loadNotes(MINT);
    expect(notes).toHaveLength(2);
    expect(notes[0].text).toBe("second note");
    expect(notes[1].handle).toBe("alice");
    expect(deleteNote(MINT, notes[0].id)).toHaveLength(1);
  });

  it("rejects empty notes and non-mint keys", () => {
    expect(addNote(MINT, "   ")).toBeNull();
    expect(addNote("not-a-mint", "hi")).toBeNull();
    expect(loadNotes("not-a-mint")).toEqual([]);
  });

  it("one vote per device, tap again removes it, tally is device-local", () => {
    expect(loadTally(MINT).total).toBe(0);
    const t1 = castVote(MINT, "bullish");
    expect(t1).toMatchObject({ bullish: 1, total: 1, myVote: "bullish" });
    expect(castVote(MINT, "bearish")).toMatchObject({ bearish: 1, bullish: 0, total: 1, myVote: "bearish" });
    expect(castVote(MINT, "bearish")).toMatchObject({ total: 0, myVote: null });
  });

  it("relativeTime buckets", () => {
    const now = Date.now();
    expect(relativeTime(now - 30_000, now)).toBe("just now");
    expect(relativeTime(now - 5 * 60_000, now)).toBe("5m ago");
    expect(relativeTime(now - 3 * 60 * 60_000, now)).toBe("3h ago");
  });

  it("same-dev / bundle / whale signals are NOT supported by the alerts backend", () => {
    for (const kind of ["same-dev", "high-bundle", "whale", "migration"] as const) {
      const s = scanSignalAlertSupport({ kind, label: "x" });
      expect(s.supported).toBe(false);
      expect(s.backendType).toBeNull();
    }
    expect(scanSignalAlertSupport({ kind: "dev-sell", label: "x" })).toMatchObject({
      supported: true,
      backendType: "wallet_trade",
    });
  });

  it("alert deep links reuse the ogdex Alerts page (no new endpoint)", () => {
    expect(scanAlertDeepLink(MINT)).toContain("/ORBITX_DEX/alerts?mint=");
    expect(scanAlertDeepLink(MINT, { devWallet: DEV })).toContain("type=wallet_trade");
    expect(scanAlertDeepLink(MINT, { devWallet: DEV })).not.toContain("mint=");
  });

  it("feed-post format carries the scan link and never invents counts", () => {
    const post = buildScanFeedPost({
      mint: MINT,
      symbol: "OBX",
      ogScore: 62,
      signals: [{ kind: "high-bundle", label: "High bundle risk", detail: "34.2% bundled" }],
    });
    expect(post.content).toContain("OG score 62/100");
    expect(post.content).toContain(`/intel/scan/${MINT}`);
    expect(post.content).not.toMatch(/\d+ votes|\d+ followers/);
  });
});

describe("SocialPanels components", () => {
  it("ScanCard renders from props only with copy + share actions", () => {
    render(
      <ScanCard
        mint={MINT}
        symbol="OBX"
        name="OrbitX"
        ogScore={62}
        ogBand="Fair"
        riskScore={41}
        riskLabel="C"
        bundledSupplyPct={34.2}
        bundleRisk="high"
        verdict="High bundle risk — 34.2% bundled"
        verdictState="fail"
      />,
    );
    expect(screen.getByTestId("scan-card")).toBeInTheDocument();
    expect(screen.getByText("$OBX")).toBeInTheDocument();
    expect(screen.getByText("62/100")).toBeInTheDocument();
    expect(screen.getByText("34.2% bundled")).toBeInTheDocument();
    expect(screen.getByText(/High bundle risk/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy scan link/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
    // No emoji anywhere in the card.
    expect(screen.getByTestId("scan-card").textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it("CommunityNotes empty state says be the first; posting works", () => {
    render(<CommunityNotes mint={MINT} />);
    expect(screen.getByText("No notes yet — be the first.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/add a note/i), { target: { value: "dev sold twice" } });
    fireEvent.click(screen.getByRole("button", { name: /post/i }));
    expect(screen.getByText("dev sold twice")).toBeInTheDocument();
    expect(screen.queryByText("No notes yet — be the first.")).toBeNull();
    expect(loadNotes(MINT)).toHaveLength(1);
  });

  it("SignalVoting labels tallies as device-only and toggles one vote", () => {
    render(<SignalVoting mint={MINT} />);
    expect(screen.getByText(/votes on this device only/i)).toBeInTheDocument();
    expect(screen.getByText("No votes on this device yet.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /bullish/i }));
    expect(screen.getByRole("button", { name: /bullish/i })).toHaveTextContent("1");
    fireEvent.click(screen.getByRole("button", { name: /bullish/i }));
    expect(screen.getByRole("button", { name: /bullish/i })).toHaveTextContent("0");
  });

  it("ScanFeedAlerts flags unsupported types honestly and links to Alerts", () => {
    render(
      <ScanFeedAlerts
        mint={MINT}
        symbol="OBX"
        ogScore={62}
        devWallet={DEV}
        signals={[
          { kind: "same-dev", label: "Same-dev flag", detail: "Dev launched 3 tokens" },
          { kind: "dev-sell", label: "Dev sold", detail: "Dev wallet sold 12%" },
        ]}
      />,
    );
    expect(screen.getByText("Same-dev flag")).toBeInTheDocument();
    expect(screen.getByText("Not supported yet")).toBeInTheDocument();
    expect(screen.getByText("Alert available")).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links.every((l) => (l as HTMLAnchorElement).href.includes("/ORBITX_DEX/alerts"))).toBe(true);
  });
});
