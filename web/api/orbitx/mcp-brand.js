/**
 * Shared OrbitX MCP branding — banner + capability menus + dashboard paste auth copy.
 * Used by Agent MCP (orbitx-hub) and X MCP (x-mcp).
 */

export const ORBITX_HOST = "https://www.orbitx.world";
export const ORBITX_BANNER_URL = `${ORBITX_HOST}/orbitx-banner.jpg`;
export const ORBITX_GLOBE_URL = `${ORBITX_HOST}/orbitx-globe.png`;
export const ORBITX_ICON_URL = `${ORBITX_HOST}/icon-192x192.png`;

/** ASCII / “3D” box menu for chat UIs that render markdown. */
export function buildAgentMenuMarkdown({ authCode } = {}) {
  const authLine = authCode
    ? `**Linked** — keep using \`authCode\`: \`${authCode}\` on every tool.`
    : `**Not linked** — paste a dashboard auth message, or call \`orbitx_auth_link\`.`;

  return [
    `![OrbitX](${ORBITX_BANNER_URL})`,
    ``,
    `# ORBITX · Agent MCP`,
    `Intel · Trade · Launch · Social · Media`,
    ``,
    authLine,
    ``,
    "```",
    "╔══════════════════════════════════════════════════╗",
    "║           ◆  O R B I T X   C O M M A N D  ◆      ║",
    "╠══════════════════════════════════════════════════╣",
    "║  /  or  orbitx_menu     · this menu              ║",
    "║  AUTH                                                ║",
    "║    orbitx_auth_status   · activate paste authCode║",
    "║    orbitx_auth_link     · clickable link (Grok)  ║",
    "║    orbitx_whoami        · session identity       ║",
    "╠══════════════════════════════════════════════════╣",
    "║  INTEL                                               ║",
    "║    orbitx_search · orbitx_get_token · screen     ║",
    "║    forensics · safety · crypto_scan · xray       ║",
    "║    orbitx_dex_chart · chart · ath · research     ║",
    "╠══════════════════════════════════════════════════╣",
    "║  CREDITS · SHOP                                      ║",
    "║    orbitx_credits_buy · confirm · balance · usage ║",
    "╠══════════════════════════════════════════════════╣",
    "║  TRADE                                               ║",
    "║    orbitx_buy_orbitx · confirm_buy (chat auto)   ║",
    "║    orbitx_prepare_buy / sell · claim · burn      ║",
    "╠══════════════════════════════════════════════════╣",
    "║  LAUNCH                                              ║",
    "║    orbitx_execute_launch · launch_config         ║",
    "╠══════════════════════════════════════════════════╣",
    "║  SOCIAL · MEDIA                                      ║",
    "║    communities · post · join · generate_image    ║",
    "╠══════════════════════════════════════════════════╣",
    "║  HELP                                                 ║",
    "║    orbitx_tools_help · search · fetch            ║",
    "╚══════════════════════════════════════════════════╝",
    "```",
    ``,
    `Setup · ${ORBITX_HOST}/agent`,
    `MCP URL · ${ORBITX_HOST}/api/mcp`,
    ``,
    `_Buy credits: say “buy 5000 credits” → orbitx_credits_buy → Phantom → desk wallet. Advanced usage: orbitx_credits_usage (24h/7d/30d)._`,
    `_Buy $ORBITX: say “buy $ORBITX” → orbitx_buy_orbitx. Say “confirm” / “auto” → Phantom auto-prompt._`,
    `_Tip: From the OrbitX dashboard, copy a one-time chat auth message for Grok / Claude / ChatGPT — no mid-chat website click._`,
  ].join("\n");
}

