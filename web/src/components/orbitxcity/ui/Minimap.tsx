import { useEffect, useMemo, useRef, useState } from "react";
import { getNearestLandmark, getWorldBlock, getWorldStreets } from "@/lib/orbitxcity/worlds";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { currentObjective } from "@/lib/orbitxcity/missions";
import { useMissionStore } from "@/lib/orbitxcity/missionStore";
import { useGameStore } from "@/lib/orbitxcity/gameStore";
import { getLiveNpcPositions } from "@/components/orbitxcity/world/NPCs";
import { getLiveCarPositions } from "@/components/orbitxcity/world/Traffic";

const SIZE = 148;

/** Tactical minimap — buildings, zones, player, mission, traffic, NPCs, cops. */
export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { playerPos, selectedCityId } = useCity();
  const block = getWorldBlock(selectedCityId);
  const streets = getWorldStreets(selectedCityId);
  const nearest = useMemo(() => getNearestLandmark(block, playerPos), [block, playerPos]);
  const defs = useMissionStore((s) => s.defs);
  const active = useMissionStore((s) => s.active);
  const cops = useGameStore((s) => s.cops);
  const [pulse, setPulse] = useState(0);

  // Pulse tick for the objective marker.
  useEffect(() => {
    const id = setInterval(() => setPulse((p) => p + 1), 600);
    return () => clearInterval(id);
  }, []);

  const activeDef = active ? defs.find((d) => d.id === active.defId) ?? null : null;
  const objective = activeDef && active ? currentObjective(activeDef, active) : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { bounds } = block;
    const worldW = bounds.maxX - bounds.minX;
    const worldD = bounds.maxZ - bounds.minZ;
    const sx = SIZE / worldW;
    const sz = SIZE / worldD;
    const toX = (x: number) => (x - bounds.minX) * sx;
    const toY = (z: number) => (z - bounds.minZ) * sz;

    ctx.clearRect(0, 0, SIZE, SIZE);

    ctx.fillStyle = "rgba(5, 10, 18, 0.92)";
    ctx.fillRect(0, 0, SIZE, SIZE);

    ctx.fillStyle = "rgba(23, 255, 77, 0.12)";
    for (const s of streets) {
      if (s.o === "h") {
        ctx.fillRect(toX(s.from), toY(s.at - s.w / 2), (s.to - s.from) * sx, s.w * sz);
      } else {
        ctx.fillRect(toX(s.at - s.w / 2), toY(s.from), s.w * sx, (s.to - s.from) * sz);
      }
    }

    for (const b of block.buildings) {
      ctx.fillStyle = `${b.accent}cc`;
      ctx.fillRect(
        toX(b.position.x - b.size.width / 2),
        toY(b.position.z - b.size.depth / 2),
        b.size.width * sx,
        b.size.depth * sz,
      );
    }

    for (const z of block.zones) {
      ctx.strokeStyle = "rgba(61, 231, 255, 0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(toX(z.position.x), toY(z.position.z), z.radius * sx, 0, Math.PI * 2);
      ctx.stroke();
    }

    const px = toX(playerPos.x);
    const py = toY(playerPos.z);

    // Mission: start beacons (green) when idle; objective (gold) + guide line when active.
    if (!active) {
      ctx.fillStyle = "#17ff4d";
      for (const d of defs) {
        ctx.beginPath();
        ctx.arc(toX(d.start.x), toY(d.start.z), 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (objective) {
      const ox = toX(objective.x);
      const oy = toY(objective.z);
      ctx.strokeStyle = "rgba(255, 210, 63, 0.75)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(ox, oy);
      ctx.stroke();
      ctx.setLineDash([]);
      const r = 3.4 + (pulse % 2 === 0 ? 1.4 : 0);
      ctx.fillStyle = "#ffd23f";
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-r / 1.4, -r / 1.4, (r * 2) / 1.4, (r * 2) / 1.4);
      ctx.restore();
    }

    // NPCs (white), traffic (orange), cops (red/blue).
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    for (const n of getLiveNpcPositions()) {
      ctx.fillRect(toX(n.x) - 1, toY(n.z) - 1, 2, 2);
    }
    ctx.fillStyle = "rgba(255, 150, 40, 0.9)";
    for (const c of getLiveCarPositions()) {
      ctx.beginPath();
      ctx.arc(toX(c.x), toY(c.z), 2, 0, Math.PI * 2);
      ctx.fill();
    }
    cops.forEach((c, i) => {
      ctx.fillStyle = i % 2 === 0 ? "#ff2d2d" : "#2d7dff";
      ctx.beginPath();
      ctx.arc(toX(c.x), toY(c.z), 2.6, 0, Math.PI * 2);
      ctx.fill();
    });

    // Player.
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(px, py, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(23, 255, 77, 0.9)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(23, 255, 77, 0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, SIZE - 1, SIZE - 1);
  }, [playerPos, block, streets, defs, active, cops, objective, pulse]);

  return (
    <div className="oxc-minimap" aria-hidden>
      <canvas ref={canvasRef} width={SIZE} height={SIZE} />
      <span>
        {nearest.label.toUpperCase()} · {Math.round(nearest.dist)}M
        {objective ? ` · ◆ ${Math.round(Math.hypot(objective.x - playerPos.x, objective.z - playerPos.z))}M` : ""}
      </span>
    </div>
  );
}
