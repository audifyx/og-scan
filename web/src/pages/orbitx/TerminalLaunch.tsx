/**
 * Terminal Launch - Create new tokens
 */

import { useState } from "react";
import { Upload, CheckCircle, AlertCircle } from "lucide-react";

type Step = "basic" | "advanced" | "review" | "confirm";

interface FormData {
  name: string;
  ticker: string;
  description: string;
  logo: string;
  supply: string;
  initialBuy: string;
}

export default function TerminalLaunch() {
  const [step, setStep] = useState<Step>("basic");
  const [formData, setFormData] = useState<FormData>({
    name: "",
    ticker: "",
    description: "",
    logo: "",
    supply: "1000000000",
    initialBuy: "1",
  });

  const handleInput = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const steps = ["basic", "advanced", "review", "confirm"] as const;
  const stepIndex = steps.indexOf(step);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-black/50 border border-green-500/20 rounded p-6">
        <h2 className="text-3xl font-bold text-green-400 mb-2">LAUNCH A TOKEN</h2>
        <p className="text-gray-500">No coding. No vectors. Just your vision.</p>
      </div>

      {/* Progress Bar */}
      <div className="bg-black/50 border border-green-500/20 rounded p-4">
        <div className="flex justify-between mb-4">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`text-xs font-bold uppercase ${i <= stepIndex ? 'text-green-400' : 'text-gray-600'}`}
            >
              {i + 1}. {s}
            </div>
          ))}
        </div>
        <div className="w-full h-2 bg-black/50 rounded overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-amber-500 transition-all"
            style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Form Content */}
      <div className="bg-black/50 border border-green-500/20 rounded p-6 space-y-4">
        {step === "basic" && (
          <div className="space-y-4">
            <h3 className="text-green-400 font-bold uppercase text-sm">Basic Info</h3>

            {/* Token Name */}
            <div>
              <label className="text-xs text-gray-500 uppercase block mb-2">Token Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInput("name", e.target.value)}
                placeholder="e.g. ORBITX"
                className="w-full bg-black/50 border border-green-500/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
              />
            </div>

            {/* Ticker */}
            <div>
              <label className="text-xs text-gray-500 uppercase block mb-2">Ticker *</label>
              <input
                type="text"
                value={formData.ticker}
                onChange={(e) => handleInput("ticker", e.target.value)}
                placeholder="OBX"
                maxLength={10}
                className="w-full bg-black/50 border border-green-500/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs text-gray-500 uppercase block mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInput("description", e.target.value)}
                placeholder="What is this token? Why does it exist?"
                rows={4}
                className="w-full bg-black/50 border border-green-500/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500 resize-none"
              />
            </div>

            {/* Logo */}
            <div>
              <label className="text-xs text-gray-500 uppercase block mb-2">Logo Image</label>
              <div className="border-2 border-dashed border-green-500/30 rounded p-6 text-center hover:border-green-500/60 transition cursor-pointer">
                <Upload className="w-6 h-6 text-green-400 mx-auto mb-2" />
                <div className="text-sm text-gray-400">Drag & drop or click to upload</div>
                <div className="text-xs text-gray-600">PNG, JPG up to 2MB</div>
              </div>
            </div>
          </div>
        )}

        {step === "advanced" && (
          <div className="space-y-4">
            <h3 className="text-green-400 font-bold uppercase text-sm">Advanced Settings</h3>

            {/* Supply */}
            <div>
              <label className="text-xs text-gray-500 uppercase block mb-2">Total Supply</label>
              <input
                type="text"
                value={formData.supply}
                onChange={(e) => handleInput("supply", e.target.value)}
                className="w-full bg-black/50 border border-green-500/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
              />
            </div>

            {/* Initial Buy */}
            <div>
              <label className="text-xs text-gray-500 uppercase block mb-2">Initial Buy (SOL)</label>
              <input
                type="text"
                value={formData.initialBuy}
                onChange={(e) => handleInput("initialBuy", e.target.value)}
                placeholder="1.0"
                className="w-full bg-black/50 border border-green-500/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
              />
              <div className="text-xs text-gray-600 mt-2">Provides initial liquidity to the bonding curve</div>
            </div>

            {/* Fee Info */}
            <div className="bg-black/50 border border-amber-500/20 rounded p-3 text-xs text-amber-300">
              <AlertCircle className="w-4 h-4 inline mr-2" />
              $2.00 launch fee • 2.5% creator fee on all trades
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <h3 className="text-green-400 font-bold uppercase text-sm">Review Launch</h3>
            <div className="bg-black/50 border border-green-500/10 rounded p-4 space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-gray-500">Name</span><span className="text-white font-bold">{formData.name}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Ticker</span><span className="text-white font-bold">{formData.ticker}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Supply</span><span className="text-white font-bold">{formData.supply}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Initial Buy</span><span className="text-white font-bold">{formData.initialBuy} SOL</span></div>
              <div className="border-t border-green-500/10 pt-2 mt-2 flex justify-between"><span className="text-gray-500">Total Cost</span><span className="text-green-400 font-bold">$2.00 + gas</span></div>
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div className="text-center space-y-4">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto" />
            <div>
              <h4 className="text-green-400 font-bold text-lg">READY TO LAUNCH</h4>
              <p className="text-gray-500 text-sm">Click below to confirm with your wallet</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-4">
        <button
          onClick={() => {
            const currentIdx = steps.indexOf(step);
            if (currentIdx > 0) setStep(steps[currentIdx - 1]);
          }}
          disabled={step === "basic"}
          className="flex-1 py-3 border border-green-500/20 text-green-400 font-bold uppercase rounded hover:bg-green-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          ← Back
        </button>

        <button
          onClick={() => {
            const currentIdx = steps.indexOf(step);
            if (currentIdx < steps.length - 1) {
              setStep(steps[currentIdx + 1]);
            } else {
              alert("Launching token...");
            }
          }}
          className="flex-1 py-3 bg-gradient-to-r from-green-500 to-amber-500 text-black font-bold uppercase rounded hover:from-green-600 hover:to-amber-600 transition"
        >
          {step === "confirm" ? "🚀 LAUNCH TOKEN" : "Next →"}
        </button>
      </div>
    </div>
  );
}
