/**
 * Cloudflare Turnstile CAPTCHA component.
 *
 * Replace TURNSTILE_SITE_KEY with your production key from:
 * https://dash.cloudflare.com → Turnstile → Add Widget (free)
 *
 * Current key is Cloudflare's visible test key (always passes).
 */

import { useEffect, useRef, useCallback } from "react";

// Test key — always passes. Replace with production key.
// Get one free at: https://dash.cloudflare.com → Turnstile
// Visible managed challenge — always shows widget, always passes (test mode).
// For production, get a free key at: https://dash.cloudflare.com → Turnstile → Add Widget
// Then replace this key and add server-side verification.
const TURNSTILE_SITE_KEY = "1x00000000000000000000AA";

interface TurnstileProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  theme?: "dark" | "light" | "auto";
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: Record<string, unknown>
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export const Turnstile = ({
  onVerify,
  onExpire,
  onError,
  theme = "dark",
}: TurnstileProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const renderedRef = useRef(false);

  const renderWidget = useCallback(() => {
    if (
      !window.turnstile ||
      !containerRef.current ||
      renderedRef.current
    )
      return;

    renderedRef.current = true;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      theme,
      callback: (token: string) => onVerify(token),
      "expired-callback": () => onExpire?.(),
      "error-callback": () => onError?.(),
    });
  }, [onVerify, onExpire, onError, theme]);

  useEffect(() => {
    // If turnstile script already loaded
    if (window.turnstile) {
      renderWidget();
      return;
    }

    // Poll until turnstile is available (script loads async)
    const interval = setInterval(() => {
      if (window.turnstile) {
        clearInterval(interval);
        renderWidget();
      }
    }, 200);

    return () => {
      clearInterval(interval);
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
      }
      renderedRef.current = false;
    };
  }, [renderWidget]);

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center"
    />
  );
};
