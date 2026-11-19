/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg:      "#060609",
        panel:   "#101016",
        panel2:  "#14141c",
        line:    "rgba(255, 255, 255, 0.09)",
        accent:  "#60A5FA",
        accent2: "#F0C75E",
        gold:    "#F0C75E",
        term:    "#60A5FA",
        up:      "#34d399",
        down:    "#fb7185",
        muted:   "rgba(255, 255, 255, 0.55)",
        faint:   "rgba(255, 255, 255, 0.32)",
      },
      fontFamily: {
        sans:    ["Manrope", "system-ui", "sans-serif"],
        display: ["Syne", "Manrope", "sans-serif"],
        mono:    ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
