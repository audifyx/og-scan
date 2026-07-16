/**
 * OrbitX Launchpad Terminal
 * Full trading/launch platform with terminal styling
 * Colors: Black (#000), Green (#00ff00/#22c55e), White (#fff), Gold (#ffd700)
 */

import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { TrendingUp, Zap, Plus, Wallet, Menu, X, Home, BarChart3, Briefcase, Rocket } from "lucide-react";

const NAV_ITEMS = [
  { icon: Home, label: "HOME", href: "/terminal" },
  { icon: BarChart3, label: "TRADE", href: "/terminal/trade" },
  { icon: Briefcase, label: "PORTFOLIO", href: "/terminal/portfolio" },
  { icon: Rocket, label: "LAUNCH", href: "/terminal/launch" },
];

export default function LaunchpadTerminal() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      {/* Grid Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_24%,rgba(34,197,94,0.05)_25%,rgba(34,197,94,0.05)_26%,transparent_27%,transparent_74%,rgba(34,197,94,0.05)_75%,rgba(34,197,94,0.05)_76%,transparent_77%,transparent),linear-gradient(90deg,transparent_24%,rgba(34,197,94,0.05)_25%,rgba(34,197,94,0.05)_26%,transparent_27%,transparent_74%,rgba(34,197,94,0.05)_75%,rgba(34,197,94,0.05)_76%,transparent_77%,transparent)] bg-[length:50px_50px]" />
      </div>

      <div className="flex h-screen">
        {/* Sidebar */}
        <nav className={`${sidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 bg-black/80 border-r border-green-500/20 backdrop-blur flex flex-col`}>
          {/* Logo */}
          <div className="p-4 border-b border-green-500/20 flex items-center gap-2">
            <Rocket className="w-6 h-6 text-amber-400" />
            {sidebarOpen && <span className="text-amber-400 font-bold">ORBITX</span>}
          </div>

          {/* Nav Items */}
          <div className="flex-1 space-y-2 p-4">
            {NAV_ITEMS.map(({ icon: Icon, label, href }) => (
              <NavLink
                key={href}
                to={href}
                className={({ isActive }) => `
                  flex items-center gap-3 px-3 py-2 rounded text-sm uppercase tracking-wider transition
                  ${isActive 
                    ? 'bg-green-500/20 text-green-400 border-l-2 border-green-500' 
                    : 'text-gray-400 hover:text-green-400 hover:bg-green-500/10'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                {sidebarOpen && <span>{label}</span>}
              </NavLink>
            ))}
          </div>

          {/* Wallet Button */}
          <div className="p-4 border-t border-green-500/20">
            <button className="w-full flex items-center gap-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 px-3 py-2 rounded text-xs font-bold uppercase transition">
              <Wallet className="w-4 h-4" />
              {sidebarOpen && <span>Connect</span>}
            </button>
          </div>

          {/* Toggle */}
          <div className="p-2 border-t border-green-500/20">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-full p-2 hover:bg-green-500/10 text-green-400 rounded transition"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Top Bar / Header */}
          <header className="border-b border-green-500/20 bg-black/50 backdrop-blur px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-green-400">
                {location.pathname.includes('trade') ? 'TRADE' : 
                 location.pathname.includes('portfolio') ? 'PORTFOLIO' :
                 location.pathname.includes('launch') ? 'LAUNCH' : 'HOME'}
              </h1>
              <p className="text-xs text-gray-500 tracking-wider">Real-time terminal</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right text-xs">
                <div className="text-gray-400">Status</div>
                <div className="text-green-400 font-bold">● LIVE</div>
              </div>
            </div>
          </header>

          {/* Content Area */}
          <div className="flex-1 overflow-auto p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
