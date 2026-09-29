/**
 * Restaurants — eat for buffs, or open your own.
 * DINE: walk to any restaurant beacon and order the special — spends paper
 * CITY, grants a meal buff (pay × / xp × for a while), scaled by rating.
 * OWN: pay $2,500 CITY to open your own spot (pick a cuisine). Diners roll
 * in on the foot-traffic formula from dining.ts (critic reviews move it),
 * tips pile up in the till — collect them anytime.
 */
import { useEffect, useRef, useState } from "react";
import type { JobMeta, JobProps } from "./types";
import { JobChrome, PremiumButton, StatRow } from "./JobChrome";
import { useWorldTick, dist2, randomSidewalk, getPlayer } from "./world";
import { makeBeacon, type Beacon } from "./markers";
import {
  getRestaurants,
  getPlayerRestaurants,
  openPlayerRestaurant,
  addTips,
  collectTips,
  footTraffic,
  mealBuff,
  type Restaurant,
  type PlayerRestaurant,
} from "./dining";
import { earnCity, addXp, addBuff, spendCity, jobLevel, levelPayScale, pushToast, fmtCity, getCity } from "./wallet";

export const RESTAURANT_META: JobMeta = {
  id: "restaurant",
  name: "Restaurants",
  icon: "🍜",
  tagline: "Eat for buffs — or own the place.",
  payInfo: "Meal buffs + tip income from your spots",
  premium: "Franchise license: 5 spots",
  howTo: "Dine: get close to an orange beacon and order. Own: pay $2,500, pick a cuisine, collect the tips. Critic reviews change your foot traffic.",
};

const OPEN_COST = 2500;
const CUISINES = [
  { name: "Ramen", price: 65 },
  { name: "Tacos", price: 40 },
  { name: "Sushi", price: 95 },
];

