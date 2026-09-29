/**
 * ORBITXCITY integration — apps shell.
 *
 * The in-world module launcher: an "APPS" HUD button opens a drawer with all
 * 18 city modules; each opens its root UI in an overlay panel with the shared
 * tokenomics billing injected into its documented provider slot.
 *
 * Also mounts the always-on HUD pieces: <FirmBadge/>, <WantedBadge/>, the
 * paper-CITY chip, the gadgets HUD (grapple + token scanner), and the
 * MediaWorldAdapter (photo-mode frame capture — checklist item 15).
 *
 * Billing: every module's `billing` prop receives the shared
 * `useOrbitxBilling()` value (auth-once, backend-signed burns, no popups).
 * The game never custodies keys or funds.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useLivePrices } from "@/hooks/useLivePrices";
import type { GtaApi } from "@/city/core/useGtaGame";
import { useSharedBilling } from "./CityBillingHost";
import { useCitySystems, settlePendingVotes } from "./CitySystemsHost";
import { bountyPaper, policePaper, cityPlayer } from "./cityPorts";

// module UIs
import { EconomyHub, usePaperWallet, formatCity } from "@/city/modules/economy";
import { BountyBoard } from "@/city/modules/bounty";
import { CharacterHub } from "@/city/modules/character";
import { RealEstateHub } from "@/city/modules/realestate";
import { JobsModule } from "@/city/modules/jobs";
import { FactionsRoot, FirmBadge, useFactions } from "@/city/modules/factions";
import { PolicePanel, WantedBadge, usePoliceStore } from "@/city/modules/police";
import { GadgetShop, GadgetHud, GrapplingHook, TokenScanner } from "@/city/modules/gadgets";
import type { GadgetAim } from "@/city/modules/gadgets/GadgetHud";
import { PhoneUi } from "@/city/modules/social";
import type { TokenDrama } from "@/city/modules/social";
import { PhotoMode, Gallery, RadioHud, DriveInHud, ShareToX, getShot } from "@/city/modules/media";
import type { MediaWorldAdapter, GalleryShot } from "@/city/modules/media";
import { SeasonPassPanel, EventBoard } from "@/city/modules/seasons";
import { EventHud, MarketPanel, WeatherPanel } from "@/city/modules/events";
import { allDoors, doorPromptLabel } from "@/city/modules/districts";

type AppId =
  | "bank" | "bounties" | "character" | "estate" | "jobs" | "factions"
  | "police" | "gadgets" | "phone" | "media" | "seasons" | "events"
  | "districts" | "heists" | "racing" | "sports";

const APPS: Array<{ id: AppId; icon: string; label: string; sub: string }> = [
  { id: "bank", icon: "🏦", label: "ORBITX Bank", sub: "Burn for premium" },
  { id: "bounties", icon: "🎯", label: "Bounty Board", sub: "Paper + ORBITX hits" },
  { id: "character", icon: "🎭", label: "Character", sub: "Creator, fits, gym" },
  { id: "estate", icon: "🏢", label: "Real Estate", sub: "NFT deeds + rent" },
  { id: "jobs", icon: "💼", label: "Jobs", sub: "11 gigs" },
  { id: "factions", icon: "⚔️", label: "Factions", sub: "Firms, turf, mayor" },
  { id: "police", icon: "🚔", label: "Police", sub: "Wanted, bribes, court" },
  { id: "gadgets", icon: "🔧", label: "Gadgets", sub: "Grapple + scanner" },
  { id: "phone", icon: "📱", label: "Phone", sub: "Calls, feed, news" },
  { id: "media", icon: "📸", label: "Media", sub: "Photo, radio, drive-in" },
  { id: "seasons", icon: "🎫", label: "Season Pass", sub: "Tiers + events" },
  { id: "events", icon: "🎪", label: "Events", sub: "Airdrops, quakes…" },
  { id: "districts", icon: "🏛️", label: "Districts", sub: "Venues + city hall" },
  { id: "heists", icon: "💰", label: "Heists", sub: "Crew jobs" },
  { id: "racing", icon: "🏁", label: "Racing", sub: "Circuits + rally" },
  { id: "sports", icon: "🏄", label: "Sports", sub: "Venues" },
  // vehicles + ambient are systems-only in v1 (see notes below)
];

/* ------------------------------------------------------------------ */
/* Gadgets host: grapple + scanner controllers, ticked per frame       */
/* ------------------------------------------------------------------ */

