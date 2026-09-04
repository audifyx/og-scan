import { Link } from "react-router-dom";
import { MAP_CLUSTERS, MAP_EDGES, eduHref, getNode } from "./catalog";

const POS: Record<string, { x: number; y: number }> = {
  hub: { x: 50, y: 50 },
  trade: { x: 18, y: 28 },
  intel: { x: 50, y: 14 },
  launch: { x: 82, y: 28 },
  auto: { x: 18, y: 74 },
  social: { x: 50, y: 86 },
  play: { x: 82, y: 74 },
};

const NODE_POS: Record<string, { x: number; y: number }> = {
  dex: { x: 10, y: 22 },
  scanner: { x: 28, y: 18 },
  forensics: { x: 42, y: 8 },
  wallets: { x: 58, y: 8 },
  smart: { x: 72, y: 16 },
  pad: { x: 90, y: 24 },
  fees: { x: 88, y: 40 },
  tg: { x: 12, y: 62 },
  mcp: { x: 22, y: 84 },
  shop: { x: 36, y: 90 },
  risk: { x: 64, y: 20 },
};

function clusterHref(clusterId: string, nodeId?: string, href?: string) {
  if (nodeId) {
    const n = getNode(nodeId);
    if (n) return eduHref(n);
  }
  return href ?? `/education#${clusterId}`;
}

export default function EcosystemMap() {
  return (
    <div className="ox-edu__map">
      <div className="ox-edu__svgmap" aria-hidden={false}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          {MAP_EDGES.map(([a, b]) => {
            const pa = NODE_POS[a] ?? POS[a];
            const pb = NODE_POS[b] ?? POS[b];
            if (!pa || !pb) return null;
            return <path key={`${a}-${b}`} className="ox-edu__edge" d={`M ${pa.x} ${pa.y} Q 50 50 ${pb.x} ${pb.y}`} />;
          })}
        </svg>
        <div className="ox-edu__node hub" style={{ left: "50%", top: "50%" }}>
          ORBITX
        </div>
        {MAP_CLUSTERS.map((c) => {
          const p = POS[c.id] ?? { x: 50, y: 50 };
          return (
            <Link
              key={c.id}
              className="ox-edu__node"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              to={`/education#${c.id}`}
            >
              {c.label}
            </Link>
          );
        })}
      </div>

      <div className="ox-edu__hub" aria-hidden>
        ORBITX
      </div>
      <div className="ox-edu__clusters mobile-only">
        {MAP_CLUSTERS.map((c) => (
          <details key={c.id} id={c.id} className="ox-edu__collapse">
            <summary>{c.label}</summary>
            {c.nodes.map((n) => (
              <Link key={n.id} to={clusterHref(c.id, n.nodeId, n.href)}>
                {n.label}
              </Link>
            ))}
          </details>
        ))}
      </div>
      <div className="ox-edu__clusters desktop-only" style={{ marginTop: 8 }}>
        {MAP_CLUSTERS.map((c) => (
          <div key={`desk-${c.id}`} className="ox-edu__cluster" id={`desk-${c.id}`}>
            <h4>{c.label}</h4>
            {c.nodes.map((n) => (
              <Link key={n.id} to={clusterHref(c.id, n.nodeId, n.href)}>
                {n.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
