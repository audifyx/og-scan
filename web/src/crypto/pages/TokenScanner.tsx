import { FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { dexChartUrl } from "@/trade/tradeFmt";
import { useTokenIntel } from "../hooks/useTokenIntel";
import { useScanVault } from "../hooks/useScanVault";
import { RiskFactors, RiskGauge } from "../components/RiskGauge";
import {
  AlertBuilderPanel,
  BundleDecayPanel,
  BundlePanel,
  CexDepositPanel,
  ChartPatternPanel,
  ClonesPanel,
  ContractDiffPanel,
  ContractPanel,
  CopycatPanel,
  CostBasisPanel,
  CrossScanComparePanel,
  DevFingerprintPanel,
  DevHistoryPanel,
  DevSellSimulatorPanel,
  DevWalletAgePanel,
  DevWalletPanel,
  DevWalletWatchPanel,
  EntryExitPlannerPanel,
  ExitLiquidityPanel,
  FreshWalletRadarPanel,
  FundingChainPanel,
  GraduationTrackerPanel,
  HolderConvictionPanel,
  HolderGraphPanel,
  HolderOverlapPanel,
  HolderTable,
  InsidersPanel,
  LinksPanel,
  LiquidityHealthPanel,
  LiquidityMigrationPanel,
  LiquidityPanel,
  LiveRiskPanel,
  LpDrainAlertPanel,
  MarketPanel,
  MetadataAuditPanel,
  OgScorePanel,
  PoolVerificationPanel,
  PositionSizePanel,
  RugAutopsyPanel,
  RugCheckPanel,
  RugRadarLeaderboardPanel,
  RugTimelinePanel,
  SameDevPanel,
  SandboxReplayPanel,
  SlippageEstimatorPanel,
  SniperRadarPanel,
  SocialScanPanel,
  TokenDnaPanel,
  TokenOverview,
  Token2022Panel,
  TradeTapePanel,
  UnlockSchedulePanel,
  WashTradingPanel,
  WhaleAlertsPanel,
  WhaleLabelsPanel,
  XPanel,
  parseCompareMints,
  termH3,
  termPanel,
  type CompareSummary,
} from "../components/TokenPanels";
import { isValidMint } from "../api/client";
import {
  summarizeTradeEvidence,
  useAlertBuilder,
  type FiredAlert,
  type ScanSnapshotForEval,
} from "../hooks/useAlertBuilder";
import { ScanFeedAlerts } from "../components/SocialPanels";
import { SmartWalletWatch } from "../components/SmartWalletWatch";

/**
 * Scanner v2 — dedicated route /intel/scanner-v2 (+ /scanner-v2) and
 * /intel/scan keeps serving the same page, so old links keep working.
 *
 * Sections: quick-scan input · LIVE risk score · bundle detection + holder
 * graph · dev wallet lineage / funding chain · same-dev + dev history ·
 * X signals · live trade tape + whale alerts · sandbox launch replay ·
 * shareable scan card + community notes + signal voting — on top of the
 * full v1 intel pass (chart, OG score, contract, liquidity, market,
 * holders, deployer, clones, links, risk factors).
 *
 * Team A fields (fundingChain / devHistory / sameDev / tradeTape /
 * whaleAlerts / riskLive) are read defensively off the intel object: they
 * light up when Team A lands and render honest "Unavailable" states until
 * then. Team C / E / F components are resolved inside TokenPanels by
 * filename and fall back the same way. Every check sourced, unknowns
 * shown as unknown — never a fake zero.
 */

/** Team A extension fields on the intel hook — optional until they land. */
type TeamAIntel = {
  fundingChain?: unknown;
  devHistory?: unknown;
  sameDev?: unknown;
  tradeTape?: unknown;
  whaleAlerts?: unknown;
  riskLive?: unknown;
};

/** Chart-first: DexScreener chart at the top of the scan, same embed as the trade token page. */
function ScannerChart({ mint }: { mint: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
  }, [mint]);
  return (
    <div className="oxc-panel relative overflow-hidden" style={{ ...termPanel, height: 360, padding: 0 }}>
      {!ready && <p className="oxc-empty oxc-pulse" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>Loading chart…</p>}
      <iframe
        title="DexScreener chart"
        src={dexChartUrl(mint)}
        style={{ width: "100%", height: "100%", border: 0 }}
        allow="clipboard-write"
        onLoad={() => setReady(true)}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="oxc-panel" style={termPanel}>
      <h3 style={termH3}>{title}</h3>
      {children}
    </div>
  );
}

