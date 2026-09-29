/**
 * Food truck empire — buy trucks, park them at hotspots, serve the lunch rush.
 * Each truck is a real prop in the world (markers.makePropTruck). Customers
 * spawn and walk to the truck; every served customer adds tips (paper CITY)
 * to that truck's till. Upgrade menu tiers for pricier plates, relocate to
 * chase foot traffic, collect the till. Up to 3 trucks.
 */
import { useEffect, useRef, useState } from "react";
import type { JobMeta, JobProps } from "./types";
import { JobChrome, PremiumButton, StatRow } from "./JobChrome";
import { useWorldTick, dist2, randomSidewalk, clampCity } from "./world";
import { makeBeacon, makePropTruck, spawnPed, walkPedTo, idlePed, type Beacon, type Ped, type PropTruck } from "./markers";
import { HALF } from "../../core";
import { earnCity, addXp, spendCity, jobLevel, levelPayScale, pushToast, fmtCity, getCity } from "./wallet";

export const FOODTRUCK_META: JobMeta = {
  id: "foodtruck",
  name: "Food Truck Empire",
  icon: "🌮",
  tagline: "Serve the lunch rush, stack the till.",
  payInfo: "$25–$80 per customer · up to 3 trucks",
  premium: "Gourmet trailer: 4th truck slot",
  howTo: "Buy a truck, park it at a hotspot beacon. Customers walk up and buy — collect the till, upgrade the menu, open more trucks.",
};

const HOTSPOTS = [
  { name: "Downtown Plaza", x: 0, z: 0 },
  { name: "Luna Bay Boardwalk", x: HALF - 70, z: 0 },
  { name: "Uptown Market", x: 0, z: -HALF + 70 },
];

const TIERS = [
  { name: "Street cart", serve: 25, upgrade: 1200 },
  { name: "Food truck", serve: 45, upgrade: 3000 },
  { name: "Gourmet trailer", serve: 80, upgrade: 0 },
];
const TRUCK_COSTS = [800, 2000, 4000];
const MAX_TRUCKS = 3;
const RELOCATE_FEE = 100;

interface Customer {
  ped: Ped;
  state: "arriving" | "waiting" | "leaving";
  waitT: number;
  lx: number;
  lz: number;
}

interface Truck {
  id: number;
  tier: number;
  hotspot: number;
  prop: PropTruck;
  till: number;
  customers: Customer[];
  served: number;
  serveT: number;
}

