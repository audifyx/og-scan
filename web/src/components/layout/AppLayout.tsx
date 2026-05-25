import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { useTheme } from "@/hooks/useTheme";

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const { customWallpaper } = useTheme();
  return (
    <div className="min-h-screen bg-background text-foreground flex relative">
      {/* Wallpaper layer — very subtle, pushed far back */}
      {customWallpaper && (
        <div
          className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-15"
          style={{ backgroundImage: `url(${customWallpaper})` }}
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-md" />
        </div>
      )}

      {/* Sidebar handles both desktop (always visible) and mobile (hamburger + overlay) */}
      <Sidebar />

      {/* Main content — offset by sidebar width on desktop, bottom padding for mobile nav */}
      <main className="flex-1 lg:ml-[260px] overflow-auto min-h-screen pb-[68px] lg:pb-0 relative z-10">
        {children}
      </main>

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
  );
};
