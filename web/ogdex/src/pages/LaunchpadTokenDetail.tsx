import { useParams, Link } from "react-router-dom";
import { ChevronRight, ArrowLeft } from "lucide-react";
import TokenDetail from "./TokenDetail";

/**
 * LaunchpadTokenDetail — wrapper page for individual tokens launched on OrbitX Launchpad.
 * Routes to /launchpad/token/:mint and displays full token detail (charts, holders, buy/sell).
 * Reuses the TokenDetail page component with launchpad-specific breadcrumb/styling.
 */
export default function LaunchpadTokenDetail() {
  const { mint } = useParams<{ mint: string }>();

  if (!mint) {
    return (
      <div className="max-w-[1500px] mx-auto px-4 py-6 text-center space-y-4">
        <p className="text-muted">Token not found</p>
        <Link to="/launchpad" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/15 text-accent hover:bg-accent/25 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Launchpad
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="max-w-[1500px] mx-auto px-4 py-3 flex items-center gap-2 text-sm text-muted">
        <Link to="/launchpad" className="hover:text-white transition-colors">Launchpad</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-white font-semibold">Token Details</span>
      </div>

      {/* Reuse TokenDetail page */}
      <TokenDetail />
    </div>
  );
}
