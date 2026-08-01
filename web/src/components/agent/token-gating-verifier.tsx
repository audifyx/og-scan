'use client';

import React, { useState } from 'react';

export function TokenGatingVerifier() {
  const [tokenCA] = useState('13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9');
  const [currentHolding, setCurrentHolding] = useState<number | null>(null);
  const [cumulativeBuys, setCumulativeBuys] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="bg-background border-2 border-destructive rounded-lg p-8 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0 4v2m0-14H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2h-7z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Token Verification Required</h1>
            <p className="text-muted-foreground">
              You need to hold a minimum of $10 worth of ORBITX tokens to access the Agent MCP system.
            </p>
          </div>

          <div className="bg-muted rounded-lg p-6 mb-6 space-y-4 text-left">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Required Token</p>
              <p className="font-mono text-sm break-all text-foreground bg-background p-3 rounded">
                {tokenCA}
              </p>
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="font-semibold text-foreground mb-3">How to Unlock Access</h3>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <span className="text-primary font-semibold">1.</span> Buy ORBITX tokens through Jupiter or any supported DEX
                </li>
                <li>
                  <span className="text-primary font-semibold">2.</span> Your cumulative buy value must total $10 or more
                </li>
                <li>
                  <span className="text-primary font-semibold">3.</span> OR hold at least $10 worth of ORBITX tokens in your wallet
                </li>
                <li>
                  <span className="text-primary font-semibold">4.</span> Connect your wallet and verify your holdings
                </li>
              </ol>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-xs text-muted-foreground mb-3">
                Current Status (if connected):
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between p-2 bg-background rounded">
                  <span className="text-muted-foreground">Current Holdings:</span>
                  <span className="text-foreground font-semibold">{currentHolding ? `$${currentHolding.toFixed(2)}` : 'Not verified'}</span>
                </div>
                <div className="flex justify-between p-2 bg-background rounded">
                  <span className="text-muted-foreground">Cumulative Buys:</span>
                  <span className="text-foreground font-semibold">{cumulativeBuys ? `$${cumulativeBuys.toFixed(2)}` : 'Not verified'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <a
              href="https://jup.ag/swap/USDC-ORBITX"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition text-center"
            >
              Buy ORBITX on Jupiter
            </a>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-6 py-3 border border-border text-foreground rounded-lg font-semibold hover:bg-muted transition"
            >
              Verify Holdings
            </button>
          </div>

          <p className="text-xs text-muted-foreground mt-6">
            By accessing this system, you agree to hold and maintain the minimum token requirement. Violation may result in access revocation.
          </p>
        </div>
      </div>
    </div>
  );
}
