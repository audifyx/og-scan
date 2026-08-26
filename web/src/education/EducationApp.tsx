import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  CATEGORY_FILTERS,
  DECISION_INTENTS,
  LEARNING_PATHS,
  SAFETY_DISCLAIMER,
  SEARCH_PLACEHOLDERS,
  TELEGRAM_COMMANDS,
  WORKFLOWS,
  eduHref,
  findNode,
  getNode,
  getPath,
  getWorkflow,
  publishedNodes,
  tools,
} from "./catalog";
import DemoStage from "./DemoStage";
import EcosystemMap from "./EcosystemMap";
import "./education.css";
import {
  LEVELS,
  loadProgress,
  markCompleted,
  markStarted,
  overallStats,
  pathPercent,
  type EducationProgress,
} from "./progress";
import { searchEducation, type SearchHit } from "./search";
import type { EduNode, LearningPath } from "./types";

function useProgress() {
  const [p, setP] = useState<EducationProgress>(loadProgress);
  useEffect(() => {
    const sync = () => setP(loadProgress());
    window.addEventListener("orbitx-edu-progress", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("orbitx-edu-progress", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return p;
}

function statusLabel(p: EducationProgress, id: string) {
  if (p.completed[id]) return { t: "Completed", c: "done" };
  if (p.started[id]) return { t: "In progress", c: "mid" };
  return { t: "Not started", c: "" };
}

function diffLabel(d: EduNode["difficulty"]) {
  if (d === "beginner") return "Beginner";
  if (d === "trader") return "Trader";
  if (d === "creator") return "Creator";
  return "Advanced";
}

function SearchField({
  autoFocus,
  size = "hero",
}: {
  autoFocus?: boolean;
  size?: "hero" | "top";
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [ph, setPh] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = window.setInterval(() => setPh((i) => (i + 1) % SEARCH_PLACEHOLDERS.length), 2800);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const hits = useMemo(() => searchEducation(q, publishedNodes()), [q]);

  return (
    <div className={size === "hero" ? "ox-edu__search" : "ox-edu__top-search"} ref={box}>
      <span className="ox-edu__search-ico" aria-hidden>
        ⌕
      </span>
      <input
        type="search"
        autoFocus={autoFocus}
        value={q}
        placeholder={SEARCH_PLACEHOLDERS[ph] ?? "What do you want to learn?"}
        aria-label="What do you want to learn?"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && hits[0]) {
            navigate(hits[0].href);
            setOpen(false);
          }
        }}
      />
      {open && q.trim() ? (
        <div className="ox-edu__hits" role="listbox">
          {hits.length === 0 ? (
            <div className="ox-edu__hit">
              <b>No matches</b>
              <span>Try “DEX”, “claim fees”, “MCP”, or a Telegram command.</span>
            </div>
          ) : (
            hits.map((h) => <HitRow key={h.id} hit={h} onPick={() => setOpen(false)} />)
          )}
        </div>
      ) : null}
    </div>
  );
}

function HitRow({ hit, onPick }: { hit: SearchHit; onPick: () => void }) {
  return (
    <Link className="ox-edu__hit" to={hit.href} onClick={onPick}>
      <b>{hit.title}</b>
      <span>
        {hit.subtitle} · {hit.kind}
        {hit.difficulty ? ` · ${hit.difficulty}` : ""}
        {hit.time ? ` · ${hit.time}` : ""}
      </span>
    </Link>
  );
}

function LiveJump({ compact }: { compact?: boolean }) {
  return (
    <Link className={compact ? "ox-edu__live ox-edu__live--compact" : "ox-edu__live"} to="/ORBITX_DEX">
      {compact ? "Live desk" : "Jump back to the live orbitx.world dashboard"}
    </Link>
  );
}

function Shell({ children, progress }: { children: ReactNode; progress: EducationProgress }) {
  const { pathname, hash } = useLocation();
  const stats = overallStats(progress, publishedNodes().length);
  const tab =
    hash === "#paths"
      ? "paths"
      : hash === "#explore" || hash === "#tools"
        ? "tools"
        : pathname.includes("/education/")
          ? "page"
          : "home";

  return (
    <div className="ox-edu">
      <div className="ox-edu__shell">
        <div className="ox-edu__chrome">
        <header className="ox-edu__top">
          <Link className="ox-edu__brand" to="/education">
            <span className="ox-edu__mark" />
            <span>
              <div className="ox-edu__brand-name">ORBITX</div>
              <div className="ox-edu__brand-sub">Education</div>
            </span>
          </Link>
          <SearchField size="top" />
          <div className="ox-edu__hud">
            {stats.completed} / {stats.total} · {stats.level}
          </div>
          <LiveJump compact />
        </header>
        <div className="ox-edu__offchain">
          This route is off-chain.{" "}
          <Link to="/ORBITX_DEX">Jump back to the live orbitx.world dashboard.</Link>
        </div>
        </div>
        <main className="ox-edu__main">{children}</main>
        <nav className="ox-edu__mobnav" aria-label="Education">
          <Link className={tab === "home" ? "on" : ""} to="/education">
            Home
          </Link>
          <Link className={tab === "paths" ? "on" : ""} to="/education#paths">
            Paths
          </Link>
          <Link className={tab === "tools" ? "on" : ""} to="/education#explore">
            Tools
          </Link>
          <Link className={pathname.endsWith("/search") ? "on" : ""} to="/education/search">
            Search
          </Link>
        </nav>
      </div>
    </div>
  );
}

function Home({ progress }: { progress: EducationProgress }) {
  const { hash } = useLocation();
  const [filter, setFilter] = useState<(typeof CATEGORY_FILTERS)[number]["id"]>("all");
  const [intent, setIntent] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const revealRef = useRef<HTMLElement>(null);
  const stats = overallStats(progress, publishedNodes().length);
  const index = tools().filter((n) => filter === "all" || n.category === filter);
  const picked = DECISION_INTENTS.find((i) => i.id === intent);
  const academies = publishedNodes().filter((n) => n.kind === "academy");
  const allTitles = publishedNodes().map((n) => n.title);

  useEffect(() => {
    const id = hash.replace("#", "");
    if (!id) return;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash]);

  useEffect(() => {
    const el = revealRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setRevealed(true);
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <section className="ox-edu__hero">
        <div className="ox-edu__kicker">ORBITX EDUCATION</div>
        <h1 className="ox-edu__h1">WELCOME TO THE ORBITX ECOSYSTEM</h1>
        <p className="ox-edu__lede">
          Off-chain learning for the live orbitx.world desk — from your first trade to advanced workflows.
        </p>
        <SearchField autoFocus={false} />
        <div className="ox-edu__personas">
          <LiveJump />
          <Link className="ox-edu__chip" to="/education/path/beginner">
            I&apos;m new to crypto
          </Link>
          <Link className="ox-edu__chip" to="/education/path/trader">
            I&apos;m a trader
          </Link>
          <Link className="ox-edu__chip" to="/education/path/creator">
            I&apos;m a creator
          </Link>
          <Link className="ox-edu__chip" to="/education/path/power">
            I&apos;m a developer
          </Link>
          <Link className="ox-edu__chip" to="/education#explore">
            Show me everything
          </Link>
        </div>
        <div className="ox-edu__progress" style={{ marginTop: 22 }}>
          <span>
            Your OrbitX level · <b>{stats.level}</b>
          </span>
          <div className="ox-edu__bar" aria-hidden>
            <i style={{ width: `${stats.pct}%` }} />
          </div>
          <span>
            {stats.completed} / {stats.total} lessons
          </span>
        </div>
        <div className="ox-edu__levels">
          {LEVELS.map((lv, i) => (
            <span key={lv}>
              {i > 0 ? " → " : ""}
              {lv === stats.level ? <b>{lv}</b> : lv}
            </span>
          ))}
        </div>
      </section>

      <section className="ox-edu__section" id="map">
        <h2 className="ox-edu__h2">THE ECOSYSTEM</h2>
        <p className="ox-edu__sub">A living map of live OrbitX surfaces. Tools connect into workflows — they are not isolated desks.</p>
        <EcosystemMap />
      </section>

      <section className="ox-edu__section" id="paths">
        <h2 className="ox-edu__h2">LEARNING PATHS</h2>
        <p className="ox-edu__sub">Pick a lane. You do not need to learn everything at once.</p>
        <div className="ox-edu__paths">
          {LEARNING_PATHS.map((path) => (
            <Link key={path.id} className={`ox-edu__path tone-${path.tone}`} to={`/education/path/${path.slug}`}>
              <div className="ox-edu__path-kicker">{path.kicker}</div>
              <h3>{path.title}</h3>
              <p>{path.description}</p>
              <span className="ox-edu__cta">
                {path.cta} → · {pathPercent(progress, path.nodes)}%
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="ox-edu__section" id="intent">
        <h2 className="ox-edu__h2">WHAT ARE YOU TRYING TO DO?</h2>
        <p className="ox-edu__sub">Say the job. Education routes you to the live tool and the guide that teaches it.</p>
        <div className="ox-edu__intents">
          {DECISION_INTENTS.map((d) => (
            <button
              key={d.id}
              type="button"
              className="ox-edu__intent"
              onClick={() => setIntent(d.id === intent ? null : d.id)}
            >
              “{d.prompt}”
              <em>{d.result}</em>
            </button>
          ))}
        </div>
        {picked ? (
          <div className="ox-edu__grid" style={{ marginTop: 14 }}>
            {picked.nodeIds.map((id) => {
              const n = getNode(id);
              if (!n) return null;
              return <ToolCard key={id} node={n} progress={progress} />;
            })}
          </div>
        ) : null}
      </section>

      <section className="ox-edu__section">
        <h2 className="ox-edu__h2">FROM DISCOVERY → TRADE</h2>
        <p className="ox-edu__sub">The core research loop. Education, not financial advice.</p>
        <Link className="ox-edu__cta" to="/education/workflow/discovery-to-trade">
          Open the interactive workflow →
        </Link>
        <div className="ox-edu__flow" style={{ marginTop: 16 }}>
          {(WORKFLOWS[0]?.stages ?? []).map((s, i) => (
            <div key={s.id} className="ox-edu__stage">
              <i>STAGE {String(i + 1).padStart(2, "0")}</i>
              <strong>{s.title}</strong>
              <p className="ox-edu__prose" style={{ margin: "6px 0 0" }}>
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="ox-edu__section" id="explore">
        <h2 className="ox-edu__h2">EXPLORE EVERYTHING</h2>
        <p className="ox-edu__sub">Every public tool and academy in the catalog. Adding a content entry surfaces it here automatically.</p>
        <div className="ox-edu__filters">
          {CATEGORY_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`ox-edu__chip${filter === f.id ? " on" : ""}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="ox-edu__grid">
          {index.map((n) => (
            <ToolCard key={n.id} node={n} progress={progress} />
          ))}
        </div>
      </section>

      <section className="ox-edu__section">
        <h2 className="ox-edu__h2">ACADEMIES</h2>
        <p className="ox-edu__sub">Deep tracks for DEX, Launchpad, Telegram, and MCP.</p>
        <div className="ox-edu__academy-row">
          {academies.map((n) => (
            <Link key={n.id} className="ox-edu__mini" to={eduHref(n)}>
              <div className="ox-edu__path-kicker">{n.title}</div>
              <p className="ox-edu__prose">{n.description}</p>
              <span className="ox-edu__cta">Open academy →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="ox-edu__section" ref={revealRef}>
        <div className="ox-edu__reveal">
          <div className="ox-edu__kicker">THERE&apos;S A LOT MORE TO ORBITX</div>
          <h2 className="ox-edu__h2">The catalog is the product.</h2>
          <div className="ox-edu__orbit">
            {(revealed ? allTitles : allTitles.slice(0, 8)).map((t) => (
              <span key={t} className="ox-edu__dot">
                {t}
              </span>
            ))}
          </div>
          <p className="ox-edu__lede" style={{ marginBottom: 0 }}>
            You don&apos;t need to learn everything at once. Pick a path and start exploring.
          </p>
        </div>
      </section>

      <p className="ox-edu__disclaimer">{SAFETY_DISCLAIMER}</p>
    </>
  );
}

function ToolCard({ node, progress }: { node: EduNode; progress: EducationProgress }) {
  const st = statusLabel(progress, node.id);
  return (
    <Link className="ox-edu__card" to={eduHref(node)}>
      <div className="ox-edu__path-kicker">{node.kind}</div>
      <h3>{node.title}</h3>
      <p className="ox-edu__prose" style={{ margin: 0 }}>
        {node.description}
      </p>
      <div className="ox-edu__meta">
        <span className="ox-edu__pill">Difficulty: {diffLabel(node.difficulty)}</span>
        <span className="ox-edu__pill">{node.category}</span>
        <span className={`ox-edu__status ${st.c}`}>{st.t}</span>
        {node.status === "coming_soon" ? <span className="ox-edu__status soon">Coming soon</span> : null}
      </div>
      <ul>
        {(node.features.length ? node.features : [node.what]).slice(0, 4).map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <span className="ox-edu__cta">Learn this tool →</span>
    </Link>
  );
}

function LessonView({ node, progress }: { node: EduNode; progress: EducationProgress }) {
  const st = statusLabel(progress, node.id);
  const [hot, setHot] = useState(0);
  const related = node.related.map(getNode).filter(Boolean) as EduNode[];
  const next = node.next.map(getNode).filter(Boolean) as EduNode[];
  const isTelegram = node.id === "academy-telegram" || node.id === "telegram-commands";
  const isMcp = node.id === "academy-mcp" || node.id === "mcp-basics" || node.id === "mcp-advanced";

  useEffect(() => {
    markStarted(node.id);
  }, [node.id]);

  return (
    <article className="ox-edu__article">
      <Link className="ox-edu__back" to="/education">
        ← Education
      </Link>
      <div className="ox-edu__kicker">{node.kind.toUpperCase()}</div>
      <h1>{node.title}</h1>
      <div className="ox-edu__meta">
        <span className="ox-edu__pill">{diffLabel(node.difficulty)}</span>
        <span className="ox-edu__pill">{node.estimatedMinutes} min</span>
        <span className="ox-edu__pill">{node.category}</span>
        <span className={`ox-edu__status ${st.c}`}>{st.t}</span>
        {node.status === "coming_soon" ? <span className="ox-edu__status soon">Coming soon</span> : null}
      </div>
      <p className="ox-edu__lede" style={{ margin: "12px 0 20px", textAlign: "left" }}>
        {node.description}
      </p>

      <h2 className="ox-edu__h2">What is it?</h2>
      <p className="ox-edu__prose">{node.what}</p>
      <h2 className="ox-edu__h2">Why would I use it?</h2>
      <p className="ox-edu__prose">{node.why}</p>
      <h2 className="ox-edu__h2">When should I use it?</h2>
      <p className="ox-edu__prose">{node.when}</p>

      {node.demo !== "none" ? <DemoStage kind={node.demo} steps={node.steps} /> : null}

      <h2 className="ox-edu__h2">STEP-BY-STEP GUIDE</h2>
      <div className="ox-edu__steps">
        {node.steps.map((step, i) => (
          <div key={step.title} className="ox-edu__step">
            <div className="ox-edu__num">{String(i + 1).padStart(2, "0")}</div>
            <div>
              <strong>{step.title}</strong>
              <p className="ox-edu__prose" style={{ margin: "6px 0 0" }}>
                {step.body}
              </p>
              {step.hotspot ? (
                <div className="ox-edu__shot">
                  <div className="ox-edu__shot-ui">
                    <div className="ox-edu__shot-title">LIVE UI · {step.hotspot}</div>
                    <p>Annotated mock of the current OrbitX surface. Open the live tool to see the real panel.</p>
                    <button
                      type="button"
                      className="ox-edu__marker on"
                      style={{ left: `${18 + (i % 4) * 18}%`, top: `${36 + (i % 3) * 16}%` }}
                      onClick={() => setHot(i)}
                    >
                      {i + 1}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {node.steps[hot]?.hotspot ? (
        <p className="ox-edu__tip">
          Marker {hot + 1}: {node.steps[hot].hotspot}. {node.steps[hot].body}
        </p>
      ) : null}

      {isTelegram ? (
        <>
          <h2 className="ox-edu__h2">COMMANDS</h2>
          <p className="ox-edu__sub">Official @theorbitxmcpbot. Groups = intel. Buys/sells only after /login in DM.</p>
          {TELEGRAM_COMMANDS.map((c) => (
            <div key={c.command} className="ox-edu__cmd">
              <code>{c.command}</code>
              <span>
                {c.does} · {c.scope}
              </span>
              <span>Example: {c.example}</span>
            </div>
          ))}
          <DemoStage kind="telegram" />
        </>
      ) : null}

      {isMcp ? (
        <>
          <h2 className="ox-edu__h2">MCP LEVELS</h2>
          <p className="ox-edu__sub">Unlock progressively. MCP prepares work. You still sign.</p>
          {["What MCP is", "Connecting /agent", "Available tools", "Research", "Trading workflows", "Access / agents"].map(
            (lv, i) => (
              <div key={lv} className="ox-edu__step">
                <div className="ox-edu__num">{String(i + 1).padStart(2, "0")}</div>
                <div>
                  <strong>Level {i + 1}</strong>
                  <p className="ox-edu__prose" style={{ margin: "6px 0 0" }}>
                    {lv}
                  </p>
                </div>
              </div>
            ),
          )}
        </>
      ) : null}

      <div className="ox-edu__actions">
        {node.href ? (
          <a className="ox-edu__btn" href={node.href}>
            Try it on OrbitX
          </a>
        ) : null}
        <button type="button" className="ox-edu__btn ghost" onClick={() => markCompleted(node.id)}>
          Mark complete
        </button>
      </div>

      {related.length ? (
        <>
          <h2 className="ox-edu__h2">RELATED</h2>
          <div className="ox-edu__grid">
            {related.map((n) => (
              <ToolCard key={n.id} node={n} progress={progress} />
            ))}
          </div>
        </>
      ) : null}
      {next.length ? (
        <>
          <h2 className="ox-edu__h2">NEXT</h2>
          <div className="ox-edu__grid">
            {next.map((n) => (
              <ToolCard key={n.id} node={n} progress={progress} />
            ))}
          </div>
        </>
      ) : null}
      <p className="ox-edu__disclaimer">{SAFETY_DISCLAIMER}</p>
    </article>
  );
}

function PathView({ path, progress }: { path: LearningPath; progress: EducationProgress }) {
  const pct = pathPercent(progress, path.nodes);
  const nodes = path.nodes.map(getNode).filter(Boolean) as EduNode[];
  return (
    <article className="ox-edu__article">
      <Link className="ox-edu__back" to="/education#paths">
        ← Paths
      </Link>
      <div className="ox-edu__kicker">{path.kicker}</div>
      <h1>{path.title}</h1>
      <p className="ox-edu__lede" style={{ textAlign: "left", margin: "0 0 16px" }}>
        {path.description}
      </p>
      <div className="ox-edu__progress">
        <span>{pct}% path complete</span>
        <div className="ox-edu__bar">
          <i style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="ox-edu__steps" style={{ marginTop: 24 }}>
        {nodes.map((n, i) => {
          const st = statusLabel(progress, n.id);
          return (
            <Link key={n.id} className="ox-edu__step" to={eduHref(n)}>
              <div className="ox-edu__num">{String(i + 1).padStart(2, "0")}</div>
              <div>
                <strong>{n.title}</strong>
                <p className="ox-edu__prose" style={{ margin: "6px 0 0" }}>
                  {n.description}
                </p>
                <span className={`ox-edu__status ${st.c}`}>{st.t}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </article>
  );
}

function WorkflowView() {
  const wf = WORKFLOWS[0];
  return (
    <article className="ox-edu__article">
      <Link className="ox-edu__back" to="/education">
        ← Education
      </Link>
      <div className="ox-edu__kicker">WORKFLOW</div>
      <h1>{wf.title}</h1>
      <p className="ox-edu__lede" style={{ textAlign: "left" }}>
        {wf.description}
      </p>
      <DemoStage kind="workflow" />
      <div className="ox-edu__flow">
        {wf.stages.map((s, i) => {
          const n = s.nodeId ? getNode(s.nodeId) : undefined;
          return (
            <div key={s.id} className="ox-edu__stage">
              <i>
                {String(i + 1).padStart(2, "0")} {s.title}
              </i>
              <p className="ox-edu__prose">{s.body}</p>
              <div className="ox-edu__actions">
                {n ? (
                  <Link className="ox-edu__btn ghost" to={eduHref(n)}>
                    Guide
                  </Link>
                ) : null}
                {s.href ? (
                  <a className="ox-edu__btn" href={s.href}>
                    Open tool
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <p className="ox-edu__disclaimer">{SAFETY_DISCLAIMER}</p>
    </article>
  );
}

function SearchPage() {
  return (
    <article className="ox-edu__article">
      <div className="ox-edu__kicker">SEARCH</div>
      <h1>What do you want to learn?</h1>
      <SearchField autoFocus />
      <p className="ox-edu__disclaimer">{SAFETY_DISCLAIMER}</p>
    </article>
  );
}

function LessonRoute({ kind }: { kind: EduNode["kind"] }) {
  const { pathname } = useLocation();
  const slug = pathname.split("/").filter(Boolean)[2] ?? "";
  const progress = useProgress();
  const node = findNode(kind, slug) ?? publishedNodes().find((n) => n.slug === slug);
  if (!node) return <Navigate to="/education" replace />;
  return (
    <Shell progress={progress}>
      <LessonView node={node} progress={progress} />
    </Shell>
  );
}

export default function EducationApp() {
  const { pathname } = useLocation();
  const progress = useProgress();
  const parts = pathname.replace(/\/+$/, "").split("/").filter(Boolean);

  if (parts[0] !== "education") {
    return <Navigate to="/education" replace />;
  }

  if (parts.length === 1) {
    return (
      <Shell progress={progress}>
        <Home progress={progress} />
      </Shell>
    );
  }

  if (parts[1] === "search") {
    return (
      <Shell progress={progress}>
        <SearchPage />
      </Shell>
    );
  }

  if (parts[1] === "path" && parts[2]) {
    const path = getPath(parts[2]);
    if (!path) return <Navigate to="/education" replace />;
    return (
      <Shell progress={progress}>
        <PathView path={path} progress={progress} />
      </Shell>
    );
  }

  if (parts[1] === "workflow" && parts[2]) {
    if (!getWorkflow(parts[2])) return <Navigate to="/education" replace />;
    return (
      <Shell progress={progress}>
        <WorkflowView />
      </Shell>
    );
  }

  if (parts[1] === "tools" && parts[2]) return <LessonRoute kind="tool" />;
  if (parts[1] === "guides" && parts[2]) return <LessonRoute kind="guide" />;
  if (parts[1] === "academy" && parts[2]) return <LessonRoute kind="academy" />;

  return <Navigate to="/education" replace />;
}
