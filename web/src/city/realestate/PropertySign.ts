/**
 * OrbitX City — Real Estate door plaques.
 *
 * setPropertyOwnerLabel(buildingKey, shortAddr) records the current owner and
 * fires a window event so live world code can react. District/world builders
 * attach the actual 3D plaque with attachPropertySign(scene, buildingKey, x, y, z)
 * (position = just above the building's door). The plaque is a canvas-texture
 * sprite — no geometry rebuilds, safe to call at runtime.
 */

import * as THREE from "three";

/** Window event fired by setPropertyOwnerLabel — world code can subscribe. */
export const PROPERTY_OWNER_EVENT = "oxc:property-owner";

const labels = new Map<string, string>();
const sprites = new Map<string, THREE.Sprite>();

/**
 * Record the owner's short address for a building (e.g. "4x7f…9Q2m").
 * Call after every purchase / listing refresh. Fires PROPERTY_OWNER_EVENT.
 */
export function setPropertyOwnerLabel(buildingKey: string, shortAddr: string): void {
  labels.set(buildingKey, shortAddr);
  try {
    window.dispatchEvent(
      new CustomEvent(PROPERTY_OWNER_EVENT, { detail: { buildingKey, shortAddr } })
    );
  } catch {
    /* non-DOM environment — registry still updated */
  }
}

/** Last recorded owner label for a building, if any. */
export function getPropertyOwnerLabel(buildingKey: string): string | undefined {
  return labels.get(buildingKey);
}

function plaqueTexture(shortAddr: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 160;
  const g = c.getContext("2d")!;
  // dark plaque, gold border
  g.fillStyle = "rgba(8,12,20,0.92)";
  g.fillRect(0, 0, 512, 160);
  g.strokeStyle = "#ffd76a";
  g.lineWidth = 6;
  g.strokeRect(8, 8, 496, 144);
  g.fillStyle = "#8fa3b8";
  g.font = "600 34px system-ui, sans-serif";
  g.textAlign = "center";
  g.fillText("OWNER", 256, 58);
  g.fillStyle = "#ffd76a";
  g.font = "800 52px system-ui, monospace";
  g.fillText(shortAddr, 256, 118);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Attach (or refresh) the owner plaque sprite above a building's door.
 * District code calls this once per building, then again whenever
 * PROPERTY_OWNER_EVENT fires for that key.
 */
export function attachPropertySign(
  scene: THREE.Scene,
  buildingKey: string,
  x: number,
  y: number,
  z: number
): THREE.Sprite | null {
  const label = labels.get(buildingKey);
  if (!label) return null;
  removePropertySign(scene, buildingKey);
  const tex = plaqueTexture(label);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(4.4, 1.375, 1);
  sp.position.set(x, y, z);
  sp.userData.oxcPropertyPlaque = buildingKey;
  scene.add(sp);
  sprites.set(buildingKey, sp);
  return sp;
}

/** Remove a building's plaque (e.g. when the district rebuilds). */
export function removePropertySign(scene: THREE.Scene, buildingKey: string): void {
  const sp = sprites.get(buildingKey);
  if (!sp) return;
  scene.remove(sp);
  const mat = sp.material as THREE.SpriteMaterial;
  mat.map?.dispose();
  mat.dispose();
  sprites.delete(buildingKey);
}
