/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg:      "#060818",
        panel:   "#0a0f28",
        panel2:  "#0f1535",
        line:    "#1a2a4a",
        accent:  "#14F195",
        accent2: "#9945FF",
        gold:    "#FFD700",
        up:      "#14F195",
        down:    "#FF4D6D",
        muted:   "#8896aa",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        display: ["Space Grotesk", "Inter", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      backgroundImage: {
        "glass":        "linear-gradient(145deg, rgba(20,241,149,0.07), rgba(153,69,255,0.05))",
        "glass-accent": "linear-gradient(145deg, rgba(20,241,149,0.12), rgba(153,69,255,0.08))",
      },
    },
  },
  plugins: [],
};
