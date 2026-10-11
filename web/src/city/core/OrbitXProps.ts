/**
 * OrbitX City — KOL characters, neon cars, ad billboards (ported from R3F).
 *
 * KOLCharacter: stylized low-poly humanoid NPCs representing X KOLs.
 * NeonCar: sports car with neon underglow + headlights.
 * AdBillboard: ad billboard with canvas-rendered text (swap text or texture later).
 */
import * as THREE from "three";

export interface KOLDef {
  name: string;
  color: string;
  hat?: boolean;
  mask?: boolean;
  glasses?: boolean;
}

export const KOLS: KOLDef[] = [
  { name: "Ansem", color: "#3b82f6", hat: true },
  { name: "Cupsey", color: "#facc15", mask: true },
  { name: "Orangie", color: "#f97316", glasses: true },
  { name: "Brez", color: "#06b6d4" },
  { name: "TJR", color: "#a855f7", hat: true },
  { name: "Murad", color: "#ef4444" },
  { name: "BonkGuy", color: "#22c55e", hat: true },
  { name: "Decu", color: "#8b5cf6" },
  { name: "Truno", color: "#f43f5e" },
  { name: "Para1lax", color: "#00f0ff", glasses: true },
];

function textSprite(text: string, fontSize = 48): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + 24;
  canvas.width = w;
  canvas.height = fontSize + 24;
  const c2 = canvas.getContext("2d")!;
  c2.font = `bold ${fontSize}px system-ui, sans-serif`;
  c2.textAlign = "center";
  c2.textBaseline = "middle";
  // outline
  c2.strokeStyle = "#000";
  c2.lineWidth = 6;
  c2.strokeText(text, w / 2, (fontSize + 24) / 2);
  c2.fillStyle = "#fff";
  c2.fillText(text, w / 2, (fontSize + 24) / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(w / fontSize * 0.35, 0.35, 1);
  return sprite;
}

export interface KOLNpc {
  group: THREE.Group;
  tick: (t: number) => void;
  def: KOLDef;
}

/** Build a KOL character NPC. */
export function buildKOLCharacter(def: KOLDef): KOLNpc {
  const group = new THREE.Group();
  const baseY = 0;

  // Body (capsule)
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.3, 0.8, 4, 8),
    new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.6 })
  );
  body.position.y = 0.9;
  body.castShadow = true;
  group.add(body);

  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 16, 16),
    new THREE.MeshStandardMaterial({ color: "#f5d0a9", roughness: 0.7 })
  );
  head.position.y = 1.6;
  head.castShadow = true;
  group.add(head);

  // Accessories
  if (def.hat) {
    const hat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.15, 16),
      new THREE.MeshStandardMaterial({ color: "#111111", roughness: 0.8 })
    );
    hat.position.y = 1.85;
    group.add(hat);
  }
  if (def.mask) {
    const mask = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.25, 0.05),
      new THREE.MeshStandardMaterial({ color: "#ffff00", roughness: 0.5 })
    );
    mask.position.set(0, 1.58, 0.15);
    group.add(mask);
  }
  if (def.glasses) {
    const glasses = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.08, 0.02),
      new THREE.MeshStandardMaterial({ color: "#000000", roughness: 0.3 })
    );
    glasses.position.set(0, 1.62, 0.2);
    group.add(glasses);
  }

  // Name label
  const label = textSprite(def.name);
  label.position.y = 2.2;
  group.add(label);

  // Idle bob (phase-offset by x position so they don't sync)
  const phase = Math.random() * Math.PI * 2;
  return {
    group,
    def,
    tick: (t) => { group.position.y = baseY + Math.sin(t * 2 + phase) * 0.05; },
  };
}

/** Build a neon sports car. */
export function buildNeonCar(color = "#ff00ff", accent = "#00f0ff"): THREE.Group {
  const group = new THREE.Group();

  // Body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.5, 3.2),
    new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.2 })
  );
  body.position.y = 0.4;
  body.castShadow = true;
  group.add(body);

  // Cabin
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.4, 1.6),
    new THREE.MeshStandardMaterial({ color: "#111111", metalness: 0.8, roughness: 0.1, transparent: true, opacity: 0.7 })
  );
  cabin.position.set(0, 0.75, -0.2);
  cabin.castShadow = true;
  group.add(cabin);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.2, 16);
  const wheelMat = new THREE.MeshStandardMaterial({ color: "#222222", roughness: 0.9 });
  for (const [x, z] of [[-0.7, 1], [0.7, 1], [-0.7, -1], [0.7, -1]] as const) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(x, 0.2, z);
    wheel.rotation.z = Math.PI / 2;
    wheel.castShadow = true;
    group.add(wheel);
  }

  // Neon underglow
  const glow = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.05, 2.8),
    new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 2, toneMapped: false })
  );
  glow.position.y = 0.1;
  group.add(glow);

  // Headlights
  const lightMat = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#ffffff", emissiveIntensity: 3 });
  for (const x of [-0.4, 0.4]) {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), lightMat);
    light.position.set(x, 0.4, 1.65);
    group.add(light);
  }

  return group;
}

export interface Billboard {
  group: THREE.Group;
  tick: (t: number) => void;
  setText: (text: string) => void;
}

/** Build an ad billboard. Text is canvas-rendered; swap via setText(). */
export function buildAdBillboard(adText = "ORBITX\nYOUR AD HERE", adColor = "#00f0ff", width = 4, height = 2.5): Billboard {
  const group = new THREE.Group();
  const accent = new THREE.Color(adColor);

  // Pole
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 2, 8),
    new THREE.MeshStandardMaterial({ color: "#374151", roughness: 0.6 })
  );
  pole.position.y = 1;
  pole.castShadow = true;
  group.add(pole);

  // Frame
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.3, height + 0.3, 0.15),
    new THREE.MeshStandardMaterial({ color: "#1f2937", metalness: 0.6, roughness: 0.3 })
  );
  frame.position.y = height / 2 + 2;
  frame.castShadow = true;
  group.add(frame);

  // Screen (pulsing glow)
  const screenMat = new THREE.MeshStandardMaterial({
    color: "#0a0e17", emissive: accent, emissiveIntensity: 0.7, toneMapped: false,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(width, height), screenMat);
  screen.position.set(0, height / 2 + 2, 0.08);
  group.add(screen);

  // Text (canvas texture on plane)
  const textCanvas = document.createElement("canvas");
  textCanvas.width = 512;
  textCanvas.height = 320;
  const textTex = new THREE.CanvasTexture(textCanvas);
  textTex.colorSpace = THREE.SRGBColorSpace;
  const textMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width - 0.4, height - 0.4),
    new THREE.MeshBasicMaterial({ map: textTex, transparent: true, toneMapped: false })
  );
  textMesh.position.set(0, height / 2 + 2, 0.12);
  group.add(textMesh);

  function drawText(text: string) {
    const ctx = textCanvas.getContext("2d")!;
    ctx.clearRect(0, 0, 512, 320);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lines = text.split("\n");
    const fs = Math.min(64, 280 / lines.length);
    ctx.font = `bold ${fs}px system-ui, sans-serif`;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 8;
    ctx.fillStyle = "#fff";
    lines.forEach((line, i) => {
      const y = 160 + (i - (lines.length - 1) / 2) * (fs * 1.2);
      ctx.strokeText(line, 256, y);
      ctx.fillText(line, 256, y);
    });
    textTex.needsUpdate = true;
  }
  drawText(adText);

  return {
    group,
    tick: (t) => { screenMat.emissiveIntensity = 0.6 + Math.sin(t * 1.5) * 0.2; },
    setText: drawText,
  };
}
