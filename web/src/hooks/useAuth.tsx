import { useState, useEffect, createContext, useContext, type ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { trackActivity } from "@/lib/trackActivity";
import { setSentryUser, clearSentryUser } from "@/lib/sentry";
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
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ error: Error | null }>;
  changeEmail: (newEmail: string, currentPassword: string) => Promise<{ error: Error | null }>;
  sendEmailVerification: () => Promise<{ error: Error | null }>;
  deleteAccount: (password: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

import { isPreview, previewUser, previewProfile } from "@/lib/preview";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const _preview = isPreview();
  const [user, setUser] = useState<User | null>(_preview ? (previewUser() as unknown as User) : null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(_preview ? (previewProfile() as unknown as Profile) : null);
  const [loading, setLoading] = useState(!_preview);

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
    if (_preview) return; // preview mode: skip real auth
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
        setSentryUser(sess.user.id, sess.user.user_metadata?.username);
        setTimeout(() => fetchProfile(sess.user.id, sess.user.email, sess.user.user_metadata), 0);
      } else {
        clearSentryUser();
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
        // Try edge function first, fall back to direct insert
        (async () => {
          try {
            const { error: fnErr } = await supabase.functions.invoke("process-referral", {
              body: { inviteeId: data.user.id, inviteCode: refCode },
            });
            if (fnErr) throw fnErr;
          } catch (edgeFnErr) {
            console.warn("Edge function failed, using direct referral insert:", edgeFnErr);
            try {
              // Look up inviter by referral_code
              const { data: inviter } = await supabase
                .from("profiles")
                .select("user_id")
                .eq("referral_code", refCode)
                .maybeSingle();
              if (inviter && inviter.user_id !== data.user!.id) {
                // Insert referral directly (count-based, no points)
                await supabase.from("referrals").insert({
                  inviter_id: inviter.user_id,
                  invitee_id: data.user!.id,
                  code: refCode,
                });
                // Set referred_by on invitee profile
                await supabase
                  .from("profiles")
                  .update({ referred_by: inviter.user_id })
                  .eq("user_id", data.user!.id);
              }
            } catch (directErr) {
              console.error("Direct referral insert also failed:", directErr);
            }
          }
        })();
      }
      // Track sign-up event
      trackActivity({
        user_id: data.user.id,
        activity_type: "auth.signup",
        title: "Signed up",
        description: `New account created with username ${cleanUsername}`,
        data: { username: cleanUsername },
        is_public: false,
      });
    }

    return { error: error as Error | null, userId: data?.user?.id ?? null };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data?.user) {
      trackActivity({
        user_id: data.user.id,
        activity_type: "auth.signin",
        title: "Signed in",
        data: { method: "email" },
        is_public: false,
      });
    }
    return { error: error as Error | null };
  };

  const signOut = async () => {
    // Track sign-out before clearing state
    if (user) {
      await trackActivity({
        user_id: user.id,
        activity_type: "auth.signout",
        title: "Signed out",
        is_public: false,
      });
    }
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

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!user || !user.email) return { error: new Error("Not authenticated") };
    
    // Verify current password by re-authenticating
    const { error: reAuthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    
    if (reAuthError) {
      return { error: new Error("Current password is incorrect") };
    }

    // Update to new password
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) {
      trackActivity({
        user_id: user.id,
        activity_type: "auth.password_changed",
        title: "Password changed",
        is_public: false,
      });
    }
    return { error: error as Error | null };
  };

  const changeEmail = async (newEmail: string, currentPassword: string) => {
    if (!user || !user.email) return { error: new Error("Not authenticated") };

    // Verify current password first
    const { error: reAuthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    
    if (reAuthError) {
      return { error: new Error("Password is incorrect") };
    }

    // Request email change (sends confirmation to new email)
    const { error } = await supabase.auth.updateUser(
      { email: newEmail },
      { emailRedirectTo: `${window.location.origin}/` }
    );

    if (!error) {
      trackActivity({
        user_id: user.id,
        activity_type: "auth.email_change_requested",
        title: "Email change requested",
        data: { new_email: newEmail },
        is_public: false,
      });
    }
    return { error: error as Error | null };
  };

  const sendEmailVerification = async () => {
    if (!user || !user.email) return { error: new Error("Not authenticated") };

    try {
      const response = await fetch(
        `${window.location.origin}/functions/v1/send-email-verification`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const data = await response.json();
        return { error: new Error(data.error || "Failed to send verification email") };
      }

      trackActivity({
        user_id: user.id,
        activity_type: "auth.verification_sent",
        title: "Email verification sent",
        is_public: false,
      });

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const deleteAccount = async (password: string) => {
    if (!user || !user.email) return { error: new Error("Not authenticated") };

    // Verify password before deletion
    const { error: reAuthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });
    
    if (reAuthError) {
      return { error: new Error("Password is incorrect") };
    }

    try {
      const response = await fetch(
        `${window.location.origin}/functions/v1/delete-account`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const data = await response.json();
        return { error: new Error(data.error || "Failed to delete account") };
      }

      // Sign out user after deletion
      await supabase.auth.signOut();
      setProfile(null);

      trackActivity({
        user_id: user.id,
        activity_type: "auth.account_deleted",
        title: "Account deleted",
        is_public: false,
      });

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signUp, signIn, signOut, resetPassword, updateProfile, changePassword, changeEmail, sendEmailVerification, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
