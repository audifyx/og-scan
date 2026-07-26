/**
 * /auth/email — password reset, update, and full email signup (with captcha).
 * Primary login UX lives on /auth; this page keeps recovery + signup guards.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, AtSign, Eye, EyeOff, Loader2, Lock, Mail, Rocket, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getDeviceFingerprint } from "@/hooks/useDeviceFingerprint";
import { SliderCaptcha } from "@/components/SliderCaptcha";
import { toast } from "sonner";
import { z } from "zod";
import {
  canUseReservedUsername,
  getReservedUsernameMessage,
  isReservedUsername,
} from "@/lib/usernamePolicy";
import "./auth.css";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");
const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be 20 characters or less")
  .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores");

type AuthMode = "signin" | "signup" | "reset" | "update";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading, signIn, signUp, resetPassword, updatePassword } = useAuth();
  const next = searchParams.get("next") || "/app";

  const [mode, setMode] = useState<AuthMode>((searchParams.get("mode") as AuthMode) || "signin");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [humanCode, setHumanCode] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [formStartedAt] = useState(() => Date.now());
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) localStorage.setItem("og_ref_code", ref);
  }, [searchParams]);

  useEffect(() => {
    let recovery = false;
    try {
      if (window.location.hash.includes("type=recovery")) recovery = true;
      if (sessionStorage.getItem("og_password_recovery") === "1") recovery = true;
    } catch { /* noop */ }
    if (recovery) setMode("update");
  }, []);

  useEffect(() => {
    const urlMode = searchParams.get("mode") as AuthMode | null;
    if (urlMode === "signin" || urlMode === "signup" || urlMode === "reset" || urlMode === "update") setMode(urlMode);
  }, [searchParams]);

  useEffect(() => {
    if (!loading && user && mode !== "signup" && mode !== "update") {
      navigate(next);
    }
  }, [user, loading, navigate, mode, next]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (mode !== "update") {
      try { emailSchema.parse(email.trim()); } catch (e) { if (e instanceof z.ZodError) newErrors.email = e.errors[0].message; }
    }
    if (mode === "signup") {
      const clean = username.replace(/^@/, "");
      try { usernameSchema.parse(clean); } catch (e) { if (e instanceof z.ZodError) newErrors.username = e.errors[0].message; }
      if (!newErrors.username && isReservedUsername(clean) && !canUseReservedUsername(email)) {
        newErrors.username = getReservedUsernameMessage();
      }
    }
    if (mode !== "reset") {
      try { passwordSchema.parse(password); } catch (e) { if (e instanceof z.ZodError) newErrors.password = e.errors[0].message; }
    }
    if ((mode === "signup" || mode === "update") && password !== confirmPassword) newErrors.confirm = "Passwords do not match";
    if (mode === "signup" && humanCode.trim().toUpperCase() !== "ORBITX") newErrors.humanCode = "Type ORBITX exactly to verify you are human";
    if (mode === "signup" && !captchaToken) newErrors.captcha = "Please complete the CAPTCHA verification";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    const cleanEmail = email.trim().toLowerCase();
    try {
      if (mode === "signin") {
        const { error } = await signIn(cleanEmail, password);
        if (error) toast.error(/invalid login|invalid credentials/i.test(error.message) ? "Invalid email or password" : error.message);
        else {
          toast.success("Welcome back");
          navigate(next);
        }
      } else if (mode === "signup") {
        const clean = username.replace(/^@/, "");
        const guardResponse = await fetch("/api/signup-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: cleanEmail,
            username: clean,
            fingerprint: getDeviceFingerprint(),
            honeypot,
            humanCode,
            captchaToken,
            elapsedMs: Date.now() - formStartedAt,
          }),
        });
        const guard = await guardResponse.json().catch(() => null);
        if (!guardResponse.ok || !guard?.allowed) {
          toast.error(guard?.message || "Signup security check failed. Please try again.");
          return;
        }
        const { error } = await signUp(cleanEmail, password, clean);
        if (error) toast.error(error.message.includes("already registered") ? "This email is already registered" : error.message);
        else {
          toast.success(`Welcome @${clean}. Check your email to verify your account.`);
          navigate("/setup");
        }
      } else if (mode === "update") {
        const { error } = await updatePassword(password);
        if (error) toast.error(error.message);
        else {
          toast.success("Password updated — you're in");
          try { sessionStorage.removeItem("og_password_recovery"); } catch { /* noop */ }
          navigate(next || "/app");
        }
      } else {
        const { error } = await resetPassword(cleanEmail);
        if (error) toast.error(error.message);
        else {
          toast.success("Check your email for the reset link");
          setMode("signin");
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="ox-auth flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#60A5FA]" />
      </div>
    );
  }

  const titles: Record<AuthMode, string> = {
    signin: "Sign in with email",
    signup: "Create account",
    reset: "Reset password",
    update: "Set a new password",
  };

  return (
    <div className="ox-auth">
      <div className="ox-auth-bg" />
      <div className="ox-auth-inner">
        <Link to="/auth" className="ox-auth-brand">
          <div className="ox-auth-brand-mark"><Rocket className="h-4 w-4" /></div>
          <div>
            <div className="ox-auth-brand-name">Orbit<span>X</span></div>
            <div className="ox-auth-brand-sub">email</div>
          </div>
        </Link>

        <div className="ox-auth-card">
          <div className="ox-auth-kicker">
            {mode === "reset" ? "Recovery" : mode === "update" ? "Almost done" : "Email access"}
          </div>
          <h1 className="ox-auth-title">{titles[mode]}</h1>
          <p className="ox-auth-sub">
            {mode === "reset" && "We'll send a secure reset link to your inbox."}
            {mode === "update" && "Choose a new password for your account."}
            {mode === "signup" && "Create an OrbitX account with email + username."}
            {mode === "signin" && (
              <>Prefer the new flow? <Link to={`/auth?next=${encodeURIComponent(next)}`} className="text-[#60A5FA] hover:underline">Open /auth</Link></>
            )}
          </p>

          {(mode === "signin" || mode === "signup") && (
            <div className="ox-auth-tabs mt-5">
              <button type="button" className={mode === "signin" ? "ox-auth-tab ox-auth-tab--on" : "ox-auth-tab"} onClick={() => setMode("signin")}>Login</button>
              <button type="button" className={mode === "signup" ? "ox-auth-tab ox-auth-tab--on" : "ox-auth-tab"} onClick={() => setMode("signup")}>Sign up</button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="ox-auth-form">
            {mode === "signup" && (
              <label className="ox-auth-label">
                Username
                <div className="relative">
                  <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8B0BC]" />
                  <input className="ox-auth-input !pl-10" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="yourname" />
                </div>
                {errors.username && <span className="text-xs text-[#ff4d6d] normal-case tracking-normal">{errors.username}</span>}
              </label>
            )}

            {mode !== "update" && (
              <label className="ox-auth-label">
                Email
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8B0BC]" />
                  <input className="ox-auth-input !pl-10" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" />
                </div>
                {errors.email && <span className="text-xs text-[#ff4d6d] normal-case tracking-normal">{errors.email}</span>}
              </label>
            )}

            {mode !== "reset" && (
              <label className="ox-auth-label">
                Password
                <div className="ox-auth-pw">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8B0BC]" />
                  <input
                    className="ox-auth-input !pl-10"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={mode === "signup" || mode === "update" ? "new-password" : "current-password"}
                  />
                  <button type="button" className="ox-auth-eye" onClick={() => setShowPassword((p) => !p)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <span className="text-xs text-[#ff4d6d] normal-case tracking-normal">{errors.password}</span>}
              </label>
            )}

            {(mode === "signup" || mode === "update") && (
              <label className="ox-auth-label">
                Confirm password
                <input className="ox-auth-input" type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" />
                {errors.confirm && <span className="text-xs text-[#ff4d6d] normal-case tracking-normal">{errors.confirm}</span>}
              </label>
            )}

            {mode === "signup" && (
              <div className="space-y-3 border border-white/10 bg-black/30 p-4" style={{ borderRadius: 14 }}>
                <label className="ox-auth-label">
                  Type ORBITX
                  <input className="ox-auth-input uppercase tracking-[0.2em]" value={humanCode} onChange={(e) => setHumanCode(e.target.value.toUpperCase())} placeholder="ORBITX" />
                  {errors.humanCode && <span className="text-xs text-[#ff4d6d] normal-case tracking-normal">{errors.humanCode}</span>}
                </label>
                <div>
                  <div className="ox-auth-label mb-2">Slide to verify</div>
                  <SliderCaptcha onVerify={(token) => setCaptchaToken(token)} />
                  {errors.captcha && <p className="mt-2 text-xs text-[#ff4d6d]">{errors.captcha}</p>}
                </div>
                <div className="hidden" aria-hidden>
                  <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                </div>
              </div>
            )}

            <button type="submit" className="ox-auth-btn" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Save password"}
            </button>
          </form>

          <div className="ox-auth-links mt-4">
            {mode === "signin" && (
              <button type="button" onClick={() => setMode("reset")}>Forgot password?</button>
            )}
            {mode === "reset" && (
              <button type="button" onClick={() => setMode("signin")}>Back to sign in</button>
            )}
            {mode === "update" && (
              <button type="button" onClick={() => { try { sessionStorage.removeItem("og_password_recovery"); } catch { /* noop */ } setMode("signin"); }}>Cancel</button>
            )}
            <Link to={`/auth?next=${encodeURIComponent(next)}`} className="inline-flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Main auth
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
