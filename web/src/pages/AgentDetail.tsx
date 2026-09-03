import { Link, useParams } from 'react-router-dom';
import { AgentDetail } from '../components/agent/agent-detail';

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Agent not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <Link to="/supercomputer?tab=workspace" className="text-primary hover:underline mb-4 inline-block">
            ← Back to Super Computer
          </Link>
          <h1 className="text-3xl font-bold text-foreground">Agent Details</h1>
        </div>
        <AgentDetail agentId={id} />
      </div>
    </div>
  );
}
