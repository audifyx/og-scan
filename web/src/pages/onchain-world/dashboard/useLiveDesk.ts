import { useEffect, useState } from "react";
import { fetchLiveDesk, type LiveDeskPayload } from "@/pages/onchain-world/api";

export function useLiveDesk(pollMs = 4_000) {
  const [snap, setSnap] = useState<LiveDeskPayload | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    const pull = () => {
      void fetchLiveDesk()
        .then((data) => {
          if (alive && data) setSnap(data);
        })
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, pollMs);
    const clock = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.clearInterval(clock);
    };
  }, [pollMs]);

  return { snap, now };
}
