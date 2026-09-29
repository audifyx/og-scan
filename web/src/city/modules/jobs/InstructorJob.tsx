/**
 * Driving instructor — run the checkpoint course, get graded.
 * Hit "Start lesson": 6 gates spawn (gold = next, blue diamonds = route).
 * Drive (or run) through them in order. The clock decides the grade:
 * S ≤ 75s, A ≤ 100s, B ≤ 140s, else C. Payout scales with grade + level.
 * Additive only: proximity checks, no input interception.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { JobMeta, JobProps } from "./types";
import { JobChrome, PremiumButton, StatRow } from "./JobChrome";
import { useWorldTick, dist2, randomNode, clampCity, districtAt, getPlayer } from "./world";
import { makeBeacon, makeDiamond, type Beacon } from "./markers";
import { earnCity, addXp, jobLevel, levelPayScale, pushToast, fmtCity } from "./wallet";

export const INSTRUCTOR_META: JobMeta = {
  id: "instructor",
  name: "Driving Instructor",
  icon: "🚗",
  tagline: "Teach the course. Grade the run.",
  payInfo: "S $400 · A $300 · B $200 · C $100",
  premium: "Pro circuit: timed leaderboard",
  howTo: "Start the lesson, then hit every gate in order (gold beacon = next). The faster the run, the better the grade — and the pay.",
};

const GATE_PAY: Record<string, number> = { S: 400, A: 300, B: 200, C: 100 };
const GATE_RADIUS = 5;

export default function InstructorJob({ api, onEndShift }: JobProps) {
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [gate, setGate] = useState(0);
  const [timer, setTimer] = useState(0);
  const [grade, setGrade] = useState<string | null>(null);
  const [lessons, setLessons] = useState(0);
  const [banner, setBanner] = useState("No lesson in progress");
  const gatesRef = useRef<{ x: number; z: number }[]>([]);
  const beaconRef = useRef<Beacon | null>(null);
  const diamondsRef = useRef<THREE.Mesh[]>([]);
  const gateRef = useRef(0);
  const timeRef = useRef(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const clearCourse = () => {
    beaconRef.current?.dispose();
    beaconRef.current = null;
    diamondsRef.current.forEach((d) => {
      d.parent?.remove(d);
      (d.geometry as THREE.BufferGeometry).dispose();
      (d.material as THREE.Material).dispose();
    });
    diamondsRef.current = [];
    gatesRef.current = [];
  };

  const startLesson = (scene: THREE.Scene) => {
    clearCourse();
    const base = randomNode();
    const offsets = [
      [0, 0],
      [45, 0],
      [80, 25],
      [80, 70],
      [40, 95],
      [0, 70],
    ];
    const gates = offsets.map(([dx, dz]) => clampCity(base.x + dx, base.z + dz, 20));
    gatesRef.current = gates;
    gates.forEach((g) => {
      const d = makeDiamond(0x3a86ff);
      d.position.set(g.x, 2.4, g.z);
      scene.add(d);
      diamondsRef.current.push(d);
    });
    const b = makeBeacon(0xffd23f);
    b.setPos(gates[0].x, gates[0].z);
    scene.add(b.group);
    beaconRef.current = b;
    gateRef.current = 0;
    timeRef.current = 0;
    setGate(0);
    setTimer(0);
    setGrade(null);
    setPhase("running");
    setBanner(`Lesson started in ${districtAt(base.x, base.z)} — hit the gold gate`);
    pushToast("Lesson started — go!", "info");
  };

  useWorldTick(api, (dt, world) => {
    beaconRef.current?.update(dt);
    diamondsRef.current.forEach((d, i) => {
      d.rotation.y += dt * (i === gateRef.current ? 3 : 1);
    });
    if (!world || phaseRef.current !== "running") return;
    timeRef.current += dt;
    setTimer(timeRef.current);
    const p = getPlayer(api);
    if (!p) return;
    const g = gatesRef.current[gateRef.current];
    if (!g) return;
    if (dist2(p.pos.x, p.pos.z, g.x, g.z) < GATE_RADIUS) {
      const next = gateRef.current + 1;
      if (next >= gatesRef.current.length) {
        // finished → grade
        const t = timeRef.current;
        const gr = t <= 75 ? "S" : t <= 100 ? "A" : t <= 140 ? "B" : "C";
        const pay = GATE_PAY[gr] * levelPayScale("instructor");
        const credited = earnCity(pay, `Driving lesson — grade ${gr}`);
        const { leveled } = addXp("instructor", gr === "S" ? 60 : gr === "A" ? 45 : 30);
        setLessons((n) => n + 1);
        setGrade(gr);
        setPhase("done");
        setBanner(
          `Grade ${gr}! ${Math.round(t)}s — ${fmtCity(credited)} earned${leveled ? " · LEVEL UP!" : ""}`,
        );
        clearCourse();
      } else {
        gateRef.current = next;
        setGate(next);
        beaconRef.current?.setPos(gatesRef.current[next].x, gatesRef.current[next].z);
        pushToast(`Gate ${next + 1}/${gatesRef.current.length}`, "info");
      }
    }
  });

  useEffect(() => {
    return () => clearCourse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <JobChrome meta={INSTRUCTOR_META} status={banner} onEnd={onEndShift}>
      <StatRow label="Lessons done" value={lessons} />
      <StatRow label="Instructor level" value={jobLevel("instructor")} />
      {phase === "running" && (
        <>
          <StatRow label="Gate" value={`${gate + 1} / ${gatesRef.current.length}`} />
          <StatRow label="Timer" value={`${Math.round(timer)}s`} accent={timer <= 75} />
        </>
      )}
      {phase === "done" && grade && <StatRow label="Grade" value={grade} accent={grade === "S" || grade === "A"} />}
      {phase !== "running" && (
        <button
          className="oj-btn primary"
          onClick={() => {
            const w = api.getWorld();
            if (w) startLesson(w.sceneRef);
            else pushToast("Open the job while in the city", "warn");
          }}
        >
          🏁 Start lesson
        </button>
      )}
      <div className="oj-hint">
        Gold beacon = next gate, blue diamonds = the route. S ≤ 75s · A ≤ 100s · B ≤ 140s.
      </div>
      <PremiumButton label="Pro circuit" />
    </JobChrome>
  );
}
