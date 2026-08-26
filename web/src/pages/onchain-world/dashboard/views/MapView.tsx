import { WORLD_NODES } from "@/pages/onchain-world/lib/orbitx/constants";

export function MapView() {
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-bg-sunken">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgb(139 92 246 / 0.16) 1px, transparent 1px), linear-gradient(90deg, rgb(139 92 246 / 0.16) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        {WORLD_NODES.filter((n) => n.id !== "orbitx").map((node) => (
          <line
            key={node.id}
            x1="50"
            y1="50"
            x2={node.x}
            y2={node.y}
            stroke="var(--color-accent-2)"
            strokeWidth="0.3"
            opacity="0.5"
          />
        ))}
        {WORLD_NODES.map((node) => (
          <g key={node.id}>
            <circle
              cx={node.x}
              cy={node.y}
              r={"hub" in node && node.hub ? 3.2 : 2.1}
              fill={"hub" in node && node.hub ? "var(--color-accent-2)" : "var(--color-bg-raised)"}
              stroke="var(--color-accent)"
              strokeWidth="0.35"
            />
            <text
              x={node.x}
              y={node.y + 6}
              textAnchor="middle"
              fill="var(--color-fg)"
              fontSize="2.4"
              fontFamily="Oxanium, sans-serif"
            >
              {node.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
