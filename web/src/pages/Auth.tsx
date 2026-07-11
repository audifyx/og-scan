import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, AtSign, Eye, EyeOff, Fingerprint, Loader2, Lock, Mail, Radar, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");
const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be 20 characters or less")
  .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores");

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "#334155" };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score: 1, label: "Weak", color: "#f87171" };
  if (score === 2) return { score: 2, label: "Fair", color: "#fbbf24" };
  if (score === 3) return { score: 3, label: "Good", color: "#a3e635" };
  return { score: 4, label: "Strong", color: "#34d399" };
}

type AuthMode = "signin" | "signup" | "reset" | "update";

const modeCopy = {
  signin: {
    eyebrow: "Welcome back",
    title: "Open your On-Chain OS.",
    body: "Sign in to scan tokens, watch launches, and track your OG signals.",
    cta: "Sign in",
  },
   signup: {
     eyebrow: "Create account",
     title: "Join the On-Chain OS.",
     body: "Get instant access to the complete on-chain platform — scanning, trading, and social tools in one place.",
     cta: "Create account",
   },
   reset: {
    eyebrow: "Password reset",
    title: "Get a fresh access link.",
    body: "Enter your email and OrbitX will send the reset flow.",
    cta: "Send reset link",
  },
  update: {
    eyebrow: "Almost done",
    title: "Set a new password",
    body: "You arrived from a secure reset link. Choose a new password for your account.",
    cta: "Save new password",
  },
} satisfies Record<AuthMode, { eyebrow: string; title: string; body: string; cta: string }>;

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading, signIn, signUp, resetPassword, updatePassword } = useAuth();

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
  const [capsLock, setCapsLock] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; username?: string; password?: string; confirm?: string; humanCode?: string; captcha?: string }>({});

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) localStorage.setItem("og_ref_code", ref);
  }, [searchParams]);

  // Recovery-link landing: Supabase may deliver the token in the URL hash
  // (#access_token=...&type=recovery) or fire PASSWORD_RECOVERY (flagged in
  // sessionStorage by useAuth). Either way, show the set-new-password form.
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
      navigate(searchParams.get("next") || "/app");
    }
  }, [user, loading, navigate, mode, searchParams]);

  const validate = () => {
    const newErrors: typeof errors = {};
    if (mode !== "update") {
      try { emailSchema.parse(email); } catch (e) { if (e instanceof z.ZodError) newErrors.email = e.errors[0].message; }
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
    try {
      if (mode === "signin") {
        const { error } = await signIn(email, password);
        if (error) toast.error(error.message.includes("Invalid login") ? "Invalid email or password" : error.message);
        else {
          toast.success("Welcome back");
          navigate(searchParams.get("next") || "/app");
        }
      } else if (mode === "signup") {
        const clean = username.replace(/^@/, "");
        const guardResponse = await fetch("/api/signup-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
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

        const { error } = await signUp(email, password, clean);
        if (error) {
          toast.error(error.message.includes("already registered") ? "This email is already registered" : error.message);
        } else {
          toast.success(`Welcome @${clean}. Check your email to verify your account.`);
          navigate("/setup");
        }
      } else if (mode === "update") {
        const { error } = await updatePassword(password);
        if (error) toast.error(error.message);
        else {
          toast.success("Password updated — you're in");
          navigate("/app");
        }
      } else {
        const { error } = await resetPassword(email);
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
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-[#2F80FF]" />
      </div>
    );
  }

  const copy = modeCopy[mode];

  return (
    <main className="min-h-screen overflow-hidden bg-black text-white" style={{ fontFamily: "'Plus Jakarta Sans', 'Sora', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap');`}</style>
      <div className="pointer-events-none fixed inset-0 bg-cover bg-center" style={{ backgroundImage: "url(/bg/bg-nebula.jpg)", opacity: 0.34 }} />
      <div className="pointer-events-none fixed inset-0 bg-black/55 backdrop-blur-[2px]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_-5%,rgba(91,91,240,0.18),transparent_38%),radial-gradient(circle_at_85%_8%,rgba(155,107,255,0.12),transparent_40%),radial-gradient(circle_at_50%_115%,rgba(47,128,255,0.10),transparent_45%)]" />
      <div className="pointer-events-none fixed inset-0 grid-bg opacity-[0.11]" />

          <section className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl gap-6 px-4 py-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div className="hidden lg:block">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-7 gap-2 rounded-2xl text-white/52 hover:bg-white/[0.07] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back home
          </Button>

            <div className="max-w-md">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#9945FF]/25 bg-[#9945FF]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#9945FF]">
                <Sparkles className="h-3.5 w-3.5" />
                The On-Chain OS
              </div>
              <h1 className="text-5xl font-black leading-[0.92] tracking-normal">{copy.title}</h1>
              <p className="mt-4 text-base leading-7 text-white/55">{copy.body}</p>
            </div>

          <div className="mt-8 grid max-w-md grid-cols-2 gap-3">
            {[
              { label: "Scanner", Icon: Radar, text: "text-[#2F80FF]", bg: "bg-[#2F80FF]/10 border-[#2F80FF]/25" },
              { label: "Watchlists", Icon: Sparkles, text: "text-[#f472b6]", bg: "bg-[#f472b6]/10 border-[#f472b6]/25" },
              { label: "Wallets", Icon: Fingerprint, text: "text-[#FFC53D]", bg: "bg-[#FFC53D]/10 border-[#FFC53D]/25" },
              { label: "Spaces", Icon: ShieldCheck, text: "text-[#9945FF]", bg: "bg-[#9945FF]/10 border-[#9945FF]/25" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                <div className={`mb-4 grid h-10 w-10 place-items-center rounded-2xl border ${item.bg} ${item.text}`}>
                  <item.Icon className="h-5 w-5" />
                </div>
                <p className="font-black">{item.label}</p>
                <p className="mt-1 text-xs text-white/38">Synced in your account</p>
              </div>
            ))}
          </div>
        </div>

            <div className="flex min-h-[calc(100vh-2rem)] items-center justify-center lg:min-h-0">
          <div className="w-full max-w-[430px]">
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
              className="mb-4 gap-2 rounded-2xl text-white/52 hover:bg-white/[0.07] hover:text-white lg:hidden"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>

              <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-2.5 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-2xl">
                <div className="rounded-[1.6rem] border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5 backdrop-blur-xl">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 overflow-hidden rounded-xl border border-white/15 bg-white/10">
                      <img src="/og-logo.svg" alt="OrbitX" className="h-full w-full object-cover" />
                    </div>
                    <div>
                     <p className="text-xs font-black uppercase tracking-[0.18em]">The On-Chain OS</p>
                       <p className="text-[10px] font-semibold text-white/38">{copy.eyebrow}</p>
                    </div>
                  </div>
                  <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[#2F80FF]/25 bg-[#2F80FF]/10 text-[#2F80FF]">
                    <Lock className="h-4 w-4" />
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-1.5 rounded-2xl border border-white/10 bg-black/20 p-1">
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    className={`min-h-11 rounded-[0.9rem] text-sm font-black transition ${mode === "signin" ? "bg-white text-[#07101d]" : "text-white/45"}`}
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("signup")}
                    className={`min-h-11 rounded-[0.9rem] text-sm font-black transition ${mode === "signup" ? "bg-[#2F80FF] text-white" : "text-white/45"}`}
                  >
                    Sign up
                  </button>
                </div>

                 <div className="mb-4">
                   <h2 className="text-2xl font-black leading-none tracking-normal">{mode === "reset" ? "Reset password" : copy.title}</h2>
                   <p className="mt-2 text-xs leading-5 text-white/48">{copy.body}</p>
                 </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === "signup" && (
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-black uppercase tracking-[0.16em] text-white/42">Username</Label>
                      <div className="relative">
                        <AtSign className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                        <Input value={username} onChange={(e) => setUsername(e.target.value)} className="h-13 min-h-[52px] rounded-2xl border-white/10 bg-white/[0.07] pl-11 text-base text-white focus:border-[#2F80FF]" placeholder="yourname" />
                      </div>
                      {errors.username && <p className="text-xs font-semibold text-og-blood">{errors.username}</p>}
                    </div>
                  )}

                  {mode !== "update" && (
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-black uppercase tracking-[0.16em] text-white/42">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-[52px] rounded-2xl border-white/10 bg-white/[0.07] pl-11 text-base text-white focus:border-[#2F80FF]" placeholder="you@example.com" />
                    </div>
                    {errors.email && <p className="text-xs font-semibold text-og-blood">{errors.email}</p>}
                  </div>
                  )}

                  {mode !== "reset" && (
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-black uppercase tracking-[0.16em] text-white/42">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                        <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => setCapsLock(e.getModifierState && e.getModifierState("CapsLock"))} onKeyUp={(e) => setCapsLock(e.getModifierState && e.getModifierState("CapsLock"))} className="min-h-[52px] rounded-2xl border-white/10 bg-white/[0.07] pl-11 pr-12 text-base text-white transition-shadow focus:border-[#2F80FF] focus:shadow-[0_0_0_3px_rgba(47,128,255,0.15)]" placeholder="Password" />
                        <button type="button" onClick={() => setShowPassword((p) => !p)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/38 transition hover:text-white" aria-label={showPassword ? "Hide password" : "Show password"}>
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.password && <p className="text-xs font-semibold text-og-blood">{errors.password}</p>}
                      {capsLock && <p className="text-xs font-semibold text-amber-400">Caps Lock is on</p>}
                      {mode === "signup" && password.length > 0 && (() => {
                        const st = passwordStrength(password);
                        return (
                          <div className="flex items-center gap-2 pt-1">
                            <div className="flex h-1.5 flex-1 gap-1">
                              {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="h-full flex-1 rounded-full transition-colors duration-300" style={{ background: i <= st.score ? st.color : "rgba(255,255,255,0.08)" }} />
                              ))}
                            </div>
                            <span className="w-12 text-right text-[10px] font-black uppercase tracking-wider" style={{ color: st.color }}>{st.label}</span>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {mode === "update" && (
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-black uppercase tracking-[0.16em] text-white/42">Confirm new password</Label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                        <Input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="min-h-[48px] rounded-2xl border-white/10 bg-white/[0.07] pl-11 text-base text-white focus:border-[#2F80FF]" placeholder="Confirm new password" />
                      </div>
                      {errors.confirm && <p className="text-xs font-semibold text-og-blood">{errors.confirm}</p>}
                    </div>
                  )}

                  {mode === "signup" && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-black uppercase tracking-[0.16em] text-white/42">Confirm password</Label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                          <Input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="min-h-[48px] rounded-2xl border-white/10 bg-white/[0.07] pl-11 text-base text-white focus:border-[#2F80FF]" placeholder="Confirm password" />
                        </div>
                        {errors.confirm && <p className="text-xs font-semibold text-og-blood">{errors.confirm}</p>}
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-4">
                        <div>
                          <Label className="text-[11px] font-black uppercase tracking-[0.16em] text-white/42">Type ORBITX</Label>
                          <Input value={humanCode} onChange={(e) => setHumanCode(e.target.value.toUpperCase())} className="mt-2 min-h-[52px] rounded-2xl border-white/10 bg-white/[0.07] text-base uppercase tracking-[0.18em] text-white focus:border-[#2F80FF]" placeholder="ORBITX" />
                          {errors.humanCode && <p className="mt-1 text-xs font-semibold text-og-blood">{errors.humanCode}</p>}
                        </div>

                        <div>
                          <Label className="mb-3 block text-[11px] font-black uppercase tracking-[0.16em] text-white/42">
                            Slide to Verify
                          </Label>
                          <SliderCaptcha onVerify={(token) => setCaptchaToken(token)} />
                          {errors.captcha && <p className="mt-2 text-center text-xs font-semibold text-og-blood">{errors.captcha}</p>}
                        </div>

                        <div className="hidden" aria-hidden="true">
                          <Label>Leave this field empty</Label>
                          <Input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                        </div>
                      </div>
                    </>
                  )}

                  <Button type="submit" disabled={isSubmitting} className="min-h-[50px] w-full rounded-2xl bg-gradient-to-r from-[#2F80FF] to-[#9945FF] text-sm font-black text-white shadow-[0_18px_46px_-22px_rgba(47,128,255,0.9)] transition hover:brightness-110 active:scale-[0.98]">
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : copy.cta}
                  </Button>
                </form>

                <div className="mt-4 text-center">
                  {mode === "signin" && (
                    <button type="button" onClick={() => setMode("reset")} className="text-xs font-bold text-white/45 transition hover:text-[#9945FF]">
                      Forgot password?
                    </button>
                  )}
                  {mode === "signup" && (
                    <button type="button" onClick={() => setMode("signin")} className="text-xs font-bold text-white/45 transition hover:text-[#2F80FF]">
                      Already have an account? Sign in
                    </button>
                  )}
                  {mode === "reset" && (
                    <button type="button" onClick={() => setMode("signin")} className="text-xs font-bold text-[#2F80FF] transition hover:text-white">
                      Back to sign in
                    </button>
                  )}
                  {mode === "update" && (
                    <button type="button" onClick={() => { try { sessionStorage.removeItem("og_password_recovery"); } catch { /* noop */ } setMode("signin"); }} className="text-xs font-bold text-white/45 transition hover:text-white">
                      Cancel — back to sign in
                    </button>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-center gap-4 border-t border-white/[0.06] pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-white/25">
                  <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3 w-3 text-emerald-400/60" /> Encrypted</span>
                  <span className="inline-flex items-center gap-1.5"><Fingerprint className="h-3 w-3 text-[#2F80FF]/60" /> Bot-protected</span>
                  <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3 w-3 text-[#9945FF]/60" /> Private beta</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Auth;
