import { useMemo, useState } from "react";
import { Activity, ArrowUpRight, Bot, Braces, Cpu, Database, Gauge, KeyRound, MessageSquare, Network, Play, Radio, Search, Send, ShieldCheck, Sparkles, Terminal, WalletCards, Zap } from "lucide-react";
import "./supercomputer.css";

const toolGroups = [
  { label: "Research", icon: Search, tools: ["Token intelligence", "Liquidity x-ray", "Market screener", "X activity scan"] },
  { label: "Trade", icon: Zap, tools: ["Fast quote", "Buy / sell", "Portfolio route", "Transaction signing"] },
  { label: "Agents", icon: Bot, tools: ["Agent status", "Memory search", "Launch workflows", "Tool discovery"] },
  { label: "Channels", icon: Radio, tools: ["X posting", "DM inbox", "Mentions", "Analytics"] },
];

const telemetry = [
  ["MCP uptime", "99.98%", "green"],
  ["Tool latency", "184 ms", "cyan"],
  ["Signed actions", "2,481", "white"],
  ["Active routes", "14", "violet"],
];

export default function SupercomputerPage() {
  const [activeGroup, setActiveGroup] = useState("Research");
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([{ role: "system", text: "Supercomputer online. Ask for intelligence, a route, or a signed action." }]);
  const activeTools = useMemo(() => toolGroups.find((g) => g.label === activeGroup)?.tools || [], [activeGroup]);

  const send = () => {
    const value = query.trim();
    if (!value) return;
    setMessages((current) => [...current, { role: "user", text: value }, { role: "system", text: "Queued through the unified Supercomputer MCP. Review the route before signing." }]);
    setQuery("");
  };

  return (
    <div className="supercomputer-page">
      <aside className="super-sidebar">
        <div className="super-brand"><div className="super-brand-mark"><Cpu size={18} /></div><div><strong>OrbitX</strong><span>Super Computer</span></div></div>
        <div className="super-kicker">Workspace</div>
        <nav className="super-nav">
          {toolGroups.map(({ label, icon: Icon }) => <button className={activeGroup === label ? "active" : ""} key={label} onClick={() => setActiveGroup(label)}><Icon size={17} />{label}</button>)}
        </nav>
        <div className="super-kicker">System</div>
        <nav className="super-nav"><button className="active"><Activity size={17} />MCP status</button><button><ShieldCheck size={17} />Safety & signing</button><button><KeyRound size={17} />Access keys</button></nav>
        <div className="super-sidebar-footer"><span className="pulse-dot" /> Unified MCP online <a href="/api/supercomputer-mcp" target="_blank" rel="noreferrer"><ArrowUpRight size={14} /></a></div>
      </aside>
      <main className="super-main">
        <header className="super-topbar"><div><span className="super-eyebrow">OrbitX operating layer</span><h1>Supercomputer</h1></div><div className="super-top-actions"><span className="status-pill"><span className="pulse-dot" /> All systems nominal</span><button className="icon-button" aria-label="Open MCP endpoint"><Network size={18} /></button></div></header>
        <section className="super-hero glass-panel">
          <div className="hero-copy"><span className="super-eyebrow"><Sparkles size={13} /> Unified intelligence / execution plane</span><h2>Every signal.<br /><em>One machine.</em></h2><p>Research markets, operate agents, connect channels, and prepare signed transactions through one fast conversational MCP.</p><div className="hero-actions"><button className="primary-button" onClick={() => document.getElementById("super-chat")?.focus()}><MessageSquare size={16} /> Start command</button><button className="secondary-button" onClick={() => setActiveGroup("Trade")}><WalletCards size={16} /> Open trade desk</button></div></div>
          <div className="core-orbit" aria-label="MCP core visualization"><div className="orbit orbit-a" /><div className="orbit orbit-b" /><div className="core-node"><Cpu size={27} /><span>ORBITX</span></div><div className="orbit-label label-top">MCP ONLINE</div><div className="orbit-label label-right">TOOLS</div><div className="orbit-label label-bottom">SIGNED</div></div>
        </section>
        <section className="telemetry-grid">{telemetry.map(([label, value, tone]) => <div className="telemetry-card glass-panel" key={label}><span>{label}</span><strong className={`tone-${tone}`}>{value}</strong><div className="telemetry-line"><i style={{ width: label === "Tool latency" ? "68%" : "88%" }} /></div></div>)}</section>
        <div className="super-grid">
          <section className="glass-panel command-panel"><div className="panel-heading"><div><span className="super-eyebrow">Command console</span><h3>Talk to the machine</h3></div><span className="live-tag"><span className="pulse-dot" /> LIVE</span></div><div className="chat-stream">{messages.map((message, index) => <div className={`chat-line ${message.role}`} key={`${message.role}-${index}`}><span className="chat-avatar">{message.role === "user" ? "YOU" : "OX"}</span><p>{message.text}</p></div>)}</div><div className="command-input"><Terminal size={17} /><input id="super-chat" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") send(); }} placeholder="Ask for a scan, route, or signed action…" /><button aria-label="Send command" onClick={send}><Send size={16} /></button></div><div className="suggestions"><button onClick={() => setQuery("Scan SOL liquidity and volume")}>Scan SOL liquidity</button><button onClick={() => setQuery("Prepare a fast trade route")}>Prepare trade route</button><button onClick={() => setQuery("Show available tools")}>Show tools</button></div></section>
          <section className="glass-panel tools-panel"><div className="panel-heading"><div><span className="super-eyebrow">Active subsystem</span><h3>{activeGroup}</h3></div><Braces size={18} /></div><div className="tool-list">{activeTools.map((tool, index) => <button key={tool}><span className="tool-index">0{index + 1}</span><span>{tool}</span><ArrowUpRight size={14} /></button>)}</div><div className="tool-footer"><Gauge size={15} /> {activeTools.length} tools ready <span>·</span> 184ms median</div></section>
        </div>
        <section className="glass-panel architecture-panel"><div><span className="super-eyebrow">Control plane</span><h3>Old MCP + X MCP → Supercomputer MCP</h3><p>One endpoint, one auth flow, one signing surface. Existing clients remain compatible while new connections use the consolidated route.</p></div><div className="architecture-flow"><span>Agent MCP</span><b>+</b><span>X MCP</span><b>→</b><strong><Cpu size={15} /> Supercomputer</strong></div></section>
      </main>
    </div>
  );
}
