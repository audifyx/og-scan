/**
 * OrbitXCity — Gadgets in-world HUD.
 *
 * Renders inside the game canvas overlay (mount next to the core HUD):
 *  - equipped-gadget quick bar (tap to equip/unequip owned gadgets)
 *  - grapple fire button + status (mobile-friendly, 64px touch target)
 *  - scanner toggle + live scan overlay panel with real DexScreener data
 *  - shop entry button
 *
 * The integrator constructs the `GrapplingHook` / `TokenScanner` controllers
 * once the world exists and passes them in; this component wires input
 * (keyboard G/V + touch buttons) and feeds live prices into the scanner.
 * It never touches core files.
 */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useLivePrices } from "@/hooks/useLivePrices";
import { SCAN_MINTS } from "./catalog";
import { GadgetRuntime, useGadgetInventory, useGadgetRuntime } from "./store";
import type { GrapplingHook } from "./GrapplingHook";
import type { TokenScanner } from "./TokenScanner";
import type { GadgetId, ScanHitView } from "./types";

export interface GadgetAim {
  origin: THREE.Vector3;
  dir: THREE.Vector3;
}

export interface GadgetHudProps {
  /** Integrator-owned controller; null until constructed or gadget not owned. */
  grapple: GrapplingHook | null;
  /** Integrator-owned controller; null until constructed or gadget not owned. */
  scanner: TokenScanner | null;
  /** Camera-space aim for the grapple. Null = can't fire right now. */
  getAim: () => GadgetAim | null;
  onOpenShop: () => void;
}

const SCAN_MINT_LIST = [...SCAN_MINTS] as string[];

