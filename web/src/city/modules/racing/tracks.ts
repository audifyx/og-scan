/**
 * OrbitXCity — RACING MODULE tracks.
 *
 * Builds street circuits from the core city road grid and defines desert
 * rally routes outside the city. The road grid is PASSED IN by the
 * integrator (core's CityData.nodes) so this module stays decoupled —
 * see MODULE.md. Grid nodes are Vec2[][] indexed [i][j].
 */
import type { RallyRoute, StreetCircuit, Vec2 } from "./types";

function at(nodes: Vec2[][], i: number, j: number): Vec2 {
  const n = nodes[i][j];
  return { x: n.x, z: n.z };
}

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function trackLength(wps: Vec2[], loop: boolean): number {
  let d = 0;
  for (let i = 1; i < wps.length; i++) d += dist(wps[i - 1], wps[i]);
  if (loop && wps.length > 1) d += dist(wps[wps.length - 1], wps[0]);
  return d;
}

/**
 * Compute staggered 2-wide start-grid slots just behind the start/finish
 * line (defined by waypoints[0] -> waypoints[1]). Returns world slots for
 * `count` entrants; the player should take slot 0 (back of the pack, GTA style).
 */
export function startGridSlots(circuit: StreetCircuit, count: number): Vec2[] {
  const a = circuit.waypoints[0];
  const b = circuit.waypoints[1] ?? { x: a.x + 1, z: a.z };
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  const fx = dx / len;
  const fz = dz / len;
  // right-hand perpendicular
  const rx = fz;
  const rz = -fx;
  const slots: Vec2[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / 2);
    const side = i % 2 === 0 ? -1 : 1;
    const back = 10 + row * 9; // metres behind the line
    const lateral = side * 3.2;
    slots.push({ x: a.x - fx * back + rx * lateral, z: a.z - fz * back + rz * lateral });
  }
  return slots;
}

/** Heading (radians, atan2 convention) pointing from slot toward waypoint[1]. */
export function startHeading(circuit: StreetCircuit): number {
  const a = circuit.waypoints[0];
  const b = circuit.waypoints[1] ?? { x: a.x + 1, z: a.z };
  return Math.atan2(b.x - a.x, b.z - a.z);
}

/**
 * Build the street-circuit catalogue from the core road grid.
 * Expects nodes[i][j] with i,j in 0..9 (core BLOCKS=9 grid).
 */
export function buildStreetCircuits(nodes: Vec2[][]): StreetCircuit[] {
  const n = (i: number, j: number) => at(nodes, i, j);
  const R = 14; // checkpoint radius on city streets

  // Perimeter loop — the big one, full city block ring.
  const perimeter: Vec2[] = [];
  for (let i = 0; i <= 9; i++) perimeter.push(n(i, 0));
  for (let j = 1; j <= 9; j++) perimeter.push(n(9, j));
  for (let i = 8; i >= 0; i--) perimeter.push(n(i, 9));
  for (let j = 8; j >= 1; j--) perimeter.push(n(0, j));

  // Inner ring — tighter, more technical.
  const inner: Vec2[] = [];
  for (let i = 2; i <= 7; i++) inner.push(n(i, 2));
  for (let j = 3; j <= 7; j++) inner.push(n(7, j));
  for (let i = 6; i >= 2; i--) inner.push(n(i, 7));
  for (let j = 6; j >= 3; j--) inner.push(n(2, j));

  // Night market loop — short central loop for quick pink-slip duels.
  const market: Vec2[] = [n(4, 4), n(5, 4), n(5, 5), n(4, 5)];

  // Financial sprint — point-to-point across the north edge.
  const sprint: Vec2[] = [n(0, 0), n(1, 0), n(2, 0), n(3, 0), n(4, 0), n(5, 0), n(6, 0), n(7, 0), n(8, 0), n(9, 0)];

  // Harbor run — point-to-point down the east edge with a chicane.
  const harbor: Vec2[] = [n(9, 0), n(9, 1), n(8, 1), n(8, 2), n(9, 2), n(9, 4), n(8, 4), n(8, 6), n(9, 6), n(9, 8), n(9, 9)];

  const mk = (
    id: string, name: string, description: string,
    waypoints: Vec2[], loop: boolean, defaultLaps: number, gridSize: number,
  ): StreetCircuit => ({
    id, name, description, waypoints, loop, defaultLaps,
    checkpointRadius: R, gridSize,
  });

  return [
    mk("downtown-gp", "Downtown GP",
      `Full perimeter of the city grid — ${(trackLength(perimeter, true) / 1000).toFixed(1)} km of high-speed boulevards.`,
      perimeter, true, 2, 8),
    mk("inner-ring", "Inner Ring",
      `Technical ${(trackLength(inner, true) / 1000).toFixed(1)} km loop through the midtown blocks. Late braking wins.`,
      inner, true, 3, 6),
    mk("night-market", "Night Market Circuit",
      "Short neon-lit loop around the market blocks. Perfect for quick duels and pink slips.",
      market, true, 4, 4),
    mk("financial-sprint", "Financial Sprint",
      `Point-to-point ${(trackLength(sprint, false) / 1000).toFixed(1)} km drag down the north boulevard.`,
      sprint, false, 1, 6),
    mk("harbor-run", "Harbor Run",
      "Point-to-point east-edge run with a nasty chicane mid-way.",
      harbor, false, 1, 6),
  ];
}

