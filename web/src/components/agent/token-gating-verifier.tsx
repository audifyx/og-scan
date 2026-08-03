

import React from 'react';

export function TokenGatingVerifier() {
  return (
    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
      <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">Token Verification</h3>
      <p className="text-sm text-blue-800 dark:text-blue-400">
        Hold $10+ of ORBITX tokens or $10+ cumulative purchases to access the agent system.
      </p>
      <p className="text-xs text-blue-700 dark:text-blue-500 mt-2 font-mono break-all">
        13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9
      </p>
    </div>
  );
}
