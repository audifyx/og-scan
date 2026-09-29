/**
 * MEDIA MODULE — live radio.
 *
 * 4 stations:
 *  - neon / lofi / bass: 100% generative Web Audio (synthesized live, no audio
 *    files, no samples) — royalty-free by construction.
 *  - chatter: reads REAL crypto chatter out loud (browser Web Speech API).
 *    Read path: the platform's X MCP (read-only tools x_user_tweets/x_mentions)
 *    when the integrator injects an X authCode (same dashboard paste flow the
 *    billing contract uses). Without authCode it falls back to LIVE market
 *    commentary generated from the game's real price feed — no mocks, and it
 *    says plainly when there is no live data.
 */
import type { MarketQuoteLite, RadioStation, RadioStationId } from "./types";

export const RADIO_STATIONS: RadioStation[] = [
  { id: "neon",    name: "NEON DRIVE",   tagline: "synthwave · 102 BPM", kind: "music" },
  { id: "lofi",    name: "MIDNIGHT LOFI",tagline: "dusty chords · 84 BPM", kind: "music" },
  { id: "bass",    name: "BASS CITY",    tagline: "trap 808s · 140 BPM", kind: "music" },
  { id: "chatter", name: "ORBITX CHATTER", tagline: "crypto talk, read aloud", kind: "chatter" },
];

export function getStation(id: RadioStationId): RadioStation {
  return RADIO_STATIONS.find((s) => s.id === id) ?? RADIO_STATIONS[0];
}

/* ============================ generative music ============================ */

type Step = number; // midi note, -1 = rest

interface StationPattern {
  bpm: number;
  bass: Step[];      // 16 steps
  chords: Step[][];  // chord roots per 16-step bar (as midi arrays)
  lead: Step[];      // 16 steps
  hats: boolean[];   // 16 steps
  kick: boolean[];   // 16 steps
}

const A = (n: number) => n; // midi passthrough helper

const PATTERNS: Record<"neon" | "lofi" | "bass", StationPattern> = {
  neon: {
    bpm: 102,
    bass: [A(33), -1, A(33), A(36), -1, A(33), -1, A(31), A(29), -1, A(29), A(31), -1, A(33), -1, -1],
    chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]],
    lead: [-1, A(69), -1, A(72), -1, -1, A(76), -1, -1, A(74), -1, A(72), -1, A(69), -1, -1],
    hats: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0].map(Boolean),
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0].map(Boolean),
  },
  lofi: {
    bpm: 84,
    bass: [A(36), -1, -1, -1, -1, -1, A(34), -1, A(32), -1, -1, -1, -1, -1, A(31), -1],
    chords: [[60, 63, 67, 70], [58, 62, 65, 69], [57, 60, 64, 67], [55, 59, 62, 65]],
    lead: [-1, -1, A(72), -1, -1, -1, -1, -1, -1, A(70), -1, -1, -1, -1, -1, -1],
    hats: [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1].map(Boolean),
    kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0].map(Boolean),
  },
  bass: {
    bpm: 140,
    bass: [A(28), -1, -1, A(28), -1, -1, A(28), A(31), -1, -1, A(26), -1, -1, A(28), -1, -1],
    chords: [[52, 55, 58], [50, 53, 57], [48, 52, 55], [50, 53, 57]],
    lead: [A(64), -1, A(67), -1, A(70), -1, -1, A(69), -1, -1, A(67), -1, A(64), -1, -1, -1],
    hats: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1].map(Boolean),
    kick: [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0].map(Boolean),
  },
};

function midiHz(m: number): number { return 440 * Math.pow(2, (m - 69) / 12); }

class GenerativeMusic {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: number | null = null;
  private step = 0;
  private nextT = 0;
  private pat: StationPattern = PATTERNS.neon;
  private bar = 0;
  private noiseBuf: AudioBuffer | null = null;

  private ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 1;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setStation(id: RadioStationId) {
    if (id === "neon" || id === "lofi" || id === "bass") this.pat = PATTERNS[id];
  }

