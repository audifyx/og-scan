'use client';

import React, { useState } from 'react';

interface McpControlPanelProps {
  agentId: string;
}

interface TradeCommand {
  direction: 'buy' | 'sell';
  tokenMint: string;
  amount: number;
}

export function McpControlPanel({ agentId }: McpControlPanelProps) {
  const [command, setCommand] = useState<TradeCommand>({
    direction: 'buy',
    tokenMint: '',
    amount: 0,
  });
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExecute = async () => {
    if (!command.tokenMint || command.amount <= 0) {
      setError('Please fill in all fields');
      return;
    }

    setIsExecuting(true);
    setError(null);

    try {
      const apiKey = localStorage.getItem('agent_api_key');
      const response = await fetch(`/api/agents/${agentId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          type: 'trade',
          direction: command.direction,
          tokenMint: command.tokenMint,
          amount: command.amount,
          slippageTolerancePercent: 0.5,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Execution failed');
      }

      const data = await response.json();
      setResult(data);
      setCommand({ direction: 'buy', tokenMint: '', amount: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-muted p-6 rounded-lg border border-border">
        <h3 className="text-xl font-bold text-foreground mb-6">Execute Trade</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Direction</label>
            <div className="flex gap-4">
              {(['buy', 'sell'] as const).map((dir) => (
                <label key={dir} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value={dir}
                    checked={command.direction === dir}
                    onChange={(e) => setCommand({ ...command, direction: e.target.value as 'buy' | 'sell' })}
                    className="w-4 h-4"
                  />
                  <span className={`font-semibold ${dir === 'buy' ? 'text-green-600' : 'text-red-600'}`}>
                    {dir.toUpperCase()}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Token Mint</label>
            <input
              type="text"
              value={command.tokenMint}
              onChange={(e) => setCommand({ ...command, tokenMint: e.target.value })}
              placeholder="Token contract address"
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Amount (in tokens)</label>
            <input
              type="number"
              value={command.amount}
              onChange={(e) => setCommand({ ...command, amount: parseFloat(e.target.value) })}
              placeholder="0.0"
              step="0.01"
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive text-destructive text-sm p-3 rounded">
              {error}
            </div>
          )}

          <button
            onClick={handleExecute}
            disabled={isExecuting}
            className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition"
          >
            {isExecuting ? 'Executing...' : 'Execute Trade'}
          </button>
        </div>
      </div>

      {result && (
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-6 rounded-lg">
          <h4 className="font-bold text-green-800 dark:text-green-300 mb-3">Execution Successful</h4>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-green-700 dark:text-green-400">Activity ID:</dt>
              <dd className="font-mono text-green-900 dark:text-green-200">{result.activityId.substring(0, 8)}</dd>
            </div>
            {result.txHash && (
              <div className="flex justify-between">
                <dt className="text-green-700 dark:text-green-400">TX Hash:</dt>
                <dd className="font-mono text-green-900 dark:text-green-200 break-all">{result.txHash.substring(0, 16)}...</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-green-700 dark:text-green-400">Time:</dt>
              <dd className="text-green-900 dark:text-green-200">{result.executionTimeMs}ms</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
