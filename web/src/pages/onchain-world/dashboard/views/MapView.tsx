import LivingMap from "@/pages/onchain-world/LivingMap";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";

export function MapView() {
  const city = useOrbitxStore((s) => s.city);
  const selected = useOrbitxStore((s) => s.selectedWallet);
  const trackWallet = useOrbitxStore((s) => s.trackWallet);
  const rawEvents = city.rawEvents;
  const setFollowId = useOrbitxStore((s) => s.setFollowId);

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-bg-sunken">
      <LivingMap
        events={rawEvents}
        kols={city.kols}
        flows={city.flows}
        followWallet={selected}
        onWallet={(address) => trackWallet(address)}
        onEvent={(event) => {
          setFollowId(event.event_id);
          if (event.wallet) trackWallet(event.wallet);
        }}
      />
    </div>
  );
}
