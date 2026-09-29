/**
 * OrbitXCity — Vehicles module: master vehicle + mod catalog.
 *
 * Currency split (per BILLING_CONTRACT.md): everyday cars/bikes buy with
 * paper CITY; premium machines and ALL performance mods burn real ORBITX.
 * Stats are arcade-tuned to feel right against core's CarPhysics
 * (top speed 36 m/s ≈ 130 km/h on the base sedan).
 */
import type { HandlingParams, ModDef, VehicleDef, VehicleKind } from "../types";

export const VEHICLE_DEFS: VehicleDef[] = [
  // --- street cars (paper CITY) ---
  { id: "komodo-s", name: "Komodo S", kind: "sedan", paperPrice: 800, orbitxPrice: 0, topSpeedKmh: 130, accel01: 0.45, handling01: 0.55, seats: 4, fuelType: "gas", fuelCapacity: 55, watercraft: false, submersible: false, tags: ["starter"] },
  { id: "volt-city", name: "Volt City EV", kind: "sedan", paperPrice: 1400, orbitxPrice: 0, topSpeedKmh: 150, accel01: 0.62, handling01: 0.6, seats: 4, fuelType: "electric", fuelCapacity: 60, watercraft: false, submersible: false, tags: ["ev"] },
  { id: "bison-4x4", name: "Bison 4x4", kind: "suv", paperPrice: 2200, orbitxPrice: 0, topSpeedKmh: 140, accel01: 0.5, handling01: 0.5, seats: 5, fuelType: "diesel", fuelCapacity: 80, watercraft: false, submersible: false, tags: ["offroad"] },
  { id: "stingray-gt", name: "Stingray GT", kind: "sports", paperPrice: 4800, orbitxPrice: 0, topSpeedKmh: 210, accel01: 0.78, handling01: 0.8, seats: 2, fuelType: "gas", fuelCapacity: 60, watercraft: false, submersible: false, tags: ["racer"] },
  { id: "juggernaut", name: "Juggernaut", kind: "muscle", paperPrice: 3600, orbitxPrice: 0, topSpeedKmh: 185, accel01: 0.85, handling01: 0.42, seats: 2, fuelType: "gas", fuelCapacity: 70, watercraft: false, submersible: false, tags: ["drag"] },
  { id: "baja-bug", name: "Baja Bug", kind: "suv", paperPrice: 2600, orbitxPrice: 0, topSpeedKmh: 120, accel01: 0.55, handling01: 0.62, seats: 2, fuelType: "gas", fuelCapacity: 65, watercraft: false, submersible: false, tags: ["offroad", "trail"] },
  // --- lowriders (paper base, ORBITX hydraulics in chop shop) ---
  { id: "azteca-low", name: "Azteca Lowrider", kind: "lowrider", paperPrice: 3200, orbitxPrice: 0, topSpeedKmh: 120, accel01: 0.4, handling01: 0.5, seats: 4, fuelType: "gas", fuelCapacity: 60, watercraft: false, submersible: false, tags: ["hydraulics", "show"] },
  { id: "serape-62", name: "Serape '62", kind: "lowrider", paperPrice: 0, orbitxPrice: 12, topSpeedKmh: 135, accel01: 0.45, handling01: 0.52, seats: 4, fuelType: "gas", fuelCapacity: 65, watercraft: false, submersible: false, tags: ["hydraulics", "show", "premium"] },
  // --- two wheels ---
  { id: "coyote-bmx", name: "Coyote BMX", kind: "bmx", paperPrice: 300, orbitxPrice: 0, topSpeedKmh: 45, accel01: 0.5, handling01: 0.95, seats: 1, fuelType: "none", fuelCapacity: 0, watercraft: false, submersible: false, tags: ["trail", "stunt"] },
  { id: "dune-450", name: "Dune 450", kind: "dirtbike", paperPrice: 1500, orbitxPrice: 0, topSpeedKmh: 130, accel01: 0.8, handling01: 0.9, seats: 1, fuelType: "gas", fuelCapacity: 12, watercraft: false, submersible: false, tags: ["trail", "offroad"] },
  { id: "ironhorse", name: "Ironhorse Chopper", kind: "chopper", paperPrice: 2400, orbitxPrice: 0, topSpeedKmh: 160, accel01: 0.7, handling01: 0.68, seats: 2, fuelType: "gas", fuelCapacity: 18, watercraft: false, submersible: false, tags: ["gang"] },
  { id: "warlord", name: "Warlord Bagger", kind: "chopper", paperPrice: 0, orbitxPrice: 9, topSpeedKmh: 175, accel01: 0.75, handling01: 0.7, seats: 2, fuelType: "gas", fuelCapacity: 22, watercraft: false, submersible: false, tags: ["gang", "premium"] },
  // --- watercraft (paper rental fleet + ORBITX yachts) ---
  { id: "spark-jetski", name: "Spark Jet Ski", kind: "jetski", paperPrice: 1200, orbitxPrice: 0, topSpeedKmh: 105, accel01: 0.85, handling01: 0.75, seats: 2, fuelType: "gas", fuelCapacity: 30, watercraft: true, submersible: false, tags: ["marina"] },
  { id: "harbor-28", name: "Harbor 28 Cuddy", kind: "yacht", paperPrice: 9000, orbitxPrice: 0, topSpeedKmh: 70, accel01: 0.35, handling01: 0.45, seats: 6, fuelType: "diesel", fuelCapacity: 300, watercraft: true, submersible: false, tags: ["marina"] },
  { id: "neptune-88", name: "Neptune 88 Superyacht", kind: "yacht", paperPrice: 0, orbitxPrice: 40, topSpeedKmh: 85, accel01: 0.4, handling01: 0.5, seats: 12, fuelType: "diesel", fuelCapacity: 1200, watercraft: true, submersible: false, tags: ["marina", "premium"] },
  // --- submarine ---
  { id: "nautilus-mini", name: "Nautilus Mini-Sub", kind: "submarine", paperPrice: 0, orbitxPrice: 25, topSpeedKmh: 40, accel01: 0.3, handling01: 0.55, seats: 4, fuelType: "electric", fuelCapacity: 200, watercraft: true, submersible: true, tags: ["dive", "premium"] },
];

