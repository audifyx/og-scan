import { useState, useEffect, createContext, useContext, type ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  canUseReservedUsername,
  getReservedUsernameMessage,
  isReservedUsername,
  normalizeUsernameForPolicy,
} from "@/lib/usernamePolicy";

export interface Profile {
  id: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  banner_url?: string | null;
  display_name?: string | null;
  verified?: boolean | null;
  is_official_account?: boolean | null;
  affiliate_org_id?: string | null;
  reputation_score?: number | null;
  current_level?: number | null;
  daily_streak?: number | null;
  created_at: string;
  updated_at?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<{ error: Error | null; userId?: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string, userEmail?: string, userMeta?: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!error && data) {
      setProfile(data as Profile);
      // Auto-generate referral code if missing
      if (!data.referral_code) {
        const code = userId.replace(/-/g, "").slice(0, 8).toUpperCase();
        supabase.from("profiles").update({ referral_code: code }).eq("user_id", userId).then(() => {
          setProfile(prev => prev ? { ...prev, referral_code: code } as any : prev);
        });
      }
    } else if (error && error.code === "PGRST116") {
      const requestedUsername = typeof userMeta?.username === "string" ? normalizeUsernameForPolicy(userMeta.username) : null;
      const username = requestedUsername && (!isReservedUsername(requestedUsername) || canUseReservedUsername(userEmail))
        ? requestedUsername
        : null;
      const { data: newProfile } = await supabase
        .from("profiles")
        .insert({ user_id: userId, username })
        .select()
        .single();
      if (newProfile) setProfile(newProfile as Profile);
    }
  };

  useEffect(() => {
    let resolved = false;

    // Safety timeout — if Supabase auth doesn't resolve in 5s, unblock the app
    const safetyTimeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        setLoading(false);
      }
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => fetchProfile(sess.user.id, sess.user.email, sess.user.user_metadata), 0);
      } else {
        setProfile(null);
      }
      if (!resolved) {
        resolved = true;
        clearTimeout(safetyTimeout);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) fetchProfile(sess.user.id, sess.user.email, sess.user.user_metadata);
      if (!resolved) {
        resolved = true;
        clearTimeout(safetyTimeout);
      }
      setLoading(false);
    });

    return () => {
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, username: string) => {
    const cleanUsername = normalizeUsernameForPolicy(username);
    if (isReservedUsername(cleanUsername) && !canUseReservedUsername(email)) {
      return { error: new Error(getReservedUsernameMessage()), userId: null };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { username: cleanUsername },
      },
    });

    // Process referral if ?ref= was captured
    if (!error && data?.user) {
      const refCode = localStorage.getItem("og_ref_code");
      if (refCode) {
        localStorage.removeItem("og_ref_code");
        supabase.functions.invoke("process-referral", {
          body: { inviteeId: data.user.id, inviteCode: refCode },
        }).catch(() => {}); // fire-and-forget
      }
    }

    return { error: error as Error | null, userId: data?.user?.id ?? null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    return { error: error as Error | null };
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error("Not authenticated") };

    if (typeof updates.username === "string") {
      const cleanUsername = normalizeUsernameForPolicy(updates.username);
      if (isReservedUsername(cleanUsername) && !canUseReservedUsername(user.email)) {
        return { error: new Error(getReservedUsernameMessage()) };
      }
      updates = { ...updates, username: cleanUsername };
    }

    const { error } = await supabase.from("profiles").update(updates).eq("user_id", user.id);
    if (!error) await fetchProfile(user.id);
    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signUp, signIn, signOut, resetPassword, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