/** B5 cross-scan compare: extra mints come from `?compare=<mint>[,<mint>,<mint>]`
 *  on the /scanner-v2 route — up to 3 extra mints, 4 tokens total. Each token
 *  gets a full intel pass; unknowns stay Unknown. */
function CompareView({ mintA, compareMints }: { mintA: string; compareMints: string[] }) {
  const navigate = useNavigate();
  const intelA = useTokenIntel(mintA);
  const intelB = useTokenIntel(compareMints[0] ?? null);
  const intelC = useTokenIntel(compareMints[1] ?? null);
  const intelD = useTokenIntel(compareMints[2] ?? null);
  const summarize = (intel: ReturnType<typeof useTokenIntel>): CompareSummary => ({
    mint: intel.mint ?? "",
    name: (intel.token?.name as string) ?? null,
    symbol: (intel.token?.symbol as string) ?? null,
    priceUsd: Number(intel.token?.priceUsd ?? intel.token?.price ?? NaN) || null,
    mcap: Number(intel.token?.marketCap ?? intel.token?.mcap ?? NaN) || null,
    liquidityUsd: Number(intel.token?.liquidityUsd ?? intel.token?.liquidity ?? NaN) || null,
    ogScore: intel.ogScore?.score ?? null,
    riskScore: intel.risk?.score ?? null,
    top10Pct: intel.forensics?.concentration?.top10Pct ?? null,
    lpLockedPct: intel.forensics?.safetyFlags?.lpLockedPct ?? null,
    bundledPct: intel.bundle?.bundledSupplyPct ?? null,
    holders: intel.token?.holderCount ?? intel.forensics?.concentration?.totalHolders ?? null,
    loading: intel.loading,
    error: intel.error,
  });
  const intels = [intelA, intelB, intelC, intelD];
  const summaries = intels.slice(0, 1 + compareMints.length).map(summarize);
  const title = summaries.map((s) => s.symbol ?? "token").join(" vs ");
  const goCompare = (mints: string[]) =>
    navigate(mints.length ? `/intel/scanner-v2/${mintA}?compare=${mints.join(",")}` : `/intel/scanner-v2/${mintA}`);
  return (
    <Section title={`Cross-scan compare — ${title}`}>
      <CrossScanComparePanel
        summaries={summaries}
        onAddMint={(m) => goCompare([...compareMints, m])}
        onRemoveMint={(m) => {
          if (m === mintA) {
            const [next, ...rest] = compareMints;
            if (!next) return;
            navigate(`/intel/scanner-v2/${next}${rest.length ? `?compare=${rest.join(",")}` : ""}`);
          } else {
            goCompare(compareMints.filter((x) => x !== m));
          }
        }}
      />
    </Section>
  );
}

