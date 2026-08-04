/**
 * XCallbackPage — handles the /x-callback redirect from Twitter OAuth 2.0 PKCE flow.
 * Must wait for an OrbitX session so tokens are saved to profiles (Claude MCP reads those).
 */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { xExchangeCode, xSetStoredUser } from "@/lib/xAuth";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export function XCallbackPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [scopeNote, setScopeNote] = useState("");

  useEffect(() => {
    if (authLoading) return;

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
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token || !user) {
          setStatus("error");
          setErrorMsg(
            "Sign in to OrbitX first, then Connect X again. Without a session, Claude cannot use your X token.",
          );
          return;
        }

        const data = await xExchangeCode(code, state, session.access_token);
        const scopes = String(data.scope || data.scopes || "");
        const hasTweetWrite = /\btweet\.write\b/.test(scopes);
        if (scopes && !hasTweetWrite) {
          setStatus("error");
          setErrorMsg(
            `X granted scopes without tweet.write (${scopes || "none"}). In developer.x.com set App permissions to “Read and write and Direct message”, revoke OrbitX at x.com/settings/connected_apps, then Connect X again.`,
          );
          return;
        }
        if (scopes) {
          setScopeNote(hasTweetWrite ? `Scopes OK: ${scopes}` : "");
          try {
            localStorage.setItem("x_oauth_scopes", scopes);
          } catch {
            /* ignore */
          }
        }

        xSetStoredUser({
          twitterId: data.twitter_id ?? "",
          username: data.twitter_username ?? "",
          displayName: data.twitter_name ?? data.twitter_username ?? "",
          profileImageUrl: data.twitter_avatar,
        });

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
        setTimeout(() => {
          const returnTo = sessionStorage.getItem("x_return_to") || "/x";
          sessionStorage.removeItem("x_return_to");
          navigate(returnTo);
        }, 1200);
      } catch (e: any) {
        setStatus("error");
        setErrorMsg(e.message || "Something went wrong. Please try again.");
      }
    };

    void handle();
  }, [authLoading, user, navigate]);

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
            {scopeNote ? (
              <p className="text-white/40 text-xs font-mono break-all">{scopeNote}</p>
            ) : null}
            <p className="text-white/40 text-sm font-mono">Redirecting you back…</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="text-3xl">❌</div>
            <p className="text-red-400 font-bold text-sm">{errorMsg}</p>
            <button
              onClick={() => navigate("/x")}
              className="px-4 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-colors"
            >
              Back to /x
            </button>
          </>
        )}
      </div>
    </div>
  );
}
