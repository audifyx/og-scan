import { useState, useEffect, useCallback } from "react";

type PermissionState = "default" | "granted" | "denied";

export const usePushNotifications = () => {
  const [permission, setPermission] = useState<PermissionState>("default");
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const isSupported = "Notification" in window;
    setSupported(isSupported);
    if (isSupported) {
      setPermission(Notification.permission as PermissionState);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!supported) return false;
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);
      return result === "granted";
    } catch {
      return false;
    }
  }, [supported]);

  const sendNotification = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (!supported || permission !== "granted") return;
      try {
        const notification = new Notification(title, {
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          ...options,
        });
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
        // Auto-close after 8 seconds
        setTimeout(() => notification.close(), 8000);
      } catch (e) {
        console.error("Failed to send notification:", e);
      }
    },
    [supported, permission]
  );

  return { permission, supported, requestPermission, sendNotification };
};
