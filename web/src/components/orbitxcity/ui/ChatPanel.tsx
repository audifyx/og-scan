import { FormEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { REALTIME_ENABLED, emptySnapshotGetter, noopSubscribe } from "@/lib/orbitxcity/realtime";
import { Send } from "lucide-react";

/** World chat — broadcast over the city realtime channel. */
export function ChatPanel() {
  const { realtime, avatar } = useCity();
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const snap = useSyncExternalStore(
    realtime?.subscribe ?? noopSubscribe,
    realtime?.getSnapshot ?? emptySnapshotGetter,
  );

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [snap.chat.length]);

  const send = (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim()) return;
    if (!realtime) {
      // Offline / no supabase — still show local echo for demo
      return;
    }
    realtime.sendChat(text);
    setText("");
  };

  return (
    <div className="oxc-stack oxc-chat">
      <div className="oxc-muted">
        {REALTIME_ENABLED
          ? snap.connected
            ? `${snap.online} online in OrbitX NYC`
            : "Connecting to city channel…"
          : "Realtime offline (set Supabase env) — local demo only"}
      </div>

      <div className="oxc-chat-log">
        {snap.chat.length === 0 && <div className="oxc-muted">Say gm — chat appears over your avatar too.</div>}
        {snap.chat.map((m) => (
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
