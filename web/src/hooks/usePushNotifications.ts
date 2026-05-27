/**
 * usePushNotifications — robust Web Push lifecycle hook.
 *
 * Handles:
 * 1. Service worker registration
 * 2. Permission requests
 * 3. Push subscription creation / lookup
 * 4. Persisting the current browser subscription to Supabase
 * 5. Unsubscribing / disabling the current browser token
 * 6. Real end-to-end test pushes through the send-push edge function
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

const VAPID_PUBLIC_KEY =
  "BG2Ces3IxXdiTK27yXZ7dBVEeKfs6KspKsb1q_qIKX_BEV5Pr2561xF209NGHnHzC-FY7QNFbeUOM49b1p2xDGY";

type PermissionState = NotificationPermission;

type PushTokenRow = {
  id: string;
  token: string;
};

type TestPushResult = {
  ok: boolean;
  sent: number;
  total: number;
  reason?: string;
  error?: string;
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function serializeSubscription(subscription: PushSubscription) {
  return JSON.stringify(subscription.toJSON());
}

function extractEndpoint(token: string | null | undefined) {
  if (!token) return null;
  try {
    const parsed = JSON.parse(token);
    return typeof parsed?.endpoint === "string" ? parsed.endpoint : null;
  } catch {
    return null;
  }
}

async function getRegistration() {
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  return registration;
}

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<PermissionState>("default");
  const [supported, setSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    const isSupported =
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;

    setSupported(isSupported);
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const refreshSubscription = useCallback(async () => {
    if (!supported) return null;

    try {
      const registration = await getRegistration();
      const existing = await registration.pushManager.getSubscription();
      setSubscription(existing);
      setPermission(Notification.permission);
      return existing;
    } catch (error) {
      console.error("[Push] Failed to refresh subscription", error);
      return null;
    }
  }, [supported]);

  const syncSubscription = useCallback(
    async (current: PushSubscription | null) => {
      if (!user || !current) {
        setIsRegistered(false);
        return false;
      }

      setIsSyncing(true);
      try {
        const token = serializeSubscription(current);
        const endpoint = extractEndpoint(token);
        const { data, error } = await supabase
          .from("push_tokens")
          .select("id, token")
          .eq("user_id", user.id)
          .eq("platform", "web");

        if (error) throw error;

        const rows = (data || []) as PushTokenRow[];
        const existing = rows.find((row) => {
          if (row.token === token) return true;
          if (!endpoint) return false;
          return extractEndpoint(row.token) === endpoint;
        });

        if (existing) {
          const { error: updateError } = await supabase
            .from("push_tokens")
            .update({
              token,
              device_name: navigator.userAgent.slice(0, 100),
              disabled_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);

          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase.from("push_tokens").insert({
            user_id: user.id,
            token,
            platform: "web",
            device_name: navigator.userAgent.slice(0, 100),
          });

          if (insertError) throw insertError;
        }

        setIsRegistered(true);
        return true;
      } catch (error) {
        console.error("[Push] Failed to sync subscription", error);
        setIsRegistered(false);
        return false;
      } finally {
        setIsSyncing(false);
      }
    },
    [user]
  );

  const disableCurrentToken = useCallback(
    async (current: PushSubscription | null) => {
      if (!user || !current) return;

      const token = serializeSubscription(current);
      const endpoint = extractEndpoint(token);

      try {
        const { data, error } = await supabase
          .from("push_tokens")
          .select("id, token")
          .eq("user_id", user.id)
          .eq("platform", "web")
          .is("disabled_at", null);

        if (error) throw error;

        const ids = ((data || []) as PushTokenRow[])
          .filter((row) => row.token === token || (!!endpoint && extractEndpoint(row.token) === endpoint))
          .map((row) => row.id);

        if (ids.length > 0) {
          const { error: updateError } = await supabase
            .from("push_tokens")
            .update({ disabled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .in("id", ids);

          if (updateError) throw updateError;
        }
      } catch (error) {
        console.error("[Push] Failed to disable token", error);
      }
    },
    [user]
  );

  useEffect(() => {
    if (!supported) return;
    refreshSubscription();
  }, [supported, refreshSubscription]);

  useEffect(() => {
    if (!user || permission !== "granted" || !subscription) return;
    syncSubscription(subscription);
  }, [user, permission, subscription, syncSubscription]);

  const requestPermission = useCallback(async () => {
    if (!supported) return false;

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== "granted") {
        setIsRegistered(false);
        return false;
      }

      const registration = await getRegistration();
      let current = await registration.pushManager.getSubscription();

      if (!current) {
        current = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      setSubscription(current);
      return await syncSubscription(current);
    } catch (error) {
      console.error("[Push] Failed to request permission", error);
      return false;
    }
  }, [supported, syncSubscription]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return false;

    try {
      const current = subscription ?? (await refreshSubscription());
      if (!current) {
        setIsRegistered(false);
        return true;
      }

      await disableCurrentToken(current);
      await current.unsubscribe();
      setSubscription(null);
      setIsRegistered(false);
      setPermission(Notification.permission);
      return true;
    } catch (error) {
      console.error("[Push] Failed to unsubscribe", error);
      return false;
    }
  }, [supported, subscription, refreshSubscription, disableCurrentToken]);

  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!supported || permission !== "granted") return;

    try {
      const notification = new Notification(title, {
        icon: "/icon-192x192.png",
        badge: "/favicon.png",
        ...options,
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      setTimeout(() => notification.close(), 8000);
    } catch (error) {
      console.error("[Push] Failed to show local notification", error);
    }
  }, [supported, permission]);

  const sendTestPush = useCallback(async (): Promise<TestPushResult> => {
    if (!user) {
      return { ok: false, sent: 0, total: 0, error: "not_authenticated" };
    }

    try {
      const { data, error } = await supabase.functions.invoke("send-push", {
        body: {
          userId: user.id,
          type: "test_push",
          title: "OG Scan push notifications are on",
          body: "This device is now connected for real push notifications.",
          url: "/notifications",
          tag: `test-push-${Date.now()}`,
          data: { kind: "test_push" },
        },
      });

      if (error) {
        return { ok: false, sent: 0, total: 0, error: error.message };
      }

      return {
        ok: Boolean(data?.db),
        sent: Number(data?.sent || 0),
        total: Number(data?.total || 0),
        reason: typeof data?.reason === "string" ? data.reason : undefined,
      };
    } catch (error) {
      console.error("[Push] Failed to send test push", error);
      return {
        ok: false,
        sent: 0,
        total: 0,
        error: error instanceof Error ? error.message : "unknown_error",
      };
    }
  }, [user]);

  return {
    permission,
    supported,
    subscription,
    isSyncing,
    isRegistered,
    refreshSubscription,
    requestPermission,
    unsubscribe,
    sendNotification,
    sendTestPush,
  };
};
