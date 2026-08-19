/**
 * OrbitX desk shop catalog — same SKUs as the Solana-betting /shop
 * (orbitxtrade.world / solana-betting-two.vercel.app).
 *
 * Prices snap to the live ladder. Checkout burns $ORBITX (Jupiter buy + 90% burn
 * in one tx). Do not invent live SOL quotes here.
 */

export const ORBITX_SHOP_GC = "https://t.me/orbitxwrld";
export const ORBITX_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
export const SHOP_BURN_BPS = 90;
export const SHOP_SOL_USD_FALLBACK = 150;

const SNAP = [
  5, 6, 7, 8, 9, 10, 12, 14, 15, 16, 18, 19, 22, 25, 29, 32, 35, 39, 45, 49, 50, 55, 59, 65, 69, 79, 89, 99, 119, 129,
  149, 159, 179, 199, 200,
];

export function snapShopUsd(raw) {
  if (!Number.isFinite(raw)) return 5;
  const t = Math.max(5, Math.min(200, Math.round(raw)));
  let best = 5;
  let dist = Math.abs(t - 5);
  for (const step of SNAP) {
    const d = Math.abs(t - step);
    if (d < dist || (d === dist && step >= t)) {
      best = step;
      dist = d;
    }
  }
  return best;
}

function sku(kind, id, name, blurb, usd, extra = {}) {
  return { sku: id, kind, name, blurb, usd: snapShopUsd(usd), ...extra };
}

const KIND_GROUP = { flare: "flare", title: "title", theme: "theme", aura: "aura" };
const KIND_CATEGORY = {
  listing: "board",
  spotlight: "board",
  featured: "board",
  intel: "intel",
  mcp: "access",
  api: "access",
  launch: "access",
  bundle: "access",
  flare: "desk",
  title: "desk",
  theme: "desk",
  pins: "desk",
  aura: "desk",
  boost: "social",
  alerts: "tools",
  watch: "tools",
  paper: "tools",
  compare: "tools",
  export: "tools",
  notes: "tools",
  tape: "tools",
  scan: "tools",
  creator: "creator",
  feed: "access",
};

export const ORBITX_SHOP_CATEGORIES = [
  { id: "board", title: "Token listings", kicker: "Put a CA on the board", kinds: ["listing", "spotlight", "featured"] },
  { id: "intel", title: "Team analysis", kicker: "Desk notes on live projects", kinds: ["intel"] },
  { id: "access", title: "MCP, API & launch", kicker: "Keys, poll paths, pump.fun launch", kinds: ["mcp", "api", "launch", "bundle", "feed"] },
  { id: "desk", title: "Desk marks", kicker: "Flares, titles, covers, auras", kinds: ["flare", "title", "theme", "pins", "aura"] },
  { id: "social", title: "Pulse & megaphone", kicker: "Sort your shouts up", kinds: ["boost"] },
  { id: "tools", title: "Desk tools", kicker: "Caps that actually raise limits", kinds: ["alerts", "watch", "paper", "compare", "export", "notes", "tape", "scan"] },
  { id: "creator", title: "Creator rails", kicker: "Coin-page and board bumps", kinds: ["creator"] },
];

