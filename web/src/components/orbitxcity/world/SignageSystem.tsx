import { useMemo } from "react";
import { Html } from "@react-three/drei";
import { BuildingDefinition } from "@/lib/orbitxcity/types";
import { getVenueDefinition } from "@/lib/orbitxcity/venueRegistry";

interface SignConfig {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
}

function getSignConfig(building: BuildingDefinition): SignConfig | null {
  const venue = getVenueDefinition(building);
  if (!venue) return null;

  const configs: Record<string, SignConfig> = {
    meme_market: {
      label: "MEME MARKET",
      color: "#00ff88",
      bgColor: "#001a0d",
      icon: "📊",
    },
    trading_desk: {
      label: "TRADING DESK",
      color: "#00d4ff",
      bgColor: "#001a2e",
      icon: "📈",
    },
    launch_pad: {
      label: "LAUNCH PAD",
      color: "#ff6b9d",
      bgColor: "#2d0010",
      icon: "🚀",
    },
    games_studio: {
      label: "GAMES STUDIO",
      color: "#ffaa00",
      bgColor: "#2d1600",
      icon: "🎮",
    },
    nft_gallery: {
      label: "NFT GALLERY",
      color: "#b366ff",
      bgColor: "#2d0f4d",
      icon: "🎨",
    },
    social_hub: {
      label: "SOCIAL HUB",
      color: "#ff66aa",
      bgColor: "#2d0f1a",
      icon: "👥",
    },
  };

  return configs[venue.id] || null;
}

/**
 * Render storefront signs, posters, and rooftop billboards
 * using procedural text and HTML overlays.
 */
export function SignageSystem({ buildings }: { buildings: BuildingDefinition[] }) {
  const signs = useMemo(() => {
    return buildings
      .filter((b) => b.interaction)
      .map((b) => {
        const config = getSignConfig(b);
        if (!config) return null;

        const cx = b.position.x + b.size.width / 2;
        const cz = b.position.z + b.size.depth / 2;
        const top = b.size.height + 1.5;
        const front = b.position.z + b.size.depth / 2 + 0.2;

        return (
          <group key={`sign-${b.id}`}>
            {/* Rooftop billboard */}
            <Html position={[cx, top, cz]} distanceFactor={1.2} scale={0.12}>
              <div
                style={{
                  background: config.bgColor,
                  border: `2px solid ${config.color}`,
                  color: config.color,
                  padding: "0.5rem 1rem",
                  borderRadius: "4px",
                  textAlign: "center",
                  fontFamily: "monospace",
                  fontSize: "0.9rem",
                  fontWeight: "700",
                  letterSpacing: "0.1em",
                  minWidth: "120px",
                  textShadow: `0 0 10px ${config.color}`,
                  boxShadow: `0 0 20px ${config.color}80`,
                }}
              >
                {config.icon} {config.label}
              </div>
            </Html>

            {/* Storefront window sign */}
            <Html position={[cx, b.size.height * 0.7, front]} distanceFactor={1.5} scale={0.08}>
              <div
                style={{
                  background: "rgba(0,0,0,0.7)",
                  border: `1px solid ${config.color}`,
                  color: config.color,
                  padding: "0.3rem 0.6rem",
                  borderRadius: "2px",
                  textAlign: "center",
                  fontFamily: "monospace",
                  fontSize: "0.7rem",
                  fontWeight: "700",
                  minWidth: "80px",
                  textShadow: `0 0 8px ${config.color}`,
                }}
              >
                {config.icon} ENTER
              </div>
            </Html>
          </group>
        );
      })
      .filter(Boolean);
  }, [buildings]);

  return <group>{signs}</group>;
}

export default SignageSystem;
