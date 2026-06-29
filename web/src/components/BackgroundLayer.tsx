import brokenGlassBg from "@/assets/broken-glass-bg.jpg";

export const BackgroundLayer = () => {
  const bgImage = brokenGlassBg;

  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      {/* Base wallpaper image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${bgImage})` }}
      />
      {/* Dark blur overlay */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-md" />
      {/* Broken glass SVG overlay */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="glass-crack" x="0" y="0" width="300" height="300" patternUnits="userSpaceOnUse">
            <path d="M150 0 L160 120 L280 80 L200 160 L300 200 L220 230 L280 300 L150 240 L100 300 L120 210 L0 260 L80 170 L0 100 L120 140 L100 30 Z"
              fill="none" stroke="currentColor" strokeWidth="0.5" className="text-foreground"/>
            <path d="M50 50 L150 150 M250 30 L180 120 M80 250 L170 190 M220 280 L200 200"
              fill="none" stroke="currentColor" strokeWidth="0.3" className="text-foreground"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#glass-crack)" />
      </svg>
      {/* Gold gradient accent overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-transparent to-accent/3" />
    </div>
  );
};
