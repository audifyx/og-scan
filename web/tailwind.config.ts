import animate from "tailwindcss-animate";
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        display: ["'Space Mono'", "'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      colors: {
        og: {
          ink: "hsl(var(--og-ink))",
          lime: "hsl(var(--og-lime))",
          gold: "hsl(var(--og-gold))",
          cyan: "hsl(var(--og-cyan))",
          blood: "hsl(var(--og-blood))",
          grid: "hsl(var(--og-grid))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        ticker: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "scan-line": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(2000%)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 hsl(var(--og-gold) / 0.45)" },
          "50%": { boxShadow: "0 0 28px 5px hsl(var(--og-gold) / 0.28)" },
        },
        "collector-holo-sweep": {
          "0%": { transform: "translateX(-45%) rotate(8deg)", opacity: "0.18" },
          "45%": { opacity: "0.42" },
          "100%": { transform: "translateX(45%) rotate(8deg)", opacity: "0.18" },
        },
        "collector-pulse-ring": {
          "0%, 100%": { boxShadow: "0 0 0 1px rgb(255 255 255 / 0.14), 0 0 28px -18px hsl(var(--og-cyan))" },
          "50%": { boxShadow: "0 0 0 1px hsl(var(--og-gold) / 0.55), 0 0 42px -14px hsl(var(--og-gold))" },
        },
        flicker: {
          "0%, 19%, 21%, 23%, 25%, 54%, 56%, 100%": { opacity: "1" },
          "20%, 24%, 55%": { opacity: "0.55" },
        },
        blink: {
          "50%": { opacity: "0" },
        },
        "burn-card-in": {
          "0%": { transform: "translateY(-24px) scale(0.92)", opacity: "0" },
          "60%": { transform: "translateY(4px) scale(1.02)", opacity: "1" },
          "100%": { transform: "translateY(0) scale(1)", opacity: "1" },
        },
        "burn-card-out": {
          "0%": { transform: "translateY(0) scale(1)", opacity: "1" },
          "100%": { transform: "translateY(-16px) scale(0.96)", opacity: "0" },
        },
        "burn-ember-rise": {
          "0%": { transform: "translateY(0) translateX(0) scale(1)", opacity: "0.9" },
          "100%": { transform: "translateY(-90px) translateX(var(--ember-drift, 12px)) scale(0.3)", opacity: "0" },
        },
        "burn-glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 1px hsl(var(--og-blood) / 0.5), 0 0 40px -8px hsl(var(--og-blood) / 0.55)" },
          "50%": { boxShadow: "0 0 0 1px hsl(var(--og-gold) / 0.6), 0 0 60px -6px hsl(var(--og-gold) / 0.55)" },
        },
        "burn-ring-expand": {
          "0%": { transform: "scale(0.7)", opacity: "0.6" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 1.6s ease-in-out infinite",
        ticker: "ticker 40s linear infinite",
        "scan-line": "scan-line 3.5s linear infinite",
        "pulse-glow": "pulse-glow 2.4s ease-in-out infinite",
        "collector-holo-sweep": "collector-holo-sweep 7.5s ease-in-out infinite alternate",
        "collector-pulse-ring": "collector-pulse-ring 4.8s ease-in-out infinite",
        flicker: "flicker 6s infinite",
        blink: "blink 1s steps(2) infinite",
        "burn-card-in": "burn-card-in 0.5s cubic-bezier(0.16,1,0.3,1) forwards",
        "burn-card-out": "burn-card-out 0.35s ease-in forwards",
        "burn-ember-rise": "burn-ember-rise 1.6s ease-out infinite",
        "burn-glow-pulse": "burn-glow-pulse 2.2s ease-in-out infinite",
        "burn-ring-expand": "burn-ring-expand 1.8s ease-out infinite",
      },
      boxShadow: {
        og: "0 0 0 1px hsl(var(--og-grid)), 0 0 28px -8px hsl(var(--og-gold) / 0.38)",
        "og-gold": "0 0 0 1px hsl(var(--og-gold) / 0.45), 0 0 28px -10px hsl(var(--og-gold) / 0.52)",
        "og-lime-glow": "0 0 60px -14px hsl(var(--og-gold) / 0.65)",
        "og-cyan-glow": "0 0 60px -14px hsl(var(--og-cyan) / 0.55)",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
