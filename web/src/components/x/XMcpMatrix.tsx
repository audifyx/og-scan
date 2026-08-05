import { useMemo, useState } from "react";

export type McpToolCard = {
  name: string;
  title: string;
  group: "post" | "dm" | "agent" | "auth" | "meta";
  description: string;
  write?: boolean;
};

export const X_MCP_TOOL_CATALOG: McpToolCard[] = [
  { name: "search", title: "Search", group: "meta", description: "Find tools, queue, and help docs." },
  { name: "fetch", title: "Fetch", group: "meta", description: "Load a document from search results." },
  { name: "x_post", title: "Post", group: "post", description: "Publish a tweet.", write: true },
  { name: "x_quote", title: "Quote", group: "post", description: "Quote an existing tweet.", write: true },
  { name: "x_reply", title: "Reply", group: "post", description: "Reply to a tweet by id.", write: true },
  { name: "x_mentions", title: "Mentions", group: "post", description: "List recent @mentions (Basic/Pro)." },
  { name: "x_dm", title: "DM", group: "dm", description: "Send a 1:1 direct message.", write: true },
  { name: "x_dm_inbox", title: "Inbox", group: "dm", description: "List DMs + group chats." },
  { name: "x_dm_group", title: "Group DM", group: "dm", description: "Reply inside a group conversation.", write: true },
  { name: "x_connection_status", title: "Status", group: "auth", description: "Check X link + tweet.write / dm.write." },
  { name: "x_auth_link", title: "Auth link", group: "auth", description: "Create a one-tap Grok auth URL." },
  { name: "x_auth_status", title: "Auth poll", group: "auth", description: "Poll whether the link was approved." },
  { name: "x_agent_status", title: "Agent", group: "agent", description: "Read persona, mode, auto-reply toggles." },
  { name: "x_agent_upsert", title: "Upsert", group: "agent", description: "Update agent config + auto-reply.", write: true },
  { name: "x_agent_train", title: "Train", group: "agent", description: "Add knowledge / voice notes.", write: true },
  { name: "x_agent_schedule", title: "Schedule", group: "agent", description: "Queue a draft for later.", write: true },
  { name: "x_agent_run", title: "Run", group: "agent", description: "Generate + queue/post from the agent.", write: true },
  { name: "x_agent_poll_replies", title: "Poll replies", group: "agent", description: "Auto-reply mentions + DMs now.", write: true },
  { name: "x_agent_list_queue", title: "Queue", group: "agent", description: "List pending / posted items." },
  { name: "x_agent_approve", title: "Approve", group: "agent", description: "Post an approved queue item.", write: true },
  { name: "x_agent_cancel", title: "Cancel", group: "agent", description: "Cancel a queued item.", write: true },
  { name: "x_help", title: "Help", group: "meta", description: "Full MCP setup + tool guide." },
];

const GROUP_LABEL: Record<McpToolCard["group"], string> = {
  post: "Post / reply",
  dm: "Direct messages",
  agent: "Agent brain",
  auth: "Auth once",
  meta: "Discovery",
};

type Props = {
  hasTweetWrite?: boolean;
  hasDmWrite?: boolean;
  xConnected?: boolean;
  hasKey?: boolean;
};

export default function XMcpMatrix({ hasTweetWrite, hasDmWrite, xConnected, hasKey }: Props) {
  const [active, setActive] = useState<string>(X_MCP_TOOL_CATALOG[2]?.name || "x_post");
  const [filter, setFilter] = useState<"all" | McpToolCard["group"]>("all");

  const tools = useMemo(
    () => (filter === "all" ? X_MCP_TOOL_CATALOG : X_MCP_TOOL_CATALOG.filter((t) => t.group === filter)),
    [filter],
  );
  const selected = X_MCP_TOOL_CATALOG.find((t) => t.name === active) || tools[0];

  return (
    <div className="xh-matrix">
      <div className="xh-matrix__intro">
        <div className="xh-matrix__kicker">MCP Matrix</div>
        <h2>Everything this connector can do</h2>
        <p>
          OrbitX X MCP exposes {X_MCP_TOOL_CATALOG.length} tools to Claude, ChatGPT, and Grok. Auth once with a key or
          link — tokens refresh automatically so you should not re-authorize every session.
        </p>
        <div className="xh-matrix__signals">
          <span className={`xh__chip${xConnected ? " is-ok" : " is-warn"}`}>
            {xConnected ? "X linked" : "X off"}
          </span>
          <span className={`xh__chip${hasTweetWrite ? " is-ok" : " is-warn"}`}>
            {hasTweetWrite ? "tweet.write" : "no tweet.write"}
          </span>
          <span className={`xh__chip${hasDmWrite ? " is-ok" : ""}`}>
            {hasDmWrite ? "dm.write" : "dm.write optional"}
          </span>
          <span className={`xh__chip${hasKey ? " is-ok" : " is-warn"}`}>
            {hasKey ? "MCP key" : "Need key"}
          </span>
        </div>
      </div>

      <div className="xh-matrix__filters" role="tablist" aria-label="Tool groups">
        {(["all", "post", "dm", "agent", "auth", "meta"] as const).map((g) => (
          <button
            key={g}
            type="button"
            role="tab"
            aria-selected={filter === g}
            className={`xh-matrix__filter${filter === g ? " is-on" : ""}`}
            onClick={() => setFilter(g)}
          >
            {g === "all" ? "All" : GROUP_LABEL[g]}
          </button>
        ))}
      </div>

      <div className="xh-matrix__stage" aria-hidden={false}>
        <div className="xh-matrix__orbit">
          <div className="xh-matrix__core">
            <span>X</span>
            <small>MCP</small>
          </div>
          {tools.map((t, i) => {
            const angle = (i / Math.max(tools.length, 1)) * Math.PI * 2 - Math.PI / 2;
            const radius = 38 + (i % 3) * 6;
            const x = 50 + Math.cos(angle) * radius * 0.42;
            const y = 50 + Math.sin(angle) * radius * 0.38;
            const depth = 40 + Math.sin(angle * 2 + i) * 28;
            return (
              <button
                key={t.name}
                type="button"
                className={`xh-matrix__node xh-matrix__node--${t.group}${active === t.name ? " is-active" : ""}`}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: `translate3d(-50%, -50%, ${depth}px) scale(${active === t.name ? 1.12 : 1})`,
                  animationDelay: `${i * 0.05}s`,
                }}
                onClick={() => setActive(t.name)}
                title={t.name}
              >
                <em>{t.title}</em>
              </button>
            );
          })}
        </div>
      </div>

      {selected ? (
        <div className="xh-matrix__detail">
          <div className="xh-matrix__detail-top">
            <code>{selected.name}</code>
            <span className="xh__chip">{GROUP_LABEL[selected.group]}</span>
            {selected.write ? <span className="xh__chip is-warn">write</span> : null}
          </div>
          <h3>{selected.title}</h3>
          <p>{selected.description}</p>
          <p className="xh__note" style={{ marginBottom: 0 }}>
            Ask your AI: use <code>{selected.name}</code>
            {selected.write ? " after x_connection_status confirms write scopes." : "."}
          </p>
        </div>
      ) : null}

      <div className="xh-matrix__menu">
        {tools.map((t) => (
          <button
            key={`row-${t.name}`}
            type="button"
            className={`xh-matrix__row${active === t.name ? " is-active" : ""}`}
            onClick={() => setActive(t.name)}
          >
            <span className={`xh-matrix__dot xh-matrix__dot--${t.group}`} />
            <span className="xh-matrix__row-name">{t.name}</span>
            <span className="xh-matrix__row-title">{t.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