export function buildXMenuMarkdown({ authCode, xUsername } = {}) {
  const authLine = authCode
    ? `**Linked** — keep using \`authCode\`: \`${authCode}\` on every \`x_*\` tool.`
    : `**Not linked** — paste a dashboard auth message, or call \`x_auth_link\`.`;
  const xLine = xUsername ? `X account · **@${xUsername}**` : `X account · connect on ${ORBITX_HOST}/x`;

  return [
    `![OrbitX](${ORBITX_BANNER_URL})`,
    ``,
    `# ORBITX · X MCP`,
    `Advanced analytics · Post · DM · PDF scan · NVIDIA agent`,
    ``,
    authLine,
    xLine,
    ``,
    "```",
    "╔══════════════════════════════════════════════════╗",
    "║         ◆  O R B I T X   X   C O M M A N D  ◆     ║",
    "╠══════════════════════════════════════════════════╣",
    "║  /  or  x_menu          · this menu              ║",
    "║  AUTH                                                ║",
    "║    x_auth_status        · activate paste authCode║",
    "║    x_auth_link          · clickable link (Grok)  ║",
    "║    x_connection_status  · X + scopes             ║",
    "╠══════════════════════════════════════════════════╣",
    "║  ANALYTICS · AUDIENCE                                 ║",
    "║    x_analytics · x_me · x_get_user @handle       ║",
    "║    x_followers · x_following · x_recent_followers║",
    "║    x_lists · x_list_members · x_tweet_metrics    ║",
    "║    x_user_tweets · x_dm_inbox · x_mentions       ║",
    "║    x_pdf_scan · x_dex_chart (CA → Dex embed)     ║",
    "║  GITHUB · DRAFTING                                   ║",
    "║    x_repo_link · x_repo · x_repo_context         ║",
    "║    x_repo_read · x_repo_search · x_repo_tree     ║",
    "║    x_tools_help (5000+ activity tools)          ║",
    "╠══════════════════════════════════════════════════╣",
    "║  POST · DM                                           ║",
    "║    x_post · x_dm · x_dm_recent · x_dm_group      ║",
    "║    x_mentions                                        ║",
    "╠══════════════════════════════════════════════════╣",
    "║  AGENT                                               ║",
    "║    x_agent_run · schedule · queue · approve      ║",
    "║    x_agent_poll_replies · x_agent_upsert         ║",
    "╠══════════════════════════════════════════════════╣",
    "║  BUY · CREDITS                                       ║",
    "║    x_buy             · credits OR orbitx (use this)║",
    "║    x_credits_buy · confirm · balance · usage      ║",
    "║    x_buy_orbitx · x_confirm_buy                   ║",
    "║  (Grok: call x_buy — never invent XBuyTool)         ║",
    "╠══════════════════════════════════════════════════╣",
    "║  HELP                                                 ║",
    "║    x_tools_help · x_help · search · fetch        ║",
    "╚══════════════════════════════════════════════════╝",
    "```",
    ``,
    `Setup · ${ORBITX_HOST}/x`,
    `Usage / shop · ${ORBITX_HOST}/shop`,
    `MCP URL · ${ORBITX_HOST}/api/x/mcp`,
    ``,
    `_Analytics: followers, following, DMs, tweet views, lists. Charts: share a CA → x_dex_chart. GitHub: link once with x_repo_link — then x_repo_context / x_repo_read while drafting (no paste every time)._`,
    `_Buy credits: say “buy credits” → amount → Phantom → desk wallet. Reconnect X on /x after deploy to refresh follows.read + list.read._`,
    `_Tip: Mint a chat auth message on the /x dashboard — paste into Grok / Claude / ChatGPT to stay linked without opening a site._`,
  ].join("\n");
}

export function agentMenuPayload({ authCode } = {}) {
  const markdown = buildAgentMenuMarkdown({ authCode });
  return {
    __mcpFormat: "markdown",
    markdown,
    bannerUrl: ORBITX_BANNER_URL,
    globeUrl: ORBITX_GLOBE_URL,
    iconUrl: ORBITX_ICON_URL,
    menu: "agent",
    authCode: authCode || null,
    mcpUrl: `${ORBITX_HOST}/api/mcp`,
    setupUrl: `${ORBITX_HOST}/agent`,
  };
}

export function xMenuPayload({ authCode, xUsername } = {}) {
  const markdown = buildXMenuMarkdown({ authCode, xUsername });
  return {
    __mcpFormat: "markdown",
    markdown,
    bannerUrl: ORBITX_BANNER_URL,
    globeUrl: ORBITX_GLOBE_URL,
    iconUrl: ORBITX_ICON_URL,
    menu: "x",
    authCode: authCode || null,
    xUsername: xUsername || null,
    mcpUrl: `${ORBITX_HOST}/api/x/mcp`,
    setupUrl: `${ORBITX_HOST}/x`,
  };
}

