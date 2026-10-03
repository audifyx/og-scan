import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { ArrowLeft, FlaskConical } from "lucide-react";

const HIDDEN_ROUTES = [
  { path: "/terminal", label: "Terminal", desc: "Trading terminal" },
  { path: "/intel", label: "Intel", desc: "Market intelligence" },
  { path: "/on-chain", label: "On-Chain", desc: "On-chain explorer" },
  { path: "/agentcalls", label: "Agent Calls", desc: "Agent call feed" },
  { path: "/ai", label: "AI Hub", desc: "AI assistant hub" },
  { path: "/os", label: "OS", desc: "OS-style home" },
  { path: "/predictions", label: "Predictions", desc: "Prediction markets" },
  { path: "/orbitxagents", label: "Agents", desc: "Agent world" },
  { path: "/play", label: "Play", desc: "Games hub" },
  { path: "/telegram", label: "Telegram", desc: "Telegram bot companion" },
];

const ComingSoon = () => {
  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-2xl mx-auto space-y-6 pt-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FlaskConical className="h-6 w-6 text-primary" />
            Coming Soon
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Shelved routes — hidden from navigation, accessible here.
          </p>
        </div>
        <div className="space-y-3">
          {HIDDEN_ROUTES.map((r) => (
            <Link key={r.path} to={r.path}>
              <Card className="p-4 glass-card border-border/30 hover:border-primary/40 transition-all hover:scale-[1.01] cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{r.label}</div>
                    <div className="text-xs text-muted-foreground font-mono">{r.path}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{r.desc}</div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ComingSoon;
