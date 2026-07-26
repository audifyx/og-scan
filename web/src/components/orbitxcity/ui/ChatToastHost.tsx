import { useEffect, useRef, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { emptySnapshotGetter, noopSubscribe } from "@/lib/orbitxcity/realtime";

/** Always-on HUD listener — pops a toast when someone else chats, even if Chat panel is closed. */
export function ChatToastHost() {
  const { realtime, playerId } = useCity();
  const seen = useRef<Set<string>>(new Set());

  const snap = useSyncExternalStore(
    realtime?.subscribe ?? noopSubscribe,
    realtime?.getSnapshot ?? emptySnapshotGetter,
  );

  useEffect(() => {
    for (const m of snap.chat) {
      if (seen.current.has(m.id)) continue;
      seen.current.add(m.id);
      if (m.senderId === playerId) continue;
      if (Date.now() - m.at > 8000) continue;
      toast.message(`@${m.name}`, {
        description: m.text,
        duration: 4200,
        className: "oxc-chat-toast",
      });
    }
  }, [snap.chat, playerId]);

  return null;
}
