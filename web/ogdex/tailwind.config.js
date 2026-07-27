/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // OrbitX DEX · Solana purple / green launchpad system
        bg:      "#07040f",
        panel:   "#0d0a16",
        panel2:  "#14101f",
        line:    "#2a2140",
        accent:  "#14F195",  // Solana green
        accent2: "#9945FF",  // Solana purple
        gold:    "#F0B429",
        term:    "#14F195",
        up:      "#14F195",
        down:    "#FF4D6D",
        muted:   "#9AA3B5",
        faint:   "#66707E",
      },
      fontFamily: {
        sans:    ["Space Grotesk", "JetBrains Mono", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "JetBrains Mono", "sans-serif"],
        mono:    ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      backgroundImage: {
        "glass":        "linear-gradient(145deg, rgba(153,69,255,0.08), rgba(20,241,149,0.05))",
        "glass-accent": "linear-gradient(145deg, rgba(20,241,149,0.12), rgba(153,69,255,0.08))",
        "term-grid":    "linear-gradient(rgba(153,69,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(20,241,149,0.04) 1px, transparent 1px)",
      },
      boxShadow: {
        "glow-blue": "0 0 34px -8px rgba(20,241,149,0.5)",
        "glow-gold": "0 0 40px -8px rgba(240,180,41,0.45)",
        "glow-term": "0 0 34px -8px rgba(20,241,149,0.5)",
        "glow-purple": "0 0 34px -8px rgba(153,69,255,0.45)",
      },
    },
  },
  plugins: [],
};
