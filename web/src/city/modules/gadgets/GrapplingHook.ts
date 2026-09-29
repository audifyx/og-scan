/**
 * OrbitXCity — Grappling hook traversal gadget.
 *
 * Framework-free three.js controller. The integrator owns the player character:
 * each frame it calls `update(dt, playerPos)` and adds the returned `pull`
 * acceleration to the player's velocity. The controller never moves the player
 * itself — it only renders the rope/hook and computes the pull force.
 *
 * Flow: fire(origin, dir) → raycast against `collidables` → if a hit is found
 * within `maxRange`, the hook head flies to it and latches; while attached the
 * controller emits a pull acceleration toward the anchor and reels the rope in.
 * release() (or arriving within 2.5 m) detaches and starts the cooldown.
 */
import * as THREE from "three";
import { GadgetRuntime } from "./store";
import type { GrappleLifecycle } from "./types";

export interface GrappleAim {
  origin: THREE.Vector3;
  dir: THREE.Vector3;
}

export interface GrappleOptions {
  /** Scene the rope + hook visuals are added to. */
  scene: THREE.Scene;
  /** Meshes the hook can latch onto. Pass building/collider meshes — do NOT pass the whole scene. */
  collidables: THREE.Object3D[];
  maxRange?: number; // default 65 (m)
  fireSpeed?: number; // default 110 (m/s) — hook head travel speed
  pullAccel?: number; // default 34 (m/s²) toward the anchor while attached
  cooldownMs?: number; // default 1200
}

export interface GrappleFrame {
  lifecycle: GrappleLifecycle;
  /** Acceleration (m/s²) for the integrator to add to player velocity. Zero when not attached. */
  pull: THREE.Vector3;
  /** Current anchor in world coords, or null. */
  anchor: THREE.Vector3 | null;
}

const ARRIVE_DIST = 2.5;
const ROPE_SEGMENTS = 14;

export class GrapplingHook {
  private scene: THREE.Scene;
  private collidables: THREE.Object3D[];
  private maxRange: number;
  private fireSpeed: number;
  private pullAccel: number;
  private cooldownMs: number;

  private lifecycle: GrappleLifecycle = "idle";
  private anchor = new THREE.Vector3();
  private headPos = new THREE.Vector3();
  private headFrom = new THREE.Vector3();
  private headTo = new THREE.Vector3();
  private headT = 0;
  private headDur = 0;
  private hasHit = false;
  private cooldownLeft = 0;

  private raycaster = new THREE.Raycaster();
  private ropeGeo = new THREE.BufferGeometry();
  private rope: THREE.Line;
  private headMesh: THREE.Mesh;
  private anchorRing: THREE.Mesh;
  private disposed = false;

