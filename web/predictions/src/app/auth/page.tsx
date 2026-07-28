'use client'
import { Suspense } from 'react'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useWallet } from '@solana/wallet-adapter-react'
import { Zap, Mail, Lock, User, Eye, EyeOff, ArrowRight, Github, Chrome, Wallet as WalletIcon } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

type Mode = 'signin' | 'signup'

function AuthPage() {
  const router = useRouter()
  const params = useSearchParams()
  const redirect = params.get('redirect') ?? '/app'
  const { publicKey } = useWallet()
  const { isAuthenticated, signInWithEmail, signUpWithEmail, loading } = useAuth()

  const [mode, setMode] = useState<Mode>(params.get('mode') === 'signup' ? 'signup' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [payoutWallet, setPayoutWallet] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isAuthenticated && !loading) window.location.assign(redirect)
  }, [isAuthenticated, loading, redirect])

  useEffect(() => { if (publicKey && !payoutWallet) setPayoutWallet(publicKey.toBase58()) }, [publicKey, payoutWallet])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password)
        window.location.assign(redirect)
        return
      } else {
        await signUpWithEmail(email, password, username, payoutWallet)
        setSuccess('Check your email to confirm your account.')
      }
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#080808] flex">
      {/* Left panel — decorative */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#9945FF]/20 to-[#14F195]/10 items-center justify-center p-12">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
        {/* Floating cards */}
        <div className="relative z-10 space-y-4 w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">OrbitX</span>
          </div>
          {[
            { label: 'SOL hits $500 before July', amount: '2.5 SOL', status: 'open', color: '#14F195' },
            { label: 'BTC dominance drops below 48%', amount: '1.0 SOL', status: 'active', color: '#9945FF' },
            { label: 'Solana surpasses Ethereum TVL', amount: '5.0 SOL', status: 'resolved', color: '#FFB547' },
          ].map((bet, i) => (
            <div
              key={i}
              className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4 transform transition-all hover:-translate-y-1"
              style={{ animationDelay: `${i * 200}ms` }}
            >
              <div className="flex items-start justify-between">
                <p className="text-white text-sm font-medium leading-snug max-w-[200px]">{bet.label}</p>
                <span className="text-xs px-2 py-1 rounded-full font-semibold" style={{ color: bet.color, background: bet.color + '20' }}>
                  {bet.status}
                </span>
              </div>
              <p className="text-gray-400 text-xs mt-2">{bet.amount} · Escrow locked</p>
            </div>
          ))}
          <p className="text-gray-500 text-sm mt-6">
            Trustless P2P bets on Solana. Your wallet, your rules.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Logo (mobile) */}
          <div className="flex lg:hidden items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold text-white">OrbitX</span>
          </div>

          <h1 className="text-3xl font-bold text-white mb-2">
            {mode === 'signin' ? 'Welcome back' : 'Create account'}
          </h1>
          <p className="text-gray-400 mb-8">
            {mode === 'signin'
              ? 'Sign in to access your bets and stats.'
              : 'Join the degen betting arena on Solana.'}
          </p>

          {/* Wallet connect */}
          <div className="mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Connect wallet</p>
            <WalletMultiButton className="!w-full !justify-center" />
            {publicKey && (
              <p className="text-xs text-[#14F195] mt-2 text-center">
                ✓ {publicKey.toBase58().slice(0,6)}…{publicKey.toBase58().slice(-4)} connected
              </p>
            )}
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs text-gray-500 uppercase tracking-widest">
              <span className="px-3 bg-[#080808]">or continue with email</span>
            </div>
          </div>

          {/* Email form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#9945FF] focus:ring-1 focus:ring-[#9945FF] transition-all"
                />
              </div>
              <div className="relative">
                <WalletIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Solana wallet address (for USDC payouts)"
                  value={payoutWallet}
                  onChange={e => setPayoutWallet(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#9945FF] focus:ring-1 focus:ring-[#9945FF] transition-all font-mono text-xs"
                />
              </div>
              <p className="text-[11px] text-gray-500 -mt-1">Winnings are paid in USDC to this Solana address. You can change it later in Settings.</p>
              </>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#9945FF] focus:ring-1 focus:ring-[#9945FF] transition-all"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#9945FF] focus:ring-1 focus:ring-[#9945FF] transition-all"
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 text-[#14F195] text-sm">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-[#9945FF] to-[#14F195] hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
              {!submitting && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setSuccess('') }}
              className="text-[#9945FF] hover:text-[#14F195] transition-colors font-medium"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function AuthPageRoot() {
  return <Suspense fallback={null}><AuthPage /></Suspense>
}
