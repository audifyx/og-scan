import { NYC_DEMO_BLOCK } from "@/lib/orbitxcity/demoBlock";
import { useCity } from "@/pages/orbitxcity/CityProvider";

const SIZE = 128;

/** Top-down neon minimap of the demo block: buildings, shards, and the player. */
export function Minimap() {
  const { playerPos, collectedShards } = useCity();
  const block = NYC_DEMO_BLOCK;
  const { minX, maxX, minZ, maxZ } = block.bounds;
  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;

  const toX = (x: number) => ((x - minX) / spanX) * SIZE;
  const toY = (z: number) => ((z - minZ) / spanZ) * SIZE;

  const shards = block.shards ?? [];

  return (
    <div className="oxc-minimap" aria-label="City minimap">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <rect x={0} y={0} width={SIZE} height={SIZE} rx={10} fill="#04070f" stroke="#17ff4d55" />
        {/* Streets */}
        <line x1={SIZE / 2} y1={4} x2={SIZE / 2} y2={SIZE - 4} stroke="#17ff4d22" strokeWidth={4} />
        <line x1={4} y1={SIZE / 2} x2={SIZE - 4} y2={SIZE / 2} stroke="#3de7ff22" strokeWidth={4} />

        {block.buildings.map((b) => {
          const w = (b.size.width / spanX) * SIZE;
          const h = (b.size.depth / spanZ) * SIZE;
          return (
            <rect
              key={b.id}
              x={toX(b.position.x) - w / 2}
              y={toY(b.position.z) - h / 2}
              width={w}
              height={h}
              rx={2}
              fill={`${b.accent}33`}
              stroke={b.accent}
              strokeWidth={0.8}
            />
          );
        })}

        {shards.map((s) =>
          collectedShards.has(s.id) ? null : (
            <circle key={s.id} cx={toX(s.position.x)} cy={toY(s.position.z)} r={2.4} fill="#17ff4d">
              <animate attributeName="opacity" values="1;0.3;1" dur="1.4s" repeatCount="indefinite" />
            </circle>
          ),
        )}

        {/* Player */}
        <circle cx={toX(playerPos.x)} cy={toY(playerPos.z)} r={3.6} fill="#ffffff" stroke="#17ff4d" strokeWidth={1.5} />
      </svg>
    </div>
  );
}