/** Build paste-ready messages for chat AIs (dashboard mint). */
export function buildAgentAuthPasteMessages({ authCode, mcpUrl, expiresAt }) {
  const url = mcpUrl || `${ORBITX_HOST}/api/mcp`;
  const exp = expiresAt ? ` (valid until ${expiresAt.slice(0, 10)})` : "";
  const core = [
    `ORBITX AGENT AUTH${exp}`,
    ``,
    `My OrbitX Agent MCP is already authorized from the dashboard. Do NOT ask me to open a website.`,
    ``,
    `authCode: ${authCode}`,
    ``,
    `Instructions for you:`,
    `1. Call orbitx_auth_status with authCode "${authCode}"`,
    `2. Call orbitx_menu (or search query "menu") and show me the OrbitX menu`,
    `3. Pass authCode "${authCode}" on every later tool call in this chat`,
    `4. Keep using this authCode for the rest of the conversation (it stays linked)`,
  ].join("\n");

  return {
    grok: [
      core,
      ``,
      `If the OrbitX connector is not added yet, MCP URL is: ${url}`,
      `(Grok → Connectors → Custom → paste that URL once.)`,
    ].join("\n"),
    claude: [
      core,
      ``,
      `MCP URL: ${url}`,
      `Client ID: orbitx-mcp (secret blank)`,
      `You can also use connector OAuth / Bearer, but prefer authCode above for this chat.`,
    ].join("\n"),
    chatgpt: [
      core,
      ``,
      `MCP URL: ${url}`,
      `OAuth Client ID: orbitx-mcp · secret blank · scope: orbitx`,
      `After tools work, call search with query "menu" or fetch id "menu".`,
    ].join("\n"),
    authCode,
  };
}

export function buildXAuthPasteMessages({ authCode, mcpUrl, expiresAt, xUsername }) {
  const url = mcpUrl || `${ORBITX_HOST}/api/x/mcp`;
  const exp = expiresAt ? ` (valid until ${expiresAt.slice(0, 10)})` : "";
  const xNote = xUsername
    ? `My X account @${xUsername} is already connected on OrbitX.`
    : `If X tools fail, I still need to Connect X on ${ORBITX_HOST}/x (one-time).`;

  const core = [
    `ORBITX X AUTH${exp}`,
    ``,
    `My OrbitX X MCP is already authorized from the dashboard. Do NOT ask me to open a website.`,
    xNote,
    ``,
    `authCode: ${authCode}`,
    ``,
    `Instructions for you:`,
    `1. Call x_auth_status with authCode "${authCode}"`,
    `2. Call x_menu (or search query "menu") and show me the OrbitX X menu`,
    `3. Pass authCode "${authCode}" on every later x_* tool call in this chat`,
    `4. Keep using this authCode for the rest of the conversation (it stays linked)`,
  ].join("\n");

  return {
    grok: [
      core,
      ``,
      `If the OrbitX X connector is not added yet, MCP URL is: ${url}`,
      `(Grok → Connectors → Custom → paste that URL once.)`,
    ].join("\n"),
    claude: [
      core,
      ``,
      `MCP URL: ${url}`,
      `Client ID: orbitx-x-mcp (secret blank)`,
    ].join("\n"),
    chatgpt: [
      core,
      ``,
      `MCP URL: ${url}`,
      `OAuth Client ID: orbitx-x-mcp · secret blank · scope: x-post`,
      `Then search "menu" or fetch id "menu".`,
    ].join("\n"),
    authCode,
  };
}

/** Normalize tools/call content for markdown menu results. */
export function wrapMcpToolContent(result) {
  if (result && result.__mcpFormat === "markdown" && typeof result.markdown === "string") {
    const { __mcpFormat, markdown, ...rest } = result;
    void __mcpFormat;
    return {
      content: [{ type: "text", text: markdown }],
      structuredContent: rest,
    };
  }
  const isError = result && result.ok === false;
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    structuredContent: result,
    ...(isError ? { isError: true } : {}),
  };
}
