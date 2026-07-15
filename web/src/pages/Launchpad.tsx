/**
 * Launchpad — Token launcher for OrbitX.
 * 
 * Main features:
 * - Create new tokens with vanity mint addresses (ending in "obx")
 * - Gallery of previously launched tokens
 * - Real-time token metrics from Pump.fun API
 * - Wallet integration for signing transactions
 */

import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Rocket, ArrowRight } from "lucide-react";

export default function Launchpad() {
  return (
    <AppLayout>
      <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <Rocket className="h-12 w-12 text-blue-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">OrbitX Launchpad</h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            Launch your token on Pump.fun with a custom vanity address ending in "obx". Completely free.
          </p>
        </div>

        {/* Main content grid */}
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-8">
          {/* Create Token Card */}
          <Card className="border-blue-500/30 bg-gradient-to-br from-blue-950/50 to-slate-900 hover:border-blue-400/50 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Rocket className="h-5 w-5 text-blue-400" />
                Launch New Token
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-300">
                Create a new token with a custom vanity address ending in "obx". Get your coin live on Pump.fun in minutes.
              </p>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">✓</span>
                  <span>Vanity addresses ending in "obx"</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">✓</span>
                  <span>Free for all users</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">✓</span>
                  <span>Just network fees (≈0.02 SOL)</span>
                </li>
              </ul>
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-4">
                Launch Token
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Token Gallery Card */}
          <Card className="border-slate-600/30 bg-gradient-to-br from-slate-800/50 to-slate-900 hover:border-slate-500/50 transition-colors">
            <CardHeader>
              <CardTitle className="text-white">Your Launched Tokens</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-300">
                View all tokens you've launched through OrbitX. Check real-time metrics and performance.
              </p>
              <div className="text-sm text-slate-400 space-y-2">
                <p>Features:</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-slate-500">•</span>
                    <span>Real-time price data</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-slate-500">•</span>
                    <span>Liquidity tracking</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-slate-500">•</span>
                    <span>Transaction history</span>
                  </li>
                </ul>
              </div>
              <Button variant="outline" className="w-full border-slate-600 text-slate-300 hover:bg-slate-800 mt-4">
                View Tokens
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Features Section */}
        <div className="max-w-7xl mx-auto mt-12">
          <h2 className="text-2xl font-bold text-white mb-6">Why Use OrbitX Launchpad?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="border-slate-700/50 bg-slate-800/30">
              <CardContent className="pt-6">
                <h3 className="font-semibold text-white mb-2">Vanity Addresses</h3>
                <p className="text-sm text-slate-400">
                  Every token gets a custom mint address ending in "obx" for easy recognition and branding.
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-700/50 bg-slate-800/30">
              <CardContent className="pt-6">
                <h3 className="font-semibold text-white mb-2">Zero Launch Fees</h3>
                <p className="text-sm text-slate-400">
                  Completely free to launch. Only pay the standard Solana network fee when your token goes live.
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-700/50 bg-slate-800/30">
              <CardContent className="pt-6">
                <h3 className="font-semibold text-white mb-2">Integrated Tools</h3>
                <p className="text-sm text-slate-400">
                  Access all OrbitX tools including metrics, analytics, and community management in one place.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