export default function TokenScanner() {
  const { mint: routeMint } = useParams<{ mint?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isV2 = location.pathname.includes("scanner-v2");
  const [draft, setDraft] = useState(routeMint || "");
  const intel = useTokenIntel(routeMint || null);
  const teamA = intel as unknown as TeamAIntel;
  const [searchParams] = useSearchParams();
  const compareMints = parseCompareMints(searchParams.get("compare"));
  const rugCheck = intel.rugCheck;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const m = draft.trim();
    if (!isValidMint(m)) return;
    navigate(isV2 ? `/intel/scanner-v2/${m}` : `/intel/scan/${m}`);
  }

  const mcap = Number(intel.token?.marketCap ?? intel.token?.mcap ?? NaN);

  /* W4 — live alert firing: evaluate the user's local alert rules against
   * this scan once the intel pass settles. Firing is local-only (see
   * useAlertBuilder): rules fire from real scan evidence, never from a
   * backend runner, and each rule waits out its cooldown before it can
   * fire again for the same mint. The signature guard means a re-render
   * with unchanged scan data never re-fires the same rules. */
  const { checkScan } = useAlertBuilder();
  const [firedAlerts, setFiredAlerts] = useState<FiredAlert[]>([]);
  const lastAlertSigRef = useRef<string | null>(null);

  const alertSnapshot = useMemo<ScanSnapshotForEval | null>(() => {
    if (!intel.mint) return null;
    const pair = (intel.dexPairs ?? [])[0] ?? null;
    const holders = (intel.token?.holders ?? []).filter((h) => h.owner);
    const top10Wallets = [...holders]
      .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || (b.pct ?? 0) - (a.pct ?? 0))
      .slice(0, 10)
      .map((h) => h.owner as string);
    const evidence = summarizeTradeEvidence({
      whaleAlerts: intel.whaleAlerts ?? null,
      tradeTape: intel.tradeTape ?? null,
      top10Wallets,
    });
    const movements = intel.lpMigration?.movements ?? [];
    const lastMove = movements.length > 0 ? movements[movements.length - 1] : null;
    const devWatch = (intel.devWalletWatch ?? [])[0] ?? null;
    const num = (v: unknown): number | null => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    return {
      mint: intel.mint,
      bundledSupplyPct: intel.bundle?.bundledSupplyPct ?? null,
      riskScore: intel.risk?.score ?? null,
      whaleBuyUsd: evidence.whaleBuyUsd,
      devWallet: intel.forensics?.dev?.wallet ?? intel.devWallet?.wallet ?? null,
      lpMigrated: intel.lpMigration ? movements.length > 0 : null,
      lpMovedUsd: lastMove?.amountUsd ?? null,
      lpUsd: num(intel.token?.liquidityUsd ?? intel.token?.liquidity),
      lpDropPct: intel.lpDrain?.dropPct ?? null,
      devWalletActivity:
        devWatch &&
        (devWatch.lastAction === "buy" || devWatch.lastAction === "sell" || devWatch.lastAction === "transfer")
          ? { wallet: devWatch.wallet, action: devWatch.lastAction, amountUsd: devWatch.lastAmountUsd }
          : null,
      // No prior observation exists, so no flip can be observed this scan.
      honeypotFlipped: (intel.honeypotFlip?.flips?.length ?? 0) > 0,
      honeypotSellable:
        intel.honeypotFlip?.currentlyHoneypot == null ? null : !intel.honeypotFlip.currentlyHoneypot,
      // No authority-history feed exists, so no change can be observed.
      authorityChange: null,
      priceUsd: num(intel.token?.priceUsd ?? intel.token?.price ?? pair?.priceUsd),
      mcapUsd: num(intel.token?.marketCap ?? intel.token?.mcap ?? pair?.marketCap),
      volumeH1: pair?.volumeH1 ?? null,
      volumeH24: pair?.volumeH24 ?? num(intel.token?.volume24h),
      top10HolderSellUsd: evidence.top10HolderSellUsd,
      top10HolderSellWallet: evidence.top10HolderSellWallet,
    };
  }, [
    intel.mint,
    intel.bundle,
    intel.risk,
    intel.dexPairs,
    intel.token,
    intel.devWallet,
    intel.forensics,
    intel.tradeTape,
    intel.whaleAlerts,
    intel.lpMigration,
    intel.lpDrain,
    intel.devWalletWatch,
    intel.honeypotFlip,
  ]);

  useEffect(() => {
    if (!alertSnapshot || intel.loading) return;
    const sig = JSON.stringify(alertSnapshot);
    if (lastAlertSigRef.current === sig) return;
    lastAlertSigRef.current = sig;
    setFiredAlerts(checkScan(alertSnapshot));
  }, [alertSnapshot, intel.loading, checkScan]);

  // W2 — record every completed scan in the vault (localStorage, this
  // device) with a forensics snapshot, so the vault, leaderboard and
  // snapshot-powered history panels have something real to diff against.
  // Guarded by a key of the recorded values so re-renders / refreshes
  // with identical intel don't double-record the same observation.
  const vault = useScanVault();
  const recordedKey = useRef<string | null>(null);
  useEffect(() => {
    if (!intel.mint || intel.loading || intel.error) return;
    const flags = intel.forensics?.safetyFlags;
    const liqNum = Number(intel.token?.liquidityUsd ?? intel.token?.liquidity ?? NaN);
    const liq = Number.isFinite(liqNum) ? liqNum : null;
    const honeypot =
      intel.safety?.canBuy === true && intel.safety?.canSell === false
        ? true
        : intel.safety?.canSell === true
          ? false
          : null;
    const key = [
      intel.mint,
      intel.ogScore?.score ?? null,
      intel.risk?.score ?? null,
      intel.bundle?.bundledSupplyPct ?? null,
      liq,
      flags?.mintRenounced ?? null,
      flags?.freezeRenounced ?? null,
      flags?.lpLockedPct ?? null,
      honeypot,
    ].join("|");
    if (recordedKey.current === key) return;
    recordedKey.current = key;
    vault.record({
      mint: intel.mint,
      name: intel.token?.name ?? null,
      symbol: intel.token?.symbol ?? null,
      ogScore: intel.ogScore?.score ?? null,
      riskScore: intel.risk?.score ?? null,
      bundleRisk:
        intel.bundle?.risk === "high"
          ? "high"
          : intel.bundle?.risk === "medium"
            ? "moderate"
            : intel.bundle?.risk === "low"
              ? "low"
              : null,
      bundledSupplyPct: intel.bundle?.bundledSupplyPct ?? null,
      verdict: intel.ogScore?.label ?? null,
      // Outcome ONLY when this scan actually knows it: rugged flag, or
      // liquidity observed at exactly zero. Never inferred from a score.
      outcome: flags?.rugged === true ? "rugged" : liq === 0 ? "dead" : null,
      scannedAt: Date.now(),
      mintRenounced: flags?.mintRenounced ?? null,
      freezeRenounced: flags?.freezeRenounced ?? null,
      lpLockedPct: flags?.lpLockedPct ?? null,
      honeypot,
      liquidityUsd: liq,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intel.mint, intel.loading, intel.error, intel.ogScore, intel.risk, intel.bundle, intel.token, intel.forensics, intel.safety]);

  // Real flags for the Share-to-X tweet — only what this scan observed.
  const shareFlags: string[] = [];
  {
    const bundled = intel.bundle?.bundledSupplyPct ?? null;
    const lpLocked = intel.forensics?.safetyFlags?.lpLockedPct ?? null;
    if (bundled != null && bundled >= 20) shareFlags.push(`Bundled ${bundled.toFixed(1)}%`);
    if (lpLocked != null && lpLocked < 50) shareFlags.push(`Only ${lpLocked.toFixed(0)}% LP locked`);
    if (intel.forensics?.safetyFlags?.mintRenounced === false) shareFlags.push("Mint authority live");
    if (intel.forensics?.safetyFlags?.freezeRenounced === false) shareFlags.push("Freeze authority live");
    if (intel.safety?.canBuy === true && intel.safety?.canSell === false) shareFlags.push("Honeypot — sells blocked");
  }

  return (
    <div>
      <header className="oxc-hero">
        <h1 style={{ fontFamily: "var(--term-hand)", color: "var(--term-gold)", fontSize: "2.6rem" }}>
          Token scanner{isV2 ? " v2" : ""}
        </h1>
        <p>OG score, contract, liquidity, holders, deployer, market, bundle detection, X intel, rug &amp; clone signals — every check sourced, unknowns shown as unknown.{" "}
          <a href="/intel/vault" style={{ color: "var(--term-gold)" }}>Scan history vault</a>
        </p>
        {isV2 && (
          <p style={{ fontSize: "0.85rem" }}>
            v2 adds live risk, bundle map, dev funding lineage, same-dev detection, trade tape, whale alerts, launch
            replay and shareable scan cards — plus sniper radar, liquidity health, dev fingerprint, rug timeline,
            token DNA, graduation tracking, sell simulators, slippage and exit-liquidity tools, and cross-scan
            compare (<span className="oxc-mono">?compare=&lt;mint&gt;[,&lt;mint&gt;,&lt;mint&gt;]</span> — up to 4 tokens).{" "}
            <a href="/intel/scan" style={{ color: "var(--term-gold)" }}>Classic scanner</a>
          </p>
        )}
      </header>

      <form className="oxc-panel" onSubmit={onSubmit} style={{ ...termPanel, marginBottom: "1rem", position: "sticky", top: 0, zIndex: 30 }}>
        <div className="oxc-input-row">
          <input
            className="oxc-input"
            placeholder="Paste Solana mint address…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
          />
          <button className="oxc-btn" type="submit" disabled={!isValidMint(draft.trim())}>
            Scan
          </button>
          {intel.mint && (
            <button className="oxc-btn oxc-btn-ghost" type="button" onClick={intel.refresh} disabled={intel.loading}>
              Refresh
            </button>
          )}
        </div>
      </form>

      {!intel.mint && <p className="oxc-empty">Enter a mint to run the full intelligence pass.</p>}
      {intel.loading && <p className="oxc-empty oxc-pulse">Composing safety · forensics · market…</p>}
      {intel.error && <p className="oxc-empty" style={{ color: "var(--oxc-red)" }}>{intel.error}</p>}

      {intel.mint && !intel.loading && (
        <div className="oxc-grid" style={{ gap: "1rem" }}>
          {/* LIVE risk score + OG score */}
          <div className="oxc-grid oxc-grid-2">
            <Section title="Live risk score">
              <LiveRiskPanel risk={intel.risk} riskLive={teamA.riskLive} loading={intel.loading} />
            </Section>
            <Section title="OG score">
              <OgScorePanel ogScore={intel.ogScore} />
            </Section>
          </div>

          <ScannerChart mint={intel.mint} />
          <TokenOverview mint={intel.mint} token={intel.token} safety={intel.safety} forensics={intel.forensics} />

          <div className="oxc-grid oxc-grid-2">
            <Section title="Risk score & safety rating">
              {intel.risk ? <RiskGauge risk={intel.risk} /> : <p className="oxc-empty">No score</p>}
            </Section>
            <Section title="Bundle detection">
              <BundlePanel bundle={intel.bundle} loading={intel.bundleLoading} />
            </Section>
          </div>

          {/* Holder graph (Team C) */}
          <Section title="Holder graph — bundle map">
            <HolderGraphPanel bundle={intel.bundle} token={intel.token} />
          </Section>

          {/* Dev lineage: funding chain + same-dev + live position */}
          <div className="oxc-grid oxc-grid-2">
            <Section title="Dev wallet lineage — funding chain">
              <FundingChainPanel bundle={intel.bundle} forensics={intel.forensics} />
            </Section>
            <Section title="Same-dev & dev history">
              <SameDevPanel forensics={intel.forensics} sameDev={teamA.sameDev} devHistory={teamA.devHistory} />
            </Section>
          </div>

          <Section title="Dev wallet — live position">
            <DevWalletPanel forensics={intel.forensics} devWallet={intel.devWallet} />
          </Section>

          <div className="oxc-grid oxc-grid-2">
            <Section title="Contract">
              <ContractPanel forensics={intel.forensics} safety={intel.safety} token={intel.token} />
            </Section>
            <Section title="Liquidity">
              <LiquidityPanel token={intel.token} forensics={intel.forensics} dexPairs={intel.dexPairs} />
            </Section>
          </div>

          <Section title="Market">
            <MarketPanel token={intel.token} dexPairs={intel.dexPairs} />
          </Section>

          <div className="oxc-grid oxc-grid-2">
            <Section title="Holders">
              <HolderTable token={intel.token} forensics={intel.forensics} />
            </Section>
            <Section title="Deployer">
              <DevHistoryPanel forensics={intel.forensics} />
            </Section>
          </div>

          {/* X signals */}
          <Section title="X / Twitter signals">
            <XPanel x={intel.x} loading={intel.xLoading} onRetry={intel.refresh} />
          </Section>

          {/* Live trade tape + whale alerts */}
          <div className="oxc-grid oxc-grid-2">
            <Section title="Live trade tape">
              <TradeTapePanel dexPairs={intel.dexPairs} tradeTape={teamA.tradeTape} />
            </Section>
            <Section title="Whale alerts">
              <WhaleAlertsPanel forensics={intel.forensics} token={intel.token} whaleAlerts={teamA.whaleAlerts} />
            </Section>
          </div>

          {/* Sandbox launch replay (Team F) */}
          <Section title="Sandbox launch replay">
            <SandboxReplayPanel mint={intel.mint} token={intel.token} />
          </Section>

          {/* Shareable scan card + community notes + signal voting (Team E) */}
          <Section title="Share scan — card, notes & voting">
            <SocialScanPanel mint={intel.mint} token={intel.token} ogScore={intel.ogScore} riskScore={intel.risk?.score ?? null} riskLabel={intel.risk?.label ?? null} flags={shareFlags} />
          </Section>

          {/* W4 — rules that fired locally when this scan completed */}
          <Section title="Fired alerts — this scan">
            {firedAlerts.length > 0 ? (
              <ScanFeedAlerts
                mint={intel.mint}
                symbol={intel.token?.symbol ?? null}
                ogScore={intel.ogScore?.score ?? null}
                devWallet={intel.forensics?.dev?.wallet ?? null}
                signals={[]}
                firedAlerts={firedAlerts}
              />
            ) : (
              <p className="oxc-empty">
                No alert rules fired on this scan. Rules are checked locally in
                your browser when a scan completes — nothing is delivered by
                the backend, and a rule inside its cooldown does not re-fire.
              </p>
            )}
          </Section>

          <div className="oxc-grid oxc-grid-2">
            <Section title="Clone signals">
              <ClonesPanel research={intel.research} ownMcap={Number.isFinite(mcap) ? mcap : null} mint={intel.mint} />
            </Section>
            <Section title="Links">
              <LinksPanel token={intel.token} research={intel.research} mint={intel.mint} />
            </Section>
          </div>

          <Section title="Risk factors">
            {intel.risk ? <RiskFactors risk={intel.risk} /> : null}
          </Section>

          {isV2 && (
            <>
              {/* B2 — sniper radar, liquidity health, fingerprint, timeline, alerts */}
              <div className="oxc-grid oxc-grid-2">
                <Section title="Sniper radar">
                  <SniperRadarPanel forensics={intel.forensics} token={intel.token} />
                </Section>
                <Section title="Liquidity health">
                  <LiquidityHealthPanel token={intel.token} forensics={intel.forensics} dexPairs={intel.dexPairs} safety={intel.safety} />
                </Section>
              </div>
              <div className="oxc-grid oxc-grid-2">
                <Section title="Dev fingerprint">
                  <DevFingerprintPanel forensics={intel.forensics} sameDev={teamA.sameDev} devHistory={teamA.devHistory} />
                </Section>
                <Section title="Rug timeline">
                  <RugTimelinePanel forensics={intel.forensics} token={intel.token} devHistory={teamA.devHistory} />
                </Section>
              </div>
              <Section title="Alert builder">
                <AlertBuilderPanel mint={intel.mint} devWallet={intel.forensics?.dev?.wallet ?? null} />
              </Section>

              {/* B3 — DNA, graduation, age tags, contract diff, copycat, conviction, whales, radar */}
              <div className="oxc-grid oxc-grid-2">
                <Section title="Token DNA">
                  <TokenDnaPanel token={intel.token} research={intel.research} mint={intel.mint} tokenDna={intel.tokenDna} />
                </Section>
                <Section title="Graduation tracker">
                  <GraduationTrackerPanel forensics={intel.forensics} token={intel.token} />
                </Section>
              </div>
              <div className="oxc-grid oxc-grid-2">
                <Section title="Dev wallet age">
                  <DevWalletAgePanel forensics={intel.forensics} token={intel.token} walletAges={intel.walletAges} walletAgesLoading={intel.walletAgesLoading} />
                </Section>
                <Section title="Contract diff">
                  <ContractDiffPanel forensics={intel.forensics} mint={intel.mint} />
                </Section>
              </div>
              <div className="oxc-grid oxc-grid-2">
                <Section title="Copycat check">
                  <CopycatPanel research={intel.research} />
                </Section>
                <Section title="Holder conviction">
                  <HolderConvictionPanel dexPairs={intel.dexPairs} token={intel.token} holderConviction={intel.holderConviction} />
                </Section>
              </div>
              <Section title="Whale labels">
                <WhaleLabelsPanel token={intel.token} forensics={intel.forensics} whaleLabels={intel.whaleLabels} />
              </Section>
              <Section title="Rug radar leaderboard">
                <RugRadarLeaderboardPanel />
              </Section>

              {/* B4 — dev sell sim, bundle decay, fresh wallets, migration, metadata, overlap, planner, autopsy */}
              <div className="oxc-grid oxc-grid-2">
                <Section title="Dev sell simulator">
                  <DevSellSimulatorPanel token={intel.token} devWallet={intel.devWallet} dexPairs={intel.dexPairs} />
                </Section>
                <Section title="Bundle decay">
                  <BundleDecayPanel bundle={intel.bundle} mint={intel.mint} />
                </Section>
              </div>
              <div className="oxc-grid oxc-grid-2">
                <Section title="Fresh wallet radar">
                  <FreshWalletRadarPanel bundle={intel.bundle} />
                </Section>
                <Section title="Liquidity migration">
                  <LiquidityMigrationPanel forensics={intel.forensics} token={intel.token} />
                </Section>
              </div>
              <div className="oxc-grid oxc-grid-2">
                <Section title="Metadata audit">
                  <MetadataAuditPanel token={intel.token} />
                </Section>
                <Section title="Holder overlap — taste graph">
                  <HolderOverlapPanel token={intel.token} holderOverlap={intel.holderOverlap} holderOverlapLoading={intel.holderOverlapLoading} />
                </Section>
              </div>
              <Section title="Pool program & address verification">
                <PoolVerificationPanel mint={intel.mint} token={intel.token} forensics={intel.forensics} dexPairs={intel.dexPairs} />
              </Section>
              <Section title="Entry / exit planner">
                <EntryExitPlannerPanel token={intel.token} />
              </Section>
              <Section title="Rug autopsy">
                <RugAutopsyPanel forensics={intel.forensics} token={intel.token} />
              </Section>

              {/* B5 — dev watch, insiders, unlocks, wash, chart pattern, slippage, compare */}
              <div className="oxc-grid oxc-grid-2">
                <Section title="Live dev wallet watch">
                  <DevWalletWatchPanel forensics={intel.forensics} devWallet={intel.devWallet} />
                </Section>
                <Section title="Insiders">
                  <InsidersPanel bundle={intel.bundle} forensics={intel.forensics} />
                </Section>
              </div>
              {/* W4 — user-added smart wallet watchlist (same wallet route as the dev watch) */}
              <Section title="Smart wallet watch">
                <SmartWalletWatch mint={intel.mint} />
              </Section>
              <div className="oxc-grid oxc-grid-2">
                <Section title="Unlock schedule">
                  <UnlockSchedulePanel forensics={intel.forensics} />
                </Section>
                <Section title="Wash trading">
                  <WashTradingPanel dexPairs={intel.dexPairs} washTrading={intel.washTrading} tapeLoaded={intel.tradeTape != null} />
                </Section>
              </div>
              <div className="oxc-grid oxc-grid-2">
                <Section title="Chart pattern">
                  <ChartPatternPanel dexPairs={intel.dexPairs} chartPatterns={intel.chartPatterns} deepIntelLoading={intel.deepIntelLoading} />
                </Section>
                <Section title="Slippage estimator">
                  <SlippageEstimatorPanel token={intel.token} dexPairs={intel.dexPairs} />
                </Section>
              </div>
              {compareMints.length ? (
                <CompareView mintA={intel.mint} compareMints={compareMints} />
              ) : (
                <Section title="Cross-scan compare">
                  <CrossScanComparePanel
                    summaries={[
                      {
                        mint: intel.mint,
                        name: (intel.token?.name as string) ?? null,
                        symbol: (intel.token?.symbol as string) ?? null,
                        priceUsd: null, mcap: null, liquidityUsd: null, ogScore: null, riskScore: null,
                        top10Pct: null, lpLockedPct: null, bundledPct: null, holders: null,
                        loading: intel.loading, error: intel.error,
                      },
                    ]}
                    onAddMint={(m) => navigate(`/intel/scanner-v2/${intel.mint}?compare=${m}`)}
                  />
                </Section>
              )}

              {/* B6 — exit liquidity, LP drain, position size, Token-2022, cost basis, RugCheck, CEX */}
              <div className="oxc-grid oxc-grid-2">
                <Section title="Exit liquidity — sell stress test">
                  <ExitLiquidityPanel token={intel.token} dexPairs={intel.dexPairs} exitLiquidity={intel.exitLiquidity} />
                </Section>
                <Section title="LP drain alert">
                  <LpDrainAlertPanel forensics={intel.forensics} token={intel.token} mint={intel.mint} />
                </Section>
              </div>
              <div className="oxc-grid oxc-grid-2">
                <Section title="Position size calculator">
                  <PositionSizePanel token={intel.token} />
                </Section>
                <Section title="Token-2022 extensions audit">
                  <Token2022Panel token={intel.token} token2022Extensions={intel.token2022Extensions} />
                </Section>
              </div>
              <div className="oxc-grid oxc-grid-2">
                <Section title="Top-holder cost basis">
                  <CostBasisPanel token={intel.token} forensics={intel.forensics} />
                </Section>
                <Section title="RugCheck">
                  <RugCheckPanel rugCheck={rugCheck} safety={intel.safety} mint={intel.mint} />
                </Section>
              </div>
              <Section title="CEX deposit monitoring">
                <CexDepositPanel />
              </Section>
            </>
          )}

          <div className="oxc-panel" style={termPanel}>
            <h3 style={termH3}>Tradeability note</h3>
            <p className="oxc-muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              {intel.safety?.note || "Run completed — see Jupiter verdict above."}
            </p>
            <div style={{ marginTop: "0.75rem" }}>
              <a className="oxc-btn" href={`/intel/trade`} style={{ textDecoration: "none", display: "inline-block" }}>
                Trade this token
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