export function vehicleDef(id: string): VehicleDef {
  const d = VEHICLE_DEFS.find((v) => v.id === id);
  if (!d) throw new Error(`Unknown vehicle def: ${id}`);
  return d;
}

/** Handling tunables the integrator applies to core's CarPhysics per kind. */
export const VEHICLE_HANDLING: Record<VehicleKind, HandlingParams> = {
  sedan:     { maxSpeed: 36, maxReverse: 12, accel: 16, brake: 30, steerMult: 1.0 },
  sports:    { maxSpeed: 58, maxReverse: 14, accel: 24, brake: 34, steerMult: 1.25 },
  muscle:    { maxSpeed: 51, maxReverse: 12, accel: 28, brake: 26, steerMult: 0.8 },
  suv:       { maxSpeed: 39, maxReverse: 12, accel: 17, brake: 28, steerMult: 0.9 },
  lowrider:  { maxSpeed: 33, maxReverse: 10, accel: 13, brake: 26, steerMult: 0.95 },
  bmx:       { maxSpeed: 13, maxReverse: 0,  accel: 9,  brake: 22, steerMult: 1.8 },
  dirtbike:  { maxSpeed: 36, maxReverse: 6,  accel: 26, brake: 30, steerMult: 1.6 },
  chopper:   { maxSpeed: 44, maxReverse: 6,  accel: 22, brake: 28, steerMult: 1.1 },
  jetski:    { maxSpeed: 29, maxReverse: 8,  accel: 20, brake: 14, steerMult: 1.35 },
  yacht:     { maxSpeed: 20, maxReverse: 6,  accel: 8,  brake: 10, steerMult: 0.55 },
  submarine: { maxSpeed: 11, maxReverse: 5,  accel: 6,  brake: 8,  steerMult: 0.8 },
};

