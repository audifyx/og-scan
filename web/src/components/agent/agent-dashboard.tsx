'use client';

import React, { useState } from 'react';
import { AgentsList } from './agents-list';
import { CreateAgentModal } from './create-agent-modal';

export function AgentDashboard() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleAgentCreated = () => {
    setShowCreateModal(false);
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground">AI Agents</h1>
          <p className="text-muted-foreground mt-2">Create and manage autonomous trading agents</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition"
        >
          Create Agent
        </button>
      </div>

      <AgentsList refreshTrigger={refreshTrigger} />

      {showCreateModal && (
        <CreateAgentModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleAgentCreated}
        />
      )}
    </div>
  );
}
