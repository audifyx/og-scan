import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { buildRig, type CityRig } from "./CityRig";
import { getStyle, STYLES, type StyleId } from "./cityState";

/**
 * SELECT TRADER (board 1): 6 cards in a 2-col grid, each with a LIVE 3D
 * preview (own WebGLRenderer, rig built from parts, slow rotate, rim light).
 * FOX/SUIT get a CSS shimmer sweep; selected card gets cyan/gold ring.
 */

const GOLD: Record<StyleId, boolean> = {
  degen: false, sniper: false, fox: true, visor: false, bomber: false, suit: true,
};
const SHIMMER: Record<StyleId, boolean> = {
  degen: false, sniper: false, fox: true, visor: false, bomber: false, suit: true,
};

interface Preview {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  rig: CityRig;
}

function Card({ id, label, selected, index, canvasRef, onPick }: {
  id: StyleId; label: string; selected: boolean; index: number;
  canvasRef: (el: HTMLCanvasElement | null) => void;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      className={`oxc-card${selected ? " sel" : ""}${GOLD[id] ? " gold" : ""}`}
      style={{ animationDelay: `${index * 70}ms` }}
      onClick={onPick}
      aria-pressed={selected}
    >
      <span className="oxc-card-preview">
        <canvas ref={canvasRef} className="oxc-card-canvas" />
        {SHIMMER[id] && <span className="oxc-shimmer" aria-hidden />}
      </span>
      <span className="oxc-card-divider"><i /></span>
      <span className="oxc-card-name">{label}</span>
    </button>
  );
}

export default function CitySelect({ onLaunch }: { onLaunch: (style: StyleId) => void }) {
  const [selected, setSelected] = useState<StyleId>(() => getStyle());
  const canvasEls = useRef<(HTMLCanvasElement | null)[]>([]);
  const previews = useRef<Preview[]>([]);
  const rafRef = useRef(0);
  const clockRef = useRef(0);
  const lastRef = useRef(0);

  // Build the 6 preview renderers once; one shared rAF drives them all.
  useEffect(() => {
    const built: Preview[] = [];
    STYLES.forEach((s, i) => {
      const canvas = canvasEls.current[i];
      if (!canvas) return;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      const W = 168, H = 200;
      renderer.setSize(W, H, false);
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0x8fb4dd, 0x141821, 0.85));
      const rim = new THREE.DirectionalLight(GOLD[s.id] ? 0xe8a93a : 0x17e6d4, 2.4);
      rim.position.set(0.5, 2.2, -3);
      scene.add(rim);
      const fill = new THREE.DirectionalLight(0xffffff, 0.55);
      fill.position.set(2, 1.6, 2.5);
      scene.add(fill);
      const rig = buildRig(s.id);
      scene.add(rig.group);
      const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 20);
      camera.position.set(0, 1.15, 2.9);
      camera.lookAt(0, 0.92, 0);
      built.push({ renderer, scene, camera, rig });
    });
    previews.current = built;

    lastRef.current = performance.now();
    const tick = (now: number) => {
      rafRef.current = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - lastRef.current) / 1000);
      lastRef.current = now;
      clockRef.current += dt;
      for (const p of previews.current) {
        p.rig.group.rotation.y += dt * 0.55; // slow turntable
        p.rig.update(dt, 0); // idle breathing
        p.renderer.render(p.scene, p.camera);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      for (const p of previews.current) {
        p.rig.dispose();
        p.scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) m.geometry.dispose();
        });
        p.renderer.dispose();
      }
      previews.current = [];
    };
  }, []);

  return (
    <div className="oxc-select">
      <div className="oxc-select-head">
        <div className="oxc-brand"><span className="oxc-brand-x">X</span> Orbit<b>X</b></div>
      </div>
      <h1 className="oxc-select-title"><i /><span>SELECT TRADER</span><i /></h1>
      <p className="oxc-select-sub">CHOOSE YOUR TRADING STYLE</p>
      <div className="oxc-grid">
        {STYLES.map((s, i) => (
          <Card
            key={s.id}
            id={s.id}
            label={s.label}
            index={i}
            selected={selected === s.id}
            canvasRef={(el) => { canvasEls.current[i] = el; }}
            onPick={() => setSelected(s.id)}
          />
        ))}
      </div>
      <button type="button" className="oxc-launch" onClick={() => onLaunch(selected)}>
        <span className="oxc-launch-play" aria-hidden>▶</span> LAUNCH TRADER
      </button>
    </div>
  );
}
