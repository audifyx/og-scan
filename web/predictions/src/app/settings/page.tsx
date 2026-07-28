'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Navbar } from '@/components/Navbar'
import { User, Bell, Wallet, Shield, Save, LogOut, Copy, CheckCheck, KeyRound, Trash2, Mail } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useWallet } from '@solana/wallet-adapter-react'
import clsx from 'clsx'

type Tab = 'profile' | 'notifications' | 'wallet' | 'security'
const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
  { id: 'security', label: 'Security', icon: Shield },
]

const fieldCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan/50 transition-all'
const card = 'bg-white/[0.03] border border-white/10 rounded-2xl p-5'
const labelCls = 'text-xs text-gray-500 uppercase tracking-widest block mb-2'

export default function SettingsPage() {
  const { profile, updateProfile, signOut } = useAuth()
  const { publicKey, disconnect } = useWallet()
  const [tab, setTab] = useState<Tab>('profile')
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '')
  const [username, setUsername] = useState(profile?.username ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [twitter, setTwitter] = useState(profile?.twitter ?? '')
  const [payoutWallet, setPayoutWallet] = useState(profile?.wallet ?? '')
  const [savingWallet, setSavingWallet] = useState(false)
  const [walletSaved, setWalletSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [notifToggles, setNotifToggles] = useState({ betJoined: true, betResolved: true, betExpired: false, marketing: false })

  // sync profile -> form when it loads/changes
  useEffect(() => {
    if (!profile) return
    setDisplayName(profile.displayName || '')
    setUsername(profile.username || '')
    setBio(profile.bio || '')
    setTwitter(profile.twitter || '')
    setPayoutWallet(profile.wallet || '')
  }, [profile])
  const [newPass, setNewPass] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMsg, setPwMsg] = useState('')
  const [resetMsg, setResetMsg] = useState('')
  const [delBusy, setDelBusy] = useState(false)

  const changePassword = async () => {
    setPwMsg('')
    if (newPass.length < 8) { setPwMsg('Password must be at least 8 characters.'); return }
    setPwBusy(true)
    try { const { error } = await supabase.auth.updateUser({ password: newPass }); if (error) throw error; setNewPass(''); setPwMsg('Password updated.') }
    catch (e: any) { setPwMsg(e.message || 'Could not update password.') } finally { setPwBusy(false) }
  }
  const sendReset = async () => {
    setResetMsg('')
    try { const { data } = await supabase.auth.getUser(); const email = data.user?.email; if (!email) { setResetMsg('No email on file.'); return }
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: typeof window !== 'undefined' ? window.location.origin + '/auth' : undefined }); if (error) throw error; setResetMsg('Reset link sent to your email.') }
    catch (e: any) { setResetMsg(e.message || 'Could not send reset email.') }
  }
  const deleteAccount = async () => {
    if (!confirm('Permanently delete your account and data? This cannot be undone.')) return
    if (!confirm('Are you absolutely sure? This is irreversible.')) return
    setDelBusy(true)
    try { const r = await fetch('/api/account/delete', { method: 'POST' }); const d = await r.json(); if (!d.ok) throw new Error(d.error || 'Failed')
      await supabase.auth.signOut(); window.location.assign('/') }
    catch (e: any) { alert(e.message || 'Could not delete account.'); setDelBusy(false) }
  }

  const handleSaveWallet = async () => {
    setSavingWallet(true)
    try { await updateProfile({ wallet: payoutWallet.trim() }); setWalletSaved(true); setTimeout(() => setWalletSaved(false), 2000) }
    catch (e: any) { alert(e.message) } finally { setSavingWallet(false) }
  }
  const handleSaveProfile = async () => {
    setSaving(true)
    try { await updateProfile({ displayName, username, bio, twitter }); setSaved(true); setTimeout(() => setSaved(false), 2000) }
    catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }
  const copyWallet = () => { if (!publicKey) return; navigator.clipboard.writeText(publicKey.toBase58()); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-black text-white mb-4">Settings</h1>

        {/* Tabs (scroll on mobile) */}
        <div className="flex gap-2 mb-6 overflow-x-auto [&::-webkit-scrollbar]:hidden -mx-1 px-1">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap border transition-all',
                tab === t.id ? 'bg-cyan text-black border-cyan' : 'text-gray-300 bg-white/[0.03] border-white/10 hover:text-white'
              )}>
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            )
          })}
        </div>

        {tab === 'profile' && (
          <div className={card}>
            <h2 className="text-white font-bold text-lg mb-5">Public Profile</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={labelCls}>Display Name</label><input value={displayName} onChange={e => setDisplayName(e.target.value)} className={fieldCls} /></div>
              <div><label className={labelCls}>Username</label><input value={username} onChange={e => setUsername(e.target.value)} className={fieldCls} /></div>
              <div className="sm:col-span-2"><label className={labelCls}>Bio</label><textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} className={clsx(fieldCls, 'resize-none')} /></div>
              <div className="sm:col-span-2"><label className={labelCls}>X (Twitter)</label><input value={twitter} onChange={e => setTwitter(e.target.value)} placeholder="@handle" className={fieldCls} /></div>
            </div>
            <button onClick={handleSaveProfile} disabled={saving} className="mt-5 w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan to-purple text-black rounded-xl text-sm font-black disabled:opacity-50">
              {saved ? <CheckCheck className="w-4 h-4" /> : <Save className="w-4 h-4" />} {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}

        {tab === 'notifications' && (
          <div className={clsx(card, 'space-y-1')}>
            <h2 className="text-white font-bold text-lg mb-3">Notification Preferences</h2>
            {Object.entries(notifToggles).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between gap-3 py-3 border-b border-white/5 last:border-0">
                <p className="text-white text-sm capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                <button onClick={() => setNotifToggles(p => ({ ...p, [key]: !val }))} className={clsx('w-12 h-6 rounded-full transition-all relative shrink-0', val ? 'bg-cyan' : 'bg-white/10')}>
                  <span className={clsx('absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all', val ? 'left-6' : 'left-0.5')} />
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'wallet' && (
          <div className="space-y-4">
            <div className={clsx(card, 'space-y-3')}>
              <h2 className="text-white font-bold text-lg">Payout wallet</h2>
              <p className="text-xs text-gray-500">Winnings are paid to this Solana address. Make sure it is correct.</p>
              <input value={payoutWallet} onChange={e => setPayoutWallet(e.target.value)} placeholder="Your Solana wallet address" className={clsx(fieldCls, 'font-mono text-xs')} />
              <button onClick={handleSaveWallet} disabled={savingWallet} className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-cyan to-purple text-black rounded-xl text-sm font-black disabled:opacity-50">
                {walletSaved ? '✓ Saved' : savingWallet ? 'Saving…' : 'Save payout wallet'}
              </button>
            </div>
            <div className={clsx(card, 'space-y-4')}>
              <h2 className="text-white font-bold text-lg">Connected Wallet</h2>
              {publicKey ? (
                <>
                  <div className="bg-black/30 rounded-xl p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0"><p className="text-xs text-gray-500 mb-1">Address</p><p className="text-white font-mono text-sm truncate">{publicKey.toBase58().slice(0, 16)}…{publicKey.toBase58().slice(-6)}</p></div>
                    <button onClick={copyWallet} className="text-gray-400 hover:text-white shrink-0">{copied ? <CheckCheck className="w-4 h-4 text-win" /> : <Copy className="w-4 h-4" />}</button>
                  </div>
                  <button onClick={() => disconnect()} className="flex items-center gap-2 text-loss hover:opacity-80 text-sm"><LogOut className="w-4 h-4" /> Disconnect Wallet</button>
                </>
              ) : <p className="text-gray-500 text-sm">No wallet connected</p>}
            </div>
          </div>
        )}

        {tab === 'security' && (
          <div className="space-y-4">
            <div className={card + ' space-y-3'}>
              <h2 className="text-white font-bold text-lg flex items-center gap-2"><KeyRound className="w-4 h-4 text-cyan" /> Change password</h2>
              <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="New password (min 8 chars)" className={fieldCls} />
              <div className="flex flex-wrap gap-2">
                <button onClick={changePassword} disabled={pwBusy} className="px-5 py-2.5 bg-gradient-to-r from-cyan to-purple text-black rounded-xl text-sm font-black disabled:opacity-50">{pwBusy ? 'Updating…' : 'Update password'}</button>
                <button onClick={sendReset} className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white text-sm font-bold"><Mail className="w-4 h-4" /> Email me a reset link</button>
              </div>
              {pwMsg && <p className="text-xs text-gray-400">{pwMsg}</p>}
              {resetMsg && <p className="text-xs text-gray-400">{resetMsg}</p>}
            </div>

            <div className={card + ' space-y-3 border-loss/20'}>
              <h2 className="text-loss font-bold text-lg flex items-center gap-2"><Trash2 className="w-4 h-4" /> Danger zone</h2>
              <p className="text-xs text-gray-500">Permanently delete your account, profile and history. This cannot be undone.</p>
              <button onClick={deleteAccount} disabled={delBusy} className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-loss/20 text-loss border border-loss/30 rounded-xl text-sm font-bold disabled:opacity-50"><Trash2 className="w-4 h-4" /> {delBusy ? 'Deleting…' : 'Delete account'}</button>
            </div>

            <button onClick={signOut} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white text-sm font-bold"><LogOut className="w-4 h-4" /> Sign Out</button>
          </div>
        )}
      </main>
    </div>
  )
}
