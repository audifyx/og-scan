/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── OrbitX DEX v2 · Phosphor terminal: pure black / white / green ──
        bg:      "#000000",  // pure black
        panel:   "#050505",  // flat near-black surface
        panel2:  "#0B0C0C",  // raised surface
        line:    "#1C2320",  // hairline borders (green-tinted grey)
        accent:  "#00FFA3",  // phosphor green (primary)
        accent2: "#00D1FF",  // terminal cyan (secondary)
        gold:    "#FFC53D",  // premium gold
        term:    "#00FFA3",  // alias — terminal green
        up:      "#00FFA3",  // gains
        down:    "#FF5C5C",  // loss
        muted:   "#A8B3C2",  // muted grey text (readable on black)
        faint:   "#66707E",  // very muted labels
      },
      fontFamily: {
        // Mono-first UI — the whole app reads like a terminal.
        sans:    ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        display: ["Space Grotesk", "JetBrains Mono", "sans-serif"],
        mono:    ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      backgroundImage: {
        "glass":        "linear-gradient(145deg, rgba(0,255,163,0.06), rgba(0,209,255,0.04))",
        "glass-accent": "linear-gradient(145deg, rgba(0,255,163,0.10), rgba(255,197,61,0.05))",
        "term-grid":    "linear-gradient(rgba(0,255,163,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,163,0.04) 1px, transparent 1px)",
      },
      boxShadow: {
        "glow-blue": "0 0 34px -8px rgba(0,255,163,0.5)",   /* legacy name, now green */
        "glow-gold": "0 0 40px -8px rgba(255,197,61,0.45)",
        "glow-term": "0 0 34px -8px rgba(0,255,163,0.5)",
      },
    },
  },
  plugins: [],
};
