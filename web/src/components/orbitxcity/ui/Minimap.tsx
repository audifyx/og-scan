import { useEffect, useRef } from "react";
import { NYC_DEMO_BLOCK, STREETS } from "@/lib/orbitxcity/demoBlock";
import { useCity } from "@/pages/orbitxcity/CityProvider";

const SIZE = 148;

/** Tactical minimap — buildings, zones, and live player position. */
export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { playerPos } = useCity();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { bounds } = NYC_DEMO_BLOCK;
    const worldW = bounds.maxX - bounds.minX;
    const worldD = bounds.maxZ - bounds.minZ;
    const sx = SIZE / worldW;
    const sz = SIZE / worldD;
    const toX = (x: number) => (x - bounds.minX) * sx;
    const toY = (z: number) => (z - bounds.minZ) * sz;

    ctx.clearRect(0, 0, SIZE, SIZE);

    // Base
    ctx.fillStyle = "rgba(5, 10, 18, 0.92)";
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Streets from config
    ctx.fillStyle = "rgba(23, 255, 77, 0.12)";
    for (const s of STREETS) {
      if (s.o === "h") {
        ctx.fillRect(toX(s.from), toY(s.at - s.w / 2), (s.to - s.from) * sx, s.w * sz);
      } else {
        ctx.fillRect(toX(s.at - s.w / 2), toY(s.from), s.w * sx, (s.to - s.from) * sz);
      }
    }

    // Buildings
    for (const b of NYC_DEMO_BLOCK.buildings) {
      ctx.fillStyle = `${b.accent}cc`;
      ctx.fillRect(
        toX(b.position.x - b.size.width / 2),
        toY(b.position.z - b.size.depth / 2),
        b.size.width * sx,
        b.size.depth * sz,
      );
    }

    // Interaction zones
    for (const z of NYC_DEMO_BLOCK.zones) {
      ctx.strokeStyle = "rgba(61, 231, 255, 0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(toX(z.position.x), toY(z.position.z), z.radius * sx, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Player blip
    const px = toX(playerPos.x);
    const py = toY(playerPos.z);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(px, py, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(23, 255, 77, 0.9)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.stroke();

    // Frame
    ctx.strokeStyle = "rgba(23, 255, 77, 0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, SIZE - 1, SIZE - 1);
  }, [playerPos]);

  return (
    <div className="oxc-minimap" aria-hidden>
      <canvas ref={canvasRef} width={SIZE} height={SIZE} />
      <span>NYC · DOWNTOWN</span>
    </div>
  );
}
