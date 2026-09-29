/**
 * Reusable 3D avatar preview: own canvas + renderer, drag-to-rotate,
 * gentle idle spin. Used by the character creator and the shops.
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildAvatar, type AvatarHandle } from "../avatar";
import type { Appearance, OutfitSlot } from "../types";

interface Live {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  avatar: AvatarHandle | null;
  rotY: number;
  time: number;
}

export function AvatarPreview(props: {
  appearance: Appearance;
  outfit: Partial<Record<OutfitSlot, string>>;
  tattoos: string[];
  className?: string;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const liveRef = useRef<Live | null>(null);
  const key = useRef(`${props.appearance.skinToneId}|${props.appearance.hairStyleId}|${props.appearance.hairColorId}|${props.appearance.facialHairId}|${Object.values(props.outfit).join(",")}|${props.tattoos.join(",")}`);
  key.current = `${props.appearance.skinToneId}|${props.appearance.hairStyleId}|${props.appearance.hairColorId}|${props.appearance.facialHairId}|${Object.values(props.outfit).join(",")}|${props.tattoos.join(",")}`;

  // build the scene once
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || liveRef.current) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    camera.position.set(0, 1.32, 3.2);
    camera.lookAt(0, 0.92, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 1.1));
    const light = new THREE.DirectionalLight(0xffffff, 1.7);
    light.position.set(2.5, 4, 3);
    scene.add(light);
    const rim = new THREE.DirectionalLight(0x14c8b4, 1.0);
    rim.position.set(-3, 2, -2);
    scene.add(rim);

    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.8, 32),
      new THREE.MeshBasicMaterial({ color: 0x14c8b4, transparent: true, opacity: 0.09 }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.005;
    scene.add(disc);

    const live: Live = { renderer, scene, camera, avatar: null, rotY: 0, time: 0 };
    liveRef.current = live;

    let raf = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      live.time += dt;
      if (live.avatar) {
        live.avatar.group.rotation.y = live.rotY + live.time * 0.22;
        live.avatar.update(dt, 0);
      }
      renderer.render(scene, camera);
    };

    const resize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (w < 2 || h < 2) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(mount);
    resize();
    animate();

    let dragging = false, lastX = 0;
    const down = (e: PointerEvent) => { dragging = true; lastX = e.clientX; };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      live.rotY += (e.clientX - lastX) * 0.012;
      lastX = e.clientX;
    };
    const up = () => { dragging = false; };
    const cv = renderer.domElement;
    cv.style.touchAction = "pan-y";
    cv.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      cv.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      live.avatar?.dispose();
      renderer.dispose();
      if (cv.parentElement === mount) mount.removeChild(cv);
      liveRef.current = null;
    };
  }, []);

  // swap the avatar whenever the look changes
  useEffect(() => {
    const live = liveRef.current;
    if (!live) return;
    const timer = setTimeout(() => {
      const l = liveRef.current;
      if (!l) return;
      l.avatar?.dispose();
      l.avatar = buildAvatar(props.appearance, props.outfit, props.tattoos);
      l.scene.add(l.avatar.group);
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key.current]);

  return (
    <div
      ref={mountRef}
      className={props.className}
      style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}
    />
  );
}