export default function RestaurantJob({ api, onEndShift }: JobProps) {
  const [tab, setTab] = useState<"dine" | "own">("dine");
  const [seeds] = useState<Restaurant[]>(() => getRestaurants());
  const [mine, setMine] = useState<PlayerRestaurant[]>(() => getPlayerRestaurants());
  const [nearId, setNearId] = useState<string | null>(null);
  const [collected, setCollected] = useState(0);
  const [cityBal, setCityBal] = useState(() => getCity());
  const [version, setVersion] = useState(0);
  const beaconsRef = useRef<Beacon[]>([]);
  const lastSync = useRef(0);

  const all: Restaurant[] = [...seeds, ...mine];

  // beacons for every restaurant
  useEffect(() => {
    const spawn = () => {
      const sc = api.getWorld()?.sceneRef;
      if (!sc) return false;
      beaconsRef.current.forEach((b) => b.dispose());
      beaconsRef.current = [];
      getRestaurants().forEach((r) => {
        const b = makeBeacon(0xff9d3c);
        b.setPos(r.x, r.z);
        sc.add(b.group);
        beaconsRef.current.push(b);
      });
      getPlayerRestaurants().forEach((r) => {
        const b = makeBeacon(0x00e5ff);
        b.setPos(r.x, r.z);
        sc.add(b.group);
        beaconsRef.current.push(b);
      });
      return true;
    };
    if (!spawn()) {
      const id = window.setInterval(() => {
        if (spawn()) window.clearInterval(id);
      }, 500);
      return () => {
        window.clearInterval(id);
        beaconsRef.current.forEach((b) => b.dispose());
        beaconsRef.current = [];
      };
    }
    return () => {
      beaconsRef.current.forEach((b) => b.dispose());
      beaconsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, version]);

  useWorldTick(api, (dt, world) => {
    beaconsRef.current.forEach((b) => b.update(dt));
    if (!world) return;
    const p = getPlayer(api);
    if (!p) return;
    // tip income on player restaurants
    getPlayerRestaurants().forEach((r) => {
      if (Math.random() < dt * 0.25 * footTraffic(r)) {
        addTips(r.id, r.price * 0.35);
      }
    });
    const now = performance.now();
    if (now - lastSync.current > 500) {
      lastSync.current = now;
      const near = [...getRestaurants(), ...getPlayerRestaurants()].find(
        (r) => dist2(p.pos.x, p.pos.z, r.x, r.z) < 16,
      );
      setNearId((prev) => (prev === (near?.id ?? null) ? prev : (near?.id ?? null)));
      setCityBal(getCity());
      setMine([...getPlayerRestaurants()]);
    }
  });

  const order = () => {
    const r = all.find((x) => x.id === nearId);
    if (!r) return;
    if (!spendCity(r.price, `meal at ${r.name}`)) return;
    const buff = mealBuff(r);
    addBuff({ id: `meal-${r.id}`, label: buff.label, payMult: buff.payMult, xpMult: buff.xpMult, minutes: buff.minutes });
    addXp("restaurant", 10);
    pushToast(`Ate at ${r.name} — buff active ${buff.minutes}m`, "info");
  };

  const openOwn = (cuisine: { name: string; price: number }) => {
    if (!spendCity(OPEN_COST, "new restaurant")) return;
    const s = randomSidewalk();
    const n = mine.length + 1;
    const r = openPlayerRestaurant(`${cuisine.name} #${n}`, cuisine.name, s.x, s.z, cuisine.price);
    addXp("restaurant", 50);
    setVersion((v) => v + 1);
    setMine([...getPlayerRestaurants()]);
    pushToast(`${r.name} is open for business!`, "cash");
  };

  const collect = (id: string) => {
    const amt = collectTips(id);
    if (amt <= 0) {
      pushToast("Till is empty", "warn");
      return;
    }
    const credited = earnCity(amt * levelPayScale("restaurant"), "Restaurant tips");
    setCollected((c) => c + credited);
    addXp("restaurant", 12);
    setMine([...getPlayerRestaurants()]);
  };

  const near = all.find((x) => x.id === nearId);
  const totalPending = mine.reduce((s, r) => s + Math.floor(r.pending), 0);

  return (
    <JobChrome meta={RESTAURANT_META} status={near ? `Near ${near.name}` : "Find an orange beacon"} onEnd={onEndShift}>
      <div className="oj-row">
        <button className={`oj-btn small ${tab === "dine" ? "primary" : ""}`} onClick={() => setTab("dine")}>
          🍽 Dine
        </button>
        <button className={`oj-btn small ${tab === "own" ? "primary" : ""}`} onClick={() => setTab("own")}>
          🏪 My spots
        </button>
      </div>
      <StatRow label="Balance" value={fmtCity(cityBal)} />
      <StatRow label="Tips collected" value={fmtCity(collected)} accent={collected > 0} />
      <StatRow label="Restaurateur level" value={jobLevel("restaurant")} />

      {tab === "dine" && (
        <>
          {near ? (
            <div className="oj-truck">
              <b>{near.name}</b>
              <div className="oj-card-tag">
                {near.cuisine} · {"★".repeat(Math.round(near.rating))} · {fmtCity(near.price)}
              </div>
              <button className="oj-btn primary" onClick={order} disabled={cityBal < near.price}>
                Order the special · {fmtCity(near.price)}
              </button>
            </div>
          ) : (
            <div className="oj-hint">Walk up to an orange beacon (cyan = your spot) to see the menu.</div>
          )}
          <div className="oj-hint">Meals grant pay ×{(1 + Math.round(near?.rating ?? 3) * 0.02).toFixed(2)} buffs for 20–45 min.</div>
        </>
      )}

      {tab === "own" && (
        <>
          {mine.map((r) => (
            <div key={r.id} className="oj-truck">
              <div className="oj-row oj-between">
                <b>{r.name}</b>
                <span className="oj-accent">{fmtCity(r.pending)} till</span>
              </div>
              <div className="oj-card-tag">
                {r.cuisine} · foot traffic ×{footTraffic(r).toFixed(1)}
              </div>
              <button className="oj-btn small" onClick={() => collect(r.id)} disabled={r.pending < 1}>
                Collect tips
              </button>
            </div>
          ))}
          {mine.length === 0 && <div className="oj-hint">No spots yet — open your first below.</div>}
          <div className="oj-hint">Open a spot — {fmtCity(OPEN_COST)} (till: {fmtCity(totalPending)} pending):</div>
          <div className="oj-row">
            {CUISINES.map((c) => (
              <button key={c.name} className="oj-btn small" onClick={() => openOwn(c)} disabled={cityBal < OPEN_COST}>
                {c.name}
              </button>
            ))}
          </div>
          <div className="oj-hint">Tip income follows your rating — get the critic on your side.</div>
        </>
      )}
      <PremiumButton label="Franchise license" />
    </JobChrome>
  );
}
