/**
 * usePushNotifications — Full Web Push notification hook.
 *
 * 1. Registers/updates service worker
 * 2. Requests Notification permission
 * 3. Subscribes to Web Push via PushManager (VAPID)
 * 4. Saves PushSubscription to Supabase `push_tokens` table
 * 5. Provides in-app sendNotification for when tab is open
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

// VAPID public key — safe to expose (paired private key is only in edge function secrets)
const VAPID_PUBLIC_KEY =
  "BG2Ces3IxXdiTK27yXZ7dBVEeKfs6KspKsb1q_qIKX_BEV5Pr2561xF209NGHnHzC-FY7QNFbeUOM49b1p2xDGY";

type PermissionState = "default" | "granted" | "denied";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<PermissionState>("default");
  const [supported, setSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const savedRef = useRef(false);

  // Check support
  useEffect(() => {
    const isSupported =
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    setSupported(isSupported);
    if ("Notification" in window) {
      setPermission(Notification.permission as PermissionState);
    }
  }, []);

  // Register SW and get existing subscription on mount
  useEffect(() => {
    if (!supported) return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          setSubscription(existing);
          setPermission("granted");
        }
      } catch (e) {
        console.error("[Push] SW registration failed:", e);
      }
    })();
  }, [supported]);

  // Save subscription to Supabase whenever user or subscription changes
  useEffect(() => {
    if (!user || !subscription || savedRef.current) return;
    const save = async () => {
      const json = subscription.toJSON();
      const token = JSON.stringify(json);
      // Upsert: delete old tokens for this user on web, insert new
      await supabase.from("push_tokens").delete().eq("user_id", user.id).eq("platform", "web");
      const { error } = await supabase.from("push_tokens").insert({
        user_id: user.id,
        token,
        platform: "web",
        device_name: navigator.userAgent.slice(0, 100),
      });
      if (error) console.error("[Push] Failed to save token:", error);
      else savedRef.current = true;
    };
    save();
  }, [user, subscription]);

  const requestPermission = useCallback(async () => {
    if (!supported) return false;
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);
      if (result !== "granted") return false;

      // Subscribe to push
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      setSubscription(sub);
      savedRef.current = false; // trigger save
      return true;
    } catch (e) {
      console.error("[Push] Subscribe failed:", e);
      return false;
    }
  }, [supported]);

  // In-app notification (for when tab is visible)
  const sendNotification = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (!supported || permission !== "granted") return;
      try {
        const n = new Notification(title, {
          icon: "/icon-192x192.png",
          badge: "/favicon.png",
          ...options,
        });
        n.onclick = () => { window.focus(); n.close(); };
        setTimeout(() => n.close(), 8000);
      } catch (e) {
        console.error("[Push] Notification failed:", e);
      }
    },
    [supported, permission]
  );

  return { permission, supported, subscription, requestPermission, sendNotification };
};
