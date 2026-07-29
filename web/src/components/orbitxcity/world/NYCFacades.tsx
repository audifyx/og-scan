import { useMemo } from "react";
import { Mesh, CanvasTexture, Color } from "three";
import { useThree } from "@react-three/fiber";
import { BuildingDefinition } from "@/lib/orbitxcity/types";

/**
 * Generate a simple procedural brick/stone facade texture for buildings.
 * Avoids external placeholder assets while providing visual detail.
 */
function createFacadeTexture(
  width: number = 512,
  height: number = 512,
  style: "brick" | "limestone" | "glass" = "brick"
): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  if (style === "brick") {
    // Brick pattern with mortar
    const brickW = 64;
    const brickH = 32;
    const mortarColor = "#666666";
    const brickColors = ["#8B4513", "#A0522D", "#964B00"];
    
    ctx.fillStyle = mortarColor;
    ctx.fillRect(0, 0, width, height);
    
    for (let y = 0; y < height; y += brickH + 2) {
      const offset = (Math.floor(y / (brickH + 2)) % 2) * (brickW / 2);
      for (let x = offset; x < width; x += brickW + 2) {
        const colorIndex = Math.floor(Math.random() * brickColors.length);
        ctx.fillStyle = brickColors[colorIndex];
        ctx.fillRect(x, y, brickW, brickH);
        // Add subtle variation
        if (Math.random() > 0.7) {
          ctx.fillStyle = "rgba(0,0,0,0.1)";
          ctx.fillRect(x, y, brickW, brickH);
        }
      }
    }
  } else if (style === "limestone") {
    // Smooth stone blocks with joints
    const blockSize = 80;
    ctx.fillStyle = "#D3D3D3";
    ctx.fillRect(0, 0, width, height);
    
    ctx.strokeStyle = "#999999";
    ctx.lineWidth = 2;
    for (let y = 0; y < height; y += blockSize) {
      for (let x = 0; x < width; x += blockSize) {
        ctx.strokeRect(x, y, blockSize, blockSize);
        // Add subtle shading
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`;
        ctx.fillRect(x, y, blockSize, blockSize);
      }
    }
  } else {
    // Glass/reflective style
    ctx.fillStyle = "#4A90E2";
    ctx.fillRect(0, 0, width, height);
    
    const windowSize = 40;
    ctx.fillStyle = "#87CEEB";
    for (let y = 0; y < height; y += windowSize + 8) {
      for (let x = 0; x < width; x += windowSize + 8) {
        ctx.fillRect(x + 2, y + 2, windowSize, windowSize);
        // Reflection highlight
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.fillRect(x + 4, y + 4, windowSize - 8, windowSize - 8);
        ctx.fillStyle = "#87CEEB";
      }
    }
  }

  const texture = new CanvasTexture(canvas);
  return texture;
}

/**
 * Procedurally render realistic Manhattan-style building facades.
 * Each building gets a unique texture and architectural details.
 */
export function NYCFacades({ buildings }: { buildings: BuildingDefinition[] }) {
  const { scene } = useThree();
  
  const facades = useMemo(() => {
    const textures = new Map<string, CanvasTexture>();
    
    return buildings.map((b, i) => {
      // Assign facade style based on building type/size
      let style: "brick" | "limestone" | "glass" = "brick";
      if (b.kind === "office" || b.size.width > 10) style = "glass";
      else if (b.kind === "shop") style = "limestone";
      else if (Math.random() > 0.5) style = "limestone";
      
      // Reuse or create texture
      let texture = textures.get(b.id);
      if (!texture) {
        texture = createFacadeTexture(512, 512, style);
        textures.set(b.id, texture);
      }

      return (
        <mesh key={b.id} position={[b.position.x + b.size.width / 2, b.size.height / 2, b.position.z + b.size.depth / 2]}>
          {/* Main facade */}
          <boxGeometry args={[b.size.width, b.size.height, b.size.depth]} />
          <meshStandardMaterial map={texture} roughness={0.6} metalness={style === "glass" ? 0.7 : 0.1} />
        </mesh>
      );
    });
  }, [buildings]);

  return <>{facades}</>;
}

export default NYCFacades;