/** Chop-shop mod catalog. Performance mods burn ORBITX; cosmetics can be paper. */
export const MOD_DEFS: ModDef[] = [
  { id: "eng-street", name: "Street Engine Tune", slot: "engine", description: "+10% top speed, sharper throttle", orbitxCost: 4, paperCost: 0, effect: { topSpeedMult: 1.1, accelAdd: 0.05 }, fits: ["sedan", "sports", "muscle", "suv", "lowrider", "chopper", "dirtbike"] },
  { id: "eng-race", name: "Race Engine Build", slot: "engine", description: "+25% top speed, aggressive cam", orbitxCost: 10, paperCost: 0, effect: { topSpeedMult: 1.25, accelAdd: 0.1 }, fits: ["sports", "muscle", "chopper", "dirtbike"] },
  { id: "turbo-1", name: "Single Turbo Kit", slot: "turbo", description: "+15% top speed, turbo lag be damned", orbitxCost: 7, paperCost: 0, effect: { topSpeedMult: 1.15, accelAdd: 0.08 }, fits: ["sedan", "sports", "muscle", "suv", "lowrider", "chopper"] },
  { id: "turbo-2", name: "Twin Turbo Kit", slot: "turbo", description: "+30% top speed, anti-lag crackle", orbitxCost: 15, paperCost: 0, effect: { topSpeedMult: 1.3, accelAdd: 0.14 }, fits: ["sports", "muscle"] },
  { id: "tires-sport", name: "Sport Tires", slot: "tires", description: "Grip for days", orbitxCost: 3, paperCost: 0, effect: { handlingAdd: 0.1 }, fits: ["sedan", "sports", "muscle", "suv", "lowrider", "chopper", "dirtbike", "bmx"] },
  { id: "tires-slick", name: "Racing Slicks", slot: "tires", description: "Maximum cornering grip", orbitxCost: 6, paperCost: 0, effect: { handlingAdd: 0.18 }, fits: ["sports", "muscle", "chopper"] },
  { id: "susp-race", name: "Coilover Kit", slot: "suspension", description: "Lowered, planted", orbitxCost: 4, paperCost: 0, effect: { handlingAdd: 0.08 }, fits: ["sedan", "sports", "muscle", "suv", "lowrider"] },
  { id: "armor-1", name: "Light Armor Plating", slot: "armor", description: "Shrugs off fender-benders", orbitxCost: 5, paperCost: 0, effect: { armorAdd: 1 }, fits: ["sedan", "sports", "muscle", "suv", "lowrider", "chopper"] },
  { id: "armor-2", name: "Heavy Armor Plating", slot: "armor", description: "Battering-ram certified", orbitxCost: 11, paperCost: 0, effect: { armorAdd: 2 }, fits: ["suv", "muscle", "sedan"] },
  { id: "hyd-2pump", name: "2-Pump Hydraulics", slot: "hydraulics", description: "Bounce-ready show setup", orbitxCost: 6, paperCost: 0, effect: { bounceAdd: 0.5 }, fits: ["lowrider"] },
  { id: "hyd-4pump", name: "4-Pump Competition Hydraulics", slot: "hydraulics", description: "Hop contest winner material", orbitxCost: 14, paperCost: 0, effect: { bounceAdd: 1.0 }, fits: ["lowrider"] },
  { id: "hull-race", name: "Racing Hull Polish", slot: "hull", description: "+12% water top speed", orbitxCost: 5, paperCost: 0, effect: { topSpeedMult: 1.12 }, fits: ["jetski", "yacht"] },
  { id: "ballast-pro", name: "Pro Ballast System", slot: "ballast", description: "Deeper, faster dives", orbitxCost: 8, paperCost: 0, effect: { topSpeedMult: 1.15, handlingAdd: 0.1 }, fits: ["submarine"] },
  // --- cosmetics (paper CITY, no burn) ---
  { id: "paint-matte", name: "Matte Paint Job", slot: "paint", description: "Fresh matte respray", orbitxCost: 0, paperCost: 400, effect: {}, fits: ["sedan", "sports", "muscle", "suv", "lowrider", "chopper", "dirtbike", "jetski", "yacht"] },
  { id: "paint-chrome", name: "Chrome Paint Job", slot: "paint", description: "Blinding mirror chrome", orbitxCost: 0, paperCost: 900, effect: {}, fits: ["sedan", "sports", "muscle", "suv", "lowrider", "chopper"] },
  { id: "neon-under", name: "Underglow Neon Kit", slot: "neon", description: "Night-cruise underglow", orbitxCost: 0, paperCost: 600, effect: {}, fits: ["sedan", "sports", "muscle", "suv", "lowrider", "chopper", "dirtbike"] },
];

export function modDef(id: string): ModDef {
  const m = MOD_DEFS.find((v) => v.id === id);
  if (!m) throw new Error(`Unknown mod def: ${id}`);
  return m;
}

/** Effective stats of an instance after installed mods (for HUD + physics). */
export function effectiveStats(def: VehicleDef, modIds: string[]): {
  topSpeedKmh: number; accel01: number; handling01: number; armor: number; bounce01: number;
} {
  let top = def.topSpeedKmh, acc = def.accel01, han = def.handling01, armor = 0, bounce = 0;
  for (const id of modIds) {
    const m = MOD_DEFS.find((x) => x.id === id);
    if (!m) continue;
    if (m.effect.topSpeedMult) top *= m.effect.topSpeedMult;
    if (m.effect.accelAdd) acc = Math.min(1, acc + m.effect.accelAdd);
    if (m.effect.handlingAdd) han = Math.min(1, han + m.effect.handlingAdd);
    if (m.effect.armorAdd) armor += m.effect.armorAdd;
    if (m.effect.bounceAdd) bounce = Math.min(1, bounce + m.effect.bounceAdd);
  }
  return { topSpeedKmh: Math.round(top), accel01: acc, handling01: han, armor, bounce01: bounce };
}
