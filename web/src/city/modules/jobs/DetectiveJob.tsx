/**
 * Detective agency — track rugged paper funds.
 * A fresh case spawns: a rugged fund, three suspects, one money trail.
 * Gather clues at marked locations (beacons), then name the culprit.
 * Correct ID → bounty payout scaled by clues found (thorough work pays).
 * Wrong ID → the trail goes cold, smaller payout for partial work.
 */
import { useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import type { JobMeta, JobProps } from "./types";
import { JobChrome, PremiumButton, StatRow } from "./JobChrome";
import { useWorldTick, dist2, randomSidewalk, districtAt, getPlayer } from "./world";
import { makeBeacon, type Beacon } from "./markers";
import { earnCity, addXp, jobLevel, levelPayScale, pushToast } from "./wallet";

export const DETECTIVE_META: JobMeta = {
  id: "detective",
  name: "Detective Agency",
  icon: "🕵️",
  tagline: "Track rugged funds, name the culprit.",
  payInfo: "Up to $500 CITY per solved case",
  premium: "Forensic lab: instant clue scan",
  howTo: "Take the case, visit the clue beacons, then pick the suspect who matches the trail. More clues = bigger bounty.",
};

const SUSPECTS = [
  { id: "vex", face: "🧔‍♂️", name: "Vex Marlowe", bio: "KOL, promotes every launch" },
  { id: "ora", face: "👩‍🦰", name: "Ora Venn", bio: "Dev, vanished wallets" },
  { id: "kil", face: "🧑‍🎤", name: "Kilo Rane", bio: "Whale, buys every dip" },
];

const CLUE_TEXTS = [
  "CCTV: suspect's van near the drained pool",
  "Burner wallet funded from the LP 12 min before the rug",
  "Discord logs deleted 40 min after mint-out",
  "Receipt: 2,000 SOL worth of GPUs, paid in rugged funds",
];

interface Case {
  fund: string;
  culprit: string;
  clues: { x: number; z: number; text: string; found: boolean }[];
  solved: boolean;
}

const FUNDS = ["NeonPepe LP", "OrbitDoge presale", "MoonVault staking pool", "TacoFi vault"];

export default function DetectiveJob({ api, onEndShift }: JobProps) {
  const [activeCase, setActiveCase] = useState<Case | null>(null);
  const [cases, setCases] = useState(0);
  const beaconsRef = useRef<Beacon[]>([]);
  const caseRef = useRef<Case | null>(null);

  const startCase = (scene: THREE.Scene) => {
    beaconsRef.current.forEach((b) => b.dispose());
    beaconsRef.current = [];
    const fund = FUNDS[Math.floor(Math.random() * FUNDS.length)];
    const culprit = SUSPECTS[Math.floor(Math.random() * SUSPECTS.length)].id;
    const clues = CLUE_TEXTS.map((text) => {
      const s = randomSidewalk();
      const b = makeBeacon(0x8a6bff);
      b.setPos(s.x, s.z);
      scene.add(b.group);
      beaconsRef.current.push(b);
      return { x: s.x, z: s.z, text, found: false };
    });
    const c: Case = { fund, culprit, clues, solved: false };
    caseRef.current = c;
    setActiveCase(c);
    pushToast(`New case: ${fund} was rugged`, "info");
  };

  useWorldTick(api, (dt, world) => {
    beaconsRef.current.forEach((b) => b.update(dt));
    if (!world) return;
    const c = caseRef.current;
    if (!c || c.solved) {
      if (!c && world.sceneRef) startCase(world.sceneRef);
      return;
    }
    const p = getPlayer(api);
    if (!p) return;
    let changed = false;
    c.clues.forEach((cl, i) => {
      if (!cl.found && dist2(p.pos.x, p.pos.z, cl.x, cl.z) < 8) {
        cl.found = true;
        changed = true;
        pushToast(`Clue ${i + 1}: ${cl.text}`, "info");
        addXp("detective", 10);
      }
    });
    if (changed) setActiveCase({ ...c });
  });

  useEffect(() => {
    return () => {
      beaconsRef.current.forEach((b) => b.dispose());
      beaconsRef.current = [];
    };
  }, []);

  const accuse = (id: string) => {
    const c = caseRef.current;
    if (!c || c.solved) return;
    const found = c.clues.filter((x) => x.found).length;
    const s = SUSPECTS.find((x) => x.id === id)!;
    if (id === c.culprit) {
      const bounty = (150 + found * 90) * levelPayScale("detective");
      earnCity(bounty, `Case solved — ${s.name}`);
      addXp("detective", 60);
      setCases((n) => n + 1);
      pushToast(`Case closed! ${s.name} did it.`, "cash");
    } else {
      earnCity(60 * levelPayScale("detective"), "Partial report");
      pushToast(`${s.name} is clean — the trail goes cold`, "warn");
      addXp("detective", 15);
    }
    c.solved = true;
    beaconsRef.current.forEach((b) => b.dispose());
    beaconsRef.current = [];
    setActiveCase(null);
    setTimeout(() => {
      const w = api.getWorld();
      if (w && caseRef.current === null) startCase(w.sceneRef);
      else if (w) startCase(w.sceneRef);
    }, 1200);
  };

  const foundCount = activeCase?.clues.filter((x) => x.found).length ?? 0;

  return (
    <JobChrome
      meta={DETECTIVE_META}
      status={activeCase ? `Case: ${activeCase.fund} · clues ${foundCount}/4` : "Between cases…"}
      onEnd={onEndShift}
    >
      <StatRow label="Cases solved" value={cases} />
      <StatRow label="Detective level" value={jobLevel("detective")} />
      {activeCase && (
        <>
          <div className="oj-hint">
            Rugged fund: <b>{activeCase.fund}</b> — visit the {foundCount < 4 ? "purple" : ""} clue beacons, then accuse.
          </div>
          <div className="oj-lineup">
            {SUSPECTS.map((s) => (
              <div key={s.id} className="oj-suspect" onClick={() => accuse(s.id)}>
                <div className="face">{s.face}</div>
                <div className="nm">{s.name}</div>
                <div className="oj-card-tag">{s.bio}</div>
              </div>
            ))}
          </div>
          <div className="oj-hint">Bounty grows with each clue found (up to +$360).</div>
        </>
      )}
      <PremiumButton label="Forensic lab" />
    </JobChrome>
  );
}
