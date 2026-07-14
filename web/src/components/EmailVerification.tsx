/**
 * Email Verification Guard
 *
 * FLOW:
 *  1. User signs up → receives verification email
 *  2. Email contains magic link: /verify-email?token=...&type=email_change
 *  3. VerifyEmailPage confirms the email
 *  4. User is redirected to onboarding
 *  5. Unverified users CANNOT write data (blocked server-side via RLS + middleware)
 *
 * SUPABASE CONFIGURATION:
 *  1. Dashboard → Auth → Email Templates
 *  2. Enable "Require email verification"
 *  3. Customize "Confirm signup" template:
 *     <a href="{{ .ConfirmationURL }}">Verify your email</a>
 *  4. Add environment variable: VITE_SUPABASE_VERIFY_REDIRECT=https://yourapp.com/verify-email
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase-ssr";

interface UseEmailVerificationProps {
  onVerified?: () => void;
  redirectTo?: string;
}

/**
 * Hook: Check if current user has verified email
 * Use to conditionally show verify-email prompts
 */
export function useEmailVerification() {
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkVerification = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      // User is verified if email_confirmed_at is set
      const verified = !!user?.email_confirmed_at;
      setIsVerified(verified);
    };

    checkVerification();
  }, []);

  return { isVerified, user };
}

/**
 * Component: Email Verification Required
 * Show this if user hasn't verified their email yet
 */
export function EmailVerificationRequired() {
  const { user } = useEmailVerification();
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const handleResend = async () => {
    if (!user?.email) return;

    setResendLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: user.email,
        options: {
          emailRedirectTo: `${window.location.origin}/verify-email`,
        },
      });

      if (error) {
        setResendMessage(`Error: ${error.message}`);
      } else {
        setResendMessage(`Verification email sent to ${user.email}`);
      }
    } catch (err) {
      setResendMessage("Failed to resend verification email");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="email-verification-required">
      <div className="verification-card">
        <h2>📧 Verify Your Email</h2>
        <p>We sent a verification link to <strong>{user?.email}</strong></p>
        <p>Click the link in that email to confirm your address and unlock full access.</p>

        <div className="actions">
          <button onClick={handleResend} disabled={resendLoading}>
            {resendLoading ? "Sending..." : "Resend Verification Email"}
          </button>
          <p className="hint">Didn't get the email? Check your spam folder.</p>
        </div>

        {resendMessage && (
          <p className={`message ${resendMessage.includes("sent") ? "success" : "error"}`}>
            {resendMessage}
          </p>
        )}
      </div>

      <style jsx>{`
        .email-verification-required {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .verification-card {
          background: white;
          border-radius: 12px;
          padding: 40px;
          max-width: 400px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          text-align: center;
        }
        h2 {
          margin: 0 0 16px;
          font-size: 24px;
          color: #333;
        }
        p {
          margin: 12px 0;
          color: #666;
          line-height: 1.6;
        }
        .actions {
          margin-top: 24px;
        }
        button {
          background: #667eea;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 12px 24px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
          width: 100%;
        }
        button:hover:not(:disabled) {
          background: #5568d3;
        }
        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .hint {
          font-size: 12px;
          color: #999;
          margin-top: 8px;
        }
        .message {
          margin-top: 16px;
          padding: 12px;
          border-radius: 6px;
          font-size: 14px;
        }
        .message.success {
          background: #e6f7e6;
          color: #2d5016;
        }
        .message.error {
          background: #ffe6e6;
          color: #7d1a1a;
        }
      `}</style>
    </div>
  );
}

/**
 * Component: Verify Email Page
 * This page handles the token from the email link
 * URL: /verify-email?token=XXX&type=email_change
 */
export function VerifyEmailPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        // Supabase handles the token verification via URL params
        const hash = window.location.hash;
        if (!hash) {
          setStatus("error");
          setMessage("Invalid verification link");
          return;
        }

        // Extract token from URL hash (Supabase sends: #type=email_change&code=XXX)
        const params = new URLSearchParams(hash.slice(1));
        const type = params.get("type");
        const code = params.get("code");

        if (type === "email_change" && code) {
          const { error } = await supabase.auth.verifyOtp({
            type: "email_change",
            token: code,
            email: "", // Let Supabase figure it out from the token
          });

          if (error) {
            setStatus("error");
            setMessage(error.message || "Verification failed");
            return;
          }

          setStatus("success");
          setMessage("Email verified! Redirecting...");

          // Redirect to dashboard after 2 seconds
          setTimeout(() => {
            navigate("/app");
          }, 2000);
        } else {
          setStatus("error");
          setMessage("Invalid verification link");
        }
      } catch (err) {
        setStatus("error");
        setMessage((err as Error).message || "An error occurred");
      }
    };

    verifyEmail();
  }, [navigate]);

  return (
    <div className="verify-email-page">
      <div className="verification-container">
        {status === "loading" && (
          <>
            <div className="spinner"></div>
            <h2>Verifying your email...</h2>
          </>
        )}

        {status === "success" && (
          <>
            <div className="icon success">✓</div>
            <h2>Email Verified!</h2>
            <p>{message}</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="icon error">✕</div>
            <h2>Verification Failed</h2>
            <p>{message}</p>
            <button onClick={() => window.location.href = "/signup"}>
              Try Again
            </button>
          </>
        )}
      </div>

      <style jsx>{`
        .verify-email-page {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .verification-container {
          background: white;
          border-radius: 12px;
          padding: 60px 40px;
          text-align: center;
          max-width: 400px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f0f0f0;
          border-top: 4px solid #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 24px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .icon {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          margin: 0 auto 16px;
          font-weight: bold;
        }
        .icon.success {
          background: #e6f7e6;
          color: #2d7d2d;
        }
        .icon.error {
          background: #ffe6e6;
          color: #d32f2f;
        }
        h2 {
          margin: 0 0 12px;
          color: #333;
        }
        p {
          color: #666;
          margin: 0 0 24px;
        }
        button {
          background: #667eea;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 12px 24px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
        }
        button:hover {
          background: #5568d3;
        }
      `}</style>
    </div>
  );
}

/**
 * Guard: Require Verified Email
 * Use in route protection to block unverified users
 *
 * Usage:
 *  <ProtectedRoute
 *    component={WriteOperationPage}
 *    requireVerifiedEmail={true}
 *    fallback={<EmailVerificationRequired />}
 *  />
 */
export async function requireVerifiedEmailServer(user: any): boolean {
  return !!user?.email_confirmed_at;
}
