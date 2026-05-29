/**
 * CCCallbackPage — handles the Twitter/X OAuth redirect from CoinCommunities.
 *
 * Flow:
 *   1. User clicks "Sign in with X" in our app
 *   2. We open a popup to CC's auth URL: GET /api/v1/users/twitter/auth-url?redirectUrl=https://www.ogscan.fun/cc-callback
 *   3. Twitter auth happens on CC's side
 *   4. CC redirects back here with ?code=...  (and optional state)
 *   5. We exchange code + codeVerifier → CC access/refresh tokens
 *   6. Tokens stored in localStorage; popup posts CC_AUTH_SUCCESS to opener
 *
 * NOTE: https://www.ogscan.fun/cc-callback must be whitelisted in the
 * CoinCommunities business dashboard → Developer → Allowed Callback URLs.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ccHandleTwitterCallback, ccGetStoredCodeVerifier, ccHandleChallengeExchange } from "@/lib/ccAuth";

export const CCCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");
    const challengeCode = searchParams.get("cc_challenge");

    const finish = () => {
      setStatus("success");
      if (window.opener) {
        try { window.opener.postMessage({ type: "CC_AUTH_SUCCESS" }, window.location.origin); } catch {}
        setTimeout(() => window.close(), 800);
      } else {
        const returnTo = sessionStorage.getItem("cc_return_to") ?? "/app";
        sessionStorage.removeItem("cc_return_to");
        setTimeout(() => navigate(returnTo, { replace: true }), 800);
      }
    };

    const fail = (msg: string) => {
      setErrorMsg(msg);
      setStatus("error");
    };

    if (errorParam) { fail(errorParam); return; }

    // Challenge exchange path (deep-link from CC native app)
    if (challengeCode) {
      ccHandleChallengeExchange(challengeCode).then(finish).catch((e: Error) => fail(e.message));
      return;
    }

    // Standard OAuth callback
    if (!code) { fail("No authorization code received. Please try again."); return; }
    const codeVerifier = ccGetStoredCodeVerifier() ?? "";
    ccHandleTwitterCallback(code, codeVerifier).then(finish).catch((e: Error) => fail(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center p-8 max-w-sm">
        {status === "loading" && (
          <>
            <div className="w-10 h-10 border-2 border-og-lime border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white/60 text-sm font-mono">Connecting your X account…</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="w-14 h-14 rounded-full bg-og-lime/10 border border-og-lime/30 grid place-items-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" className="w-7 h-7 fill-og-lime"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
            </div>
            <p className="text-white font-bold text-base">X account connected!</p>
            <p className="text-white/40 text-sm mt-1">You can now post in communities.</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 grid place-items-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" className="w-7 h-7 fill-red-400"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
            </div>
            <p className="text-white font-bold text-base">Connection failed</p>
            <p className="text-white/40 text-sm mt-2 leading-relaxed">{errorMsg}</p>
            <button
              onClick={() => window.opener ? window.close() : navigate("/app")}
              className="mt-4 px-5 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-white/60 font-mono text-[11px] uppercase tracking-widest hover:border-white/20 transition-colors"
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default CCCallbackPage;