function GadgetsHost({ api, onOpenShop }: { api: GtaApi; onOpenShop: () => void }) {
  const [ctrl, setCtrl] = useState<{ grapple: GrapplingHook; scanner: TokenScanner } | null>(null);
  const { prices } = useLivePrices(
    [
      "So11111111111111111111111111111111111111112",
      "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
      "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPBAA7",
      "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
      "EKpQGSJtjMFqKZ9KQanSqYXRcwiUd5R8ZEWHz5MCFG4rq",
    ],
    30_000,
  );
  const ctrlRef = useRef<{ grapple: GrapplingHook; scanner: TokenScanner } | null>(null);

  useEffect(() => {
    let disposed = false;
    let raf = 0;
    const boot = () => {
      if (disposed) return;
      const world = api.getWorld();
      if (!world) {
        setTimeout(boot, 400);
        return;
      }
      // scannable/latchable meshes: everything the core tagged (checklist 10)
      const tagged: THREE.Object3D[] = [];
      world.sceneRef.traverse((o) => {
        if (o.userData.isBuilding) tagged.push(o);
      });
      const grapple = new GrapplingHook({ scene: world.sceneRef, collidables: tagged });
      const scanner = new TokenScanner({ scene: world.sceneRef, camera: world.cameraRef });
      scanner.setScannables(tagged);
      ctrlRef.current = { grapple, scanner };
      setCtrl({ grapple, scanner });

      let last = performance.now();
      const loop = () => {
        if (disposed) return;
        raf = requestAnimationFrame(loop);
        const now = performance.now();
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        try {
          const p = world.getPlayerState().pos;
          const frame = grapple.update(dt, p);
          // checklist 8: route the rope pull through the world's velocity
          if (frame.pull.lengthSq() > 0.0001) world.addPlayerVelocity(frame.pull.clone().multiplyScalar(dt));
        } catch { /* decorative */ }
        try {
          scanner.update(now);
        } catch { /* decorative */ }
      };
      raf = requestAnimationFrame(loop);
    };
    boot();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ctrlRef.current = null;
      setCtrl((c) => {
        c?.grapple.dispose();
        c?.scanner.dispose();
        return null;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  // feed live quotes into the token scanner overlay
  useEffect(() => {
    const s = ctrlRef.current?.scanner;
    if (!s) return;
    const q: Record<string, { price: number; priceChange24h: number; volume24h: number; liquidity: number; marketCap: number; lastUpdated: number }> = {};
    for (const [mint, p] of Object.entries(prices)) {
      q[mint] = {
        price: p.price,
        priceChange24h: p.priceChange24h,
        volume24h: p.volume24h,
        liquidity: p.liquidity,
        marketCap: p.marketCap,
        lastUpdated: p.lastUpdated,
      };
    }
    try {
      s.setPrices(q);
    } catch { /* decorative */ }
  }, [prices]);

  const getAim = (): GadgetAim | null => {
    const world = api.getWorld();
    if (!world) return null;
    const cam = world.cameraRef;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    return { origin: cam.position.clone(), dir };
  };

  if (!ctrl) return null;
  return <GadgetHud grapple={ctrl.grapple} scanner={ctrl.scanner} getAim={getAim} onOpenShop={onOpenShop} />;
}

/* ------------------------------------------------------------------ */
/* Apps shell                                                          */
/* ------------------------------------------------------------------ */

export function CityAppsShell({ api }: { api: GtaApi }) {
  const billing = useSharedBilling();
  const systems = useCitySystems();
  const [drawer, setDrawer] = useState(false);
  const [app, setApp] = useState<AppId | null>(null);
  const [mediaTab, setMediaTab] = useState<"photo" | "gallery" | "radio" | "drivein">("photo");
  const [shareShot, setShareShot] = useState<GalleryShot | null>(null);
  const [eventTab, setEventTab] = useState<"hud" | "market" | "weather">("hud");
  const [settleMsg, setSettleMsg] = useState<string | null>(null);
  const police = usePoliceStore();
  const { wallet } = usePaperWallet();
  const [factionsState] = useFactions();
  const me = useMemo(() => cityPlayer(), []);

  const closeApp = () => setApp(null);

  // MediaWorldAdapter (checklist 15): frame capture + pause + teleport
  const mediaAdapter: MediaWorldAdapter = useMemo(
    () => ({
      getCanvas: () => api.canvasRef.current,
      captureFrame: () => {
        try {
          const c = api.canvasRef.current;
          if (!c) return null;
          const url = c.toDataURL("image/png");
          // blank canvas guard (no preserveDrawingBuffer → often blank)
          return url.length > 1000 ? url : null;
        } catch {
          return null;
        }
      },
      setPaused: (p: boolean) => api.getWorld()?.setPaused(p),
      teleport: (x: number, z: number, h?: number) => api.getWorld()?.teleport(x, z, h),
      getPlayerSnapshot: () => {
        const w = api.getWorld();
        if (!w) return null;
        const s = w.getPlayerState();
        return {
          pos: { x: s.pos.x, y: s.pos.y, z: s.pos.z },
          heading: s.heading,
          speedKmh: s.speedKmh,
          isNight: s.isNight,
        };
      },
    }),
    [api],
  );

  // PhoneUi drama feed: real token moves only (pump ≥+8%, dump ≤−8%)
  const drama = useMemo<TokenDrama[]>(() => {
    const out: TokenDrama[] = [];
    const mints: Record<string, string> = {
      SOL: "So11111111111111111111111111111111111111112",
      ORBITX: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
      BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPBAA7",
      JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
      WIF: "EKpQGSJtjMFqKZ9KQanSqYXRcwiUd5R8ZEWHz5MCFG4rq",
    };
    for (const [sym, q] of Object.entries(api.quotes)) {
      if (Math.abs(q.change24h) >= 8) {
        out.push({
          symbol: sym,
          mint: mints[sym] ?? sym,
          price: q.price,
          change24h: q.change24h,
          volume24h: 0,
          marketCap: 0,
        });
      }
    }
    return out;
  }, [api.quotes]);

  const doSettleVotes = async () => {
    if (!billing) return;
    setSettleMsg(null);
    try {
      const { settled, signature } = await settlePendingVotes(billing);
      setSettleMsg(
        settled > 0
          ? `Settled ${settled} ORBITX in votes — burn ${signature?.slice(0, 10)}…`
          : "No pending votes to settle.",
      );
    } catch (e) {
      setSettleMsg(e instanceof Error ? e.message : "Settlement failed.");
    }
  };

  const renderApp = () => {
    const onClose = closeApp;
    switch (app) {
      case "bank":
        return <EconomyHub billing={billing} onClose={onClose} />;
      case "bounties":
        return <BountyBoard me={me} paper={bountyPaper} billing={billing} onClose={onClose} />;
      case "character":
        return <CharacterHub billing={billing} onClose={onClose} />;
      case "estate":
        return <RealEstateHub billing={billing} onClose={onClose} />;
      case "jobs":
        return <JobsModule api={api} />;
      case "factions":
        return (
          <div className="oxc-app-scroll">
            {billing?.ready && factionsState && (
              <SettleVotesRow onSettle={doSettleVotes} msg={settleMsg} />
            )}
            <FactionsRoot onClose={onClose} />
          </div>
        );
      case "police":
        return <PolicePanel paper={policePaper} billing={billing} onClose={onClose} />;
      case "gadgets":
        return <GadgetShop billing={billing} onClose={onClose} />;
      case "phone":
        return (
          <PhoneUi
            playerName={me.displayName}
            playerHandle={`@${me.displayName.toLowerCase().replace(/[^a-z0-9]/g, "")}`}
            drama={drama}
            takeSnapshot={() => mediaAdapter.captureFrame()}
            teleport={(x: number, z: number) => api.getWorld()?.teleport(x, z)}
            onClose={onClose}
          />
        );
      case "media":
        return (
          <div className="oxc-app-scroll">
            <div className="oxc-tabs" data-hud>
              {(["photo", "gallery", "radio", "drivein"] as const).map((t) => (
                <button key={t} className={mediaTab === t ? "on" : ""} onClick={() => setMediaTab(t)}>
                  {t}
                </button>
              ))}
            </div>
            {mediaTab === "photo" && (
              <PhotoMode
                adapter={mediaAdapter}
                billing={billing}
                onClose={onClose}
                onShare={(shotId) => {
                  const s = getShot(shotId);
                  if (s) setShareShot(s);
                }}
              />
            )}
            {mediaTab === "gallery" && <Gallery onClose={onClose} onShare={(s) => setShareShot(s)} />}
            {mediaTab === "radio" && <RadioHud onClose={onClose} />}
            {mediaTab === "drivein" && <DriveInHud adapter={mediaAdapter} onClose={onClose} />}
            {shareShot && <ShareToX shot={shareShot} onClose={() => setShareShot(null)} />}
          </div>
        );
      case "seasons":
        return (
          <div className="oxc-app-scroll">
            <SeasonPassPanel billing={billing} onClose={onClose} />
            <EventBoard />
          </div>
        );
      case "events":
        return systems ? (
          <div className="oxc-app-scroll">
            <div className="oxc-tabs" data-hud>
              {(["hud", "market", "weather"] as const).map((t) => (
                <button key={t} className={eventTab === t ? "on" : ""} onClick={() => setEventTab(t)}>
                  {t}
                </button>
              ))}
            </div>
            {eventTab === "hud" && (
              <EventHud system={systems.events} onOpenMarket={() => setEventTab("market")} onOpenWeather={() => setEventTab("weather")} />
            )}
            {eventTab === "market" && <MarketPanel system={systems.events} mode="night" onClose={onClose} />}
            {eventTab === "weather" && <WeatherPanel system={systems.events} onClose={onClose} />}
          </div>
        ) : (
          <div className="oxc-app-note">Events system booting…</div>
        );
      case "districts":
        return <DistrictsApp api={api} onClose={onClose} />;
      case "heists":
        return <HeistsApp onClose={onClose} />;
      case "racing":
        return <RacingApp />;
      case "sports":
        return <SportsApp />;
      default:
        return null;
    }
  };

  return (
    <>
      {/* always-on HUD chips */}
      <div className="oxc-hud-chips" data-hud>
        <FirmBadge />
        <WantedBadge stars={police.stars} onOpen={() => setApp("police")} />
        <button className="oxc-chip" onClick={() => setApp("bank")} title="Paper CITY balance">
          💠 {formatCity(wallet.balance)} CITY
        </button>
        {billing && (
          <button
            className={`oxc-chip ${billing.ready ? "on" : ""}`}
            onClick={() => !billing.ready && billing.beginAuth()}
            title={billing.ready ? `ORBITX: ${billing.balance ?? "…"}` : "Connect ORBITX billing"}
          >
            {billing.ready ? `🪙 ${billing.balance ?? "…"} ORBITX` : "🔌 Connect ORBITX"}
          </button>
        )}
      </div>

      {/* apps drawer toggle */}
      <button data-hud className="oxc-apps-btn" onClick={() => setDrawer((d) => !d)} aria-label="City apps">
        📱 APPS
      </button>

      <GadgetsHost api={api} onOpenShop={() => { setDrawer(false); setApp("gadgets"); }} />

      {drawer && (
        <div className="oxc-drawer" data-hud>
          <div className="oxc-drawer-head">
            <strong>ORBITX CITY</strong>
            <button onClick={() => setDrawer(false)} aria-label="Close apps">✕</button>
          </div>
          <div className="oxc-drawer-grid">
            {APPS.map((a) => (
              <button
                key={a.id}
                className="oxc-app-tile"
                onClick={() => { setDrawer(false); setApp(a.id); }}
              >
                <span className="oxc-app-icon">{a.icon}</span>
                <span className="oxc-app-label">{a.label}</span>
                <span className="oxc-app-sub">{a.sub}</span>
              </button>
            ))}
          </div>
          <p className="oxc-drawer-note">Vehicles module: systems-only in v1 (dealership/garage data wired, drivable registration needs core vehicle hooks).</p>
        </div>
      )}

      {app && (
        <div className="oxc-overlay" data-hud>
          <div className="oxc-overlay-bar">
            <strong>{APPS.find((a) => a.id === app)?.label}</strong>
            <button onClick={closeApp} aria-label="Close">✕</button>
          </div>
          <div className="oxc-overlay-body">{renderApp()}</div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* small panels                                                         */
/* ------------------------------------------------------------------ */

function SettleVotesRow({ onSettle, msg }: { onSettle: () => void; msg: string | null }) {
  const [state] = useFactions();
  const pending = state.election.candidates.reduce((s, c) => s + c.pendingVotes, 0);
  if (pending <= 0 && !msg) return null;
  return (
    <div className="oxc-settle-row" data-hud>
      <span>🗳️ {pending} vote{pending === 1 ? "" : "s"} pending ORBITX settlement</span>
      {pending > 0 && <button onClick={onSettle}>Settle & burn</button>}
      {msg && <em>{msg}</em>}
    </div>
  );
}

function DistrictsApp({ api, onClose }: { api: GtaApi; onClose: () => void }) {
  const doors = allDoors();
  return (
    <div className="oxc-app-scroll" data-hud>
      <p className="oxc-app-note">Walk to a door (or teleport) — the prompt chip handles entry.</p>
      {doors.map((d) => (
        <button
          key={d.id}
          className="oxc-row-btn"
          onClick={() => {
            api.getWorld()?.teleport(d.position[0], d.position[2]);
            onClose();
          }}
        >
          <strong>{d.label}</strong>
          <span>{doorPromptLabel(d, false)}</span>
        </button>
      ))}
    </div>
  );
}

function HeistsApp({ onClose }: { onClose: () => void }) {
  const systems = useCitySystems();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  if (!systems) return <div className="oxc-app-note">Heist director booting…</div>;
  const dir = systems.heists;
  const session = dir.engine.getSession();
  void tick;
  return (
    <div className="oxc-app-scroll" data-hud>
      {session ? (
        <div className="oxc-app-note">
          <strong>Active: {session.plan.templateId}</strong> — stage: {session.stage}
          <br />Crew: {session.plan.crew.map((c) => c.name).join(", ")}
        </div>
      ) : (
        <p className="oxc-app-note">No active heist. Pick a template to start casing.</p>
      )}
      {dir.catalog().map((t) => (
        <button
          key={t.id}
          className="oxc-row-btn"
          disabled={!!session || dir.cooldownRemaining(t.id) > 0}
          onClick={() => {
            dir.startPlan(t.id, t.approaches[0], dir.quickCrew(t.id));
            onClose();
          }}
        >
          <strong>{t.name}</strong>
          <span>{t.tagline} · {t.minCrew}–{t.maxCrew} crew · {t.baseLootCity.toLocaleString()} CITY</span>
        </button>
      ))}
    </div>
  );
}

function RacingApp() {
  return (
    <div className="oxc-app-scroll" data-hud>
      <p className="oxc-app-note">
        Street circuit, pink-slip duels (midnight), and desert rally raids run headless in v1 —
        race sessions spawn at track markers. PvP lobbies arrive with multiplayer.
      </p>
    </div>
  );
}

function SportsApp() {
  return (
    <div className="oxc-app-scroll" data-hud>
      <p className="oxc-app-note">
        Skate park, parkour rooftops, base-jump tower, wingsuit lines, fight dojo,
        surf break, golf course, and the fishing pier are live venues — head to their
        map markers. Style points settle to paper CITY automatically.
      </p>
    </div>
  );
}
