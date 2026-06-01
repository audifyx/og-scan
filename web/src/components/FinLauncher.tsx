import { MessageCircle } from "lucide-react";

declare global {
  interface Window {
    Intercom: (...args: unknown[]) => void;
  }
}

/**
 * Custom floating button that opens the Intercom / Fin messenger.
 * Replaces Intercom's default launcher so we control the position.
 * Shown on all screen sizes; positioned above the mobile bottom nav.
 */
export const FinLauncher = () => {
  const openFin = () => {
    if (typeof window.Intercom === "function") {
      window.Intercom("show");
    }
  };

  return (
    <button
      onClick={openFin}
      aria-label="Open support chat"
      className="
        fixed right-4 z-[9999]
        bottom-24 lg:bottom-6
        flex items-center justify-center
        w-14 h-14 rounded-full
        bg-og-red text-white shadow-lg
        hover:bg-og-red/90 active:scale-95
        transition-all duration-150
      "
    >
      <MessageCircle className="w-6 h-6" />
    </button>
  );
};
