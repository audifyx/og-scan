/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── OrbitX DEX · Terminal / deep-black theme ──
        bg:      "#000000",  // pure black
        panel:   "#04070E",  // near-black surface
        panel2:  "#080D1A",  // raised surface
        line:    "#12203B",  // hairline borders
        accent:  "#2F80FF",  // electric blue (primary)
        accent2: "#9945FF",  // solana purple (secondary)
        gold:    "#FFC53D",  // premium gold
        term:    "#28F0C8",  // terminal cyan-green (data / prompt)
        up:      "#14F195",  // gains
        down:    "#FF4D6D",  // loss
        muted:   "#8FA3C4",  // muted blue-grey text
        faint:   "#5A6B88",  // very muted labels
      },
      fontFamily: {
        sans:    ["Plus Jakarta Sans", "Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        display: ["Space Grotesk", "Sora", "Plus Jakarta Sans", "sans-serif"],
        mono:    ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      letterSpacing: {
        term: "0.02em",
      },
      backgroundImage: {
        "glass":        "linear-gradient(145deg, rgba(47,128,255,0.08), rgba(153,69,255,0.05))",
        "glass-accent": "linear-gradient(145deg, rgba(47,128,255,0.14), rgba(255,197,61,0.06))",
        "term-grid":    "linear-gradient(rgba(47,128,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(47,128,255,0.05) 1px, transparent 1px)",
      },
      boxShadow: {
        "glow-blue": "0 0 40px -8px rgba(47,128,255,0.55)",
        "glow-gold": "0 0 40px -8px rgba(255,197,61,0.45)",
        "glow-term": "0 0 40px -10px rgba(40,240,200,0.5)",
      },
    },
  },
  plugins: [],
};