/** Generate co-driver pace notes from route geometry. */
function makePaceNotes(cps: Vec2[]): string[] {
  const notes: string[] = [];
  const sev = (deg: number) => {
    const a = Math.abs(deg);
    if (a < 15) return "flat";
    if (a < 40) return "4";
    if (a < 75) return "3";
    if (a < 120) return "2";
    return "1 — hairpin";
  };
  for (let i = 1; i < cps.length - 1; i++) {
    const a = cps[i - 1];
    const b = cps[i];
    const c = cps[i + 1];
    const h1 = Math.atan2(b.x - a.x, b.z - a.z);
    const h2 = Math.atan2(c.x - b.x, c.z - b.z);
    let d = ((h2 - h1) * 180) / Math.PI;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    const dir = d > 0 ? "Right" : "Left";
    notes.push(d < 1 && d > -1 ? "Straight — flat out" : `${dir} ${sev(d)}`);
  }
  return notes;
}

/**
 * Desert rally routes. Coordinates are world metres; the city spans
 * roughly ±358 m (core HALF), so these all live out in the west desert
 * flats — clear of the city, the east forest and the north hills.
 * Stage terrain is open sand — checkpoints only, no building colliders.
 */
export function buildRallyRoutes(): RallyRoute[] {
  const routes: { id: string; name: string; description: string; cps: Vec2[] }[] = [
    {
      id: "dust-bowl-dash", name: "Dust Bowl Dash",
      description: "Fast, flowing opener in the west desert flats. Keep it pinned.",
      cps: [
        { x: -420, z: -120 }, { x: -520, z: -180 }, { x: -620, z: -120 },
        { x: -690, z: -200 }, { x: -600, z: -280 }, { x: -480, z: -240 },
      ],
    },
    {
      id: "cactus-run", name: "Cactus Run",
      description: "Tight and twisty through the rock gardens. Precision over power.",
      cps: [
        { x: -430, z: 160 }, { x: -540, z: 260 }, { x: -630, z: 200 },
        { x: -700, z: 320 }, { x: -600, z: 400 }, { x: -480, z: 340 },
        { x: -420, z: 220 },
      ],
    },
    {
      id: "mirage-crossing", name: "Mirage Crossing",
      description: "The long one. Big dunes, blind crests, no mercy.",
      cps: [
        { x: -430, z: -80 }, { x: -580, z: -160 }, { x: -700, z: -120 },
        { x: -660, z: -300 }, { x: -520, z: -420 }, { x: -380, z: -500 },
        { x: -450, z: -340 },
      ],
    },
  ];
  return routes.map((r) => {
    const len = trackLength(r.cps, false);
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      checkpoints: r.cps,
      lengthKm: len / 1000,
      checkpointRadius: 18,
      paceNotes: makePaceNotes(r.cps),
    };
  });
}
