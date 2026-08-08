import { useOrbitAtmosphere } from "@/hooks/useOrbitAtmosphere";

type Props = {
  className?: string;
  compact?: boolean;
};

/** Opens the shared wallpaper / atmosphere picker (same as /app Hub). */
export function PlatformThemeButton({ className = "", compact = false }: Props) {
  const { openTheme, mode } = useOrbitAtmosphere();
  return (
    <button
      type="button"
      className={`ox-theme-btn ${className}`.trim()}
      onClick={openTheme}
      title="Platform theme"
      aria-label="Change platform theme"
    >
      <span aria-hidden>🎨</span>
      {!compact && <span className="ox-theme-btn__label">Theme</span>}
      <span className="ox-theme-btn__mode">{mode}</span>
    </button>
  );
}
