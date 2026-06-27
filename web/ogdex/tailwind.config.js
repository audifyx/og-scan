/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── OG SCAN · Solana blue/black/white/gold theme ──
        bg:      "#04060E",  // near-black, blue-tinted
        panel:   "#0A1226",
        panel2:  "#0F1A36",
        line:    "#1B2C52",  // blue-steel borders
        accent:  "#2F80FF",  // electric blue (primary brand)
        accent2: "#9945FF",  // Solana purple (secondary)
        gold:    "#FFC53D",  // premium gold (highlight)
        up:      "#14F195",  // Solana green — gains
        down:    "#FF4D6D",  // loss
        muted:   "#8497B8",  // blue-grey
      },
      fontFamily: {
        sans:    ["Plus Jakarta Sans", "Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        display: ["Sora", "Plus Jakarta Sans", "sans-serif"],
        mono:    ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      backgroundImage: {
        "glass":        "linear-gradient(145deg, rgba(47,128,255,0.08), rgba(153,69,255,0.05))",
        "glass-accent": "linear-gradient(145deg, rgba(47,128,255,0.14), rgba(255,197,61,0.06))",
      },
      boxShadow: {
        "glow-blue": "0 0 40px -8px rgba(47,128,255,0.55)",
        "glow-gold": "0 0 40px -8px rgba(255,197,61,0.45)",
      },
    },
  },
  plugins: [],
};
