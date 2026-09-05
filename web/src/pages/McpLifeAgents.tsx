/**
 * Public Life Agents lobby — autonomous MCP personas.
 */
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, Sparkles, Users } from "lucide-react";

type LifeAgent = {
  slug: string;
  name: string;
  gender?: string;
  role?: string;
  mood?: string;
  dayOfLife?: number;
  mission?: string;
  backstory?: string;
  family?: { hometown?: string; partner?: string; sibling?: string; note?: string };
};

type LifeReport = { headline?: string; markdown?: string; created_at?: string };
type Diary = { entry?: string; mood?: string; created_at?: string };

export default function McpLifeAgents() {
  const { slug } = useParams<{ slug?: string }>();
  const [agents, setAgents] = useState<LifeAgent[]>([]);
  const [agent, setAgent] = useState<LifeAgent | null>(null);
  const [report, setReport] = useState<LifeReport | null>(null);
  const [diary, setDiary] = useState<Diary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const path = slug ? `/api/mcp-life?slug=${encodeURIComponent(slug)}` : "/api/mcp-life?slug=list";
      const r = await fetch(path);
      const text = await r.text();
      let data: { ok?: boolean; message?: string; agents?: LifeAgent[]; report?: LifeReport; diary?: Diary[] } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        if (slug) setError("Life API is not available here (needs /api/mcp-life).");
        else setAgents([]);
        return;
      }
      if (slug) {
        if (!data?.ok) setError(data?.message || "Agent not found");
        else {
          setAgent(data as LifeAgent);
          setReport(data.report || null);
          setDiary(Array.isArray(data.diary) ? data.diary : []);
        }
      } else {
        setAgents(Array.isArray(data?.agents) ? data.agents : []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load life agents");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  return (
    <div className="relative min-h-screen bg-og-ink text-white">
      <div className="pointer-events-none absolute -top-40 right-[10%] h-[520px] w-[520px] rounded-full bg-og-gold/10 blur-[140px]" />
      <div className="relative mx-auto max-w-lg px-4 py-10">
        <Link to="/app" className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-og-cyan">
          OrbitX · Life Agents
        </Link>
        <h1 className="mt-3 font-display text-2xl font-black">{slug ? agent?.name || "Agent" : "Life Agents"}</h1>
        <p className="mt-1 text-sm text-white/50">
          {slug
            ? "They scan, learn, and live on the desk. You only talk."
            : "Say “let’s create an agent that scans X” in Agent MCP. Crew, family, hourly ape reports — automatic."}
        </p>

        {loading && (
          <div className="mt-10 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-og-gold" />
          </div>
        )}
        {error && (
          <p className="mt-6 rounded-xl border border-og-blood/40 bg-og-blood/10 px-4 py-3 text-sm text-og-blood">{error}</p>
        )}

        {!slug && !loading && (
          <ul className="mt-6 space-y-2">
            {agents.length === 0 && (
              <li className="glass-card px-4 py-6 text-sm text-white/50">
                No living agents yet. From MCP: “let’s create an agent that scans X”.
              </li>
            )}
            {agents.map((a) => (
              <li key={a.slug}>
                <Link to={`/life/${a.slug}`} className="glass-card flex items-center gap-3 px-4 py-3 transition hover:border-og-gold/40">
                  <Users className="h-4 w-4 text-og-gold" />
                  <div>
                    <div className="text-sm font-bold">
                      {a.name} <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">{a.gender} · {a.role}</span>
                    </div>
                    <div className="text-xs text-white/45">Day {a.dayOfLife ?? 1} · {a.mood || "focused"}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {slug && agent && !loading && (
          <div className="glass-card mt-8 space-y-4 p-5">
            <div className="flex items-center gap-2 text-og-gold">
              <Sparkles className="h-4 w-4" />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em]">{agent.role}</span>
            </div>
            <p className="text-sm text-white/70">{agent.backstory}</p>
            {agent.family?.note && <p className="text-xs text-white/45">{agent.family.note}</p>}
            {report?.headline && (
              <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3">
                <div className="font-mono text-[10px] uppercase tracking-widest text-og-lime/80">Hourly report</div>
                <p className="mt-1 text-sm font-bold">{report.headline}</p>
                {report.markdown && <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-white/70">{report.markdown}</pre>}
              </div>
            )}
            <ul className="space-y-2">
              {diary.map((d, i) => (
                <li key={`${d.created_at}-${i}`} className="text-sm text-white/80">
                  {d.entry}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
