/**
 * Rescue page — uses the in-app backend-signed wallet via OrbitxWalletHub
 * (provided at the app root). No wallet-adapter, no Phantom.
 */
import LaunchpadRescue from "./orbitx/LaunchpadRescue";

export default function RescuePage() {
  return <LaunchpadRescue />;
}
