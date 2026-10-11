/**
 * OrbitX City — branded landmark buildings (ported from R3F components).
 *
 * OrbitXTower: signature downtown landmark — glass tower, pulsing neon crown, OrbitX sign.
 * OrbitXShop: branded retail storefront with pulsing sign band.
 * OrbitXApartment: residential block with balconies and neon trim.
 *
 * Each builder returns { group, tick } — call tick(t) every frame for animations.
 */
import * as THREE from "three";

export interface BrandedBuilding {
  group: THREE.Group;
  tick: (t: number) => void;
  /** footprint for collider (x, z) */
  footprint: [number, number];
  height: number;
}

function std(color: string | number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, ...opts });
}

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Signature OrbitX downtown landmark tower. */
export function buildOrbitXTower(accentColor = "#00f0ff", height = 48): BrandedBuilding {
  const group = new THREE.Group();
  const accent = new THREE.Color(accentColor);

  // Main glass tower
  const tower = box(16, height, 16,
    std("#0a0e17", { metalness: 0.8, roughness: 0.2, transparent: true, opacity: 0.85 }),
    0, height / 2, 0);
  group.add(tower);

  // Glass curtain walls on 4 sides
  for (let i = 0; i < 4; i++) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, height - 2, 15.2),
      new THREE.MeshPhysicalMaterial({
        color: "#88ccff", metalness: 0.1, roughness: 0.05,
        transmission: 0.9, thickness: 0.5, transparent: true,
      })
    );
    const a = (i * Math.PI) / 2;
    wall.position.set(Math.cos(a) * 8.2, height / 2, Math.sin(a) * 8.2);
    wall.rotation.y = -a + Math.PI / 2;
    group.add(wall);
  }

  // Pulsing neon crown
  const neonMat = std(accentColor, { emissive: accent, emissiveIntensity: 1.5, toneMapped: false });
  const crown = box(16.8, 0.6, 16.8, neonMat, 0, height + 0.4, 0);
  group.add(crown);

  // OrbitX sign band
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 3.2),
    std("#001122", { emissive: accent, emissiveIntensity: 0.8, toneMapped: false })
  );
  sign.position.set(0, height * 0.7, 8.4);
  group.add(sign);

  // Base podium
  group.add(box(20, 4, 20, std("#111827", { metalness: 0.6, roughness: 0.3 }), 0, 2, 0));

  // Entrance glow
  group.add(box(6, 6.4, 0.4,
    std("#00ffaa", { emissive: "#00ffaa", emissiveIntensity: 0.4 }), 0, 3.2, 9.6));

  return {
    group,
    tick: (t) => { neonMat.emissiveIntensity = 1.2 + Math.sin(t * 2) * 0.3; },
    footprint: [20, 20],
    height: height + 1,
  };
}

/** Branded OrbitX retail shop. */
export function buildOrbitXShop(accentColor = "#ff00ff"): BrandedBuilding {
  const group = new THREE.Group();
  const accent = new THREE.Color(accentColor);

  // Main box
  group.add(box(6, 4, 4, std("#e5e7eb", { metalness: 0.3, roughness: 0.4 }), 0, 2, 0));
  // Roof slab
  group.add(box(6.2, 0.4, 4.2, std("#1f2937", { metalness: 0.5, roughness: 0.3 }), 0, 4.2, 0));

  // Pulsing sign band
  const signMat = std(accentColor, { emissive: accent, emissiveIntensity: 1.6, toneMapped: false });
  group.add(box(5, 0.6, 0.1, signMat, 0, 3.6, 2.1));

  // Display windows
  const winL = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.4),
    std("#00f0ff", { emissive: "#00f0ff", emissiveIntensity: 0.6, transparent: true, opacity: 0.8 }));
  winL.position.set(-1.8, 1.8, 2.05);
  group.add(winL);
  const winR = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.4),
    std("#a855f7", { emissive: "#a855f7", emissiveIntensity: 0.6, transparent: true, opacity: 0.8 }));
  winR.position.set(1.8, 1.8, 2.05);
  group.add(winR);

  // Door
  group.add(box(1.2, 2, 0.1, std("#0f172a", { metalness: 0.7, roughness: 0.2 }), 0, 1, 2.05));
  // Neon base strip
  group.add(box(6.1, 0.1, 0.05,
    std("#00f0ff", { emissive: "#00f0ff", emissiveIntensity: 1.2, toneMapped: false }), 0, 0.15, 2.05));

  return {
    group,
    tick: (t) => { signMat.emissiveIntensity = 1.4 + Math.sin(t * 3) * 0.4; },
    footprint: [6.2, 4.2],
    height: 4.4,
  };
}

/** OrbitX apartment block with balconies. */
export function buildOrbitXApartment(floors = 8, accentColor = "#a855f7"): BrandedBuilding {
  const group = new THREE.Group();
  const height = floors * 4.8; // scaled up from R3F (1.2/floor was tiny)
  const accent = new THREE.Color(accentColor);

  // Main slab
  group.add(box(20, height, 20, std("#374151", { metalness: 0.4, roughness: 0.5 }), 0, height / 2, 0));

  for (let i = 0; i < floors; i++) {
    const y = 2.4 + i * 4.8;
    // Balcony slab
    group.add(box(18.4, 0.4, 3.2, std("#1f2937"), 0, y, 9.6));
    // Neon rail strip
    group.add(box(17.6, 0.2, 0.2,
      std(accentColor, { emissive: accent, emissiveIntensity: 1.1, toneMapped: false }), 0, y + 1.2, 11));
    // Window band
    const win = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.8),
      std("#bfdbfe", { emissive: "#60a5fa", emissiveIntensity: 0.3, transparent: true, opacity: 0.7 }));
    win.position.set(0, y + 0.8, 10.05);
    group.add(win);
  }

  // Rooftop sign
  group.add(box(16, 2.4, 0.8,
    std("#0f172a", { emissive: accent, emissiveIntensity: 0.9, toneMapped: false }), 0, height + 1.6, 0));
  // Entrance canopy
  group.add(box(8, 0.6, 4, std("#111827", { metalness: 0.6, roughness: 0.3 }), 0, 4.8, 10.4));

  const baseY = 0;
  return {
    group,
    tick: (t) => { group.position.y = baseY + Math.sin(t * 0.5) * 0.08; },
    footprint: [20, 20],
    height: height + 3,
  };
}