export default function FoodTruckJob({ api, onEndShift }: JobProps) {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [earned, setEarned] = useState(0);
  const [cityBal, setCityBal] = useState(() => getCity());
  const trucksRef = useRef<Truck[]>([]);
  const idRef = useRef(1);
  const tRef = useRef(0);
  const hotspotBeacons = useRef<Beacon[]>([]);
  const lastSync = useRef(0);

  const sync = () => {
    setTrucks([...trucksRef.current]);
    setCityBal(getCity());
  };

  const buyTruck = (hotspot: number) => {
    const w = api.getWorld();
    if (!w) {
      pushToast("Open the job while in the city", "warn");
      return;
    }
    const owned = trucksRef.current.length;
    if (owned >= MAX_TRUCKS) {
      pushToast("Empire cap: 3 trucks", "warn");
      return;
    }
    if (trucksRef.current.some((t) => t.hotspot === hotspot)) {
      pushToast("That hotspot is taken", "warn");
      return;
    }
    const cost = TRUCK_COSTS[owned];
    if (!spendCity(cost, "food truck")) return;
    const h = HOTSPOTS[hotspot];
    const prop = makePropTruck(0xff7a1a, "TACOS");
    prop.setPos(h.x + 6, h.z, Math.PI / 2);
    w.sceneRef.add(prop.group);
    trucksRef.current.push({ id: idRef.current++, tier: 0, hotspot, prop, till: 0, customers: [], served: 0, serveT: 2 });
    addXp("foodtruck", 20);
    pushToast(`Truck #${owned + 1} parked at ${h.name}`, "cash");
    sync();
  };

  const upgrade = (id: number) => {
    const t = trucksRef.current.find((x) => x.id === id);
    if (!t || t.tier >= 2) return;
    if (!spendCity(TIERS[t.tier].upgrade, "menu upgrade")) return;
    t.tier += 1;
    addXp("foodtruck", 15);
    pushToast(`Upgraded to ${TIERS[t.tier].name}`, "cash");
    sync();
  };

  const relocate = (id: number, hotspot: number) => {
    const t = trucksRef.current.find((x) => x.id === id);
    if (!t || t.hotspot === hotspot) return;
    if (trucksRef.current.some((x) => x.hotspot === hotspot)) {
      pushToast("That hotspot is taken", "warn");
      return;
    }
    if (!spendCity(RELOCATE_FEE, "relocate")) return;
    t.hotspot = hotspot;
    const h = HOTSPOTS[hotspot];
    t.prop.setPos(h.x + 6, h.z, Math.PI / 2);
    // shoo existing customers
    t.customers.forEach((c) => c.ped.dispose());
    t.customers = [];
    pushToast(`Truck moved to ${h.name}`, "info");
    sync();
  };

  const collect = (id?: number) => {
    const list = id === undefined ? trucksRef.current : trucksRef.current.filter((x) => x.id === id);
    const total = list.reduce((s, t) => s + Math.floor(t.till), 0);
    if (total <= 0) {
      pushToast("Tills are empty", "warn");
      return;
    }
    list.forEach((t) => {
      t.till = 0;
    });
    const credited = earnCity(total * levelPayScale("foodtruck"), "Food truck till");
    setEarned((e) => e + credited);
    addXp("foodtruck", 10 * list.length);
    sync();
  };

  useWorldTick(api, (dt, world) => {
    tRef.current += dt;
    const t = tRef.current;
    hotspotBeacons.current.forEach((b) => b.update(dt));
    if (!world) return;
    if (hotspotBeacons.current.length === 0) {
      HOTSPOTS.forEach((h) => {
        const b = makeBeacon(0x3a86ff);
        b.setPos(h.x, h.z);
        world.sceneRef.add(b.group);
        hotspotBeacons.current.push(b);
      });
    }
    trucksRef.current.forEach((tr) => {
      const h = HOTSPOTS[tr.hotspot];
      // spawn customers
      tr.serveT -= dt;
      const arriving = tr.customers.filter((c) => c.state !== "leaving").length;
      if (tr.serveT <= 0 && arriving < 3) {
        tr.serveT = 4 + Math.random() * 5;
        const s = randomSidewalk();
        const ped = spawnPed(world.sceneRef, s.x, s.z, {});
        const leave = clampCity(h.x + 30, h.z + 30);
        tr.customers.push({ ped, state: "arriving", waitT: 0, lx: leave.x, lz: leave.z });
      }
      const servePt = { x: h.x + 2, z: h.z + 4 };
      tr.customers = tr.customers.filter((c) => {
        if (c.state === "arriving") {
          if (walkPedTo(c.ped, servePt.x, servePt.z, dt, 2.6)) {
            c.state = "waiting";
            c.waitT = 1.2 + Math.random();
          }
          return true;
        }
        if (c.state === "waiting") {
          idlePed(c.ped, dt, t);
          c.waitT -= dt;
          if (c.waitT <= 0) {
            const price = TIERS[tr.tier].serve * (0.9 + Math.random() * 0.3);
            tr.till += price;
            tr.served += 1;
            c.state = "leaving";
          }
          return true;
        }
        // leaving
        if (walkPedTo(c.ped, c.lx, c.lz, dt, 2.4)) {
          c.ped.dispose();
          return false;
        }
        return true;
      });
    });
    const now = performance.now();
    if (now - lastSync.current > 1000) {
      lastSync.current = now;
      sync();
    }
  });

  useEffect(() => {
    return () => {
      trucksRef.current.forEach((tr) => {
        tr.customers.forEach((c) => c.ped.dispose());
        tr.prop.group.parent?.remove(tr.prop.group);
        tr.prop.dispose();
      });
      trucksRef.current = [];
      hotspotBeacons.current.forEach((b) => b.dispose());
      hotspotBeacons.current = [];
    };
  }, []);

  const nextCost = trucks.length < MAX_TRUCKS ? TRUCK_COSTS[trucks.length] : 0;

  return (
    <JobChrome meta={FOODTRUCK_META} status={trucks.length === 0 ? "No trucks yet — buy your first" : `${trucks.length} truck${trucks.length > 1 ? "s" : ""} rolling`} onEnd={onEndShift}>
      <StatRow label="Collected" value={fmtCity(earned)} accent={earned > 0} />
      <StatRow label="Empire level" value={jobLevel("foodtruck")} />
      <StatRow label="Balance" value={fmtCity(cityBal)} />
      {trucks.map((tr) => (
        <div key={tr.id} className="oj-truck">
          <div className="oj-row oj-between">
            <b>
              🚚 #{tr.id} · {TIERS[tr.tier].name}
            </b>
            <span className="oj-accent">{fmtCity(tr.till)} till</span>
          </div>
          <div className="oj-card-tag">
            {HOTSPOTS[tr.hotspot].name} · {tr.served} served · ${TIERS[tr.tier].serve}/plate
          </div>
          <div className="oj-row">
            <button className="oj-btn small" onClick={() => collect(tr.id)} disabled={tr.till < 1}>
              Collect
            </button>
            {tr.tier < 2 && (
              <button className="oj-btn small" onClick={() => upgrade(tr.id)} disabled={cityBal < TIERS[tr.tier].upgrade}>
                ⬆ ${TIERS[tr.tier].upgrade.toLocaleString()}
              </button>
            )}
            {HOTSPOTS.map((h, i) =>
              i !== tr.hotspot && !trucks.some((x) => x.hotspot === i) ? (
                <button key={i} className="oj-btn small" onClick={() => relocate(tr.id, i)}>
                  → {h.name.split(" ")[0]}
                </button>
              ) : null,
            )}
          </div>
        </div>
      ))}
      {trucks.length < MAX_TRUCKS && (
        <>
          <div className="oj-hint">Buy truck #{trucks.length + 1} — {fmtCity(nextCost)}:</div>
          <div className="oj-row">
            {HOTSPOTS.map((h, i) => (
              <button
                key={i}
                className="oj-btn small"
                onClick={() => buyTruck(i)}
                disabled={trucks.some((x) => x.hotspot === i) || cityBal < nextCost}
              >
                {h.name}
              </button>
            ))}
          </div>
        </>
      )}
      {trucks.length > 0 && (
        <button className="oj-btn" onClick={() => collect()}>
          Collect all tills
        </button>
      )}
      <div className="oj-hint">Blue beacons mark hotspots. Customers walk up on their own — keep the till collected.</div>
      <PremiumButton label="Gourmet trailer slot" />
    </JobChrome>
  );
}
