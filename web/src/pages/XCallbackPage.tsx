/**
 * XCallbackPage — handles the /x-callback redirect from Twitter OAuth 2.0 PKCE flow.
 * Exchanges the authorization code for tokens via the x-oauth-callback edge function,
 * stores the X user profile, then redirects back to Settings → Connections.
 */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { xExchangeCode, xSetStoredUser } from "@/lib/xAuth";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export function XCallbackPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const handle = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const error = params.get("error");

      if (error) {
        setStatus("error");
        setErrorMsg(params.get("error_description") || "Twitter authorization was denied.");
        return;
      }

      if (!code || !state) {
        setStatus("error");
        setErrorMsg("Missing authorization code from Twitter.");
        return;
      }

      try {
        const data = await xExchangeCode(code, state);

        // Store X user info locally
        xSetStoredUser({
          twitterId: data.twitter_id ?? "",
          username: data.twitter_username ?? "",
          displayName: data.twitter_name ?? data.twitter_username ?? "",
          profileImageUrl: data.twitter_avatar,
        });

        // Fire global event so Settings + feed tabs update immediately
        window.dispatchEvent(new CustomEvent("x-auth-changed", {
          detail: {
            user: {
              twitterId: data.twitter_id,
              username: data.twitter_username,
              displayName: data.twitter_name,
              profileImageUrl: data.twitter_avatar,
            },
          },
        }));

        setStatus("success");
        // Small delay so user sees success state, then redirect
        setTimeout(() => {
          const returnTo = sessionStorage.getItem("x_return_to") || "/settings?tab=connections";
          sessionStorage.removeItem("x_return_to");
          navigate(returnTo);
        }, 1200);

      } catch (e: any) {
        setStatus("error");
        setErrorMsg(e.message || "Something went wrong. Please try again.");
      }
    };

    handle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[#08080e] flex items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-sm">
        {status === "loading" && (
          <>
            <div className="w-10 h-10 border-2 border-og-lime border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-white/50 text-sm font-mono">Connecting your X account…</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="text-3xl">✅</div>
            <p className="text-og-lime font-bold">X connected!</p>
            <p className="text-white/40 text-sm font-mono">Redirecting you back…</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="text-3xl">❌</div>
            <p className="text-red-400 font-bold text-sm">{errorMsg}</p>
            <button
              onClick={() => navigate("/settings?tab=connections")}
              className="px-4 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-colors"
            >
              Back to Settings
            </button>
          </>
        )}
      </div>
    </div>
  );
}