function generatedSkus() {
  const e = [];

  for (const t of [2, 3, 4, 5, 6, 8, 10, 12, 16, 18, 36, 48, 60, 72, 96, 120]) {
    e.push(
      sku(
        "spotlight",
        `spotlight-${t}h`,
        `${t}h board spotlight`,
        "Jupiter buys $ORBITX and burns it. Your CA sits on the home spotlight rail for this window.",
        8 + 1.15 * t,
        { durationHours: t, needsMint: true, needsMeta: true },
      ),
    );
  }

  for (const t of [1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 18, 21, 24, 30]) {
    e.push(
      sku(
        "featured",
        `featured-${t}d`,
        `Featured listing · ${t} day${t === 1 ? "" : "s"}`,
        "Burn $ORBITX to hold the featured rail. Listing stays on the board after the window.",
        18 + 5.5 * t,
        { durationHours: 24 * t, needsMint: true, needsMeta: true },
      ),
    );
  }

  for (const [id, name, usd] of [
    ["list-2", "Priority listing", 39],
    ["list-3", "Listing + 24h tape", 59],
    ["list-5", "Listing + 48h heat", 89],
    ["list-10", "Listing + 7d featured", 149],
  ]) {
    e.push(
      sku("listing", id, name, "One CA onto the OrbitX board in the same burn. Higher packs also light a timed rail.", usd, {
        needsMint: true,
        needsMeta: true,
        durationHours: id === "list-2" ? undefined : id === "list-3" ? 24 : id === "list-5" ? 48 : 168,
        value: id === "list-3" ? "tape" : id === "list-5" ? "heat" : id === "list-10" ? "featured" : undefined,
      }),
    );
  }

  [
    ["tape", "Ticker tape"],
    ["heat", "Heat rail"],
    ["new", "New rail"],
    ["ending", "Ending-soon rail"],
    ["votes", "Vote rail"],
    ["mcap", "Mcap rail"],
    ["volume", "Volume rail"],
    ["holders", "Holder rail"],
    ["chat", "Chat rail"],
    ["desks", "Desk rail"],
    ["official", "Official rail"],
    ["vanity", "Vanity rail"],
  ].forEach(([id, name], i) => {
    e.push(
      sku("featured", `rail-${id}-24h`, `${name} · 24h`, `Burn $ORBITX to place a CA on the ${name.toLowerCase()} for a day.`, 29 + 4 * i, {
        durationHours: 24,
        needsMint: true,
        needsMeta: true,
        value: id,
      }),
    );
  });

  const intelDays = [1, 3, 7, 14, 30, 90];
  for (const [id, name] of [
    ["core", "Core desk notes"],
    ["holders", "Holder structure"],
    ["risk", "Risk flags"],
    ["curve", "Bonding / curve"],
    ["social", "Social tape"],
    ["creator", "Creator flow"],
    ["liquidity", "Liquidity watch"],
    ["votes", "YES/NO tape"],
  ]) {
    for (const days of intelDays) {
      e.push(
        sku(
          "intel",
          `intel-pack-${id}-${days}d`,
          `${name} · ${days}d`,
          "Team analysis seat. Jupiter buy-and-burn; notes open for this window.",
          9 + 0.9 * days + (id === "risk" ? 8 : 0),
          { durationHours: 24 * days, value: "all" },
        ),
      );
    }
  }

  for (const [id, name, usd] of [
    ["orbitx", "OrbitX house token", 12],
    ["pump-board", "Pump.fun board flow", 12],
    ["listing-hygiene", "Listing hygiene", 15],
    ["freeze", "Freeze authority", 18],
    ["mint-auth", "Mint authority", 18],
    ["top-holder", "Top-holder concentration", 16],
    ["curve-state", "Curve vs AMM", 14],
    ["vote-memo", "Vote memo path", 12],
    ["vault-split", "Vault / pot split", 19],
    ["winner-pot", "Winner pot", 19],
    ["claim-doctor", "Claim doctor notes", 15],
    ["jupiter-route", "Jupiter route hygiene", 14],
    ["token-2022", "Token-2022 burns", 16],
    ["social-cents", "Social cent burns", 12],
    ["shop-burns", "Shop dollar burns", 12],
    ["mcp-seat", "MCP seat model", 14],
    ["api-v1", "API v1 surface", 14],
    ["desk-card", "Desk card stamps", 9],
    ["pulse-tape", "Pulse tape", 11],
    ["pin-rails", "Pin rails", 9],
    ["watch-wallets", "Watch wallets", 11],
    ["paper-book", "Paper book", 10],
    ["tax-lots", "Tax lots", 17],
    ["alerts-bands", "Alert bands", 10],
    ["compare-cas", "Compare CAs", 11],
    ["bags-dust", "Bags / dust", 12],
    ["epochs", "Claim epochs", 13],
    ["copy-tape", "Copy tape", 13],
    ["vanity-obx", "Vanity …obx", 15],
    ["hidden-mints", "Hidden mints", 16],
    ["identity-deny", "Identity denylist", 18],
    ["official-coin", "Official live coin", 12],
  ]) {
    e.push(
      sku("intel", `intel-note-${id}`, `Note · ${name}`, "Unlock this one desk note. Full intel packs open every note.", usd, {
        durationHours: 720,
        value: id,
      }),
    );
  }

  for (const t of [3, 7, 14, 21, 45, 60, 90, 120, 180, 270]) {
    e.push(
      sku("mcp", `mcp-${t}d`, `MCP seat · ${t}d`, "Cursor / Claude MCP against OrbitX board, token, intel, and extra tools.", 12 + 0.45 * t, {
        durationHours: 24 * t,
        value: "all",
      }),
    );
    e.push(
      sku("api", `api-${t}d`, `API key · ${t}d`, "REST at /api/orbitx/v1. Same burn path. Key shown once.", 18 + 0.55 * t, {
        durationHours: 24 * t,
        value: "all",
      }),
    );
  }

  [30, 60, 90, 120, 180, 240, 360, 480, 600, 900].forEach((rpm, i) => {
    e.push(
      sku("api", `api-rpm-${rpm}`, `API rate · ${rpm}/min`, "Raises the documented poll rate on your key. Still a $ORBITX burn, not a team invoice.", 25 + 12 * i, {
        durationHours: 720,
        value: String(rpm),
      }),
    );
  });

  [
    ["holders", "Holders tool"],
    ["dex", "Dex stats tool"],
    ["pulse", "Pulse tool"],
    ["catalog", "Shop catalog tool"],
    ["perks", "Perks tool"],
    ["search", "Search tool"],
    ["bags", "Bags tool"],
    ["votes", "Votes tool"],
    ["chat", "Chat tool"],
    ["notes", "Notes tool"],
    ["tape", "Tape tool"],
    ["doctor", "Doctor tool"],
    ["epochs", "Epochs tool"],
    ["leaderboard", "Leaderboard tool"],
    ["wallet", "Wallet card tool"],
    ["sol", "SOL quote tool"],
  ].forEach(([id, name], i) => {
    e.push(
      sku("mcp", `mcp-tool-${id}`, `MCP · ${name}`, `Adds the ${id} tool on /api/orbitx/mcp for 30 days.`, 19 + 4 * i, {
        durationHours: 720,
        value: id,
      }),
    );
  });

  for (const [id, name, usd, hours, grants] of [
    ["bundle-weekend", "Weekend desk", 39, 72, "intel-30d,mcp-30d"],
    ["bundle-week", "Week builder", 79, 168, "intel-30d,api-30d"],
    ["bundle-month", "Month stack", 129, 720, "intel-30d,mcp-30d,api-30d"],
    ["bundle-quarter", "Quarter stack", 179, 2160, "intel-30d,mcp-30d,api-30d"],
    ["bundle-intel-api", "Intel + API", 99, 720, "intel-30d,api-30d"],
    ["bundle-intel-mcp", "Intel + MCP", 89, 720, "intel-30d,mcp-30d"],
    ["bundle-board-week", "Board week", 119, 168, "list-token,spotlight-24h"],
    ["bundle-desk-kit", "Desk kit", 49, 2160, "pins-8,chat-aura"],
    ["bundle-scout", "Scout kit", 69, 720, "alerts-32,watch-24"],
    ["bundle-creator", "Creator week", 159, 168, "list-token,featured-7d,intel-30d"],
  ]) {
    e.push(
      sku("bundle", id, name, "One burn, several seats. Grants are written as live entitlements on this wallet.", usd, {
        durationHours: hours,
        value: grants,
      }),
    );
  }

  for (const [id, name, usd] of [
    ["ember", "Ember", 7],
    ["ice", "Ice", 7],
    ["lime", "Lime", 8],
    ["rose", "Rose", 8],
    ["amber", "Amber", 9],
    ["cobalt", "Cobalt", 9],
    ["magenta", "Magenta", 10],
    ["white", "White", 11],
    ["copper", "Copper", 11],
    ["jade", "Jade", 12],
    ["crimson", "Crimson", 12],
    ["azure", "Azure", 13],
    ["sand", "Sand", 8],
    ["night", "Night", 14],
    ["solar", "Solar", 14],
    ["plasma", "Plasma", 15],
    ["fog", "Fog", 6],
    ["volt", "Volt", 13],
    ["bloom", "Bloom", 10],
    ["steel", "Steel", 9],
    ["neon", "Neon", 15],
    ["ink", "Ink", 12],
  ]) {
    e.push(sku("flare", `flare-${id}`, `${name} flare`, "Desk, chat, and pulse mark. Exclusive with other flares.", usd, { value: id }));
  }

  [
    "Scout",
    "Caller",
    "Tape",
    "Curve",
    "Holder",
    "Voter",
    "Maker+",
    "Relayer",
    "Archivist",
    "Cartographer",
    "Night desk",
    "Open",
    "Close",
    "Heat",
    "Ice",
    "Signal+",
    "Vault+",
    "Pilot",
    "Navigator",
    "Scribe",
    "Warden",
    "Keeper",
    "Forge",
    "Mint",
    "Rail",
    "Pulse",
    "Orbit",
    "Axiom",
    "Vector",
    "Delta",
  ].forEach((title, i) => {
    e.push(
      sku(
        "title",
        `title-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        `Title · ${title}`,
        "Shows next to your handle on desk, chat, and pulse.",
        5 + (i % 10),
        { value: title },
      ),
    );
  });

  for (const [id, name, usd] of [
    ["slate", "Slate", 5],
    ["forest", "Forest", 6],
    ["blood", "Blood", 8],
    ["iceberg", "Iceberg", 7],
    ["sunset", "Sunset", 9],
    ["carbon", "Carbon", 10],
    ["lilac", "Lilac", 8],
    ["bronze", "Bronze", 11],
    ["pearl", "Pearl", 12],
    ["radar", "Radar", 9],
    ["moss", "Moss", 6],
    ["wine", "Wine", 10],
    ["glacier", "Glacier", 11],
    ["emberplate", "Ember plate", 13],
    ["midnight", "Midnight", 14],
    ["chartreuse", "Chartreuse", 12],
    ["obsidian", "Obsidian", 15],
    ["aurora", "Aurora", 15],
  ]) {
    e.push(sku("theme", `theme-${id}`, `${name} cover`, "Desk and profile plate. Exclusive with other covers.", usd, { value: id }));
  }

  for (const t of [4, 5, 6, 7, 9, 10, 11, 12, 14, 16, 18, 20, 24]) {
    e.push(
      sku("pins", `pins-${t}`, `${t} board pins`, `Raise the home-board pin cap to ${t}. Stacks to the highest cap you own.`, 6 + t, {
        value: String(t),
      }),
    );
  }

  for (const [id, name, usd] of [
    ["gold", "Gold chat aura", 12],
    ["violet", "Violet chat aura", 12],
    ["lime", "Lime chat aura", 11],
    ["rose", "Rose chat aura", 11],
    ["white", "White chat aura", 14],
    ["pulse", "Pulse chat aura", 15],
    ["thin", "Thin chat aura", 8],
    ["heavy", "Heavy chat aura", 16],
  ]) {
    e.push(sku("aura", `aura-${id}`, name, "Edge on your messages in token rooms and pulse.", usd, { value: id }));
  }

  for (const t of [1, 2, 3, 4, 6, 8, 12, 18, 24, 36, 48, 72]) {
    e.push(
      sku("boost", `pulse-boost-${t}h`, `Pulse boost · ${t}h`, "Megaphone on your next shouts. Burn $ORBITX; tape sorts you up for the window.", 8 + 1.4 * t, {
        durationHours: t,
        value: "pulse",
      }),
    );
  }

  for (const t of [1, 2, 4, 6, 8, 12, 24, 48, 72, 168]) {
    e.push(
      sku("boost", `mega-${t}h`, `Megaphone · ${t}h`, "Stronger pulse boost for a longer window. Same Jupiter burn.", 14 + 0.9 * t, {
        durationHours: t,
        value: "mega",
      }),
    );
  }

  for (const t of [8, 12, 16, 24, 32, 48, 64, 80]) {
    e.push(
      sku("alerts", `alerts-${t}`, `${t} price alerts`, `Raise local alert slots to ${t}. Highest cap wins.`, 8 + 0.7 * t, {
        value: String(t),
        durationHours: 2160,
      }),
    );
  }

  for (const t of [8, 12, 16, 24, 32, 40, 48, 64]) {
    e.push(
      sku("watch", `watch-${t}`, `${t} watch wallets`, `Scout more desks. Cap ${t} on this device.`, 9 + 0.8 * t, {
        value: String(t),
        durationHours: 2160,
      }),
    );
  }

  for (const t of [40, 60, 80, 120, 160, 200, 300, 400]) {
    e.push(
      sku("paper", `paper-${t}`, `${t} paper fills`, `Keep a longer paper book. Cap ${t}.`, 7 + 0.12 * t, {
        value: String(t),
        durationHours: 4320,
      }),
    );
  }

  for (const t of [3, 4, 5, 6, 8]) {
    e.push(
      sku("compare", `compare-${t}`, `Compare ${t} CAs`, "Side-by-side slots on /tools/compare.", 8 + 4 * t, {
        value: String(t),
        durationHours: 2160,
      }),
    );
  }

  [
    ["full", "Full CSV pack"],
    ["alerts", "Alerts CSV"],
    ["burns", "Burns CSV"],
    ["lots", "Lots CSV"],
    ["notes", "Notes CSV"],
    ["paper", "Paper CSV"],
    ["watch", "Watch CSV"],
    ["claims", "Claims CSV"],
  ].forEach(([id, name], i) => {
    e.push(
      sku("export", `export-${id}`, name, "Marks the export pack as unlocked on this wallet. Files still download locally.", 9 + 5 * i, {
        value: id,
        durationHours: 8760,
      }),
    );
  });

  for (const t of [20, 40, 60, 80, 100, 120, 160, 200]) {
    e.push(
      sku("notes", `notes-${t}`, `${t} coin notes`, "Private thesis slots on /tools/notes.", 6 + 0.2 * t, {
        value: String(t),
        durationHours: 4320,
      }),
    );
  }

  for (const t of [20, 40, 60, 80, 100, 140, 180, 240]) {
    e.push(
      sku("tape", `tape-${t}`, `${t} copy-tape rows`, "Longer /tools/tape history.", 8 + 0.18 * t, {
        value: String(t),
        durationHours: 2160,
      }),
    );
  }

  for (const t of ["tight", "wide", "degen", "desk", "two-percent", "five-percent"]) {
    e.push(
      sku("scan", `size-${t}`, `Size preset · ${t}`, "Unlocks a named size preset on /tools/size.", 9, {
        value: t,
        durationHours: 4320,
      }),
    );
  }

  for (const t of ["fifo", "income", "claims", "year", "wallets", "mints"]) {
    e.push(
      sku("export", `tax-${t}`, `Tax · ${t}`, "Marks a tax export flavor. CSV still builds on-device.", 19, {
        value: t,
        durationHours: 8760,
      }),
    );
  }

  for (const t of ["vault", "pot", "winner", "ata", "memo", "sig"]) {
    e.push(
      sku("scan", `doctor-${t}`, `Doctor · ${t}`, "Priority copy on /tools/doctor for this failure class.", 14, {
        value: t,
        durationHours: 2160,
      }),
    );
  }

  for (const t of ["dust", "listed", "unlisted", "sol", "orbitx", "closed"]) {
    e.push(
      sku("scan", `bags-${t}`, `Bags · ${t}`, "Filter mark on /tools/bags.", 11, {
        value: t,
        durationHours: 2160,
      }),
    );
  }

  for (const [id, name, usd, needsMint] of [
    ["creator-relist", "Relist a CA", 25, true],
    ["creator-rename", "Refresh name/ticker", 19, true],
    ["creator-logo", "Refresh logo", 15, true],
    ["creator-market-bump", "Market bump 24h", 49, true],
    ["creator-chat-pin", "Pin a coin chat 24h", 29, true],
    ["creator-vote-pin", "Pin the YES/NO 24h", 35, true],
    ["creator-holder-note", "Holder note 7d", 45, true],
    ["creator-launch-week", "Launch week tape", 99, true],
    ["creator-weekend", "Weekend launch blast", 79, true],
    ["creator-monday", "Monday open blast", 69, true],
    ["creator-close", "Session close blast", 59, true],
    ["creator-thesis", "Public thesis bump", 39, true],
    ["creator-desk-link", "Desk link on coin", 22, true],
    ["creator-twitter-tag", "Twitter tag on coin", 18, true],
    ["creator-dual-rail", "Dual rail 12h", 89, true],
    ["creator-tri-rail", "Triple rail 12h", 129, true],
  ]) {
    e.push(
      sku("creator", id, name, "Creator-side board and coin-page surface. Burns $ORBITX; does not pay the desk.", usd, {
        needsMint,
        needsMeta: needsMint,
        durationHours: id.includes("week") ? 168 : id.includes("7d") ? 168 : id.includes("dual") || id.includes("tri") ? 12 : 24,
      }),
    );
  }

  for (const [id, name, usd] of [
    ["board-poll", "Board poll feed", 29],
    ["pulse-poll", "Pulse poll feed", 29],
    ["intel-poll", "Intel poll feed", 39],
    ["dex-poll", "Dex poll feed", 35],
    ["holders-poll", "Holders poll feed", 45],
    ["votes-poll", "Votes poll feed", 32],
    ["shop-poll", "Shop poll feed", 22],
    ["wallet-poll", "Wallet poll feed", 27],
    ["search-poll", "Search poll feed", 24],
    ["leaderboard-poll", "Leaderboard poll feed", 31],
    ["bags-poll", "Bags poll feed", 33],
    ["epochs-poll", "Epochs poll feed", 36],
  ]) {
    e.push(
      sku("feed", `feed-${id}`, name, "Documents a poll path your API/MCP key may hit. Burn $ORBITX for the 30-day mark.", usd, {
        durationHours: 720,
        value: id,
      }),
    );
  }

  return e;
}

const HERO_SKUS = [
  sku("listing", "list-token", "List a token", "Put a contract address on the OrbitX board so people can trade, vote, and talk about it.", 25, {
    needsMint: true,
    needsMeta: true,
  }),
  sku("spotlight", "spotlight-24h", "24h board spotlight", "Pin your CA to the home rail for a day. Burns $ORBITX; the listing stays after the spotlight ends.", 49, {
    durationHours: 24,
    needsMint: true,
    needsMeta: true,
  }),
  sku("featured", "featured-7d", "Featured listing · 7 days", "Keep the token in the featured rail for a week. Same buy-and-burn checkout.", 99, {
    durationHours: 168,
    needsMint: true,
    needsMeta: true,
  }),
  sku("intel", "intel-30d", "Team analysis · 30 days", "Unlock OrbitX desk notes on live projects: structure, holders, risks, and what we are watching.", 29, {
    durationHours: 720,
    value: "all",
  }),
  sku("intel", "intel-365d", "Team analysis · 1 year", "A year of posted project analysis. New notes drop as the desk writes them.", 199, {
    durationHours: 8760,
    value: "all",
  }),
  sku("mcp", "mcp-30d", "MCP seat · 30 days", "Cursor / Claude MCP access to OrbitX board, token, intel, and wallet tools with your key.", 49, {
    durationHours: 720,
    value: "all",
  }),
  sku("api", "api-30d", "API key · 30 days", "REST access at /api/orbitx/v1. Board, token lookup, intel, and your entitlements.", 79, {
    durationHours: 720,
    value: "all",
  }),
  sku("launch", "launch-api-120d", "Launch API · 4 months", "Build on our pump.fun launch flow. One key for IPFS, vanity mint, create, and first-buy. Expires in 120 days and access stops.", 50, {
    durationHours: 2880,
    value: "pump",
  }),
  sku("bundle", "builder-90d", "Builder pack · 90 days", "MCP + API together. One checkout, one key, ninety days.", 149, {
    durationHours: 2160,
    value: "mcp-30d,api-30d",
  }),
  sku("bundle", "year-stack", "Year stack", "Listing credit, a year of intel, MCP, and API. Top of the shop. Paste a CA to list it in the same burn.", 200, {
    durationHours: 8760,
    value: "intel-365d,mcp-30d,api-30d,list-token",
    needsMint: true,
    needsMeta: true,
  }),
  sku("flare", "flare-orbit", "Orbit flare", "Gold ring on your desk, chat, and pulse.", 8, { value: "orbit" }),
  sku("flare", "flare-signal", "Signal flare", "Cyan pulse on your identity.", 8, { value: "signal" }),
  sku("flare", "flare-vault", "Vault flare", "Violet mark for desk regulars.", 12, { value: "vault" }),
  sku("title", "title-scanner", "Title · Scanner", "Shows next to your handle.", 5, { value: "Scanner" }),
  sku("title", "title-maker", "Title · Maker", "For people who ship coins.", 9, { value: "Maker" }),
  sku("title", "title-desk", "Title · Desk", "OrbitX desk badge.", 15, { value: "Desk" }),
  sku("theme", "theme-navy", "Navy cover", "Deep navy desk and profile plate.", 5, { value: "navy" }),
  sku("theme", "theme-gold", "Gold cover", "Warm gold desk plate.", 9, { value: "gold" }),
  sku("theme", "theme-void", "Void cover", "Near-black desk with a thin gold edge.", 15, { value: "void" }),
  sku("pins", "pins-8", "8 board pins", "Raise your home-board pin cap from 3 to 8.", 12, { value: "8" }),
  sku("aura", "chat-aura", "Chat aura", "Gold edge on your messages in token rooms.", 9, { value: "gold" }),
];

function finishSku(row) {
  return {
    ...row,
    id: row.sku,
    cents: Math.round(100 * row.usd),
    hours: row.durationHours,
    group: KIND_GROUP[row.kind],
    category: KIND_CATEGORY[row.kind],
  };
}

export const ORBITX_SHOP_SKUS = [...HERO_SKUS, ...generatedSkus()].map(finishSku);
export const ORBITX_SHOP_BY_ID = Object.fromEntries(ORBITX_SHOP_SKUS.map((row) => [row.sku, row]));

export function getShopSku(id) {
  return ORBITX_SHOP_BY_ID[String(id || "").trim()] || null;
}

export function usdToShopSol(usd, solUsd) {
  const px = Number.isFinite(solUsd) && solUsd > 1 ? solUsd : SHOP_SOL_USD_FALLBACK;
  const dollars = snapShopUsd(usd);
  return Math.max(0.01, Number((dollars / px).toFixed(6)));
}

export function shopMemo(skuId, walletOrMint) {
  const raw = String(walletOrMint || "").trim();
  const short = raw.length > 12 ? `${raw.slice(0, 6)}…${raw.slice(-4)}` : raw;
  return `ox shop ${skuId} ${short}`;
}

export function solscanTxUrl(signature) {
  return `https://solscan.io/tx/${encodeURIComponent(String(signature || "").trim())}`;
}

/**
 * Copy-paste note for the OrbitX team after a successful burn.
 * User fills project details below the 👇 line.
 */
export function formatShopTeamMessage({
  usd,
  sol,
  orbitxBurned,
  itemName,
  sku: skuId,
  signature,
  mint,
  name,
  ticker,
  wallet,
  details,
} = {}) {
  const amount =
    orbitxBurned != null && Number.isFinite(Number(orbitxBurned))
      ? `${Number(orbitxBurned).toFixed(2)} $ORBITX ($${usd}${sol ? ` · ${sol} SOL` : ""})`
      : `$${usd}${sol ? ` · ${sol} SOL` : ""}`;
  const lines = [
    `I have burned (${amount}) for this shop item (${itemName || skuId})`,
    `here is solscan (${signature ? solscanTxUrl(signature) : "link"})`,
    "here is my projects detailed below 👇",
    "",
    details ? String(details).trim() : "",
  ];
  if (mint || name || ticker || wallet) {
    lines.push("");
    if (mint) lines.push(`CA: ${mint}`);
    if (name) lines.push(`Name: ${name}`);
    if (ticker) lines.push(`Ticker: ${ticker}`);
    if (wallet) lines.push(`Wallet: ${wallet}`);
  }
  lines.push("");
  lines.push(`Send to ${ORBITX_SHOP_GC}`);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}
