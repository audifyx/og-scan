/**
 * Food critic — review the city's restaurants, move the market.
 * Visit a restaurant beacon, taste the menu (8s on site), then rate 1–5.
 * The review lands in the shared registry (dining.ts) and shifts foot
 * traffic, which the restaurant/food-truck jobs feel. Pay per review plus
 * a "foodie palate" pay buff. Eating is part of the gig.
 */
import { Fragment, useEffect, useRef, useState } from "react";
import type { JobMeta, JobProps } from "./types";
import { JobChrome, PremiumButton, StatRow } from "./JobChrome";
import { useWorldTick, dist2, getPlayer } from "./world";
import { makeBeacon, type Beacon } from "./markers";
import { getRestaurants, publishReview, type Restaurant } from "./dining";
import { earnCity, addXp, addBuff, jobLevel, levelPayScale, pushToast, fmtCity } from "./wallet";

export const CRITIC_META: JobMeta = {
  id: "critic",
  name: "Food Critic",
  icon: "⭐",
  tagline: "Review restaurants, move the market.",
  payInfo: "$60 + $25/star per review",
  premium: "Michelin column: double review fees",
  howTo: "Visit a restaurant beacon (green = unreviewed), hit Taste the menu, stay on site 8s, then rate 1–5 stars. Your reviews change real foot traffic.",
};

const TASTE_SEC = 8;

export default function CriticJob({ api, onEndShift }: JobProps) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>(() => getRestaurants());
  const [nearId, setNearId] = useState<string | null>(null);
  const [tastePct, setTastePct] = useState(0);
  const [readyId, setReadyId] = useState<string | null>(null);
  const [reviews, setReviews] = useState(0);
  const beaconsRef = useRef<Map<string, Beacon>>(new Map());
  const tastingRef = useRef<{ id: string; t: number } | null>(null);
  const lastSync = useRef(0);
  const restRef = useRef(restaurants);
  restRef.current = restaurants;

  // beacons per restaurant
  useEffect(() => {
    const w = api.getWorld();
    const scene = w?.sceneRef;
    const spawn = () => {
      const sc = api.getWorld()?.sceneRef;
      if (!sc) return false;
      beaconsRef.current.forEach((b) => b.dispose());
      beaconsRef.current.clear();
      restRef.current.forEach((r) => {
        const b = makeBeacon(r.reviews === 0 ? 0x00ff9f : 0xffd23f);
        b.setPos(r.x, r.z);
        sc.add(b.group);
        beaconsRef.current.set(r.id, b);
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
        beaconsRef.current.clear();
      };
    }
    return () => {
      beaconsRef.current.forEach((b) => b.dispose());
      beaconsRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, restaurants]);

  useWorldTick(api, (dt, world) => {
    beaconsRef.current.forEach((b) => b.update(dt));
    if (!world) return;
    const p = getPlayer(api);
    if (!p) return;
    // tasting progress
    const tg = tastingRef.current;
    if (tg) {
      const r = restRef.current.find((x) => x.id === tg.id);
      if (r && dist2(p.pos.x, p.pos.z, r.x, r.z) < 14) {
        tg.t += dt;
        setTastePct(Math.min(1, tg.t / TASTE_SEC));
        if (tg.t >= TASTE_SEC) {
          tastingRef.current = null;
          setTastePct(0);
          setReadyId(tg.id);
          pushToast("Menu tasted — rate it!", "info");
        }
      } else {
        tastingRef.current = null;
        setTastePct(0);
        pushToast("You left before dessert — tasting cancelled", "warn");
      }
    }
    const now = performance.now();
    if (now - lastSync.current > 500) {
      lastSync.current = now;
      const near = restRef.current.find((r) => dist2(p.pos.x, p.pos.z, r.x, r.z) < 14);
      setNearId((prev) => (prev === (near?.id ?? null) ? prev : (near?.id ?? null)));
    }
  });

  const taste = () => {
    if (!nearId || tastingRef.current) return;
    tastingRef.current = { id: nearId, t: 0 };
    setReadyId(null);
    pushToast("Tasting the menu… stay on site", "info");
  };

  const rate = (stars: number) => {
    if (!readyId) return;
    const r = restRef.current.find((x) => x.id === readyId);
    const newRating = publishReview(readyId, stars);
    const pay = (60 + stars * 25) * levelPayScale("critic");
    earnCity(pay, `Review — ${r?.name ?? "restaurant"} (${stars}★)`);
    const { leveled } = addXp("critic", 35);
    addBuff({ id: `foodie-${readyId}`, label: "Foodie palate", payMult: 1.1, xpMult: 1, minutes: 20 });
    setReviews((n) => n + 1);
    setRestaurants([...getRestaurants()]);
    setReadyId(null);
    if (leveled) pushToast("Critic level up!", "info");
    pushToast(`${r?.name} now rated ${newRating.toFixed(1)}★ — foot traffic shifted`, "info");
  };

  const near = restaurants.find((r) => r.id === nearId);

  return (
    <JobChrome meta={CRITIC_META} status={near ? `At ${near.name}` : "Find a restaurant beacon"} onEnd={onEndShift}>
      <StatRow label="Reviews filed" value={reviews} />
      <StatRow label="Critic level" value={jobLevel("critic")} />
      {tastingRef.current && (
        <div className="oj-progress">
          <div style={{ width: `${Math.round(tastePct * 100)}%` }} />
        </div>
      )}
      {near && !tastingRef.current && !readyId && (
        <button className="oj-btn primary" onClick={taste}>
          🍽 Taste the menu · {near.name}
        </button>
      )}
      {readyId && (
        <>
          <div className="oj-hint">Rate {restRef.current.find((x) => x.id === readyId)?.name}:</div>
          <div className="oj-stars">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} onClick={() => rate(s)} aria-label={`${s} stars`}>
                ⭐
              </button>
            ))}
          </div>
        </>
      )}
      <div className="oj-kv">
        {restaurants.map((r) => (
          <Fragment key={r.id}>
            <dt>
              {r.name} <span className="oj-card-tag">{r.cuisine}</span>
            </dt>
            <dd>
              {"★".repeat(Math.round(r.rating))}{"☆".repeat(5 - Math.round(r.rating))}
              <span className="oj-card-tag"> {r.reviews} rev</span>
            </dd>
          </Fragment>
        ))}
      </div>
      <div className="oj-hint">
        Your reviews move real foot traffic — 5★ joints boom, 1★ joints starve. Earned fees: {fmtCity(reviews * 100)}+
      </div>
      <PremiumButton label="Michelin column" />
    </JobChrome>
  );
}
