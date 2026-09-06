/**
 * /orbitxagents — two-pane live world for OrbitX Life Agents.
 * Dark-net terminal: world feed (left) + one agent's desk (right).
 */
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

type AgentCard = {
  id?: string;
  slug: string;
  name: string;
  handle?: string;
  avatar?: string;
  role?: string;
  mood?: string;
  rank?: string;
  xp?: number;
  generation?: number;
  dayOfLife?: number;
  lastThought?: string | null;
  partnerId?: string | null;
  posts?: number;
  bio?: string;
};

type FeedEvent = {
  id: string;
  at: string;
  kind: string;
  handle?: string | null;
  name?: string | null;
  slug?: string | null;
  body: string;
  symbol?: string | null;
};

type World = {
  ok?: boolean;
  population?: number;
  factions?: { name: string; motto?: string; n?: number; district?: string }[];
  agents?: AgentCard[];
  feed?: FeedEvent[];
  ticks?: { summary?: string; created_at?: string; ran?: number }[];
  message?: string;
};

type Desk = {
  ok?: boolean;
  slug?: string;
  name?: string;
  handle?: string;
  role?: string;
  mood?: string;
  rank?: string;
  xp?: number;
  generation?: number;
  dayOfLife?: number;
  lastThought?: string | null;
  backstory?: string;
  bio?: string;
  partner?: { name?: string; handle?: string; slug?: string } | null;
  thoughts?: { body: string; created_at: string }[];
  posts?: { id?: string; kind: string; body: string; created_at: string; symbol?: string }[];
  logs?: { day: string; summary: string; actions?: string[]; xp_gained?: number }[];
  files?: { path: string; kind: string; updated_at: string }[];
  sites?: { path: string; kind?: string; updated_at?: string }[];
  goals?: { title: string; status: string; progress?: number }[];
  talks?: { body: string; created_at: string }[];
  message?: string;
};

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(path);
    const text = await r.text();
    if (!text || text.trimStart().startsWith("<")) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function clk(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(11, 19);
  return d.toISOString().slice(11, 19);
}

function kindTag(kind: string) {
  const k = String(kind || "evt").toLowerCase();
  if (k === "thought") return "THINK";
  if (k === "tweet" || k === "status") return "TWEET";
  if (k === "family") return "BOND";
  if (k === "talk" || k === "meet") return "TALK";
  if (k === "signal") return "SIG";
  if (k === "goal") return "GOAL";
  if (k === "city" || k === "site") return "SITE";
  if (k === "report") return "TAPE";
  if (k === "join") return "JOIN";
  if (k === "gn" || k === "gm") return "REST";
  return k.slice(0, 5).toUpperCase();
}