  setVolume(v: number) {
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v * 0.6, this.ctx.currentTime, 0.05);
  }

  start() {
    this.ensure();
    if (!this.ctx || !this.master) return;
    void this.ctx.resume();
    this.step = 0; this.bar = 0;
    this.nextT = this.ctx.currentTime + 0.06;
    if (this.timer === null) this.timer = window.setInterval(() => this.schedule(), 40);
  }

  stop() {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
    void this.ctx?.suspend();
  }

  private schedule() {
    if (!this.ctx) return;
    const stepDur = 60 / this.pat.bpm / 4;
    while (this.nextT < this.ctx.currentTime + 0.18) {
      this.playStep(this.step, this.nextT, stepDur);
      this.nextT += stepDur;
      this.step = (this.step + 1) % 16;
      if (this.step === 0) this.bar++;
    }
  }

  private playStep(s: number, t: number, stepDur: number) {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const ctx = this.ctx, out = this.master;
    const bass = this.pat.bass[s];
    if (bass >= 0) this.tone(midiHz(bass), t, stepDur * 2.2, "sine", 0.5, out);
    if (s === 0) {
      const chord = this.pat.chords[this.bar % this.pat.chords.length];
      chord.forEach((m) => this.tone(midiHz(m), t, stepDur * 14, "sawtooth", 0.06, out, 900));
    }
    const lead = this.pat.lead[s];
    if (lead >= 0) this.tone(midiHz(lead), t, stepDur * 1.8, "triangle", 0.16, out);
    if (this.pat.kick[s]) this.kick(t);
    if (this.pat.hats[s]) this.hat(t, s % 4 === 2 ? 0.09 : 0.05);
  }

  private tone(freq: number, t: number, dur: number, type: OscillatorType, vol: number, out: AudioNode, lp = 0) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    let node: AudioNode = o;
    if (lp > 0) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lp; o.connect(f); node = f; }
    node.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.05);
  }

  private kick(t: number) {
    const ctx = this.ctx!, out = this.master!;
    const o = ctx.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + 0.3);
  }

  private hat(t: number, vol: number) {
    const ctx = this.ctx!, out = this.master!;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 7500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(f); f.connect(g); g.connect(out);
    src.start(t); src.stop(t + 0.08);
  }
}

/* ============================== chatter feed =============================== */

const X_MCP_URL = "https://www.orbitx.world/api/x/mcp";
const CHATTER_ACCOUNTS = ["orbitx_wrld"];

interface XToolEnvelope { ok?: boolean; error?: string; tool?: string; [k: string]: unknown }

async function mcpCall(tool: string, args: Record<string, unknown>): Promise<XToolEnvelope | null> {
  try {
    const res = await fetch(X_MCP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name: tool, arguments: args } }),
    });
    const raw = await res.text();
    const m = raw.match(/"text":"((?:[^"\\]|\\.)*)"/);
    if (!m) return null;
    return JSON.parse(`{"text":"${m[1]}"}`) as unknown as XToolEnvelope;
  } catch { return null; }
}

/** Extract tweet-ish lines from a tool envelope. Best-effort, shape-tolerant. */
function extractLines(env: XToolEnvelope | null): string[] {
  if (!env) return [];
  const lines: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") {
      const t = v.trim();
      if (t.length > 20 && t.length < 400 && !/^https?:\/\//.test(t)) lines.push(t);
      return;
    }
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (v && typeof v === "object") Object.values(v as Record<string, unknown>).forEach(walk);
  };
  walk(env);
  return [...new Set(lines)].slice(0, 12);
}

/** Live market commentary from the game's real price feed — always factual. */
export function marketChatterLines(quotes: MarketQuoteLite[]): string[] {
  if (quotes.length === 0) return [];
  const sorted = [...quotes].sort((a, b) => b.change24h - a.change24h);
  const top = sorted[0];
  const lines: string[] = [];
  const dir = (c: number) => (c >= 0 ? "up" : "down");
  lines.push(
    `Market check on OrbitX Chatter. ${top.symbol} is ${dir(top.change24h)} ${Math.abs(top.change24h).toFixed(1)} percent in the last 24 hours, trading at ${top.price < 1 ? top.price.toFixed(4) : top.price.toFixed(2)} dollars.`,
  );
  sorted.slice(1, 4).forEach((q) => {
    lines.push(`${q.symbol} ${dir(q.change24h)} ${Math.abs(q.change24h).toFixed(1)} percent, at ${q.price < 1 ? q.price.toFixed(4) : q.price.toFixed(2)} dollars.`);
  });
  lines.push("That was the market. Back to the streets of OrbitXCity.");
  return lines;
}

/* ============================= radio controller ============================= */

