import { useEffect, useMemo, useState } from "react";
import { BellRing, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const DISMISS_KEY = "ogscan-push-prompt-dismissed";

export const PushNotificationPrompt = () => {
  const { user } = useAuth();
  const { supported, permission, isRegistered, isSyncing, requestPermission } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "true");
  }, []);

  const shouldShow = useMemo(() => {
    return Boolean(user && supported && permission === "default" && !isRegistered && !dismissed);
  }, [user, supported, permission, isRegistered, dismissed]);

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, "true");
    }
    setDismissed(true);
  };

  const handleEnable = async () => {
    const granted = await requestPermission();
    if (granted) {
      toast.success("Push notifications enabled");
      handleDismiss();
    } else {
      toast.error("Push notifications were not enabled");
    }
  };

  if (!shouldShow) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex justify-center px-4">
      <Card className="pointer-events-auto w-full max-w-xl border-og-lime/20 bg-black/95 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-og-lime/10 p-2 text-og-lime">
              <BellRing className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Turn on real push notifications</p>
              <p className="text-xs text-white/65">
                Get live alerts for messages, spaces, and platform activity even when OG Scan is closed.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button variant="ghost" size="icon" onClick={handleDismiss} className="h-9 w-9 text-white/60 hover:text-white">
              <X className="h-4 w-4" />
            </Button>
            <Button onClick={handleEnable} disabled={isSyncing} className="rounded-xl bg-og-lime text-black hover:bg-og-lime/90">
              {isSyncing ? "Connecting..." : "Enable"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
