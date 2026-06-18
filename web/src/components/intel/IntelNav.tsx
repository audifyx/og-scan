/** Shared sub-navigation for the OG Scan Intelligence section (spec UX/IA). */
import { NavLink } from "react-router-dom";
import { Gauge, Search, Compass, History, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/intel-scan", label: "Scan", icon: Search },
  { to: "/intel-discovery", label: "Discovery", icon: Compass },
  { to: "/intel-history", label: "History", icon: History },
  { to: "/intel-analytics", label: "Analytics", icon: BarChart3 },
] as const;

export function IntelNav() {
  return (
    <nav className="mb-6 flex flex-wrap gap-1 rounded-lg border bg-card/40 p-1">
      <div className="flex items-center gap-1.5 px-2 text-sm font-semibold text-muted-foreground">
        <Gauge className="h-4 w-4" /> OG Intel
      </div>
      {LINKS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )
          }
        >
          <Icon className="h-4 w-4" /> {label}
        </NavLink>
      ))}
    </nav>
  );
}

export default IntelNav;
