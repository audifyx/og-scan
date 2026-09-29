/**
 * Real estate agent — show homes, close deals, bank commission.
 * Pick a client (buyer ped spawns at the first listing), present 3 homes
 * (get within 15m, hit Present), then the buyer picks their favorite
 * (interest = presentation quality + price appeal). Commission: 3% of the
 * sale, scaled by agent level. Listings get floating price tags.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { JobMeta, JobProps } from "./types";
import { JobChrome, PremiumButton, StatRow } from "./JobChrome";
import { useWorldTick, dist2, getPlayer } from "./world";
import { makeBeacon, makeTextSprite, spawnPed, walkPedTo, idlePed, type Beacon, type Ped } from "./markers";
import { HALF } from "../../core";
import { earnCity, addXp, jobLevel, levelPayScale, pushToast, fmtCity } from "./wallet";

export const REALESTATE_META: JobMeta = {
  id: "realestate",
  name: "Real Estate Agent",
  icon: "🏠",
  tagline: "Show homes. Close deals. Bank 3%.",
  payInfo: "3% commission per closed sale",
  premium: "Luxury listings: $2M+ homes",
  howTo: "Take a client, present 3 homes (get close, hit Present), and the buyer picks a favorite. Commission is 3% of the sale price.",
};

interface Listing {
  id: string;
  name: string;
  x: number;
  z: number;
  price: number;
}

const LISTINGS: Listing[] = [
  { id: "loft", name: "Neon Loft", x: HALF * 0.2, z: -HALF * 0.3, price: 180_000 },
  { id: "villa", name: "Palm Villa", x: -HALF * 0.4, z: HALF * 0.2, price: 420_000 },
  { id: "pent", name: "Skyline Penthouse", x: HALF * 0.1, z: HALF * 0.05, price: 1_150_000 },
  { id: "starter", name: "Suburb Starter", x: -HALF * 0.6, z: -HALF * 0.55, price: 95_000 },
  { id: "cottage", name: "Marina Cottage", x: HALF * 0.55, z: HALF * 0.4, price: 260_000 },
];

const BUYERS = ["Amara", "Theo", "Iris", "Caspian", "Wren"];

interface Shown {
  id: string;
  interest: number;
}

export default function RealEstateJob({ api, onEndShift }: JobProps) {
  const [phase, setPhase] = useState<"idle" | "showing" | "closing">("idle");
  const [shown, setShown] = useState<Shown[]>([]);
  const [buyer, setBuyer] = useState("");
  const [deals, setDeals] = useState(0);
  const [volume, setVolume] = useState(0);
  const [nearId, setNearId] = useState<string | null>(null);
  const beaconsRef = useRef<Beacon[]>([]);
  const tagsRef = useRef<THREE.Sprite[]>([]);
  const buyerRef = useRef<Ped | null>(null);
  const closingTarget = useRef<Listing | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const shownRef = useRef<Shown[]>([]);
  const tRef = useRef(0);
  const lastSync = useRef(0);

  // listing beacons + price tags (always up while job is active)
  useEffect(() => {
    const spawn = () => {
      const sc = api.getWorld()?.sceneRef;
      if (!sc) return false;
      beaconsRef.current.forEach((b) => b.dispose());
      beaconsRef.current = [];
      tagsRef.current.forEach((s) => {
        sc.remove(s);
        (s.material as THREE.Material).dispose();
      });
      tagsRef.current = [];
      LISTINGS.forEach((l) => {
        const b = makeBeacon(0x00e5ff);
        b.setPos(l.x, l.z);
        sc.add(b.group);
        const tag = makeTextSprite(`$${(l.price / 1000).toFixed(0)}k`, "#fff", "rgba(0,90,110,0.9)");
        tag.position.set(l.x, 5.2, l.z);
        sc.add(tag);
        beaconsRef.current.push(b);
        tagsRef.current.push(tag);
      });
      return true;
    };
    if (!spawn()) {
      const id = window.setInterval(() => {
        if (spawn()) window.clearInterval(id);
      }, 500);
      return () => window.clearInterval(id);
    }
    return () => {
      beaconsRef.current.forEach((b) => b.dispose());
      tagsRef.current.forEach((s) => {
        s.parent?.remove(s);
        (s.material as THREE.Material).dispose();
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  useEffect(() => {
    return () => {
      buyerRef.current?.dispose();
      buyerRef.current = null;
    };
  }, []);

  const startShowing = (scene: THREE.Scene) => {
    buyerRef.current?.dispose();
    const first = LISTINGS[Math.floor(Math.random() * LISTINGS.length)];
    const ped = spawnPed(scene, first.x + 3, first.z + 3, {});
    buyerRef.current = ped;
    closingTarget.current = null;
    shownRef.current = [];
    setShown([]);
    setBuyer(BUYERS[Math.floor(Math.random() * BUYERS.length)]);
    setPhase("showing");
    pushToast("Client arrived — present 3 homes", "info");
  };

  useWorldTick(api, (dt, world) => {
    tRef.current += dt;
    const t = tRef.current;
    beaconsRef.current.forEach((b) => b.update(dt));
    if (!world) return;
    const ph = phaseRef.current;
    if (ph === "idle" || !buyerRef.current) return;
    const p = getPlayer(api);
    if (!p) return;
    const b = buyerRef.current;
    if (ph === "showing") {
      // buyer follows the player at a distance
      const d = dist2(b.pos.x, b.pos.z, p.pos.x, p.pos.z);
      if (d > 12) walkPedTo(b, p.pos.x, p.pos.z, dt, 3.2);
      else idlePed(b, dt, t);
    } else if (ph === "closing") {
      const target = closingTarget.current;
      if (target && walkPedTo(b, target.x, target.z, dt, 3.2)) {
        b.dispose();
        buyerRef.current = null;
        setPhase("idle");
        setTimeout(() => {
          const w2 = api.getWorld();
          if (w2 && phaseRef.current === "idle") startShowing(w2.sceneRef);
        }, 2000);
      }
    }
    const now = performance.now();
    if (now - lastSync.current > 500) {
      lastSync.current = now;
      const near = LISTINGS.find((l) => dist2(p.pos.x, p.pos.z, l.x, l.z) < 16);
      setNearId((prev) => (prev === (near?.id ?? null) ? prev : (near?.id ?? null)));
    }
  });

  const present = () => {
    if (!nearId || shownRef.current.some((s) => s.id === nearId)) return;
    const l = LISTINGS.find((x) => x.id === nearId)!;
    // interest: presentation quality (random) tilted by price appeal
    const interest = 45 + Math.random() * 45 + (l.price > 800_000 ? 10 : 0);
    shownRef.current = [...shownRef.current, { id: nearId, interest }];
    setShown(shownRef.current);
    addXp("realestate", 40);
    pushToast(`Presented ${l.name} — ${buyer} is ${interest > 75 ? "impressed" : interest > 55 ? "interested" : "lukewarm"}`, "info");
    if (shownRef.current.length >= 3) closeDeal();
  };

  const closeDeal = () => {
    const list = shownRef.current;
    const winner = list.reduce((a, b) => (b.interest >= a.interest ? b : a));
    const l = LISTINGS.find((x) => x.id === winner.id)!;
    const commission = l.price * 0.03 * levelPayScale("realestate");
    earnCity(commission, `Sold ${l.name} to ${buyer}`);
    addXp("realestate", 80);
    setDeals((n) => n + 1);
    setVolume((v) => v + l.price);
    setPhase("closing");
    closingTarget.current = l;
    if (buyerRef.current) {
      pushToast(`${buyer} bought ${l.name} for $${l.price.toLocaleString()}!`, "cash");
    }
  };

  const near = LISTINGS.find((x) => x.id === nearId);
  const alreadyShown = nearId ? shown.some((s) => s.id === nearId) : false;

  return (
    <JobChrome
      meta={REALESTATE_META}
      status={
        phase === "idle"
          ? "Between clients…"
          : phase === "showing"
            ? `${buyer} wants to see ${3 - shown.length} more home${3 - shown.length === 1 ? "" : "s"}`
            : "Deal closing…"
      }
      onEnd={onEndShift}
    >
      <StatRow label="Deals closed" value={deals} />
      <StatRow label="Volume sold" value={fmtCity(volume)} accent={volume > 0} />
      <StatRow label="Agent level" value={jobLevel("realestate")} />
      {phase === "idle" && (
        <button
          className="oj-btn primary"
          onClick={() => {
            const w = api.getWorld();
            if (w) startShowing(w.sceneRef);
            else pushToast("Open the job while in the city", "warn");
          }}
        >
          🤝 Take a client
        </button>
      )}
      {phase === "showing" && near && !alreadyShown && (
        <button className="oj-btn primary" onClick={present}>
          🏠 Present {near.name} · ${(near.price / 1000).toFixed(0)}k
        </button>
      )}
      {shown.length > 0 && (
        <div className="oj-hint">
          Shown: {shown.map((s) => LISTINGS.find((l) => l.id === s.id)?.name).join(", ")}
        </div>
      )}
      <div className="oj-hint">Cyan beacons mark listings (price tags overhead). Your client follows you — keep them close.</div>
      <PremiumButton label="Luxury listings" />
    </JobChrome>
  );
}
