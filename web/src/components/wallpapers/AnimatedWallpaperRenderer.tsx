import { useMemo } from "react";
import type { AnimatedWallpaperPreset } from "@/data/animatedWallpapers";

const keyframes = `
@keyframes wp-float-x {
  0%, 100% { transform: translate3d(var(--wp-x0), var(--wp-y0), var(--wp-z0)) rotateX(var(--wp-rx0)) rotateY(var(--wp-ry0)); }
  50% { transform: translate3d(var(--wp-x1), var(--wp-y1), var(--wp-z1)) rotateX(var(--wp-rx1)) rotateY(var(--wp-ry1)); }
}
@keyframes wp-float-x-alt {
  0%, 100% { transform: translate3d(var(--wp-x0), var(--wp-y0), var(--wp-z0)) rotateY(var(--wp-ry0)) rotateZ(var(--wp-rz0)); }
  50% { transform: translate3d(var(--wp-x1), var(--wp-y1), var(--wp-z1)) rotateY(var(--wp-ry1)) rotateZ(var(--wp-rz1)); }
}
@keyframes wp-spin-slow {
  from { transform: rotateX(0deg) rotateY(0deg); }
  to { transform: rotateX(360deg) rotateY(360deg); }
}
@keyframes wp-spin-reverse {
  from { transform: rotateX(360deg) rotateY(0deg) rotateZ(0deg); }
  to { transform: rotateX(0deg) rotateY(360deg) rotateZ(360deg); }
}
@keyframes wp-pulse-opacity {
  0%, 100% { opacity: var(--wp-op0); }
  50% { opacity: var(--wp-op1); }
}
@keyframes wp-grid-scroll {
  0% { background-position: 0 0; }
  100% { background-position: 0 100%; }
}
`;

function ShapeCube({ color, size, delay }: { color: string; size: number; delay: number }) {
  return (
    <div
      className="absolute rounded-lg border will-change-transform"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${color}44, ${color}11)`,
        borderColor: `${color}66`,
        boxShadow: `0 0 ${size / 4}px ${color}33, inset 0 0 ${size / 6}px ${color}22`,
        animation: `wp-float-x ${18 + delay}s ease-in-out infinite`,
        animationDelay: `${-delay}s`,
        left: "50%",
        top: "50%",
        transform: `translate3d(-50%, -50%, -50%)`,
      }}
    />
  );
}
function ShapePyramid({ color, size, delay }: { color: string; size: number; delay: number }) {
  return (
    <div
      className="absolute will-change-transform"
      style={{
        width: 0,
        height: 0,
        borderLeft: `${size / 2}px solid transparent`,
        borderRight: `${size / 2}px solid transparent`,
        borderBottom: `${size}px solid ${color}44`,
        filter: `drop-shadow(0 0 ${size / 5}px ${color}55)`,
        animation: `wp-float-x-alt ${20 + delay}s ease-in-out infinite`,
        animationDelay: `${-delay}s`,
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      }}
    />
  );
}
function ShapeTorus({ color, size, delay }: { color: string; size: number; delay: number }) {
  return (
    <div
      className="absolute rounded-full border-4 will-change-transform"
      style={{
        width: size,
        height: size,
        borderColor: `${color}66`,
        boxShadow: `0 0 ${size / 3}px ${color}44, inset 0 0 ${size / 4}px ${color}33`,
        animation: `wp-spin-slow ${24 + delay}s linear infinite`,
        animationDelay: `${-delay}s`,
        left: "50%",
        top: "50%",
        marginLeft: -size / 2,
        marginTop: -size / 2,
      }}
    />
  );
}
function ShapeIcosa({ color, size, delay }: { color: string; size: number; delay: number }) {
  return (
    <div
      className="absolute border will-change-transform"
      style={{
        width: size,
        height: size * 1.15,
        borderRadius: "40% 60% 70% 30% / 40% 50% 50% 60%",
        background: `linear-gradient(180deg, ${color}33, transparent)`,
        borderColor: `${color}55`,
        boxShadow: `0 0 ${size / 3}px ${color}33`,
        animation: `wp-spin-reverse ${26 + delay}s linear infinite`,
        animationDelay: `${-delay}s`,
        left: "50%",
        top: "50%",
        marginLeft: -size / 2,
        marginTop: -(size * 1.15) / 2,
      }}
    />
  );
}
function ShapeRing({ color, size, delay }: { color: string; size: number; delay: number }) {
  return (
    <div
      className="absolute rounded-full border-2 will-change-transform"
      style={{
        width: size,
        height: size,
        borderColor: `${color}55`,
        boxShadow: `0 0 ${size / 4}px ${color}22, inset 0 0 ${size / 5}px ${color}11`,
        animation: `wp-spin-slow ${22 + delay}s linear infinite`,
        animationDelay: `${-delay}s`,
        left: "50%",
        top: "50%",
        marginLeft: -size / 2,
        marginTop: -size / 2,
      }}
    />
  );
}
function ShapeSphere({ color, size, delay }: { color: string; size: number; delay: number }) {
  return (
    <div
      className="absolute rounded-full will-change-transform"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 30%, ${color}66, ${color}11)`,
        boxShadow: `0 0 ${size / 2}px ${color}44`,
        animation: `wp-float-x ${16 + delay}s ease-in-out infinite`,
        animationDelay: `${-delay}s`,
        left: "50%",
        top: "50%",
        marginLeft: -size / 2,
        marginTop: -size / 2,
      }}
    />
  );
}