export class RadioController {
  private music = new GenerativeMusic();
  private station: RadioStationId = "neon";
  private playing = false;
  private volume = 0.6;
  private quotes: MarketQuoteLite[] = [];
  private xAuthCode: string | null = null;
  private chatterTimer: number | null = null;
  private speaking = false;
  private chatterQueue: string[] = [];
  private lastFetch = 0;

  constructor(opts?: { station?: RadioStationId; volume?: number; xAuthCode?: string | null }) {
    if (opts?.station) this.station = opts.station;
    if (typeof opts?.volume === "number") this.volume = opts.volume;
    if (opts?.xAuthCode !== undefined) this.xAuthCode = opts.xAuthCode;
  }

  setStation(id: RadioStationId) {
    this.station = id;
    this.music.setStation(id);
    if (this.playing) {
      this.stopAll();
      this.play();
    }
  }
  getStation(): RadioStationId { return this.station; }
  isPlaying(): boolean { return this.playing; }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    this.music.setVolume(this.volume);
  }

  setMarketQuotes(q: MarketQuoteLite[]) { this.quotes = q; }
  setXAuthCode(code: string | null) { this.xAuthCode = code; }

  play() {
    this.playing = true;
    if (getStation(this.station).kind === "music") {
      this.music.setVolume(this.volume);
      this.music.start();
    } else {
      this.startChatter();
    }
  }

  pause() {
    this.playing = false;
    this.stopAll();
  }

  toggle(): boolean {
    if (this.playing) this.pause(); else this.play();
    return this.playing;
  }

  nowPlaying(): string {
    const st = getStation(this.station);
    if (st.kind === "music") return `${st.name} — generative set`;
    if (this.speaking) return "ORBITX CHATTER — reading the timeline";
    return "ORBITX CHATTER — tuning in…";
  }

  private stopAll() {
    this.music.stop();
    if (this.chatterTimer !== null) { clearInterval(this.chatterTimer); this.chatterTimer = null; }
    try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
    this.speaking = false;
  }

  /* ------------------------------- chatter -------------------------------- */

  private startChatter() {
    this.refreshChatterQueue();
    this.chatterTimer = window.setInterval(() => this.refreshChatterQueue(), 120_000);
    this.pumpSpeech();
  }

  private async refreshChatterQueue() {
    const now = Date.now();
    if (now - this.lastFetch < 60_000 && this.chatterQueue.length > 0) return;
    this.lastFetch = now;

    // 1) Real X timeline via platform MCP — read-only tools, only with authCode.
    if (this.xAuthCode) {
      for (const user of CHATTER_ACCOUNTS) {
        const env = await mcpCall("x_user_tweets", { username: user, max_results: 8, authCode: this.xAuthCode });
        const lines = extractLines(env).map((t) => `From ${user}: ${t}`);
        if (lines.length > 0) { this.chatterQueue = lines; return; }
      }
    }
    // 2) Live market commentary from the game's real price feed.
    const market = marketChatterLines(this.quotes);
    if (market.length > 0) { this.chatterQueue = market; return; }
    // 3) Honest silence: no mocks, no invented tweets.
    this.chatterQueue = [
      "OrbitX Chatter here. No live feed right now — connect your X account on orbitx.world/x to hear the real timeline, or wait for market data to sync.",
    ];
  }

  private pumpSpeech() {
    if (!this.playing || getStation(this.station).kind !== "chatter") return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (synth.speaking || this.speaking) {
      window.setTimeout(() => this.pumpSpeech(), 1500);
      return;
    }
    const line = this.chatterQueue.shift();
    if (!line) {
      void this.refreshChatterQueue().then(() => window.setTimeout(() => this.pumpSpeech(), 2000));
      return;
    }
    try {
      const u = new SpeechSynthesisUtterance(line);
      u.rate = 1.05;
      u.volume = Math.max(0.2, this.volume);
      const voices = synth.getVoices();
      const en = voices.find((v) => v.lang.startsWith("en") && /Google|Natural|Samantha|Daniel/i.test(v.name))
        ?? voices.find((v) => v.lang.startsWith("en"));
      if (en) u.voice = en;
      this.speaking = true;
      u.onend = () => { this.speaking = false; window.setTimeout(() => this.pumpSpeech(), 1200); };
      u.onerror = () => { this.speaking = false; window.setTimeout(() => this.pumpSpeech(), 3000); };
      synth.speak(u);
    } catch {
      this.speaking = false;
      window.setTimeout(() => this.pumpSpeech(), 3000);
    }
  }
}
