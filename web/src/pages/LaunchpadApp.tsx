import { useEffect, useRef, useState } from "react";
import Launch from "./Launch";
import { useWallet } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/button";

/**
 * LaunchpadApp: Wraps the Launch component with Hub-style UI
 * Combines the full token creation functionality with a modern design
 */
export default function LaunchpadApp() {
  const { connected } = useWallet();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(true);
  }, []);

  if (!connected) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-gradient-to-br from-violet-500/30 to-purple-700/30 border border-violet-500/50 mb-6">
              <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h1 className="text-3xl font-black text-white mb-2">Launchpad</h1>
            <p className="text-white/50">Create tokens with custom vanity addresses</p>
          </div>
          
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.02] backdrop-blur-sm p-6 mb-8">
            <p className="text-sm text-white/70 mb-4">Connect your wallet to launch your token</p>
            <div className="flex justify-center">
              <Button className="bg-violet-600 hover:bg-violet-700">Connect Wallet</Button>
            </div>
          </div>

          <p className="text-xs text-white/30">
            Free token launches with "obx" vanity addresses<br/>Just network fees
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-purple-950 to-slate-950">
      {/* Hub-style header bar */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between h-14 px-4 bg-white/[0.05] backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold text-white">Launchpad</div>
            <div className="text-[10px] text-white/40">Create Tokens</div>
          </div>
        </div>
        <div className="text-xs text-white/60">🟢 Connected</div>
      </div>

      {/* Main content area with Hub-style padding */}
      <div className="pt-16 pb-20 px-4 max-w-4xl mx-auto">
        {isReady && <Launch />}
      </div>
    </div>
  );
}