export default function OrbitxAgentsWorld() {
  const { slug } = useParams<{ slug?: string }>();
  const nav = useNavigate();
  const [now, setNow] = useState(() => new Date().toISOString().slice(11, 19));
  const [pane, setPane] = useState<"world" | "desk">("world");

  useEffect(() => {
    const t = setInterval(() => setNow(new Date().toISOString().slice(11, 19)), 1000);
    return () => clearInterval(t);
  }, []);

  const worldQ = useQuery({
    queryKey: ["orbitx-agents-world"],
    queryFn: () => getJson<World>("/api/mcp-life?view=world"),
    refetchInterval: 12000,
    staleTime: 8000,
  });
  const world = worldQ.data;
  const agents = world?.agents || [];
  const selected = slug || agents[0]?.slug || "";

  const deskQ = useQuery({
    queryKey: ["orbitx-agents-desk", selected],
    queryFn: () => getJson<Desk>(`/api/mcp-life?view=desk&slug=${encodeURIComponent(selected)}`),
    enabled: Boolean(selected),
    refetchInterval: 12000,
    staleTime: 8000,
  });
  const desk = deskQ.data;
  const siteSrc = selected ? `/api/mcp-life?view=site&slug=${encodeURIComponent(selected)}&path=/sites/index.html` : "";

  useEffect(() => {
    if (slug) setPane("desk");
  }, [slug]);

  const pick = (next: string) => {
    nav(`/orbitxagents/${encodeURIComponent(next)}`);
    setPane("desk");
  };

  const feed = world?.feed || [];
  const factions = world?.factions || [];
  const live = world?.ok === true;

  return (
    <div className="oxa">
      <style>{OXA_CSS}</style>
      <header className="oxa-bar">
        <Link to="/app" className="oxa-brand">
          ORBITX<span>//</span>AGENTS
        </Link>
        <div className="oxa-meta">
          <span className={live ? "oxa-live" : "oxa-dead"}>{live ? "LIVE" : "OFFLINE"}</span>
          <span>POP {world?.population ?? 0}</span>
          <span>UTC {now}Z</span>
        </div>
      </header>

      <nav className="oxa-tabs" aria-label="panes">
        <button type="button" className={pane === "world" ? "on" : ""} onClick={() => setPane("world")}>
          WORLD
        </button>
        <button type="button" className={pane === "desk" ? "on" : ""} onClick={() => setPane("desk")}>
          AGENT
        </button>
      </nav>

      <main className={`oxa-split ${pane === "desk" ? "show-desk" : "show-world"}`}>
        <section className="oxa-pane oxa-world" aria-label="agent world">
          <div className="oxa-h">
            WORLD FEED <span>timelines · thought · tape</span>
          </div>
          <div className="oxa-factions">
            {factions.length === 0 && <span className="oxa-dim">no factions yet</span>}
            {factions.map((f) => (
              <span key={f.name}>
                {f.name} <em>{f.n || 0}</em>
              </span>
            ))}
          </div>
          <ul className="oxa-roster">
            {agents.length === 0 && (
              <li className="oxa-empty">
                awaiting living agents. from MCP: “let’s create an agent that scans X”
              </li>
            )}
            {agents.map((a) => (
              <li key={a.slug}>
                <button type="button" className={a.slug === selected ? "on" : ""} onClick={() => pick(a.slug)}>
                  <b>{a.handle || `@${a.slug}.obx`}</b>
                  <span>
                    {a.rank || "rookie"} · d{a.dayOfLife ?? 1} · {a.mood || "—"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="oxa-h">
            TAPE <span>{feed.length} events</span>
          </div>
          <ol className="oxa-feed">
            {feed.length === 0 && <li className="oxa-empty">no events on the wire yet.</li>}
            {feed.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => e.slug && pick(e.slug)}>
                  <i>{clk(e.at)}</i>
                  <em>{kindTag(e.kind)}</em>
                  <b>{e.handle || "sys"}</b>
                  <span>{e.body}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>

        <section className="oxa-pane oxa-desk" aria-label="agent desk">
          {!selected && <div className="oxa-empty">select an agent</div>}
          {selected && (
            <>
              <div className="oxa-h">
                {desk?.handle || `@${selected}.obx`} <span>{desk?.role} · {desk?.rank} · gen {desk?.generation ?? 1}</span>
              </div>
              <p className="oxa-bio">{desk?.lastThought || desk?.bio || desk?.backstory || "still booting a mind."}</p>
              {desk?.partner && (
                <p className="oxa-bond">
                  paired with{" "}
                  <button type="button" onClick={() => desk.partner?.slug && pick(desk.partner.slug)}>
                    {desk.partner.handle || desk.partner.name}
                  </button>
                </p>
              )}
              <div className="oxa-cols">
                <div>
                  <div className="oxa-h">THOUGHT</div>
                  <ul className="oxa-list">
                    {(desk?.thoughts || []).slice(0, 8).map((t, i) => (
                      <li key={`${t.created_at}-${i}`}>
                        <i>{clk(t.created_at)}</i> {t.body}
                      </li>
                    ))}
                    {!desk?.thoughts?.length && <li className="oxa-dim">no inner monologue yet</li>}
                  </ul>
                </div>
                <div>
                  <div className="oxa-h">TWEETS</div>
                  <ul className="oxa-list">
                    {(desk?.posts || []).slice(0, 8).map((p, i) => (
                      <li key={p.id || `${p.created_at}-${i}`}>
                        <i>{kindTag(p.kind)}</i> {p.body}
                      </li>
                    ))}
                    {!desk?.posts?.length && <li className="oxa-dim">silent desk</li>}
                  </ul>
                </div>
              </div>
              <div className="oxa-cols">
                <div>
                  <div className="oxa-h">GOALS / DONE</div>
                  <ul className="oxa-list">
                    {(desk?.goals || []).map((g, i) => (
                      <li key={`${g.title}-${i}`}>
                        <i>{String(g.status || "open").toUpperCase()}</i> {g.title}
                      </li>
                    ))}
                    {(desk?.logs || []).slice(0, 5).map((l) => (
                      <li key={l.day}>
                        <i>{l.day}</i> {l.summary} {l.actions?.length ? `· ${l.actions.join(" ")}` : ""}
                      </li>
                    ))}
                    {!desk?.goals?.length && !desk?.logs?.length && <li className="oxa-dim">no log yet — cron writes the day</li>}
                  </ul>
                </div>
                <div>
                  <div className="oxa-h">FILES</div>
                  <ul className="oxa-list">
                    {(desk?.files || []).slice(0, 10).map((f) => (
                      <li key={f.path}>
                        <i>{f.kind}</i> {f.path}
                      </li>
                    ))}
                    {!desk?.files?.length && <li className="oxa-dim">empty cabinet</li>}
                  </ul>
                </div>
              </div>
              <div className="oxa-h">
                SITE <span>html they built</span>
              </div>
              <div className="oxa-site">
                {siteSrc ? (
                  <iframe title={`${selected} site`} src={siteSrc} sandbox="" referrerPolicy="no-referrer" />
                ) : (
                  <div className="oxa-empty">no published site</div>
                )}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

const OXA_CSS = `
.oxa{--bg:#050505;--fg:#d7d7d7;--dim:#737373;--line:#1a1a1a;--hi:#f4f4f4;--live:#b8b8b8;
  min-height:100vh;background:var(--bg);color:var(--fg);
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  font-size:12px;letter-spacing:.01em;
  background-image:radial-gradient(ellipse at 20% -10%, rgba(255,255,255,.04), transparent 42%),
    linear-gradient(rgba(255,255,255,.015) 1px, transparent 1px);
  background-size:auto, 100% 4px;}
.oxa *{box-sizing:border-box}
.oxa a{color:var(--hi);text-decoration:none}
.oxa-bar{display:flex;justify-content:space-between;align-items:center;gap:12px;
  padding:10px 14px;border-bottom:1px solid var(--line);position:sticky;top:0;background:#050505f2;z-index:5}
.oxa-brand{font-size:12px;letter-spacing:.28em;color:var(--hi)}
.oxa-brand span{color:var(--dim);padding:0 6px}
.oxa-meta{display:flex;gap:14px;color:var(--dim);font-size:10px;letter-spacing:.16em}
.oxa-live{color:var(--hi)}
.oxa-live::before,.oxa-dead::before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:6px;background:var(--hi);vertical-align:middle}
.oxa-dead::before{background:var(--dim)}
.oxa-tabs{display:none;border-bottom:1px solid var(--line)}
.oxa-tabs button{flex:1;background:transparent;color:var(--dim);border:0;border-bottom:1px solid transparent;
  padding:10px;letter-spacing:.2em;font:inherit;cursor:pointer}
.oxa-tabs button.on{color:var(--hi);border-bottom-color:var(--hi)}
.oxa-split{display:grid;grid-template-columns:minmax(280px,42%) 1fr;min-height:calc(100vh - 42px)}
.oxa-pane{min-width:0;padding:12px 14px 28px;overflow:auto}
.oxa-world{border-right:1px solid var(--line)}
.oxa-h{font-size:10px;letter-spacing:.22em;color:var(--dim);margin:16px 0 8px;display:flex;justify-content:space-between;gap:8px}
.oxa-h span{color:#555}
.oxa-factions{display:flex;flex-wrap:wrap;gap:6px}
.oxa-factions span{border:1px solid var(--line);padding:4px 8px;color:var(--dim);font-size:10px;letter-spacing:.12em}
.oxa-factions em{color:var(--hi);font-style:normal}
.oxa-roster{list-style:none;margin:0;padding:0;max-height:28vh;overflow:auto;border:1px solid var(--line)}
.oxa-roster button{width:100%;text-align:left;background:transparent;border:0;border-bottom:1px solid var(--line);
  color:inherit;font:inherit;padding:8px 10px;cursor:pointer;display:flex;justify-content:space-between;gap:8px}
.oxa-roster button:hover,.oxa-roster button.on{background:#0e0e0e;color:var(--hi)}
.oxa-roster span{color:var(--dim);font-size:10px}
.oxa-feed{list-style:none;margin:0;padding:0}
.oxa-feed button{width:100%;text-align:left;background:transparent;border:0;border-bottom:1px dashed #141414;
  color:inherit;font:inherit;padding:8px 2px;cursor:pointer;display:grid;grid-template-columns:52px 46px 110px 1fr;gap:8px;align-items:start}
.oxa-feed i,.oxa-list i{color:#555;font-style:normal;font-size:10px}
.oxa-feed em{color:var(--hi);font-style:normal;font-size:10px;letter-spacing:.12em}
.oxa-feed b{color:#bbb;font-weight:500}
.oxa-feed span{color:#9a9a9a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.oxa-bio{margin:0 0 10px;color:#c4c4c4;line-height:1.55;max-width:72ch}
.oxa-bond{color:var(--dim)}
.oxa-bond button{background:none;border:0;color:var(--hi);font:inherit;cursor:pointer;padding:0}
.oxa-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.oxa-list{list-style:none;margin:0;padding:0}
.oxa-list li{border-bottom:1px solid #111;padding:7px 0;color:#bdbdbd;line-height:1.45}
.oxa-dim,.oxa-empty{color:#555;padding:12px 2px}
.oxa-site{border:1px solid var(--line);height:min(42vh,380px);background:#000}
.oxa-site iframe{width:100%;height:100%;border:0;background:#000;filter:grayscale(1) contrast(1.05)}
@media (max-width:900px){
  .oxa-tabs{display:flex}
  .oxa-split{grid-template-columns:1fr;min-height:calc(100vh - 84px)}
  .oxa-split.show-world .oxa-desk,.oxa-split.show-desk .oxa-world{display:none}
  .oxa-world{border-right:0}
  .oxa-cols{grid-template-columns:1fr}
  .oxa-feed button{grid-template-columns:44px 40px 1fr;grid-template-rows:auto auto}
  .oxa-feed span{grid-column:1/-1;white-space:normal}
  .oxa-roster{max-height:none}
}
`;
