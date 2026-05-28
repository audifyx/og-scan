function getNavigatorBadgeApi() {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & {
    setAppBadge?: (count?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  return nav;
}

export async function updateAppBadge(count: number) {
  const nav = getNavigatorBadgeApi();
  if (!nav?.setAppBadge || !nav?.clearAppBadge) return;

  try {
    if (count > 0) {
      await nav.setAppBadge(count);
    } else {
      await nav.clearAppBadge();
    }
  } catch (error) {
    console.error("[badge] Failed to update app badge", error);
  }
}
