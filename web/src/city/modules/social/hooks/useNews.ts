/**
 * useNews — Channel 6 news state. Items derive from live drama via
 * buildNews; read/unread tracked per device.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildNews } from "../engine/newsEngine";
import type { NewsItem, TokenDrama } from "../types";

const READ_KEY = "orbitxcity.social.news-read.v1";

function loadRead(): string[] {
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    /* none */
  }
  return [];
}

export function useNews(drama: TokenDrama[]) {
  const items: NewsItem[] = useMemo(() => buildNews(drama), [drama]);
  const [read, setRead] = useState<Set<string>>(() => new Set(loadRead()));

  useEffect(() => {
    try {
      localStorage.setItem(READ_KEY, JSON.stringify([...read].slice(-100)));
    } catch {
      /* blocked */
    }
  }, [read]);

  const markRead = useCallback((id: string) => {
    setRead((prev) => new Set(prev).add(id));
  }, []);

  const unread = items.filter((i) => !read.has(i.id)).length;
  const breaking = items.filter((i) => i.severity === "breaking").length;

  return { items, read, markRead, unread, breaking };
}
