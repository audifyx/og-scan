import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { V2WelcomeModal } from "@/components/modals/V2WelcomeModal";
import { V3AnnouncementModal } from "@/components/modals/V3AnnouncementModal";
import { useState, useEffect } from "react";

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const hasSeenV2 = localStorage.getItem("solana-hub-v2-seen");
    if (!hasSeenV2) {
      setShowWelcome(true);
    }
  }, []);

  const handleCloseWelcome = () => {
    localStorage.setItem("solana-hub-v2-seen", "true");
    setShowWelcome(false);
  };

  return (
    <div className="min-h-screen bg-background/80 backdrop-blur-sm flex relative z-10">
      {/* Desktop Sidebar — hidden on mobile since PhoneLayout handles it */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Main Content — no mobile padding since AppView handles chrome */}
      <main className="flex-1 lg:pt-0 lg:pb-0 overflow-auto">
        {children}
      </main>

      {/* V2 Welcome Modal */}
      <V2WelcomeModal open={showWelcome} onOpenChange={handleCloseWelcome} />

      {/* V3 Announcement Modal */}
      <V3AnnouncementModal />
    </div>
  );
};
