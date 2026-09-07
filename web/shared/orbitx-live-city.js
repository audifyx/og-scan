/**
 * Live agent city — the desk builds a real town as it trades.
 * Layout is deterministic from fills + tape so MCP, UI, and 3D share one map.
 */
const SOL_MINT = "So11111111111111111111111111111111111111112";
const LIVE_WALLET_PUBKEY = "BhdxqXy1C1PMaLBGUABdncqjR68PqB19xPJYcpGcWPJj";
const LIVE_TRADE_USD = 1.5;
const LIVE_MAX_OPEN = 1;
const FOUNDING_MS = Date.parse("2026-09-01T00:00:00Z");

function voiceOf(agent) {
  const a = agent || {};
  const handle = String(a.id || "desk").replace(/-live$/, "");
  const first = String(a.name || "The desk").replace(/\s+LIVE$/i, "");
  return { first, handle: `@${handle}`, name: a.name || "LIVE", color: a.color || "#a3e635" };
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function hash32(s) {
  let h = 2166136261;
  const str = String(s || "");
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function manhattanPath(ax, az, bx, bz) {
  const path = [{ x: ax, z: az }];
  if (Math.abs(ax - bx) > 0.4) path.push({ x: bx, z: az });
  path.push({ x: bx, z: bz });
  return path;
}

function plazaLoop(i) {
  const r = 6.2 + i * 1.1;
  return [
    { x: r, z: r * 0.4 },
    { x: -r * 0.2, z: r },
    { x: -r, z: -r * 0.3 },
    { x: r * 0.35, z: -r },
    { x: r, z: r * 0.4 },
  ];
}

const PALETTES = ["#7dd3c0", "#f9a8d4", "#fcd34d", "#93c5fd", "#c4b5fd", "#fdba74", "#86efac", "#fca5a5"];
const CIVIC = ["#3f4a52", "#4a5560", "#2f3a42", "#5a5048", "#3a444c", "#4b3f38", "#39464f", "#4e433c"];

export function liveCityClimate(now = Date.now()) {
  const d = new Date(now);
  const hour = d.getUTCHours() + d.getUTCMinutes() / 60;
  const day = Math.floor(now / 86_400_000);
  const month = d.getUTCMonth();
  let phase = "night";
  if (hour >= 5.2 && hour < 7.4) phase = "dawn";
  else if (hour >= 7.4 && hour < 16.8) phase = "day";
  else if (hour >= 16.8 && hour < 19.2) phase = "dusk";
  const rain = day % 6 === 2 || (day % 9 === 0 && hour >= 13 && hour < 18);
  const snow = (month === 11 || month === 0 || month === 1) && day % 4 === 1;
  const storm = rain && !snow && day % 12 === 2 && hour >= 14;
  const fog = phase === "dawn" || (rain && phase !== "day") || day % 7 === 3;
  const wind = storm ? 2.15 : rain || snow ? 1.35 : phase === "dusk" ? 0.7 : 0.35;
  const weather = snow ? "snow" : storm ? "storm" : rain ? "rain" : fog && !rain ? "fog" : "clear";
  return { phase, hour, day, month, rain: rain && !snow, fog, wind, snow, storm, weather };
}

function spiralCells(span) {
  const cells = [{ gx: 0, gz: 0 }];
  for (let r = 1; r <= span; r++) {
    for (let x = -r; x <= r; x++) cells.push({ gx: x, gz: -r });
    for (let z = -r + 1; z <= r; z++) cells.push({ gx: r, gz: z });
    for (let x = r - 1; x >= -r; x--) cells.push({ gx: x, gz: r });
    for (let z = r - 1; z >= -r + 1; z--) cells.push({ gx: -r, gz: z });
  }
  const seen = new Set();
  return cells.filter((c) => {
    const k = `${c.gx}:${c.gz}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function layoutLiveCity({
  wallet = LIVE_WALLET_PUBKEY,
  agents = [],
  open = [],
  feed = [],
  fills = [],
  ledger = null,
  now = Date.now(),
} = {}) {
  const climate = liveCityClimate(now);
  const books = agents?.length ? agents : [];
  const tape = [...(fills || []), ...(feed || [])];
  const buys = tape.filter((r) => String(r.side || r.kind) === "buy" && r.mint);
  const coins = [];
  const seen = new Set();
  const bump = (row, extra = {}) => {
    const mint = row?.mint;
    if (!mint || mint === SOL_MINT) return;
    const symbol = String(row.symbol || mint.slice(0, 4)).replace(/^\$/, "").toUpperCase();
    const prev = coins.find((c) => c.mint === mint);
    const isBuy = String(row.side || row.kind) === "buy";
    if (!prev) {
      if (seen.has(mint)) return;
      seen.add(mint);
      coins.push({
        mint,
        symbol,
        name: row.name || symbol,
        image: row.image || null,
        buys: isBuy ? 1 : 0,
        usd: num(row.usd ?? row.usd_in ?? row.usd_amount),
        pnl_usd: row.pnl_usd != null ? num(row.pnl_usd) : null,
        last_kind: extra.last_kind || row.kind || row.side || null,
        last_at: row.at || row.created_at || null,
        builder: row.agent_id || null,
        holding: Boolean((open || []).some((p) => p.mint === mint)),
      });
      return;
    }
    if (isBuy) prev.buys += 1;
    prev.usd += num(row.usd ?? row.usd_in ?? row.usd_amount);
    if (row.pnl_usd != null) prev.pnl_usd = (prev.pnl_usd || 0) + num(row.pnl_usd);
    prev.last_kind = extra.last_kind || row.kind || prev.last_kind;
    prev.last_at = row.at || row.created_at || prev.last_at;
    prev.builder = row.agent_id || prev.builder;
  };
  for (const p of open || []) bump(p, { last_kind: "hold" });
  for (const f of fills || []) bump(f);
  for (const row of feed || []) bump(row, { last_kind: row.kind });

  const ageDays = Math.max(1, Math.floor((now - FOUNDING_MS) / 86_400_000) + 1);
  const generation = Math.max(1, buys.length + coins.length + ageDays);
  const span = 3 + Math.min(5, Math.floor(Math.sqrt(generation)));
  const cells = spiralCells(span);
  const pitch = 8.2;
  const unlocked = Math.min(cells.length, 16 + generation * 2 + ageDays);

  const buildings = [];
  const trees = [];
  const lamps = [];
  const roads = [];
  const parks = [];
  const water = [];
  const hills = [];
  const props = [];
  const walks = [];

  for (let gx = -span; gx <= span; gx++) {
    roads.push({ id: `rd-x-${gx}`, x: gx * pitch, z: 0, w: 2.2, d: (span * 2 + 1) * pitch + 6, axis: "z" });
    walks.push({ id: `wk-x-${gx}`, x: gx * pitch, z: 0, w: 3.6, d: (span * 2 + 1) * pitch + 6 });
  }
  for (let gz = -span; gz <= span; gz++) {
    roads.push({ id: `rd-z-${gz}`, x: 0, z: gz * pitch, w: (span * 2 + 1) * pitch + 6, d: 2.2, axis: "x" });
    walks.push({ id: `wk-z-${gz}`, x: 0, z: gz * pitch, w: (span * 2 + 1) * pitch + 6, d: 3.6 });
  }

  const riverX = span * pitch * 0.48;
  water.push({
    id: "river",
    kind: "river",
    x: riverX,
    z: pitch * 0.35,
    w: 5.4,
    d: (span * 2 + 3) * pitch,
    rot: 0.18,
  });
  props.push({
    id: "bridge",
    kind: "bridge",
    x: riverX,
    z: 0,
    rot: 0.18,
    w: 9,
    d: 3.4,
  });
  props.push({ id: "fountain", kind: "fountain", x: 6.4, z: -6.1 });
  props.push({ id: "stall-a", kind: "stall", x: -6.6, z: 6.8, rot: 0.4 });
  props.push({ id: "stall-b", kind: "stall", x: -8.2, z: 4.6, rot: -0.2 });

  const rim = (span + 2.6) * pitch;
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + 0.13;
    const jitter = ((hash32(`hill-${i}`) % 100) / 100 - 0.5) * pitch;
    hills.push({
      id: `hill-${i}`,
      x: Math.cos(a) * (rim + jitter),
      z: Math.sin(a) * (rim + jitter * 0.6),
      r: 8 + (i % 5) * 2.2,
      h: 6 + (i % 8) * 1.7,
    });
  }

  cells.forEach((cell, i) => {
    const x = cell.gx * pitch;
    const z = cell.gz * pitch;
    const rng = mulberry(hash32(`${cell.gx}:${cell.gz}:${generation}`));
    if (i === 0) {
      buildings.push({
        id: "solscan",
        kind: "solscan",
        label: "SOLSCAN",
        gx: 0,
        gz: 0,
        x,
        z,
        y: 0,
        height: 26,
        stories: 16,
        color: "#e5e7eb",
        url: `https://solscan.io/account/${wallet}`,
        meta: "Proof tower — every live fill lands here.",
        built: true,
        construction: false,
      });
      lamps.push(
        { id: "lp-plaza-a", x: x + 4.2, z: z + 4.2 },
        { id: "lp-plaza-b", x: x - 4.2, z: z + 4.2 },
        { id: "lp-plaza-c", x: x + 4.2, z: z - 4.2 },
        { id: "lp-plaza-d", x: x - 4.2, z: z - 4.2 },
      );
      return;
    }
    if (i === 1) {
      buildings.push({
        id: "desk",
        kind: "desk",
        label: "LIVE DESK",
        gx: cell.gx,
        gz: cell.gz,
        x,
        z,
        y: 0,
        height: 9.2,
        stories: 5,
        color: "#d6d3d1",
        url: "https://www.orbitx.world/on-chain",
        meta: `$${LIVE_TRADE_USD.toFixed(2)} clips · max ${LIVE_MAX_OPEN} open`,
        built: true,
        construction: false,
      });
      return;
    }
    const coin = coins[i - 2];
    if (coin) {
      const stories = 3 + Math.min(14, coin.buys * 2 + (coin.holding ? 3 : 0) + Math.min(4, ageDays));
      const fresh = coin.last_at && now - Date.parse(coin.last_at) < 15 * 60_000;
      buildings.push({
        id: `coin-${coin.mint}`,
        kind: "coin",
        label: `$${coin.symbol}`,
        mint: coin.mint,
        symbol: coin.symbol,
        name: coin.name,
        image: coin.image,
        holding: coin.holding,
        usd: coin.usd,
        pnl_usd: coin.pnl_usd,
        last_kind: coin.last_kind,
        last_at: coin.last_at,
        builder: coin.builder,
        buys: coin.buys,
        gx: cell.gx,
        gz: cell.gz,
        x,
        z,
        y: 0,
        height: 2.4 + stories * 1.4,
        stories,
        color: PALETTES[hash32(coin.mint) % PALETTES.length],
        solscan: `https://solscan.io/token/${coin.mint}`,
        url: `https://solscan.io/token/${coin.mint}`,
        meta: `${coin.buys} clip${coin.buys === 1 ? "" : "s"} built this tower`,
        built: true,
        construction: Boolean(fresh && coin.last_kind === "buy"),
      });
      lamps.push({ id: `lp-${coin.mint}`, x: x + 3.4, z: z + 3.4 });
      trees.push({ id: `tc-${i}`, x: x - 3.4, z: z + 3.2, h: 2.1 + rng() * 1.2, form: "round" });
      return;
    }
    if (i >= unlocked) {
      parks.push({ id: `vacant-${cell.gx}-${cell.gz}`, x, z, w: 5.4, d: 5.4 });
      trees.push({
        id: `tv-${i}-a`,
        x: x + (rng() - 0.5) * 3.2,
        z: z + (rng() - 0.5) * 3.2,
        h: 1.7 + rng() * 1.6,
        form: rng() > 0.5 ? "pine" : "round",
      });
      return;
    }
    const ring = Math.abs(cell.gx) + Math.abs(cell.gz);
    const parkLot = rng() < 0.16 || ring % 5 === 0;
    if (parkLot) {
      parks.push({ id: `park-${cell.gx}-${cell.gz}`, x, z, w: 6.2, d: 6.2 });
      for (let t = 0; t < 5; t++) {
        trees.push({
          id: `t-${i}-${t}`,
          x: x + (rng() - 0.5) * 4.4,
          z: z + (rng() - 0.5) * 4.4,
          h: 2.2 + rng() * 2.6,
          form: t % 2 ? "pine" : "round",
        });
      }
      if (rng() > 0.55) props.push({ id: `bench-${i}`, kind: "bench", x: x + 1.4, z: z - 1.1, rot: rng() * 3 });
      return;
    }
    const roll = rng();
    const kind = roll < 0.14 ? "market" : roll < 0.42 ? "shop" : roll < 0.72 ? "block" : "loft";
    const stories =
      kind === "market" ? 2 + Math.floor(rng() * 2) : kind === "loft" ? 5 + Math.floor(rng() * 6) : 2 + Math.floor(rng() * 6);
    const rising = i > unlocked - 4;
    buildings.push({
      id: `civic-${cell.gx}-${cell.gz}`,
      kind,
      label: kind === "market" ? "MARKET" : kind === "loft" ? "LOFT" : rng() > 0.78 ? "BLOCK" : null,
      gx: cell.gx,
      gz: cell.gz,
      x,
      z,
      y: 0,
      height: (kind === "market" ? 2.4 : 2.1) + stories * (kind === "loft" ? 1.35 : 1.15),
      stories,
      color: CIVIC[Math.floor(rng() * CIVIC.length)],
      meta: rising ? "The books are raising this block today." : "The desk raised this block as the city grew.",
      built: true,
      construction: rising,
    });
    lamps.push({ id: `lp-c-${i}`, x: x + 3.2, z: z - 3.2 });
    if (rng() > 0.48) trees.push({ id: `ts-${i}`, x: x - 3.6, z: z + 3.1, h: 1.8 + rng() * 1.8, form: "round" });
    if (rising) props.push({ id: `crate-${i}`, kind: "crates", x: x + 2.6, z: z + 2.4 });
  });

  const characters = books.map((a, i) => {
    const hold = (open || []).find((p) => p.agent_id === a.id) || a.open || null;
    const last = (feed || []).find((r) => r.agent_id === a.id) || null;
    const target = hold ? `coin-${hold.mint}` : last?.mint ? `coin-${last.mint}` : last?.kind === "skip" ? "solscan" : "desk";
    const dest = buildings.find((b) => b.id === target) || buildings[0];
    const voice = voiceOf(a);
    const constructing = Boolean(dest.construction) || last?.kind === "buy";
    const action = constructing ? "build" : last?.kind || (hold ? "hold" : "patrol");
    const start = { x: (i - 1) * 2.4, z: 7.2 };
    const goal = { x: dest.x + (i - 1) * 1.6, z: dest.z + 2.8 };
    const path = action === "patrol" ? plazaLoop(i) : manhattanPath(start.x, start.z, goal.x, goal.z);
    return {
      id: a.id,
      name: a.name,
      first: voice.first,
      handle: voice.handle,
      color: a.color,
      holding: hold ? `$${String(hold.symbol || "").replace(/^\$/, "")}` : "cash",
      mint: hold?.mint || last?.mint || null,
      action,
      text: last?.text || last?.thesis || `${voice.first} ${action === "build" ? "is raising a tower." : "is on the floor."}`,
      made_usd: a.made_usd ?? null,
      wins: a.wins ?? 0,
      losses: a.losses ?? 0,
      target,
      path,
      loop: action === "patrol",
      x: goal.x,
      z: goal.z,
      y: 0,
    };
  });

  return {
    wallet,
    worldUrl: "https://www.orbitx.world/on-chain",
    fundUrl: `https://solscan.io/account/${wallet}`,
    made_usd: ledger?.made_usd ?? null,
    holding: ledger?.holding?.symbol || null,
    generation,
    age_days: ageDays,
    span,
    unlocked,
    built: buildings.filter((b) => b.kind === "coin").length,
    climate,
    buildings,
    characters,
    trees,
    lamps,
    roads,
    walks,
    parks,
    water,
    hills,
    props,
    posts: (feed || []).slice(0, 40),
  };
}
