'use client'
import { useEffect, useState, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useWallet } from '@solana/wallet-adapter-react'

export interface Profile {
  id: string
  authId: string | null
  wallet: string | null
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  twitter: string | null
  wins: number
  losses: number
  totalBets: number
  totalWagered: number
}

function rowToProfile(r: any): Profile {
  return {
    id: r.id,
    authId: r.user_id,
    wallet: r.wallet,
    username: r.username,
    displayName: r.display_name ?? r.username ?? '',
    avatarUrl: r.avatar_url,
    bio: r.bio ?? '',
    twitter: r.twitter ?? '',
    wins: r.wins ?? 0,
    losses: r.losses ?? 0,
    totalBets: r.total_bets ?? 0,
    totalWagered: Number(r.total_wagered_sol ?? 0),
  }
}

export function useAuth() {
  const { publicKey, signMessage } = useWallet()
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (data) setProfile(rowToProfile(data))
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) await fetchProfile(session.user.id)
        else setProfile(null)
      }
    )
    return () => subscription.unsubscribe()
  }, [fetchProfile])

  // Attach wallet to existing profile
  useEffect(() => {
    if (!user || !publicKey || !profile) return
    if (profile.wallet === publicKey.toBase58()) return
    supabase
      .from('profiles')
      .update({ wallet: publicKey.toBase58() })
      .eq('user_id', user.id)
      .then(() => fetchProfile(user.id))
  }, [user, publicKey, profile, fetchProfile])

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signUpWithEmail = useCallback(async (email: string, password: string, username?: string, wallet?: string) => {
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: username ?? email.split('@')[0] } },
    })
    if (error) throw error
    // Update username if provided
    if (data.user) {
      const upd: any = {}
      if (username) { upd.username = username; upd.display_name = username }
      if (wallet && wallet.trim()) upd.wallet = wallet.trim()
      if (Object.keys(upd).length) {
        await supabase.from('profiles').update(upd).eq('user_id', data.user.id)
      }
    }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!user) throw new Error('Not authenticated')
    const dbUpdates: any = {}
    if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName
    if (updates.username !== undefined) dbUpdates.username = updates.username
    if (updates.bio !== undefined) dbUpdates.bio = updates.bio
    if (updates.twitter !== undefined) dbUpdates.twitter = updates.twitter
    if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl
    if (updates.wallet !== undefined) dbUpdates.wallet = updates.wallet

    const { error } = await supabase
      .from('profiles')
      .update(dbUpdates)
      .eq('user_id', user.id)
    if (error) throw error
    await fetchProfile(user.id)
  }, [user, fetchProfile])

  return {
    user,
    session,
    profile,
    loading,
    isAuthenticated: !!user,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    updateProfile,
    refreshProfile: () => user ? fetchProfile(user.id) : Promise.resolve(),
  }
}
