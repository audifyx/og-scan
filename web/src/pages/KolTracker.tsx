import React, { useState, useEffect, useRef } from 'react';
import { Bell, Bot, Upload, Trash2, Plus, AlertCircle, Check, Copy } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface TrackedKol {
  id: string;
  wallet: string;
  name: string;
  isActive: boolean;
}

interface BotConfig {
  id: string;
  telegramBotToken: string;
  botName: string;
  botBio: string;
  botImageUrl: string | null;
  trackAllKols: boolean;
  trackedKols: TrackedKol[];
  lastAlertSent?: string;
  status: 'active' | 'inactive' | 'error';
}

export default function KolTracker() {
  const { user } = useAuth();
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [botName, setBotName] = useState('');
  const [botBio, setBotBio] = useState('');
  const [botImage, setBotImage] = useState<File | null>(null);
  const [botImageUrl, setBotImageUrl] = useState<string | null>(null);
  const [trackAllKols, setTrackAllKols] = useState(true);
  const [selectedKolWallets, setSelectedKolWallets] = useState<string[]>([]);
  const [kolWalletInput, setKolWalletInput] = useState('');
  const [alerts, setAlerts] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sample KOL wallets (replace with your actual KOL list)
  const SAMPLE_KOLS = [
    { wallet: '5QPBQ...vt7a', name: 'Alpha Trader' },
    { wallet: '9w8Q2...kL9m', name: 'Whale Watcher' },
    { wallet: 'Eu8E5...3k2z', name: 'MemeLord' },
  ];

  useEffect(() => {
    if (user) {
      loadBotConfig();
      loadAlerts();
    }
  }, [user]);

  const loadBotConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('kol_tracker_bots')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (data) {
        setBotConfig(data);
        setBotToken(data.telegramBotToken || '');
        setBotName(data.botName || '');
        setBotBio(data.botBio || '');
        setBotImageUrl(data.botImageUrl || null);
        setTrackAllKols(data.trackAllKols || true);
        setSelectedKolWallets(data.trackedKols?.map((k: TrackedKol) => k.wallet) || []);
      }
    } catch (error) {
      console.error('Error loading bot config:', error);
    }
  };

  const loadAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from('kol_tracker_alerts')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) {
        setAlerts(data);
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBotImage(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setBotImageUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const validateBotToken = async () => {
    if (!botToken.trim()) {
      toast({ title: 'Bot token required', variant: 'destructive' });
      return false;
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      if (!response.ok) {
        toast({ title: 'Invalid bot token', variant: 'destructive' });
        return false;
      }
      return true;
    } catch {
      toast({ title: 'Failed to validate bot token', variant: 'destructive' });
      return false;
    }
  };

  const handleSaveBot = async () => {
    if (!user) {
      toast({ title: 'Please log in', variant: 'destructive' });
      return;
    }

    // Validate token
    const isValid = await validateBotToken();
    if (!isValid) return;

    setLoading(true);
    try {
      const trackedKols = trackAllKols
        ? SAMPLE_KOLS.map((kol) => ({ ...kol, id: kol.wallet, isActive: true }))
        : selectedKolWallets.map((wallet) => {
            const kol = SAMPLE_KOLS.find((k) => k.wallet === wallet);
            return { id: wallet, wallet, name: kol?.name || wallet, isActive: true };
          });

      const { error } = await supabase.from('kol_tracker_bots').upsert(
        {
          user_id: user.id,
          telegramBotToken: botToken,
          botName: botName || 'KOL Tracker Bot',
          botBio: botBio || 'Tracking KOL wallet activity',
          botImageUrl: botImageUrl,
          trackAllKols: trackAllKols,
          trackedKols: trackedKols,
          status: 'active',
        },
        { onConflict: 'user_id' }
      );

      if (error) throw error;

      toast({ title: '✅ Bot configured successfully' });
      setBotConfig({
        id: user.id,
        telegramBotToken: botToken,
        botName: botName || 'KOL Tracker Bot',
        botBio: botBio || 'Tracking KOL wallet activity',
        botImageUrl: botImageUrl,
        trackAllKols: trackAllKols,
        trackedKols: trackedKols as TrackedKol[],
        status: 'active',
      });
    } catch (error) {
      console.error('Error saving bot:', error);
      toast({ title: 'Failed to save bot configuration', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddKol = () => {
    if (!kolWalletInput.trim()) return;
    if (!selectedKolWallets.includes(kolWalletInput)) {
      setSelectedKolWallets([...selectedKolWallets, kolWalletInput]);
    }
    setKolWalletInput('');
  };

  const handleRemoveKol = (wallet: string) => {
    setSelectedKolWallets(selectedKolWallets.filter((w) => w !== wallet));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black">KOL Tracker</h1>
            <p className="text-muted-foreground text-sm">Monitor KOL wallet activity and get Telegram alerts</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Configuration Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Bot Setup */}
            <div className="rounded-2xl border border-border/30 bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-sm p-6">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Bot className="h-5 w-5 text-cyan-500" />
                Telegram Bot Configuration
              </h2>

              <div className="space-y-4">
                {/* Bot Token */}
                <div>
                  <label className="text-sm font-semibold text-foreground block mb-2">Telegram Bot Token</label>
                  <input
                    type="password"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder="e.g., 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                    className="w-full px-4 py-3 rounded-xl bg-background/50 border border-border/50 text-foreground placeholder-muted-foreground focus:outline-none focus:border-cyan-500/50"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Get a token from <a href="https://t.me/botfather" target="_blank" className="text-cyan-500 hover:underline">BotFather</a>
                  </p>
                </div>

                {/* Bot Name */}
                <div>
                  <label className="text-sm font-semibold text-foreground block mb-2">Bot Display Name</label>
                  <input
                    type="text"
                    value={botName}
                    onChange={(e) => setBotName(e.target.value)}
                    placeholder="e.g., My KOL Tracker"
                    className="w-full px-4 py-3 rounded-xl bg-background/50 border border-border/50 text-foreground placeholder-muted-foreground focus:outline-none focus:border-cyan-500/50"
                  />
                </div>

                {/* Bot Bio */}
                <div>
                  <label className="text-sm font-semibold text-foreground block mb-2">Bot Bio</label>
                  <textarea
                    value={botBio}
                    onChange={(e) => setBotBio(e.target.value)}
                    placeholder="Describe what your bot does..."
                    className="w-full px-4 py-3 rounded-xl bg-background/50 border border-border/50 text-foreground placeholder-muted-foreground focus:outline-none focus:border-cyan-500/50 resize-none"
                    rows={3}
                  />
                </div>

                {/* Bot Image */}
                <div>
                  <label className="text-sm font-semibold text-foreground block mb-2">Bot Profile Image</label>
                  <div className="flex gap-3 items-end">
                    <div className="relative flex-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full px-4 py-3 rounded-xl bg-background/50 border border-border/50 border-dashed hover:border-cyan-500/50 transition-colors flex items-center justify-center gap-2 text-muted-foreground hover:text-cyan-500"
                      >
                        <Upload className="h-4 w-4" />
                        Choose Image
                      </button>
                    </div>
                    {botImageUrl && (
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-border/50">
                        <img src={botImageUrl} alt="Bot" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* KOL Tracking */}
            <div className="rounded-2xl border border-border/30 bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-sm p-6">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Bell className="h-5 w-5 text-cyan-500" />
                KOL Tracking Settings
              </h2>

              {/* Track All vs Specific */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-background/30 border border-border/30">
                  <input
                    type="radio"
                    id="track-all"
                    checked={trackAllKols}
                    onChange={() => setTrackAllKols(true)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="track-all" className="flex-1 cursor-pointer">
                    <p className="font-semibold">Track All KOLs</p>
                    <p className="text-sm text-muted-foreground">Monitor all {SAMPLE_KOLS.length} KOLs in the network</p>
                  </label>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-xl bg-background/30 border border-border/30">
                  <input
                    type="radio"
                    id="track-specific"
                    checked={!trackAllKols}
                    onChange={() => setTrackAllKols(false)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="track-specific" className="flex-1 cursor-pointer">
                    <p className="font-semibold">Track Specific KOLs</p>
                    <p className="text-sm text-muted-foreground">Select individual wallets to monitor</p>
                  </label>
                </div>

                {!trackAllKols && (
                  <div className="space-y-3 mt-4 p-4 rounded-xl bg-background/20 border border-border/30">
                    {/* Quick Select from Sample */}
                    <p className="text-sm font-semibold text-muted-foreground">Quick Add Presets:</p>
                    <div className="flex flex-wrap gap-2">
                      {SAMPLE_KOLS.map((kol) => (
                        <button
                          key={kol.wallet}
                          onClick={() => {
                            if (!selectedKolWallets.includes(kol.wallet)) {
                              setSelectedKolWallets([...selectedKolWallets, kol.wallet]);
                            }
                          }}
                          className={cn(
                            'px-3 py-2 rounded-lg text-sm font-medium transition-colors border',
                            selectedKolWallets.includes(kol.wallet)
                              ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                              : 'bg-background/30 border-border/50 hover:border-cyan-500/50'
                          )}
                        >
                          {kol.name}
                        </button>
                      ))}
                    </div>

                    {/* Manual Add */}
                    <div className="flex gap-2 mt-4">
                      <input
                        type="text"
                        value={kolWalletInput}
                        onChange={(e) => setKolWalletInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') handleAddKol();
                        }}
                        placeholder="Add wallet address..."
                        className="flex-1 px-4 py-2 rounded-lg bg-background/50 border border-border/50 text-foreground placeholder-muted-foreground focus:outline-none focus:border-cyan-500/50 text-sm"
                      />
                      <button
                        onClick={handleAddKol}
                        className="px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30 transition-colors flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add
                      </button>
                    </div>

                    {/* Selected KOLs */}
                    {selectedKolWallets.length > 0 && (
                      <div className="space-y-2 mt-4">
                        <p className="text-sm font-semibold text-muted-foreground">Selected KOLs ({selectedKolWallets.length}):</p>
                        <div className="space-y-2">
                          {selectedKolWallets.map((wallet) => {
                            const kol = SAMPLE_KOLS.find((k) => k.wallet === wallet);
                            return (
                              <div key={wallet} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-background/20 border border-border/30">
                                <span className="text-sm">{kol?.name || wallet}</span>
                                <button
                                  onClick={() => handleRemoveKol(wallet)}
                                  className="p-1 hover:bg-red-500/20 rounded text-red-400 transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveBot}
              disabled={loading}
              className={cn(
                'w-full px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all',
                'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-lg hover:shadow-cyan-500/20',
                loading && 'opacity-50 cursor-not-allowed'
              )}
            >
              {loading ? 'Saving...' : <Check className="h-5 w-5" />}
              {loading ? 'Configuring Bot...' : 'Save & Activate Tracker'}
            </button>
          </div>

          {/* Status & Alerts Panel */}
          <div className="space-y-6">
            {/* Bot Status */}
            <div className="rounded-2xl border border-border/30 bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-sm p-6">
              <h3 className="font-bold mb-4">Bot Status</h3>
              {botConfig ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-3 h-3 rounded-full', botConfig.status === 'active' ? 'bg-green-500' : 'bg-gray-500')} />
                    <span className="text-sm font-semibold capitalize">{botConfig.status}</span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>
                      <span className="font-semibold">Name:</span> {botConfig.botName}
                    </p>
                    <p>
                      <span className="font-semibold">Tracking:</span> {botConfig.trackAllKols ? 'All KOLs' : `${botConfig.trackedKols?.length || 0} KOLs`}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No bot configured yet</p>
              )}
            </div>

            {/* Recent Alerts */}
            <div className="rounded-2xl border border-border/30 bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-sm p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Bell className="h-4 w-4 text-cyan-500" />
                Recent Alerts
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {alerts.length > 0 ? (
                  alerts.slice(0, 5).map((alert) => (
                    <div key={alert.id} className="text-xs p-3 rounded-lg bg-background/20 border border-border/30">
                      <p className="font-semibold text-foreground">{alert.kol_name}</p>
                      <p className="text-muted-foreground">{alert.transaction_type} {alert.token_symbol}</p>
                      <p className="text-muted-foreground text-xs">
                        {new Date(alert.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">No alerts yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default KolTracker;
