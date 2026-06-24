/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#000000",
        panel: "#0b0b10",
        panel2: "#16161f",
        line: "#23232e",
        accent: "#22d3a6",
        accent2: "#7c5cff",
        up: "#16c784",
        down: "#ea3943",
        muted: "#9aa1b2",
      },
      fontFamily: { mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"] },
      backgroundImage: {
        "glass": "linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.015))",
        "glass-accent": "linear-gradient(160deg, rgba(34,211,166,0.14), rgba(124,92,255,0.06))",
      },
    },
  },
  plugins: [],
};
