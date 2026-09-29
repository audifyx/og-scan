/**
 * OrbitXCity — Token scanner intel gadget.
 *
 * Framework-free three.js controller. While active it raycasts from the camera
 * center on a throttle and, when it hits a tagged building, pushes a
 * `ScanHitView` into `GadgetRuntime` for the HUD to render with LIVE token
 * data (price, 24h change, volume, liquidity, market cap).
 *
 * Buildings are tagged with a token mint via `TokenScanner.tag(obj, mint)` or
 * bulk-assigned with `autoAssign(buildings)`. The integrator should pass the
 * city's building meshes (e.g. from `buildCity()`'s group, or the billboard
 * meshes which already carry live quotes).
 */
import * as THREE from "three";
import { GadgetRuntime } from "./store";
import { SCAN_BUILDING_NAMES, SCAN_MINTS, SCAN_SYMBOLS } from "./catalog";
import type { ScanHitView, TokenQuote } from "./types";

export interface ScanHit {
  mint: string;
  symbol: string;
  name: string;
  point: THREE.Vector3;
  distance: number;
}

export interface ScannerOptions {
  scene: THREE.Scene;
  camera: THREE.Camera;
  /** Meshes that can be scanned. Tag them first (see `tag` / `autoAssign`). */
  scannables?: THREE.Object3D[];
  /** Min ms between raycasts. Default 300. */
  scanIntervalMs?: number;
  /** Max scan distance in meters. Default 260. */
  maxDistance?: number;
}

const TAG_MINT = "tokenMint";
const TAG_SYMBOL = "tokenSymbol";
const TAG_NAME = "tokenName";

export class TokenScanner {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private scannables: THREE.Object3D[];
  private scanIntervalMs: number;
  private maxDistance: number;

  private active = false;
  private lastScanAt = 0;
  private lastHit: ScanHit | null = null;
  private prices: Record<string, TokenQuote> = {};
  private raycaster = new THREE.Raycaster();
  private center = new THREE.Vector2(0, 0);
  private marker: THREE.Mesh;
  private markerT = 0;
  private disposed = false;

  constructor(opts: ScannerOptions) {
    this.scene = opts.scene;
    this.camera = opts.camera;
    this.scannables = opts.scannables ?? [];
    this.scanIntervalMs = opts.scanIntervalMs ?? 300;
    this.maxDistance = opts.maxDistance ?? 260;

    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.35, 32),
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthTest: false,
      }),
    );
    this.marker.visible = false;
    this.marker.renderOrder = 999;
    this.scene.add(this.marker);
  }

  /** Tag any object (building mesh/group) with a token mint. Walks up parents at scan time. */
  static tag(obj: THREE.Object3D, mint: string, name?: string) {
    obj.userData[TAG_MINT] = mint;
    obj.userData[TAG_SYMBOL] = SCAN_SYMBOLS[mint] ?? mint.slice(0, 4).toUpperCase();
    obj.userData[TAG_NAME] = name ?? "Tower";
  }

  /**
   * Round-robin assigns the known market mints over `buildings`, giving each a
   * display name. Returns the number of buildings tagged.
   */
  autoAssign(buildings: THREE.Object3D[]): number {
    let n = 0;
    buildings.forEach((b, i) => {
      const mint = SCAN_MINTS[i % SCAN_MINTS.length] as string;
      const name = SCAN_BUILDING_NAMES[i % SCAN_BUILDING_NAMES.length] as string;
      TokenScanner.tag(b, mint, name);
      n++;
    });
    return n;
  }

  setScannables(objs: THREE.Object3D[]) {
    this.scannables = objs;
  }

  /** Live quotes from `useLivePrices` — the HUD feeds these in. */
  setPrices(prices: Record<string, TokenQuote>) {
    this.prices = prices;
  }

  setActive(active: boolean) {
    if (this.disposed || this.active === active) return;
    this.active = active;
    this.lastHit = null;
    this.marker.visible = false;
    GadgetRuntime.setScannerActive(active);
    if (!active) GadgetRuntime.setScanHit(null);
  }

  get isActive(): boolean {
    return this.active;
  }

  /**
   * Call every frame (cheap — raycasts at most every `scanIntervalMs`).
   * Returns the current scan hit, or null.
   */
  update(nowMs: number): ScanHit | null {
    if (this.disposed || !this.active) return this.lastHit;

    // Pulse the marker on the current hit.
    if (this.lastHit) {
      this.markerT += 0.06;
      const s = 1 + Math.sin(this.markerT) * 0.12;
      this.marker.scale.setScalar(s);
      this.marker.lookAt(this.camera.position);
    }

    if (nowMs - this.lastScanAt < this.scanIntervalMs) return this.lastHit;
    this.lastScanAt = nowMs;

    this.raycaster.setFromCamera(this.center, this.camera);
    this.raycaster.far = this.maxDistance;
    const hits = this.raycaster.intersectObjects(this.scannables, true);

    let found: ScanHit | null = null;
    for (const h of hits) {
      const tag = this.findTag(h.object);
      if (tag) {
        found = {
          mint: tag.mint,
          symbol: tag.symbol,
          name: tag.name,
          point: h.point.clone(),
          distance: h.distance,
        };
        break;
      }
    }

    this.lastHit = found;
    if (found) {
      this.marker.position.copy(found.point);
      this.marker.visible = true;
      GadgetRuntime.setScanHit(this.toView(found));
    } else {
      this.marker.visible = false;
      GadgetRuntime.setScanHit(null);
    }
    return found;
  }

  private findTag(obj: THREE.Object3D): { mint: string; symbol: string; name: string } | null {
    let o: THREE.Object3D | null = obj;
    while (o) {
      const mint = o.userData[TAG_MINT] as string | undefined;
      if (mint) {
        return {
          mint,
          symbol: (o.userData[TAG_SYMBOL] as string) ?? "???",
          name: (o.userData[TAG_NAME] as string) ?? "Tower",
        };
      }
      o = o.parent;
    }
    return null;
  }

  private toView(hit: ScanHit): ScanHitView {
    return {
      mint: hit.mint,
      symbol: hit.symbol,
      name: hit.name,
      distance: hit.distance,
      quote: this.prices[hit.mint] ?? null,
      scannedAt: Date.now(),
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.remove(this.marker);
    this.marker.geometry.dispose();
    (this.marker.material as THREE.Material).dispose();
    this.setActive(false);
  }
}
