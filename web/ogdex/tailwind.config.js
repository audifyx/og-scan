/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── OG SCAN · Solana black/blue/white/gold theme ──
        bg:      "#000000",  // pure black
        panel:   "#03060F",  // near-pure black with blue tint
        panel2:  "#060C1E",  // dark blue-black
        line:    "#0F1E3A",  // blue border lines
        accent:  "#2F80FF",  // electric blue (primary brand)
        accent2: "#9945FF",  // Solana purple (secondary)
        gold:    "#FFC53D",  // premium gold (highlight)
        up:      "#14F195",  // Solana green — gains
        down:    "#FF4D6D",  // loss
        muted:   "#A0B4D0",  // lighter blue-grey for better white-text contrast
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
