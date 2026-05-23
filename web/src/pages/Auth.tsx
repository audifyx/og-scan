import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Loader2, Mail, Lock, ArrowLeft, AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { z } from "zod";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");
const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be 20 characters or less")
  .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores");

type AuthMode = "signin" | "signup" | "reset";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading, signIn, signUp, resetPassword } = useAuth();

  const [mode, setMode] = useState<AuthMode>((searchParams.get("mode") as AuthMode) || "signin");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; username?: string; password?: string; confirm?: string }>({});

  useEffect(() => {
    if (!loading && user && mode !== "signup") navigate("/wallets");
  }, [user, loading, navigate, mode]);

  const validate = () => {
    const newErrors: typeof errors = {};
    try { emailSchema.parse(email); } catch (e) { if (e instanceof z.ZodError) newErrors.email = e.errors[0].message; }
    if (mode === "signup") {
      const clean = username.replace(/^@/, "");
      try { usernameSchema.parse(clean); } catch (e) { if (e instanceof z.ZodError) newErrors.username = e.errors[0].message; }
    }
    if (mode !== "reset") {
      try { passwordSchema.parse(password); } catch (e) { if (e instanceof z.ZodError) newErrors.password = e.errors[0].message; }
    }
    if (mode === "signup" && password !== confirmPassword) newErrors.confirm = "Passwords do not match";
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
        else { toast.success("Welcome back!"); navigate("/wallets"); }
      } else if (mode === "signup") {
        const clean = username.replace(/^@/, "");
        const { error } = await signUp(email, password, clean);
        if (error) toast.error(error.message.includes("already registered") ? "This email is already registered" : error.message);
        else { toast.success(`Welcome @${clean}!`); navigate("/setup"); }
      } else {
        const { error } = await resetPassword(email);
        if (error) toast.error(error.message);
        else { toast.success("Check your email for the reset link"); setMode("signin"); }
      }
    } finally { setIsSubmitting(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020915] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-og-lime" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020915] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background grid */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(hsl(var(--og-grid)/0.15)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--og-grid)/0.15)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,hsl(var(--og-cyan)/0.08),transparent)]" />

      <div className="w-full max-w-md relative z-10">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6 gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-og-lime"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl shadow-[0_0_80px_-30px_hsl(var(--og-cyan)/0.3)]">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="relative h-12 w-12 overflow-hidden rounded-full border-2 border-og-lime bg-og-ink shadow-[0_0_20px_-8px_hsl(var(--og-lime))]">
              <img src="/icon.png" alt="OGScan" className="h-full w-full object-cover" />
            </div>
            <span className="font-display text-xl font-black uppercase tracking-[0.22em] text-foreground">
              ogscan<span className="text-og-lime">.fun</span>
            </span>
          </div>

          <div className="text-center mb-8">
            <h1 className="font-display text-2xl font-black uppercase tracking-[0.1em]">
              {mode === "signin" && "Welcome Back"}
              {mode === "signup" && "Create Account"}
              {mode === "reset" && "Reset Password"}
            </h1>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              {mode === "signin" && "Sign in to your dashboard"}
              {mode === "signup" && "Join the OGScan platform"}
              {mode === "reset" && "Enter your email to reset"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Username</Label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="yourname"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10 h-12 rounded-xl border-white/10 bg-white/[0.04] font-mono text-sm focus:border-og-lime focus:ring-og-lime/20"
                  />
                </div>
                {errors.username && <p className="font-mono text-[10px] text-og-blood">{errors.username}</p>}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12 rounded-xl border-white/10 bg-white/[0.04] font-mono text-sm focus:border-og-lime focus:ring-og-lime/20"
                />
              </div>
              {errors.email && <p className="font-mono text-[10px] text-og-blood">{errors.email}</p>}
            </div>

            {mode !== "reset" && (
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-12 rounded-xl border-white/10 bg-white/[0.04] font-mono text-sm focus:border-og-lime focus:ring-og-lime/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-og-lime"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="font-mono text-[10px] text-og-blood">{errors.password}</p>}
              </div>
            )}

            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 h-12 rounded-xl border-white/10 bg-white/[0.04] font-mono text-sm focus:border-og-lime focus:ring-og-lime/20"
                  />
                </div>
                {errors.confirm && <p className="font-mono text-[10px] text-og-blood">{errors.confirm}</p>}
              </div>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 rounded-xl border border-og-lime bg-og-lime font-mono text-[11px] font-black uppercase tracking-[0.18em] text-og-ink shadow-[0_0_34px_-12px_hsl(var(--og-lime))] transition hover:bg-white active:scale-[0.98]"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {mode === "signin" && "Sign In"}
                  {mode === "signup" && "Create Account"}
                  {mode === "reset" && "Send Reset Link"}
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center space-y-2">
            {mode === "signin" && (
              <>
                <button type="button" onClick={() => setMode("reset")} className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-og-cyan transition-colors">
                  Forgot your password?
                </button>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  No account?{" "}
                  <button type="button" onClick={() => setMode("signup")} className="text-og-lime hover:underline font-bold">
                    Sign up
                  </button>
                </p>
              </>
            )}
            {mode === "signup" && (
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Have an account?{" "}
                <button type="button" onClick={() => setMode("signin")} className="text-og-lime hover:underline font-bold">
                  Sign in
                </button>
              </p>
            )}
            {mode === "reset" && (
              <button type="button" onClick={() => setMode("signin")} className="font-mono text-[10px] uppercase tracking-widest text-og-lime hover:underline font-bold">
                Back to sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
