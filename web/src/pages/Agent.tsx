import { AgentDashboard } from "../components/agent/agent-dashboard";

/** /agent — MCP connection hub (auth via ProtectedRoute). */
function AgentPage() {
  return (
    <main className="min-h-screen bg-[#05070d]">
      <AgentDashboard />
    </main>
  );
}

export default AgentPage;