  constructor(opts: GrappleOptions) {
    this.scene = opts.scene;
    this.collidables = opts.collidables;
    this.maxRange = opts.maxRange ?? 65;
    this.fireSpeed = opts.fireSpeed ?? 110;
    this.pullAccel = opts.pullAccel ?? 34;
    this.cooldownMs = opts.cooldownMs ?? 1200;

    const positions = new Float32Array((ROPE_SEGMENTS + 1) * 3);
    this.ropeGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.rope = new THREE.Line(
      this.ropeGeo,
      new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.9 }),
    );
    this.rope.frustumCulled = false;
    this.rope.visible = false;

    this.headMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x67e8f9 }),
    );
    this.headMesh.visible = false;

    this.anchorRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.8, 0.08, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.85 }),
    );
    this.anchorRing.visible = false;

    this.scene.add(this.rope, this.headMesh, this.anchorRing);
    this.pushRuntime();
  }

  get state(): GrappleLifecycle {
    return this.lifecycle;
  }

  /** Fire toward `dir` from `origin`. Returns false if on cooldown or mid-flight. */
  fire(origin: THREE.Vector3, dir: THREE.Vector3): boolean {
    if (this.disposed || this.lifecycle === "flying" || this.lifecycle === "cooldown") {
      return false;
    }
    if (this.lifecycle === "attached") {
      this.release();
      return true;
    }
    const ndir = dir.clone().normalize();
    this.raycaster.set(origin, ndir);
    this.raycaster.far = this.maxRange;
    const hits = this.raycaster.intersectObjects(this.collidables, true);

    this.headFrom.copy(origin);
    if (hits.length > 0) {
      this.hasHit = true;
      this.headTo.copy(hits[0].point);
      this.anchor.copy(hits[0].point);
    } else {
      this.hasHit = false;
      this.headTo.copy(origin).addScaledVector(ndir, this.maxRange);
    }
    const dist = this.headFrom.distanceTo(this.headTo);
    this.headDur = Math.max(dist / this.fireSpeed, 0.05);
    this.headT = 0;
    this.headPos.copy(this.headFrom);
    this.lifecycle = "flying";
    this.headMesh.visible = true;
    this.rope.visible = true;
    this.pushRuntime();
    return true;
  }

  /** Detach and start cooldown. Safe to call in any state. */
  release() {
    if (this.disposed) return;
    if (this.lifecycle === "attached" || this.lifecycle === "flying") {
      this.lifecycle = "cooldown";
      this.cooldownLeft = this.cooldownMs / 1000;
      this.headMesh.visible = false;
      this.anchorRing.visible = false;
      this.rope.visible = false;
      this.pushRuntime();
    }
  }

  /**
   * Advance the simulation. The integrator passes the player's world position
   * and adds `frame.pull * dt` to the player velocity.
   */
  update(dt: number, playerPos: THREE.Vector3): GrappleFrame {
    const out: GrappleFrame = {
      lifecycle: this.lifecycle,
      pull: new THREE.Vector3(),
      anchor: null,
    };
    if (this.disposed) return out;

    if (this.lifecycle === "cooldown") {
      this.cooldownLeft -= dt;
      if (this.cooldownLeft <= 0) {
        this.lifecycle = "idle";
        this.pushRuntime();
      }
      out.lifecycle = this.lifecycle;
      return out;
    }

    if (this.lifecycle === "flying") {
      this.headT += dt;
      const t = Math.min(this.headT / this.headDur, 1);
      this.headPos.lerpVectors(this.headFrom, this.headTo, t);
      this.drawRope(playerPos, this.headPos, 0);
      this.headMesh.position.copy(this.headPos);
      if (t >= 1) {
        if (this.hasHit) {
          this.lifecycle = "attached";
          this.anchorRing.position.copy(this.anchor);
          this.anchorRing.visible = true;
        } else {
          this.lifecycle = "cooldown";
          this.cooldownLeft = this.cooldownMs / 1000;
          this.rope.visible = false;
          this.headMesh.visible = false;
        }
        this.pushRuntime();
      }
      out.lifecycle = this.lifecycle;
      if (this.lifecycle === "attached") out.anchor = this.anchor.clone();
      return out;
    }

    if (this.lifecycle === "attached") {
      const toAnchor = new THREE.Vector3().subVectors(this.anchor, playerPos);
      const dist = toAnchor.length();
      // Arrived, or anchor went stale (shouldn't happen, but be safe).
      if (dist < ARRIVE_DIST || dist > this.maxRange * 1.75) {
        this.release();
        out.lifecycle = this.lifecycle;
        return out;
      }
      toAnchor.normalize();
      out.pull.copy(toAnchor).multiplyScalar(this.pullAccel);
      out.anchor = this.anchor.clone();
      this.drawRope(playerPos, this.anchor, Math.min(dist * 0.06, 2.5));
      this.headMesh.position.copy(this.anchor);
      this.headMesh.visible = true;
      // Face the ring toward the player for readability.
      this.anchorRing.lookAt(playerPos);
      out.lifecycle = this.lifecycle;
      return out;
    }

    return out;
  }

  private drawRope(from: THREE.Vector3, to: THREE.Vector3, sag: number) {
    const pos = this.ropeGeo.getAttribute("position") as THREE.BufferAttribute;
    const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
    mid.y -= sag;
    const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
    const pts = curve.getPoints(ROPE_SEGMENTS);
    for (let i = 0; i <= ROPE_SEGMENTS; i++) {
      pos.setXYZ(i, pts[i].x, pts[i].y, pts[i].z);
    }
    pos.needsUpdate = true;
    this.rope.visible = true;
  }

  private pushRuntime() {
    GadgetRuntime.setGrapple(
      this.lifecycle,
      this.lifecycle === "attached"
        ? [this.anchor.x, this.anchor.y, this.anchor.z]
        : null,
    );
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.remove(this.rope, this.headMesh, this.anchorRing);
    this.ropeGeo.dispose();
    (this.rope.material as THREE.Material).dispose();
    (this.headMesh.material as THREE.Material).dispose();
    (this.anchorRing.material as THREE.Material).dispose();
    this.headMesh.geometry.dispose();
    this.anchorRing.geometry.dispose();
  }
}
