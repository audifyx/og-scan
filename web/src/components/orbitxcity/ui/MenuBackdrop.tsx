/**
 * Full-bleed cinematic city backdrop for OrbitX City gate screens.
 * Uses a live 3D skyline — the old /orbitxcity/bg/*.png files were never shipped.
 */
import { TitleBackdrop } from "./TitleBackdrop";

interface MenuBackdropProps {
  cityId?: string;
  /** Extra class for gate-specific intensity. */
  intensity?: "title" | "chamber";
}

export function MenuBackdrop({ cityId = "nyc", intensity = "title" }: MenuBackdropProps) {
  return <TitleBackdrop cityId={cityId} intensity={intensity} />;
}
