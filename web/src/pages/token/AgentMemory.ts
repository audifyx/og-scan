import { useEffect, useRef, useState } from "react";

export interface AgentMemory {
  id: string;
  type: "whale" | "burn" | "ath" | "dip" | "milestone";
  text: string;
  time: number;
  usd?: number;
}

const MEM_KEY = "orbitx-agent-memory";
const SEEN_KEY = "orbitx-agent-memory-seen";
const BURNMI_KEY = "orbitx-agent-memory-burnmi";
const ATH_KEY = "orbitx-agent-memory-ath";
const MAX_MEMORIES = 30;
const WHALE_USD = 1000;
const BURN_MILESTONE_STEP = 1_000_000;

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function safeParseMemories(raw: string | null): AgentMemory[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is AgentMemory =>
        typeof m === "object" &&
        m !== null &&
        typeof (m as AgentMemory).id === "string" &&
        typeof (m as AgentMemory).text === "string" &&
        typeof (m as AgentMemory).time === "number",
    );
  } catch {
    return [];
  }
}

function safeParseNumber(raw: string | null): number | null {
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatUsd(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function useAgentMemory(
  trades: Array<{ usd?: number | null; timestamp: number; side?: string }>,
  burned: number | null,
  price: number | null | undefined,
  _mcap: number | null | undefined,
): AgentMemory[] {
  const [memories, setMemories] = useState<AgentMemory[]>(() =>
    safeParseMemories(safeGet(MEM_KEY)),
  );
  const seenTsRef = useRef<number>(safeParseNumber(safeGet(SEEN_KEY)) ?? 0);

  const appendMemory = (mem: Omit<AgentMemory, "id" | "time">) => {
    setMemories((prev) => {
      const next: AgentMemory[] = [
        { ...mem, id: makeId(), time: Date.now() },
        ...prev,
      ].slice(0, MAX_MEMORIES);
      safeSet(MEM_KEY, JSON.stringify(next));
      return next;
    });
  };

  // a. Whale buys
  useEffect(() => {
    let maxTs = seenTsRef.current;
    for (const t of trades) {
      const usd = t.usd ?? 0;
      const side = t.side ?? "BUY";
      if (
        t.timestamp > seenTsRef.current &&
        side === "BUY" &&
        usd >= WHALE_USD
      ) {
        appendMemory({
          type: "whale",
          text: `🐋 Whale bought $${formatUsd(usd)} of ORBITX`,
          usd,
        });
      }
      if (t.timestamp > maxTs) maxTs = t.timestamp;
    }
    if (maxTs > seenTsRef.current) {
      seenTsRef.current = maxTs;
      safeSet(SEEN_KEY, String(maxTs));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades]);

  // b. Burn milestones
  useEffect(() => {
    if (burned === null || !Number.isFinite(burned)) return;
    const milestone = Math.floor(burned / BURN_MILESTONE_STEP);
    const prev = safeParseNumber(safeGet(BURNMI_KEY)) ?? 0;
    if (milestone > prev) {
      safeSet(BURNMI_KEY, String(milestone));
      if (prev > 0) {
        appendMemory({
          type: "burn",
          text: `🔥 ${milestone}M ORBITX burned forever`,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burned]);

  // c. Price ATH
  useEffect(() => {
    if (price === null || price === undefined || !Number.isFinite(price)) return;
    if (price <= 0) return;
    const stored = safeParseNumber(safeGet(ATH_KEY));
    if (stored === null) {
      // Initialize silently on first run
      safeSet(ATH_KEY, String(price));
      return;
    }
    if (price > stored * 1.01) {
      safeSet(ATH_KEY, String(price));
      appendMemory({
        type: "ath",
        text: `🚀 New local high: $${formatUsd(price)}`,
        usd: price,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [price]);

  return memories;
}

export function timeAgo(ts: number): string {
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return "just now";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
