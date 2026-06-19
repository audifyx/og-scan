/**
 * Secure Signup Form
 *
 * ENFORCES:
 *  1. Strong password validation (12+ chars, entropy check, HaveIBeenPwned)
 *  2. Rate limiting (3 signups per hour per IP+email)
 *  3. Email verification required (server-side gate on writes)
 *  4. Real-time password feedback
 *  5. Clear error messages
 *
 * FLOW:
 *  1. User enters email + password
 *  2. Client-side: validate password strength
 *  3. Client-side: validate email format
 *  4. Server-side: check rate limits
 *  5. Server-side: sign up via Supabase Auth
 *  6. Supabase: sends verification email
 *  7. User confirms email via magic link
 *  8. User can now write data (RLS + middleware verified)
 */

import { useState } from "react";
import { supabase } from "@/lib/supabase-ssr";
import {
  validatePassword,
  getPasswordFeedback,
  getPasswordStrengthLabel,
} from "@/lib/password-validation";

interface SignupFormProps {
  onSignupSuccess?: (email: string) => void;
}

export function SecureSignupForm({ onSignupSuccess }: SignupFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [passwordFeedback, setPasswordFeedback] = useState<any>(null);

  // Real-time password validation
  const handlePasswordChange = async (value: string) => {
    setPassword(value);

    if (value.length > 0) {
      const feedback = await getPasswordFeedback(value);
      setPasswordFeedback(feedback);
    } else {
      setPasswordFeedback(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // 1. Validate email
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    // 2. Validate password match
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    // 3. Validate password strength
    const passwordValidation = await validatePassword(password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.error || "Password is not strong enough");
      return;
    }

    // 4. Validate TOS
    if (!agreed) {
      setError("Please agree to the Terms of Service");
      return;
    }

    // 5. Attempt signup
    setLoading(true);
    try {
      // Call server API route for rate limiting + signup
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          metadata: {
            signupAt: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();

        // Handle specific error cases
        if (response.status === 429) {
          setError(
            "Too many signup attempts. Please try again in 1 hour.",
          );
        } else if (response.status === 400) {
          setError(data.error || "Signup failed. Please try again.");
        } else {
          setError(data.error || "Signup failed. Please try again.");
        }
        return;
      }

      setSuccess(true);
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      onSignupSuccess?.(email);
    } catch (err) {
      setError((err as Error).message || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="secure-signup-form">
      {success ? (
        <div className="success-message">
          <h2>✓ Signup Successful!</h2>
          <p>
            We sent a verification email to <strong>{email}</strong>. Click the
            link to confirm your address and unlock full access.
          </p>
          <p className="hint">Check your spam folder if you don't see it.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <h2>Create Your Account</h2>

          {error && <div className="error-message">{error}</div>}

          {/* Email */}
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="password">
              Password
              {passwordFeedback && (
                <span className={`strength-badge ${passwordFeedback.isValid ? "valid" : "invalid"}`}>
                  {passwordFeedback.label}
                </span>
              )}
            </label>
            <input
              id="password"
              type="password"
              placeholder="At least 12 characters"
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              disabled={loading}
              required
            />

            {/* Password Feedback */}
            {passwordFeedback && (
              <div className={`password-feedback ${passwordFeedback.isValid ? "valid" : "invalid"}`}>
                <div className="strength-bar">
                  <div
                    className="strength-fill"
                    style={{ width: `${(passwordFeedback.score / 5) * 100}%` }}
                  />
                </div>

                {!passwordFeedback.isValid && passwordFeedback.suggestions.length > 0 && (
                  <ul className="suggestions">
                    {passwordFeedback.suggestions.map((s: string) => (
                      <li key={s}>💡 {s}</li>
                    ))}
                  </ul>
                )}

                {passwordFeedback.isValid && (
                  <p className="valid-text">✓ Strong password!</p>
                )}
              </div>
            )}

            <p className="hint">
              At least 12 characters. Avoid common passwords like "password123".
            </p>
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label htmlFor="confirm">Confirm Password</label>
            <input
              id="confirm"
              type="password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              required
            />
            {password && confirmPassword && password !== confirmPassword && (
              <p className="mismatch">Passwords do not match</p>
            )}
          </div>

          {/* Terms */}
          <div className="form-group checkbox">
            <input
              id="terms"
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              disabled={loading}
              required
            />
            <label htmlFor="terms">
              I agree to the{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer">
                Terms of Service
              </a>
              {" "}and{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !agreed || (password && !passwordFeedback?.isValid)}
            className="submit-btn"
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>

          {/* Login Link */}
          <p className="login-link">
            Already have an account?{" "}
            <a href="/login">Sign in here</a>
          </p>
        </form>
      )}

      <style jsx>{`
        .secure-signup-form {
          max-width: 400px;
          margin: 0 auto;
          padding: 32px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        h2 {
          margin: 0 0 24px;
          font-size: 24px;
          color: #333;
        }

        .error-message {
          background: #fee;
          border: 1px solid #fcc;
          color: #d32f2f;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 16px;
          font-size: 14px;
        }

        .success-message {
          text-align: center;
          padding: 24px;
        }

        .success-message h2 {
          color: #2d7d2d;
          margin-bottom: 12px;
        }

        .success-message p {
          color: #666;
          margin: 8px 0;
          font-size: 14px;
        }

        .hint {
          font-size: 12px;
          color: #999;
          margin-top: 6px;
          display: block;
        }

        .form-group {
          margin-bottom: 20px;
        }

        label {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
          font-weight: 600;
          color: #333;
          font-size: 14px;
        }

        input[type="email"],
        input[type="password"] {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }

        input[type="email"]:focus,
        input[type="password"]:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        input:disabled {
          background: #f5f5f5;
          cursor: not-allowed;
        }

        .mismatch {
          color: #d32f2f;
          font-size: 12px;
          margin-top: 4px;
        }

        .password-feedback {
          margin-top: 12px;
          padding: 12px;
          background: #f5f5f5;
          border-radius: 6px;
        }

        .password-feedback.valid {
          background: #e6f7e6;
        }

        .password-feedback.invalid {
          background: #fff3e0;
        }

        .strength-bar {
          height: 4px;
          background: #ddd;
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .strength-fill {
          height: 100%;
          background: linear-gradient(90deg, #ff6b6b, #ffa94d, #74b9ff, #00b894);
          transition: width 0.3s;
        }

        .strength-badge {
          font-size: 12px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 4px;
          margin-left: 8px;
        }

        .strength-badge.valid {
          background: #e6f7e6;
          color: #2d7d2d;
        }

        .strength-badge.invalid {
          background: #fff3e0;
          color: #f57c00;
        }

        .suggestions {
          list-style: none;
          padding: 0;
          margin: 8px 0 0;
        }

        .suggestions li {
          font-size: 12px;
          color: #666;
          margin: 4px 0;
        }

        .valid-text {
          font-size: 12px;
          color: #2d7d2d;
          margin: 0;
        }

        .checkbox {
          display: flex;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .checkbox input {
          width: auto;
          margin-right: 8px;
          margin-top: 2px;
        }

        .checkbox label {
          margin-bottom: 0;
          font-weight: normal;
        }

        a {
          color: #667eea;
          text-decoration: none;
        }

        a:hover {
          text-decoration: underline;
        }

        .submit-btn {
          width: 100%;
          padding: 12px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .submit-btn:hover:not(:disabled) {
          background: #5568d3;
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .login-link {
          text-align: center;
          font-size: 14px;
          color: #666;
          margin-top: 16px;
        }
      `}</style>
    </div>
  );
}