function fmtUsd(n: number): string {
  if (!isFinite(n) || n <= 0) return "$0";
  if (n < 0.000001) return `$${n.toExponential(2)}`;
  if (n < 1) return `$${n.toFixed(6)}`;
  if (n < 1000) return `$${n.toFixed(n < 10 ? 4 : 2)}`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function fmtCompact(n: number): string {
  if (!isFinite(n) || n <= 0) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

const CHANGE_UP = "text-emerald-400";
const CHANGE_DOWN = "text-red-400";

export function GadgetHud({ grapple, scanner, getAim, onOpenShop }: GadgetHudProps) {
  const { owned, equipped, equip } = useGadgetInventory();
  const snap = useGadgetRuntime();
  const { prices, connected } = useLivePrices(SCAN_MINT_LIST, 10_000);

  // Feed live quotes into the scanner controller + runtime connectivity flag.
  useEffect(() => {
    scanner?.setPrices(prices);
  }, [scanner, prices]);
  useEffect(() => {
    GadgetRuntime.setPricesConnected(connected);
  }, [connected]);

  const fireGrapple = () => {
    if (!grapple || equipped !== "grappling-hook") return;
    if (grapple.state === "attached" || grapple.state === "flying") {
      grapple.release();
      return;
    }
    const aim = getAim();
    if (aim) grapple.fire(aim.origin, aim.dir);
  };

  const toggleScanner = () => {
    if (!scanner || equipped !== "token-scanner") return;
    scanner.setActive(!scanner.isActive);
  };

  // Keyboard: G = grapple, V = scanner.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "g" || e.key === "G") fireGrapple();
      if (e.key === "v" || e.key === "V") toggleScanner();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grapple, scanner, equipped, getAim]);

  const ownsGrapple = owned.includes("grappling-hook");
  const ownsScanner = owned.includes("token-scanner");
  const scan = snap.scanHit;

  const gadgetSlot = (id: GadgetId, icon: string, label: string, ownedFlag: boolean) => (
    <button
      key={id}
      onClick={() => ownedFlag && equip(equipped === id ? null : id)}
      disabled={!ownedFlag}
      aria-label={`${label} ${ownedFlag ? (equipped === id ? "(equipped)" : "") : "(not owned)"}`}
      className={`flex h-14 w-14 flex-col items-center justify-center rounded-2xl border text-lg transition active:scale-95 disabled:opacity-30 ${
        equipped === id
          ? "border-cyan-400/70 bg-cyan-400/20 shadow-[0_0_16px_rgba(34,211,238,0.4)]"
          : "border-white/10 bg-black/50 backdrop-blur"
      }`}
    >
      <span>{icon}</span>
      <span className="text-[8px] font-bold uppercase tracking-wide text-slate-300">
        {equipped === id ? "on" : label}
      </span>
    </button>
  );

  const grappleStatus = useMemo(() => {
    switch (snap.grapple) {
      case "flying":
        return "Firing…";
      case "attached":
        return "Attached — tap to release";
      case "cooldown":
        return "Recharging…";
      default:
        return "Ready";
    }
  }, [snap.grapple]);

  return (
    <div className="pointer-events-none absolute inset-0 z-[40]" data-gadget-hud>
      {/* top-right: shop button */}
      <div className="pointer-events-auto absolute right-3 top-3">
        <button
          onClick={onOpenShop}
          aria-label="Open gadget shop"
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/50 text-xl backdrop-blur active:scale-95"
        >
          🛠️
        </button>
      </div>

      {/* scan overlay panel */}
      {equipped === "token-scanner" && snap.scannerActive && (
        <div className="pointer-events-auto absolute left-3 top-3 w-64 rounded-2xl border border-cyan-400/30 bg-black/70 p-3 backdrop-blur-md">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-300">
              📡 Token Scanner
            </span>
            <span
              className={`flex items-center gap-1 text-[10px] font-bold ${
                connected ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  connected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                }`}
              />
              {connected ? "LIVE" : "SYNC…"}
            </span>
          </div>
          {scan ? (
            <ScanPanel scan={scan} />
          ) : (
            <p className="py-2 text-center text-xs text-slate-400">
              Aim at a tagged tower…
            </p>
          )}
        </div>
      )}

      {/* bottom-left: equipped gadget quick bar */}
      <div className="pointer-events-auto absolute bottom-24 left-3 flex flex-col gap-2 sm:bottom-6">
        {gadgetSlot("grappling-hook", "🪝", "hook", ownsGrapple)}
        {gadgetSlot("token-scanner", "📡", "scan", ownsScanner)}
      </div>

      {/* bottom-right: contextual action button */}
      {equipped === "grappling-hook" && grapple && (
        <div className="pointer-events-auto absolute bottom-24 right-3 flex flex-col items-center gap-1 sm:bottom-6">
          <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-cyan-300 backdrop-blur">
            {grappleStatus}
          </span>
          <button
            onClick={fireGrapple}
            aria-label="Fire grappling hook"
            className={`flex h-16 w-16 items-center justify-center rounded-full border-2 text-2xl backdrop-blur transition active:scale-90 ${
              snap.grapple === "attached"
                ? "border-red-400/70 bg-red-500/30"
                : "border-cyan-400/70 bg-cyan-400/20 shadow-[0_0_20px_rgba(34,211,238,0.35)]"
            }`}
          >
            🪝
          </button>
        </div>
      )}
      {equipped === "token-scanner" && scanner && (
        <div className="pointer-events-auto absolute bottom-24 right-3 sm:bottom-6">
          <button
            onClick={toggleScanner}
            aria-label="Toggle token scanner"
            className={`flex h-16 w-16 items-center justify-center rounded-full border-2 text-2xl backdrop-blur transition active:scale-90 ${
              snap.scannerActive
                ? "border-cyan-400/70 bg-cyan-400/20 shadow-[0_0_20px_rgba(34,211,238,0.35)]"
                : "border-white/20 bg-black/50"
            }`}
          >
            📡
          </button>
        </div>
      )}
    </div>
  );
}

function ScanPanel({ scan }: { scan: ScanHitView }) {
  const q = scan.quote;
  const chg = q?.priceChange24h ?? 0;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-lg font-extrabold text-white">${scan.symbol}</span>
        <span className="text-[10px] text-slate-400">{scan.distance.toFixed(0)} m</span>
      </div>
      <div className="text-[11px] text-slate-400">{scan.name}</div>
      {q ? (
        <div className="mt-1.5 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Price</span>
            <span className="font-bold text-white">{fmtUsd(q.price)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">24h</span>
            <span className={`font-bold ${chg >= 0 ? CHANGE_UP : CHANGE_DOWN}`}>
              {chg >= 0 ? "▲" : "▼"} {Math.abs(chg).toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Volume 24h</span>
            <span className="text-slate-200">{fmtCompact(q.volume24h)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Liquidity</span>
            <span className="text-slate-200">{fmtCompact(q.liquidity)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Mkt cap</span>
            <span className="text-slate-200">{fmtCompact(q.marketCap)}</span>
          </div>
        </div>
      ) : (
        <p className="mt-1.5 text-xs text-amber-300/90">Fetching live quote…</p>
      )}
    </div>
  );
}
