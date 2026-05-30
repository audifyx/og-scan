import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, AtSign, Eye, EyeOff, Fingerprint, Loader2, Lock, Mail, Radar, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { getDeviceFingerprint } from "@/hooks/useDeviceFingerprint";
import { Turnstile } from "@/components/Turnstile";
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

type AuthMode = "signin" | "signup" | "reset";

const modeCopy = {
  signin: {
    eyebrow: "Welcome back",
    title: "Open your command deck.",
    body: "Sign in to scan tokens, watch launches, and track your OG signals.",
    cta: "Sign in",
  },
  signup: {
    eyebrow: "Create account",
    title: "Start with the mobile deck.",
    body: "Build your profile, save watchlists, and keep scanner history in sync.",
    cta: "Create account",
  },
  reset: {
    eyebrow: "Password reset",
    title: "Get a fresh access link.",
    body: "Enter your email and OGScan will send the reset flow.",
    cta: "Send reset link",
  },
} satisfies Record<AuthMode, { eyebrow: string; title: string; body: string; cta: string }>;

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading, signIn, signUp, resetPassword } = useAuth();

  const [mode, setMode] = useState<AuthMode>((searchParams.get("mode") as AuthMode) || "signin");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const [formStartedAt] = useState(() => Date.now());
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; username?: string; password?: string; confirm?: string; humanCode?: string }>({});

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) localStorage.setItem("og_ref_code", ref);
  }, [searchParams]);

  useEffect(() => {
    const urlMode = searchParams.get("mode") as AuthMode | null;
    if (urlMode === "signin" || urlMode === "signup" || urlMode === "reset") setMode(urlMode);
  }, [searchParams]);

  useEffect(() => {
    if (!loading && user && mode !== "signup") {
      navigate(searchParams.get("next") || "/app");
    }
  }, [user, loading, navigate, mode, searchParams]);

  const validate = () => {
    const newErrors: typeof errors = {};
    try { emailSchema.parse(email); } catch (e) { if (e instanceof z.ZodError) newErrors.email = e.errors[0].message; }
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
    if (mode === "signup" && password !== confirmPassword) newErrors.confirm = "Passwords do not match";
    if (mode === "signup" && !captchaToken) newErrors.humanCode = "Please complete the human verification";
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
      <div className="flex min-h-screen items-center justify-center bg-[#050914]">
        <Loader2 className="h-8 w-8 animate-spin text-og-lime" />
      </div>
    );
  }

  const copy = modeCopy[mode];

  return (
    <main className="min-h-screen overflow-hidden bg-[#050914] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(34,211,238,0.16),transparent_30%),radial-gradient(circle_at_88%_10%,rgba(163,230,53,0.13),transparent_30%),radial-gradient(circle_at_48%_100%,rgba(244,114,182,0.12),transparent_36%)]" />
      <div className="pointer-events-none fixed inset-0 grid-bg opacity-[0.11]" />

      <section className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl gap-8 px-4 py-5 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div className="hidden lg:block">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-7 gap-2 rounded-2xl text-white/52 hover:bg-white/[0.07] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back home
          </Button>

          <div className="max-w-md">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-og-cyan/25 bg-og-cyan/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-og-cyan">
              <ShieldCheck className="h-3.5 w-3.5" />
              Secure access
            </div>
            <h1 className="text-6xl font-black leading-[0.92] tracking-normal">{copy.title}</h1>
            <p className="mt-5 text-lg leading-8 text-white/55">{copy.body}</p>
          </div>

          <div className="mt-8 grid max-w-md grid-cols-2 gap-3">
            {[
              { label: "Scanner", Icon: Radar, text: "text-og-lime", bg: "bg-og-lime/10 border-og-lime/25" },
              { label: "Watchlists", Icon: Sparkles, text: "text-[#f472b6]", bg: "bg-[#f472b6]/10 border-[#f472b6]/25" },
              { label: "Wallets", Icon: Fingerprint, text: "text-og-gold", bg: "bg-og-gold/10 border-og-gold/25" },
              { label: "Spaces", Icon: ShieldCheck, text: "text-og-cyan", bg: "bg-og-cyan/10 border-og-cyan/25" },
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

        <div className="flex min-h-[calc(100vh-2.5rem)] items-center justify-center lg:min-h-0">
          <div className="w-full max-w-[430px]">
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
              className="mb-4 gap-2 rounded-2xl text-white/52 hover:bg-white/[0.07] hover:text-white lg:hidden"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>

            <div className="rounded-[2rem] border border-white/12 bg-[#0b1423]/92 p-3 shadow-[0_24px_92px_-54px_rgba(34,211,238,0.95)] backdrop-blur-2xl">
              <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-5 sm:p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 overflow-hidden rounded-2xl border border-white/15 bg-white/10">
                      <img src="/icon.png" alt="OGScan" className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <p className="text-sm font-black uppercase tracking-[0.18em]">OGScan</p>
                      <p className="text-[10px] font-semibold text-white/38">{copy.eyebrow}</p>
                    </div>
                  </div>
                  <div className="grid h-11 w-11 place-items-center rounded-2xl border border-og-lime/25 bg-og-lime/10 text-og-lime">
                    <Lock className="h-4 w-4" />
                  </div>
                </div>

                <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/20 p-1">
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
                    className={`min-h-11 rounded-[0.9rem] text-sm font-black transition ${mode === "signup" ? "bg-og-lime text-og-ink" : "text-white/45"}`}
                  >
                    Sign up
                  </button>
                </div>

                <div className="mb-6">
                  <h2 className="text-3xl font-black leading-none tracking-normal">{mode === "reset" ? "Reset password" : copy.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-white/48">{copy.body}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === "signup" && (
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-black uppercase tracking-[0.16em] text-white/42">Username</Label>
                      <div className="relative">
                        <AtSign className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                        <Input value={username} onChange={(e) => setUsername(e.target.value)} className="h-13 min-h-[52px] rounded-2xl border-white/10 bg-white/[0.07] pl-11 text-base text-white focus:border-og-lime" placeholder="yourname" />
                      </div>
                      {errors.username && <p className="text-xs font-semibold text-og-blood">{errors.username}</p>}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-black uppercase tracking-[0.16em] text-white/42">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-[52px] rounded-2xl border-white/10 bg-white/[0.07] pl-11 text-base text-white focus:border-og-lime" placeholder="you@example.com" />
                    </div>
                    {errors.email && <p className="text-xs font-semibold text-og-blood">{errors.email}</p>}
                  </div>

                  {mode !== "reset" && (
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-black uppercase tracking-[0.16em] text-white/42">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                        <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="min-h-[52px] rounded-2xl border-white/10 bg-white/[0.07] pl-11 pr-12 text-base text-white focus:border-og-lime" placeholder="Password" />
                        <button type="button" onClick={() => setShowPassword((p) => !p)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/38 transition hover:text-white" aria-label={showPassword ? "Hide password" : "Show password"}>
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.password && <p className="text-xs font-semibold text-og-blood">{errors.password}</p>}
                    </div>
                  )}

                  {mode === "signup" && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-black uppercase tracking-[0.16em] text-white/42">Confirm password</Label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                          <Input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="min-h-[52px] rounded-2xl border-white/10 bg-white/[0.07] pl-11 text-base text-white focus:border-og-lime" placeholder="Confirm password" />
                        </div>
                        {errors.confirm && <p className="text-xs font-semibold text-og-blood">{errors.confirm}</p>}
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <Label className="mb-3 block text-[11px] font-black uppercase tracking-[0.16em] text-white/42">
                          Human Verification
                        </Label>
                        <Turnstile
                          onVerify={(token) => setCaptchaToken(token)}
                          onExpire={() => setCaptchaToken(null)}
                          onError={() => setCaptchaToken(null)}
                        />
                        {captchaToken && (
                          <p className="mt-2 text-center text-[10px] font-bold text-green-400/80">✓ Verified</p>
                        )}
                        {errors.humanCode && <p className="mt-2 text-center text-xs font-semibold text-og-blood">{errors.humanCode}</p>}
                        <div className="hidden" aria-hidden="true">
                          <Label>Leave this field empty</Label>
                          <Input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                        </div>
                      </div>
                    </>
                  )}

                  <Button type="submit" disabled={isSubmitting} className="min-h-[54px] w-full rounded-2xl bg-og-lime text-sm font-black text-og-ink shadow-[0_18px_46px_-30px_hsl(var(--og-lime))] transition hover:bg-white active:scale-[0.98]">
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : copy.cta}
                  </Button>
                </form>

                <div className="mt-5 text-center">
                  {mode === "signin" && (
                    <button type="button" onClick={() => setMode("reset")} className="text-xs font-bold text-white/45 transition hover:text-og-cyan">
                      Forgot password?
                    </button>
                  )}
                  {mode === "signup" && (
                    <button type="button" onClick={() => setMode("signin")} className="text-xs font-bold text-white/45 transition hover:text-og-lime">
                      Already have an account? Sign in
                    </button>
                  )}
                  {mode === "reset" && (
                    <button type="button" onClick={() => setMode("signin")} className="text-xs font-bold text-og-lime transition hover:text-white">
                      Back to sign in
                    </button>
                  )}
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
