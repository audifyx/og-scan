import { FormEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { REALTIME_ENABLED, emptySnapshotGetter, noopSubscribe } from "@/lib/orbitxcity/realtime";
import { Send } from "lucide-react";

type LocalLine = { id: string; name: string; accentColor: string; text: string; at: number };

/** World chat — broadcast over the city realtime channel. */
export function ChatPanel() {
  const { realtime, avatar } = useCity();
  const [text, setText] = useState("");
  const [localLines, setLocalLines] = useState<LocalLine[]>([]);
  const bottom = useRef<HTMLDivElement>(null);

  const snap = useSyncExternalStore(
    realtime?.subscribe ?? noopSubscribe,
    realtime?.getSnapshot ?? emptySnapshotGetter,
  );

  const lines = snap.chat.length > 0 ? snap.chat : localLines;

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines.length]);

  // Toast when someone else chats is handled by ChatToastHost in the HUD
  // (keeps popups working even when this panel is closed).

  const send = (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    if (realtime) {
      realtime.sendChat(trimmed);
    } else {
      // Offline / no client — local echo for demo
      const line: LocalLine = {
        id: `local-${Date.now()}`,
        name: avatar.name,
        accentColor: avatar.accentColor,
        text: trimmed,
        at: Date.now(),
      };
      setLocalLines((prev) => [...prev.slice(-40), line]);
      toast.message(`@${avatar.name}`, { description: trimmed, duration: 3200 });
    }
    setText("");
  };

  return (
    <div className="oxc-stack oxc-chat">
      <div className="oxc-muted">
        {REALTIME_ENABLED
          ? snap.connected
            ? `${snap.online} online · messages pop up for the whole lobby`
            : "Connecting to city channel…"
          : "Realtime offline (set Supabase env) — local demo chat still works"}
      </div>

      <div className="oxc-chat-log">
        {lines.length === 0 && <div className="oxc-muted">Say gm — chat appears over your avatar and as a HUD toast.</div>}
        {lines.map((m) => (
          <div key={m.id} className="oxc-chat-line">
            <b style={{ color: m.accentColor }}>@{m.name}</b>
            <span>{m.text}</span>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      <form className="oxc-chat-form" onSubmit={send}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={280}
          placeholder={`Message as @${avatar.name}`}
        />
        <button type="submit" className="oxc-btn primary compact" disabled={!text.trim()}>
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
