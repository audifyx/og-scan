import { Link, NavLink, Outlet } from "react-router-dom";
import { Crosshair, Gamepad2, Home, Swords, Trophy, Users } from "lucide-react";
import { useEffect } from "react";
import { seedPresence } from "../multiplayer/client";
import { useGameProfile } from "../state/useGameProfile";
import "./gaming.css";

const NAV = [
  { to: "/play", label: "Home", end: true },
  { to: "/play/character", label: "Character" },
  { to: "/play/progression", label: "Progress" },
  { to: "/play/inventory", label: "Gear" },
  { to: "/play/multiplayer", label: "Social" },
  { to: "/play/hud", label: "HUD" },
  { to: "/play/pass", label: "Pass" },
] as const;

const DOCK = [
  { to: "/play", icon: Home, end: true },
  { to: "/play/character", icon: Crosshair },
  { to: "/play/multiplayer", icon: Users },
  { to: "/play/progression", icon: Trophy },
  { to: "/Orbitxcity", icon: Gamepad2 },
] as const;

export function PlayShell() {
  const { profile } = useGameProfile();

  useEffect(() => {
    seedPresence(profile.character.name, "online");
  }, [profile.character.name]);

  return (
    <div className="gx">
      <div className="gx-shell">
        <header className="gx-top">
          <Link to="/play" className="gx-brand">
            Orbit<span>X</span> Play
          </Link>
          <nav className="gx-nav" aria-label="Play navigation">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={"end" in n ? n.end : false}
                style={({ isActive }) => ({
                  padding: "0.45rem 0.75rem",
                  borderRadius: 999,
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: isActive ? "#041008" : "var(--gx-muted)",
                  background: isActive ? "var(--gx-lime)" : "transparent",
                  border: isActive ? "1px solid var(--gx-lime)" : "1px solid transparent",
                  whiteSpace: "nowrap",
                })}
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <Link to="/Orbitxcity" className="gx-btn gx-btn-primary" style={{ padding: "0.45rem 0.8rem", fontSize: "0.78rem" }}>
            <Swords className="h-3.5 w-3.5" /> City
          </Link>
        </header>
        <Outlet />
      </div>

      <nav className="gx-dock" aria-label="Play dock">
        {DOCK.map((d) => (
          <NavLink key={d.to} to={d.to} end={"end" in d ? d.end : false}>
            {({ isActive }) => (
              <span data-active={isActive} style={{ width: 42, height: 42, borderRadius: 999, display: "grid", placeItems: "center", background: isActive ? "var(--gx-lime)" : "transparent", color: isActive ? "#041008" : "var(--gx-muted)" }}>
                <d.icon className="h-4 w-4" />
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
