import { Orbit, Tv, Terminal, AppWindow, Waves, EyeOff, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TokenTheme {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const THEMES: TokenTheme[] = [
  { id: "orbitx", name: "OrbitX", icon: Orbit },
  { id: "crt", name: "CRT", icon: Tv },
  { id: "bloomberg", name: "Terminal", icon: Terminal },
  { id: "win95", name: "Win95", icon: AppWindow },
  { id: "underwater", name: "Abyss", icon: Waves },
  { id: "redacted", name: "Classified", icon: EyeOff },
  { id: "oled", name: "OLED", icon: Moon },
];

/** Compact horizontal theme picker. */
export function ThemeSwitcher({
  theme,
  setTheme,
}: {
  theme: string;
  setTheme: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {THEMES.map((t) => {
        const active = theme === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition active:scale-95",
              active
                ? "border-teal-300/60 bg-teal-400/20 text-teal-100 shadow-[0_0_12px_rgba(45,212,191,0.3)]"
                : "border-white/10 bg-white/[0.04] text-white/55 hover:border-white/25 hover:text-white/85"
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.name}
          </button>
        );
      })}
    </div>
  );
}

const CSS: Record<string, string> = {
  orbitx: `
[data-theme="orbitx"] { color-scheme: dark; }
`,

  crt: `
[data-theme="crt"] { color-scheme: dark; }
[data-theme="crt"] .token-root { background: #031007; }
[data-theme="crt"] .token-root::after {
  content: ""; position: fixed; inset: 0; z-index: 90; pointer-events: none;
  background: repeating-linear-gradient(0deg, rgba(0,0,0,0.28) 0 1px, transparent 1px 3px);
  animation: crt-flicker 4s infinite;
}
[data-theme="crt"] * { text-shadow: 0 0 6px rgba(74,222,128,0.55); }
[data-theme="crt"] .token-root { filter: sepia(0.35) hue-rotate(70deg) saturate(1.6); }
@keyframes crt-flicker { 0%,100% { opacity: 1; } 48% { opacity: 1; } 50% { opacity: 0.86; } 52% { opacity: 1; } }
`,

  bloomberg: `
[data-theme="bloomberg"] { color-scheme: dark; }
[data-theme="bloomberg"] .token-root { background: #0a0600; }
[data-theme="bloomberg"] .token-root, [data-theme="bloomberg"] .token-root * {
  font-family: ui-monospace, "Cascadia Mono", Menlo, Consolas, monospace;
}
[data-theme="bloomberg"] .token-root { color: #ffb000; }
[data-theme="bloomberg"] [class*="text-teal"], [data-theme="bloomberg"] [class*="text-cyan"],
[data-theme="bloomberg"] [class*="text-sky"], [data-theme="bloomberg"] [class*="text-emerald"] {
  color: #ffb000;
}
[data-theme="bloomberg"] [class*="border-teal"], [data-theme="bloomberg"] [class*="bg-teal"] {
  border-color: rgba(255,176,0,0.4);
}
[data-theme="bloomberg"] ::selection { background: #ffb000; color: #000; }
`,

  win95: `
[data-theme="win95"] { color-scheme: light; }
[data-theme="win95"] .token-root { background: #008080; }
[data-theme="win95"] .token-root [class*="rounded-3xl"], [data-theme="win95"] .token-root [class*="rounded-2xl"],
[data-theme="win95"] .token-root [class*="rounded-xl"] {
  border-radius: 0; border: 2px solid;
  border-color: #ffffff #808080 #808080 #ffffff;
  box-shadow: inset -1px -1px #0a0a0a, inset 1px 1px #dfdfdf;
  background: #c0c0c0; color: #111;
}
[data-theme="win95"] .token-root [class*="rounded-full"] { border-radius: 0; }
[data-theme="win95"] .token-root button { border: 2px solid; border-color: #fff #808080 #808080 #fff; background: #c0c0c0; color: #111; }
[data-theme="win95"] .token-root button:active { border-color: #808080 #fff #fff #808080; }
[data-theme="win95"] .token-root h1, [data-theme="win95"] .token-root h2 {
  background: linear-gradient(90deg, #000080, #1084d0); color: #fff; padding: 2px 8px;
}
`,

  underwater: `
[data-theme="underwater"] { color-scheme: dark; }
[data-theme="underwater"] .token-root { background: linear-gradient(180deg, #02131f 0%, #062a44 60%, #0a3a5c 100%); }
[data-theme="underwater"] .token-root::before {
  content: ""; position: fixed; inset: 0; z-index: 90; pointer-events: none; opacity: 0.5;
  background:
    radial-gradient(circle at 15% 20%, rgba(125,211,252,0.25) 0 3px, transparent 4px),
    radial-gradient(circle at 70% 60%, rgba(125,211,252,0.2) 0 2px, transparent 3px),
    radial-gradient(circle at 40% 80%, rgba(125,211,252,0.22) 0 4px, transparent 5px),
    radial-gradient(circle at 85% 15%, rgba(125,211,252,0.18) 0 2px, transparent 3px);
  animation: bubble-rise 9s linear infinite;
}
[data-theme="underwater"] .token-root [class*="rounded-3xl"], [data-theme="underwater"] .token-root [class*="rounded-2xl"] {
  animation: drift 7s ease-in-out infinite;
  box-shadow: 0 0 24px rgba(56,189,248,0.18);
}
@keyframes bubble-rise { from { transform: translateY(40px); } to { transform: translateY(-40px); } }
@keyframes drift { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
`,

  redacted: `
[data-theme="redacted"] { color-scheme: dark; }
[data-theme="redacted"] .token-root {
  background: #0d0d0f;
  background-image: repeating-linear-gradient(-45deg, transparent 0 14px, rgba(239,68,68,0.05) 14px 15px);
}
[data-theme="redacted"] .token-root::before {
  content: "CLASSIFIED // ORBITX EYES ONLY"; position: fixed; top: 46%; left: 50%; z-index: 90;
  transform: translate(-50%,-50%) rotate(-18deg); pointer-events: none; white-space: nowrap;
  font-size: 15px; font-weight: 900; letter-spacing: 0.35em; color: rgba(239,68,68,0.16);
  border: 3px solid rgba(239,68,68,0.16); padding: 8px 18px;
}
[data-theme="redacted"] .token-root h1, [data-theme="redacted"] .token-root h2 {
  display: inline-block; background: #000; color: #f87171; padding: 0 10px;
  border: 1px solid rgba(239,68,68,0.5);
}
[data-theme="redacted"] .token-root [class*="rounded-3xl"], [data-theme="redacted"] .token-root [class*="rounded-2xl"] {
  border-style: dashed; border-color: rgba(239,68,68,0.35);
}
`,

  oled: `
[data-theme="oled"] { color-scheme: dark; }
[data-theme="oled"] .token-root, [data-theme="oled"] .token-root [class*="bg-\\[\\#04070d\\]"],
[data-theme="oled"] .token-root [class*="bg-black"] { background-color: #000; }
[data-theme="oled"] .token-root [class*="bg-white/"] { background-color: rgba(255,255,255,0.03); }
[data-theme="oled"] .token-root { --tw-shadow: 0 0 0 transparent; }
[data-theme="oled"] .token-root * { box-shadow: none; }
[data-theme="oled"] .token-root [class*="border-white/"] { border-color: rgba(255,255,255,0.14); }
`,
};

/** Injects the active theme's CSS overrides. Parent sets data-theme + .token-root on the page root. */
export function ThemeStyles({ theme }: { theme: string }) {
  const css = CSS[theme] ?? CSS.orbitx;
  return <style>{css}</style>;
}
