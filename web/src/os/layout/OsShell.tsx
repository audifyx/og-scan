import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Compass, Gamepad2, Home, LayoutGrid, Settings, UserRound, Wallet } from "lucide-react";
import { OS_NAV } from "../apps";
import { OxButton } from "../components/primitives";
import { useAuth } from "@/hooks/useAuth";
import "../orbitx-os.css";

const DOCK = [
  { to: "/os", icon: Home, end: true },
  { to: "/os/dashboard", icon: LayoutGrid },
  { to: "/os/trading", icon: Compass },
  { to: "/os/games", icon: Gamepad2 },
  { to: "/os/hub", icon: UserRound },
] as const;

export function OsShell() {
  const { user } = useAuth();
  const loc = useLocation();
  const isLanding = loc.pathname === "/os" || loc.pathname === "/os/";

  return (
    <div className="ox-os">
      <div className="ox-os__stars" aria-hidden />
      <div className="ox-os__grid" aria-hidden />

      <div className="ox-os__shell">
        <header className="ox-topbar" style={{ gridColumn: "1 / -1" }}>
          <Link to="/os" className="ox-brand">
            Orbit<span>X</span> OS
          </Link>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <OxButton type="button" variant="ghost" size="sm" onClick={() => (window.location.href = "/Orbitxcity")}>
              Enter City
            </OxButton>
            {user ? (
              <Link to="/os/hub">
                <OxButton type="button" variant="primary" size="sm">
                  <UserRound className="h-3.5 w-3.5" /> Hub
                </OxButton>
              </Link>
            ) : (
              <Link to="/os/login">
                <OxButton type="button" variant="primary" size="sm">
                  <Wallet className="h-3.5 w-3.5" /> Connect
                </OxButton>
              </Link>
            )}
          </div>
        </header>

        {!isLanding && (
          <aside className="ox-side" aria-label="OrbitX OS navigation">
            <div className="ox-kicker" style={{ padding: "0.35rem 0.75rem 0.75rem" }}>
              Navigation
            </div>
            {OS_NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={"end" in item ? item.end : false} data-active={undefined}>
                {({ isActive }) => (
                  <span className="ox-navlink" data-active={isActive} style={{ display: "flex", width: "100%", padding: "0.65rem 0.75rem", borderRadius: 10, color: isActive ? "var(--ox-lime)" : "var(--ox-muted)", background: isActive ? "rgba(23,255,77,0.08)" : "transparent", border: isActive ? "1px solid var(--ox-line)" : "1px solid transparent", fontWeight: 600, fontSize: "0.86rem" }}>
                    {item.label}
                  </span>
                )}
              </NavLink>
            ))}
            <div style={{ marginTop: "auto", padding: "0.75rem" }}>
              <Link to="/os/settings" style={{ display: "flex", alignItems: "center", gap: "0.45rem", color: "var(--ox-muted)", fontSize: "0.85rem" }}>
                <Settings className="h-4 w-4" /> Settings
              </Link>
            </div>
          </aside>
        )}

        <main className="ox-os__main" style={isLanding ? { width: "min(1100px, calc(100% - 2rem))", margin: "0 auto" } : undefined}>
          <Outlet />
        </main>
      </div>

      {!isLanding && (
        <nav className="ox-dock" aria-label="Quick dock">
          {DOCK.map((d) => (
            <NavLink key={d.to} to={d.to} end={"end" in d ? d.end : false}>
              {({ isActive }) => (
                <span data-active={isActive} style={{ width: 44, height: 44, borderRadius: 999, display: "grid", placeItems: "center", color: isActive ? "#041008" : "var(--ox-muted)", background: isActive ? "var(--ox-lime)" : "transparent" }}>
                  <d.icon className="h-4 w-4" />
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
