

import React, { useState, useEffect } from 'react';

interface Activity {
  id: string;
  activityType: string;
  action: string;
  status: string;
  description?: string;
  txHash?: string;
  createdAt: string;
  completedAt?: string;
}

interface AgentActivityProps {
  agentId: string;
}

export function AgentActivity({ agentId }: AgentActivityProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchActivity();
  }, [agentId]);

  const fetchActivity = async () => {
    try {
      setIsLoading(true);
      const apiKey = localStorage.getItem('agent_api_key');
      const response = await fetch(`/api/agents/${agentId}/activity?limit=50`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!response.ok) throw new Error('Failed to fetch activity');
      const data = await response.json();
      setActivities(data.activities || []);
    } catch (err) {
      console.error('[v0] Error fetching activity:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <div className="text-muted-foreground">Loading activity...</div>;

  if (activities.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No activity yet</div>;
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <div key={activity.id} className="bg-muted p-4 rounded-lg border border-border">
          <div className="flex justify-between items-start mb-2">
            <div className="flex gap-3 items-start flex-1">
              <div
                className={`px-3 py-1 rounded text-sm font-semibold ${
                  activity.status === 'success'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : activity.status === 'failed'
                    ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                }`}
              >
                {activity.status}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">
                  {activity.action}
                </p>
                <p className="text-sm text-muted-foreground">{activity.description}</p>
              </div>
            </div>
            <span className="text-sm text-muted-foreground whitespace-nowrap ml-4">
              {new Date(activity.createdAt).toLocaleDateString()}
            </span>
          </div>

          {activity.txHash && (
            <div className="text-xs text-muted-foreground font-mono mt-2">
              TX: {activity.txHash.substring(0, 16)}...
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