function renderShape(kind: AnimatedWallpaperPreset["config"]["shapes"][0]["kind"], color: string, size: number, delay: number) {
  switch (kind) {
    case "cube": return <ShapeCube key={kind + delay} color={color} size={size} delay={delay} />;
    case "pyramid": return <ShapePyramid key={kind + delay} color={color} size={size} delay={delay} />;
    case "torus": return <ShapeTorus key={kind + delay} color={color} size={size} delay={delay} />;
    case "icosa": return <ShapeIcosa key={kind + delay} color={color} size={size} delay={delay} />;
    case "ring": return <ShapeRing key={kind + delay} color={color} size={size} delay={delay} />;
    case "sphere": return <ShapeSphere key={kind + delay} color={color} size={size} delay={delay} />;
  }
}

function seededRNG(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export const AnimatedWallpaperRenderer = ({ preset }: { preset: AnimatedWallpaperPreset }) => {
  const { config } = preset;
  const rng = useMemo(() => seededRNG(preset.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)), [preset.id]);

  const clouds = useMemo(() => {
    const c: { id: number; color: string; size: number; left: number; top: number; opacity: number; blur: number }[] = [];
    const count = 5;
    for (let i = 0; i < count; i++) {
      const pick = rng();
      const color = pick < 0.5 ? config.primary : pick < 0.8 ? config.secondary : config.accent;
      c.push({
        id: i,
        color,
        size: 40 + rng() * 35,
        left: rng() * 100,
        top: rng() * 100,
        opacity: 0.06 + rng() * 0.1,
        blur: 60 + rng() * 120,
      });
    }
    return c;
  }, [config, rng]);

  const shapes = useMemo(() => {
    const out: { id: number; kind: AnimatedWallpaperPreset["config"]["shapes"][0]["kind"]; color: string; size: number; x: number; y: number; z: number; delay: number; opacity: number }[] = [];
    config.shapes.forEach((group) => {
      for (let i = 0; i < group.count; i++) {
        const pick = rng();
        const color = pick < 0.45 ? config.primary : pick < 0.8 ? config.secondary : config.accent;
        out.push({
          id: out.length,
          kind: group.kind,
          color,
          size: group.size * (0.6 + rng() * 0.8),
          x: (rng() - 0.5) * group.spread * 2,
          y: (rng() - 0.5) * group.spread * 2,
          z: (rng() - 0.5) * group.spread,
          delay: rng() * 20,
          opacity: group.opacity * (0.7 + rng() * 0.3),
        });
      }
    });
    return out;
  }, [config, rng]);

  const gridStyle = config.grid?.show
    ? {
        backgroundImage: `linear-gradient(${config.grid.color}11 1px, transparent 1px), linear-gradient(90deg, ${config.grid.color}11 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
        animation: "wp-grid-scroll 60s linear infinite",
        opacity: config.grid.opacity,
      }
    : undefined;

  return (
    <div
      className="fixed inset-0 z-0 overflow-hidden pointer-events-none"
      style={{ background: config.background }}
    >
      {/* Ambient light orbs */}
      {config.ambientLight && clouds.map((c) => (
        <div
          key={c.id}
          className="absolute rounded-full"
          style={{
            width: c.size * 20,
            height: c.size * 20,
            left: `${c.left}%`,
            top: `${c.top}%`,
            background: `radial-gradient(circle, ${c.color}${Math.round(c.opacity * 255).toString(16).padStart(2, "0")}, transparent 70%)`,
            filter: `blur(${c.blur}px)`,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}

      {/* Animated grid */}
      {gridStyle && (
        <div
          className="absolute inset-0"
          style={{
            ...gridStyle,
            maskImage: "radial-gradient(circle at 50% 50%, rgba(0,0,0,0.8), transparent 70%)",
            WebkitMaskImage: "radial-gradient(circle at 50% 50%, rgba(0,0,0,0.8), transparent 70%)",
          }}
        />
      )}

      {/* CSS keyframes injection */}
      <style>{keyframes}</style>

      {/* 3D scene */}
      <div
        className="absolute inset-0"
        style={{
          perspective: `${config.perspective}px`,
          transformStyle: "preserve-3d",
        }}
      >
        <div
          className="w-full h-full"
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateX(15deg) rotateY(0deg)`,
          }}
        >
          {shapes.map((s) => {
            const style: React.CSSProperties = {
              position: "absolute",
              left: "50%",
              top: "50%",
              marginLeft: 0,
              marginTop: 0,
              opacity: s.opacity,
              transformStyle: "preserve-3d",
              animation: `${18 + s.delay}s ease-in-out infinite`,
              animationName: rng() > 0.5 ? "wp-float-x" : "wp-float-x-alt",
              animationDelay: `${-s.delay}s`,
              "--wp-x0": `${s.x * 0.3}px`,
              "--wp-y0": `${s.y * 0.3}px`,
              "--wp-z0": `${s.z}px`,
              "--wp-x1": `${s.x * -0.3}px`,
              "--wp-y1": `${s.y * -0.3}px`,
              "--wp-z1": `${s.z * -1}px`,
              "--wp-rx0": `${rng() * 40 - 20}deg`,
              "--wp-ry0": `${rng() * 40 - 20}deg`,
              "--wp-rz0": `${rng() * 20 - 10}deg`,
              "--wp-rx1": `${rng() * 40 - 20}deg`,
              "--wp-ry1": `${rng() * 40 - 20}deg`,
              "--wp-rz1": `${rng() * 20 - 10}deg`,
              "--wp-op0": s.opacity,
              "--wp-op1": s.opacity * (0.6 + rng() * 0.4),
            } as React.CSSProperties;
            return (
              <div key={s.id} style={style}>
                {renderShape(s.kind, s.color, s.size, s.delay)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
