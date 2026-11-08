/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* OrbitX Terminal v2 — black / white / gold / silver.
         * Single accent: gold #e8b84a. Silver #c9d1d9 is the secondary.
         * Up = gold, down = silver (Terminal canon, see web/src/index.css --term-*). */
        bg:      "#050505",
        panel:   "#0a0a0a",
        panel2:  "#101010",
        line:    "rgba(255, 255, 255, 0.08)",
        accent:  "#e8b84a",
        accent2: "#c9d1d9",
        gold:    "#e8b84a",
        term:    "#e8b84a",
        up:      "#e8b84a",
        down:    "#c9d1d9",
        muted:   "rgba(244, 244, 242, 0.55)",
        faint:   "rgba(244, 244, 242, 0.32)",
      },
      fontFamily: {
        sans:    ["Instrument Sans", "system-ui", "sans-serif"],
        display: ["Caveat", "Instrument Sans", "cursive"],
        mono:    ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
