import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <div className="min-h-screen bg-[#070d14] text-white flex">
      {/* Sidebar handles both desktop (always visible) and mobile (hamburger + overlay) */}
      <Sidebar />

      {/* Main content — offset by sidebar width on desktop */}
      <main className="flex-1 lg:ml-[260px] overflow-auto min-h-screen">
        {children}
      </main>
    </div>
  );
};
