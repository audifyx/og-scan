import { Dashboard } from "./dashboard/Dashboard";
import { useOnChainFeed } from "./useOnChainFeed";

export default function OnChainWorldApp() {
  useOnChainFeed();
  return <Dashboard />;
}
