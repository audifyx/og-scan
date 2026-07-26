/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg:      "#050505",
        panel:   "#0e0e0e",
        panel2:  "#121212",
        line:    "rgba(192, 198, 210, 0.16)",
        accent:  "#60A5FA",
        accent2: "#F0C75E",
        gold:    "#F0C75E",
        term:    "#60A5FA",
        up:      "#60A5FA",
        down:    "#ff4d6d",
        muted:   "#A8B0BC",
        faint:   "#66707E",
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
