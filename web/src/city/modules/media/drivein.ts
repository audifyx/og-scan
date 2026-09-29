/**
 * MEDIA MODULE — drive-in movie theater.
 *
 * In-world: the integrator places a drive-in lot with buildDriveIn() (additive
 * meshes only — big screen, projector glow, slot markers). The theater controller
 * manages the playlist and "now showing" state.
 *
 * Playback: an HTML overlay video player (DriveInHud). The in-world screen shows
 * an animated "NOW SHOWING" canvas texture while a clip plays.
 *
 * Playlist: community-made clips + trailers. The list is integrator-configured
 * via setPlaylist() (e.g. fetched from a community submissions endpoint);
 * ships with the official OrbitX trailer slot.
 */
import * as THREE from "three";
import type { DriveInSpot, MovieClip } from "./types";

export const DEFAULT_PLAYLIST: MovieClip[] = [
  {
    id: "orbitx-trailer",
    title: "OrbitXCity — Official Trailer",
    by: "OrbitX",
    src: "https://www.orbitx.world/trailer.mp4",
    poster: "https://www.orbitx.world/trailer-poster.jpg",
  },
];

/** Community submissions go here via setPlaylist() — never hardcode mocks. */
let playlist: MovieClip[] = [...DEFAULT_PLAYLIST];
const listeners = new Set<() => void>();

export function setPlaylist(clips: MovieClip[]) {
  playlist = [...clips];
  listeners.forEach((l) => l());
}
export function getPlaylist(): MovieClip[] { return [...playlist]; }
export function addCommunityClip(clip: MovieClip) {
  if (!playlist.some((c) => c.id === clip.id)) { playlist = [...playlist, clip]; listeners.forEach((l) => l()); }
}
export function onPlaylistChange(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }

/** Fallback spot if the integrator doesn't pick a real lot location. */
export const FALLBACK_DRIVE_IN: DriveInSpot = { x: 190, z: 190, heading: Math.PI * 0.75, name: "Starlight Drive-In" };

export interface DriveInBuild {
  group: THREE.Group;
  screenMesh: THREE.Mesh;
  dispose: () => void;
}

function makeNowShowingTexture(title: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 288;
  const g = c.getContext("2d")!;
  g.fillStyle = "#0a0a12"; g.fillRect(0, 0, 512, 288);
  const grad = g.createLinearGradient(0, 0, 0, 288);
  grad.addColorStop(0, "#1b1040"); grad.addColorStop(1, "#0a0a12");
  g.fillStyle = grad; g.fillRect(0, 0, 512, 288);
  g.fillStyle = "#7c5cff"; g.font = "bold 44px system-ui, sans-serif";
  g.textAlign = "center";
  g.fillText("★ NOW SHOWING ★", 256, 110);
  g.fillStyle = "#ffffff"; g.font = "28px system-ui, sans-serif";
  const short = title.length > 30 ? title.slice(0, 29) + "…" : title;
  g.fillText(short, 256, 170);
  g.fillStyle = "#8b8b9e"; g.font = "20px system-ui, sans-serif";
  g.fillText("ORBITXCITY DRIVE-IN", 256, 220);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Build a drive-in lot additively at `spot`. Nothing here touches player control.
 */
export function buildDriveIn(scene: THREE.Scene, spot: DriveInSpot): DriveInBuild {
  const group = new THREE.Group();
  group.position.set(spot.x, 0, spot.z);
  group.rotation.y = spot.heading;
  group.userData.isDriveIn = true;

  // big screen: frame + emissive canvas
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.8 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(34, 20, 1), frameMat);
  frame.position.set(0, 12, 0);
  group.add(frame);
  const screenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(32, 18),
    new THREE.MeshBasicMaterial({ map: makeNowShowingTexture(DEFAULT_PLAYLIST[0].title) }),
  );
  screenMesh.position.set(0, 12, 0.6);
  group.add(screenMesh);

  // support poles
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x33333d, roughness: 0.7 });
  [-12, 12].forEach((x) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 12, 8), poleMat);
    pole.position.set(x, 6, -1);
    group.add(pole);
  });

  // lot surface
  const lot = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 60),
    new THREE.MeshStandardMaterial({ color: 0x15151c, roughness: 0.95 }),
  );
  lot.rotation.x = -Math.PI / 2;
  lot.position.set(0, 0.02, 32);
  group.add(lot);

  // parking slot markers (3 rows x 4)
  const slotMat = new THREE.MeshBasicMaterial({ color: 0x7c5cff, transparent: true, opacity: 0.35 });
  for (let r = 0; r < 3; r++) {
    for (let cI = 0; cI < 4; cI++) {
      const slot = new THREE.Mesh(new THREE.PlaneGeometry(7, 4.5), slotMat);
      slot.rotation.x = -Math.PI / 2;
      slot.position.set((cI - 1.5) * 11, 0.05, 18 + r * 12);
      group.add(slot);
    }
  }

  // projector glow cone
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xbfaaff, transparent: true, opacity: 0.06,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(9, 46, 24, 1, true), glowMat);
  cone.rotation.x = Math.PI / 2 - 0.28;
  cone.position.set(0, 9, 24);
  group.add(cone);

  // marquee light strip on the screen frame
  const stripMat = new THREE.MeshBasicMaterial({ color: 0x7c5cff });
  const strip = new THREE.Mesh(new THREE.BoxGeometry(34.6, 0.35, 0.35), stripMat);
  strip.position.set(0, 22.2, 0.6);
  group.add(strip);

  scene.add(group);

  return {
    group,
    screenMesh,
    dispose() {
      scene.remove(group);
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          (m.geometry as THREE.BufferGeometry).dispose();
          const mat = m.material as THREE.Material | THREE.Material[];
          (Array.isArray(mat) ? mat : [mat]).forEach((mm) => {
            const bm = mm as THREE.MeshBasicMaterial;
            if (bm.map) bm.map.dispose();
            mm.dispose();
          });
        }
      });
    },
  };
}

/** Swap the screen texture to the current clip title. */
export function setNowShowing(build: DriveInBuild, title: string) {
  const mat = build.screenMesh.material as THREE.MeshBasicMaterial;
  const old = mat.map;
  mat.map = makeNowShowingTexture(title);
  mat.needsUpdate = true;
  if (old) old.dispose();
}
