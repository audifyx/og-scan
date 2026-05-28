/**
 * ReactionOverlay — Floating animated reactions (TikTok Live style).
 * Reactions float up from bottom and fade out. Shared via Supabase broadcast channel.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const REACTIONS = ["🔥", "🚀", "💎", "🐂", "🐻", "💰", "👀", "💯", "⚡", "🎯", "❤️", "😂"];

interface FloatingReaction {
  id: string;
  emoji: string;
  x: number; // 0-100 %
  createdAt: number;
}

interface ReactionOverlayProps {
  spaceId: string;
  userId: string;
  onReact?: (emoji: string) => void;
}

const FLOAT_DURATION = 2500; // ms

const ReactionOverlay: React.FC<ReactionOverlayProps> = ({ spaceId, userId, onReact }) => {
  const [floating, setFloating] = useState<FloatingReaction[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const cooldownRef = useRef(0);

  // Add a floating reaction
  const addFloating = useCallback((emoji: string) => {
    const r: FloatingReaction = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      emoji,
      x: 5 + Math.random() * 90,
      createdAt: Date.now(),
    };
    setFloating(prev => [...prev.slice(-30), r]); // Cap at 30
  }, []);

  // Clean up old reactions
  useEffect(() => {
    const iv = setInterval(() => {
      setFloating(prev => prev.filter(r => Date.now() - r.createdAt < FLOAT_DURATION));
    }, 500);
    return () => clearInterval(iv);
  }, []);

  // Subscribe to broadcast channel when managing reactions internally
  useEffect(() => {
    if (onReact) return;
    const channel = supabase.channel(`reactions-${spaceId}`)
      .on("broadcast", { event: "reaction" }, (payload: any) => {
        if (payload.payload?.emoji) addFloating(payload.payload.emoji);
      })
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [spaceId, addFloating, onReact]);

  // Send reaction
  const send = (emoji: string) => {
    if (Date.now() - cooldownRef.current < 300) return; // Rate limit
    cooldownRef.current = Date.now();

    if (onReact) {
      onReact(emoji);
      setShowPicker(false);
      return;
    }

    addFloating(emoji);
    channelRef.current?.send({ type: "broadcast", event: "reaction", payload: { emoji, userId } });
    setShowPicker(false);
  };

  return (
    <>
      {/* Floating reactions overlay */}
      {!onReact && (
        <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden">
          {floating.map(r => {
            const age = (Date.now() - r.createdAt) / FLOAT_DURATION;
            return (
              <div
                key={r.id}
                className="absolute text-2xl sm:text-3xl transition-none"
                style={{
                  left: `${r.x}%`,
                  bottom: `${10 + age * 70}%`,
                  opacity: Math.max(0, 1 - age * 1.2),
                  transform: `scale(${1 - age * 0.3}) translateX(${Math.sin(age * 8) * 15}px)`,
                  pointerEvents: "none",
                }}
              >
                {r.emoji}
              </div>
            );
          })}
        </div>
      )}

      {/* Reaction button + picker (positioned by parent) */}
      <div className="relative">
        <button onClick={() => setShowPicker(!showPicker)}
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all",
            showPicker
              ? "bg-amber-500/20 border border-amber-500/30 scale-110"
              : "bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.1]"
          )}>
          🔥
        </button>

        {showPicker && (
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-[#0c1219] rounded-2xl border border-white/[0.1] p-2 shadow-2xl shadow-black/40 flex flex-wrap gap-1 w-[200px] z-[100]">
            {REACTIONS.map(emoji => (
              <button key={emoji} onClick={() => send(emoji)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-lg hover:bg-white/[0.08] hover:scale-110 transition-all active:scale-90">
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default ReactionOverlay;
