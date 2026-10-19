/**
 * Real notification system — browser push + in-app center.
 * Stored in localStorage. Polls for events (graduations, sniper activity).
 */
import { useState, useEffect, useCallback } from "react";

export interface PadNotification {
  id: string;
  type: "graduation" | "sniper" | "launch" | "claim" | "system";
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  link?: string;
}

const LS_NOTIF = "orbitx_pad_notifications_v1";
const LS_PERM = "orbitx_pad_notif_perm";

export function getNotifications(): PadNotification[] {
  try {
    return JSON.parse(localStorage.getItem(LS_NOTIF) || "[]");
  } catch {
    return [];
  }
}

export function addNotification(n: Omit<PadNotification, "id" | "timestamp" | "read">) {
  const notifs = getNotifications();
  const full: PadNotification = {
    ...n,
    id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    read: false,
  };
  notifs.unshift(full);
  localStorage.setItem(LS_NOTIF, JSON.stringify(notifs.slice(0, 50)));
  // Browser notification if permitted
  if (Notification.permission === "granted") {
    try {
      new Notification(n.title, { body: n.body, icon: "/orbitx-x-avatar.jpg" });
    } catch {}
  }
  return full;
}

export function markAllRead() {
  const notifs = getNotifications().map((n) => ({ ...n, read: true }));
  localStorage.setItem(LS_NOTIF, JSON.stringify(notifs));
}

export async function requestNotifPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const perm = await Notification.requestPermission();
  localStorage.setItem(LS_PERM, perm);
  return perm === "granted";
}

export function usePadNotifications() {
  const [notifs, setNotifs] = useState<PadNotification[]>([]);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(() => {
    const all = getNotifications();
    setNotifs(all);
    setUnread(all.filter((n) => !n.read).length);
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 5000);
    return () => clearInterval(iv);
  }, [refresh]);

  const markRead = useCallback(() => {
    markAllRead();
    refresh();
  }, [refresh]);

  return { notifs, unread, refresh, markRead };
}
