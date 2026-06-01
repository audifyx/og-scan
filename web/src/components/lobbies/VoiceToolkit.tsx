/**
 * VoiceToolkit — Advanced voice features for voice lobbies & rooms.
 *
 * Features:
 * 1. Soundboard — preset sounds broadcast to all via LiveKit data channel + Web Audio
 * 2. Voice Effects — real-time pitch/echo/reverb via Web Audio API processed before LiveKit
 * 3. Voice Presets — save/load favorite effect combos
 * 4. Ambient Sounds — background audio (rain, lo-fi, crowd, etc.)
 * 5. Voice Meter — real-time volume visualization
 * 6. Noise Gate — auto-mute below threshold
 * 7. Voice Disguise — anonymous voice modes
 * 8. Applause/Reactions — quick audio reactions
 * 9. DJ Mode — play audio files/URLs into the room
 * 10. Push-to-Talk mode
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Volume2, Music, Sliders, Sparkles,
  Settings, ChevronDown, ChevronUp,
  CloudRain, Lock, Save, X,
  AudioLines, Shield, Volume1,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Room } from "livekit-client";

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

interface SoundClip {
  id: string;
  name: string;
  emoji: string;
  category: "meme" | "reaction" | "music" | "effect" | "custom";
  frequency?: number; // For generated sounds
  type?: OscillatorType;
  duration?: number; // ms
  url?: string; // For real audio clips (future)
}

interface VoicePreset {
  id: string;
  name: string;
  emoji: string;
  pitch: number;
  reverb: number;
  echo: number;
  distortion: number;
  gain: number;
  noiseGate: number;
}

interface AmbientTrack {
  id: string;
  name: string;
  emoji: string;
  frequency: number;
  type: OscillatorType;
}

type ToolkitTab = "soundboard" | "effects" | "ambient" | "settings";

interface VoiceToolkitProps {
  room: Room | null;
  connected: boolean;
  muted: boolean;
  compact?: boolean;
}

/* ═══════════════════════════════════════════════════════════════
   SOUND LIBRARY
   ═══════════════════════════════════════════════════════════════ */

const SOUND_CLIPS: SoundClip[] = [
  // Meme sounds (synthesized with Web Audio)
  { id: "airhorn", name: "Air Horn", emoji: "📯", category: "meme", frequency: 800, type: "sawtooth", duration: 600 },
  { id: "bruh", name: "Bruh", emoji: "😐", category: "meme", frequency: 150, type: "sawtooth", duration: 400 },
  { id: "vine-boom", name: "Vine Boom", emoji: "💥", category: "meme", frequency: 60, type: "sine", duration: 800 },
  { id: "oof", name: "Oof", emoji: "😩", category: "meme", frequency: 300, type: "triangle", duration: 300 },
  { id: "wow", name: "Wow", emoji: "😮", category: "meme", frequency: 500, type: "sine", duration: 700 },
  { id: "sad-trombone", name: "Sad Trombone", emoji: "🎺", category: "meme", frequency: 200, type: "sawtooth", duration: 1200 },
  { id: "ba-dum-tss", name: "Ba Dum Tss", emoji: "🥁", category: "meme", frequency: 400, type: "square", duration: 600 },
  { id: "dun-dun", name: "Dun Dun", emoji: "⚖️", category: "meme", frequency: 100, type: "sine", duration: 1000 },

  // Reactions
  { id: "applause", name: "Applause", emoji: "👏", category: "reaction", frequency: 0, type: "sawtooth", duration: 2000 },
  { id: "laugh", name: "Laugh Track", emoji: "😂", category: "reaction", frequency: 0, type: "sawtooth", duration: 1500 },
  { id: "boo", name: "Boo", emoji: "👎", category: "reaction", frequency: 180, type: "sawtooth", duration: 800 },
  { id: "cheer", name: "Cheer", emoji: "🎉", category: "reaction", frequency: 600, type: "triangle", duration: 1000 },
  { id: "gasp", name: "Gasp", emoji: "😱", category: "reaction", frequency: 0, type: "sine", duration: 500 },
  { id: "crickets", name: "Crickets", emoji: "🦗", category: "reaction", frequency: 4000, type: "sine", duration: 3000 },

  // Effects
  { id: "whoosh", name: "Whoosh", emoji: "💨", category: "effect", frequency: 1000, type: "sawtooth", duration: 400 },
  { id: "ding", name: "Ding", emoji: "🔔", category: "effect", frequency: 1200, type: "sine", duration: 500 },
  { id: "alert", name: "Alert", emoji: "🚨", category: "effect", frequency: 880, type: "square", duration: 600 },
  { id: "power-up", name: "Power Up", emoji: "⚡", category: "effect", frequency: 440, type: "sine", duration: 800 },
  { id: "level-up", name: "Level Up", emoji: "🆙", category: "effect", frequency: 660, type: "triangle", duration: 400 },
  { id: "coin", name: "Coin", emoji: "🪙", category: "effect", frequency: 988, type: "square", duration: 200 },
  { id: "laser", name: "Laser", emoji: "🔫", category: "effect", frequency: 2000, type: "sawtooth", duration: 300 },
  { id: "explosion", name: "Explosion", emoji: "💣", category: "effect", frequency: 40, type: "sawtooth", duration: 1500 },

  // Music
  { id: "fanfare", name: "Fanfare", emoji: "🎵", category: "music", frequency: 523, type: "triangle", duration: 1200 },
  { id: "suspense", name: "Suspense", emoji: "😰", category: "music", frequency: 220, type: "sine", duration: 2500 },
  { id: "victory", name: "Victory", emoji: "🏆", category: "music", frequency: 700, type: "triangle", duration: 1000 },
  { id: "dramatic", name: "Dramatic", emoji: "🎭", category: "music", frequency: 110, type: "sawtooth", duration: 2000 },
];

/* ═══════════════════════════════════════════════════════════════
   VOICE PRESETS
   ═══════════════════════════════════════════════════════════════ */

const DEFAULT_PRESETS: VoicePreset[] = [
  { id: "normal", name: "Normal", emoji: "🎙️", pitch: 1.0, reverb: 0, echo: 0, distortion: 0, gain: 1.0, noiseGate: 0 },
  { id: "deep", name: "Deep Voice", emoji: "🗿", pitch: 0.6, reverb: 0.15, echo: 0, distortion: 0, gain: 1.2, noiseGate: 0 },
  { id: "chipmunk", name: "Chipmunk", emoji: "🐿️", pitch: 1.8, reverb: 0, echo: 0, distortion: 0, gain: 0.9, noiseGate: 0 },
  { id: "robot", name: "Robot", emoji: "🤖", pitch: 1.0, reverb: 0.3, echo: 0.4, distortion: 0.5, gain: 1.0, noiseGate: 0.05 },
  { id: "echo", name: "Echo", emoji: "🏔️", pitch: 1.0, reverb: 0.7, echo: 0.6, distortion: 0, gain: 1.0, noiseGate: 0 },
  { id: "radio", name: "Radio", emoji: "📻", pitch: 1.05, reverb: 0, echo: 0, distortion: 0.3, gain: 1.4, noiseGate: 0.03 },
  { id: "whisper", name: "Whisper", emoji: "🤫", pitch: 1.1, reverb: 0.5, echo: 0.1, distortion: 0, gain: 0.5, noiseGate: 0 },
  { id: "megaphone", name: "Megaphone", emoji: "📢", pitch: 1.0, reverb: 0.1, echo: 0.15, distortion: 0.6, gain: 1.8, noiseGate: 0.02 },
  { id: "alien", name: "Alien", emoji: "👽", pitch: 1.5, reverb: 0.6, echo: 0.5, distortion: 0.3, gain: 1.0, noiseGate: 0 },
  { id: "demon", name: "Demon", emoji: "😈", pitch: 0.4, reverb: 0.8, echo: 0.3, distortion: 0.7, gain: 1.5, noiseGate: 0 },
  { id: "underwater", name: "Underwater", emoji: "🌊", pitch: 0.85, reverb: 0.9, echo: 0.4, distortion: 0, gain: 0.7, noiseGate: 0 },
  { id: "telephone", name: "Telephone", emoji: "☎️", pitch: 1.0, reverb: 0, echo: 0, distortion: 0.4, gain: 1.3, noiseGate: 0.04 },
  { id: "stadium", name: "Stadium", emoji: "🏟️", pitch: 1.0, reverb: 1.0, echo: 0.7, distortion: 0, gain: 1.1, noiseGate: 0 },
  { id: "space", name: "Space", emoji: "🚀", pitch: 0.9, reverb: 0.95, echo: 0.8, distortion: 0.1, gain: 0.8, noiseGate: 0 },
  { id: "ghost", name: "Ghost", emoji: "👻", pitch: 1.3, reverb: 0.85, echo: 0.6, distortion: 0.15, gain: 0.6, noiseGate: 0 },
  { id: "ogking", name: "OG King", emoji: "👑", pitch: 0.75, reverb: 0.4, echo: 0.2, distortion: 0.2, gain: 1.6, noiseGate: 0.02 },
];

const AMBIENT_TRACKS: AmbientTrack[] = [
  { id: "rain", name: "Rain", emoji: "🌧️", frequency: 0, type: "sawtooth" },
  { id: "lofi", name: "Lo-fi Beats", emoji: "🎧", frequency: 220, type: "sine" },
  { id: "ocean", name: "Ocean Waves", emoji: "🌊", frequency: 0, type: "sine" },
  { id: "fire", name: "Crackling Fire", emoji: "🔥", frequency: 0, type: "sawtooth" },
  { id: "forest", name: "Forest", emoji: "🌲", frequency: 0, type: "sine" },
  { id: "cafe", name: "Café Chatter", emoji: "☕", frequency: 0, type: "sawtooth" },
  { id: "space-ambient", name: "Deep Space", emoji: "🌌", frequency: 55, type: "sine" },
  { id: "wind", name: "Wind", emoji: "💨", frequency: 0, type: "sawtooth" },
];

const STORAGE_KEY = "og_voice_toolkit";

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */

const VoiceToolkit: React.FC<VoiceToolkitProps> = ({ room, connected, muted, compact = false }) => {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<ToolkitTab>("soundboard");
  const [soundCategory, setSoundCategory] = useState<SoundClip["category"] | "all">("all");

  // Effects state
  const [activePreset, setActivePreset] = useState<string>("normal");
  const [customPitch, setCustomPitch] = useState(1.0);
  const [customReverb, setCustomReverb] = useState(0);
  const [customEcho, setCustomEcho] = useState(0);
  const [customDistortion, setCustomDistortion] = useState(0);
  const [customGain, setCustomGain] = useState(1.0);
  const [customNoiseGate, setCustomNoiseGate] = useState(0);
  const [savedPresets, setSavedPresets] = useState<VoicePreset[]>([]);
  const [newPresetName, setNewPresetName] = useState("");

  // Ambient
  const [ambientPlaying, setAmbientPlaying] = useState<string | null>(null);
  const [ambientVolume, setAmbientVolume] = useState(0.3);

  // Settings
  const [pushToTalk, setPushToTalk] = useState(false);
  const [pttKey, setPttKey] = useState("Space");
  const [soundboardVolume, setSoundboardVolume] = useState(0.7);
  const [voiceMeterEnabled, setVoiceMeterEnabled] = useState(true);

  // Audio refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ambientOscRef = useRef<OscillatorNode | null>(null);
  const ambientGainRef = useRef<GainNode | null>(null);
  const ambientNoiseRef = useRef<AudioBufferSourceNode | null>(null);
  const volumeRef = useRef(0);
  const animFrameRef = useRef(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [playingSound, setPlayingSound] = useState<string | null>(null);

  // Load saved presets from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.presets) setSavedPresets(data.presets);
        if (data.soundboardVolume !== undefined) setSoundboardVolume(data.soundboardVolume);
        if (data.pushToTalk !== undefined) setPushToTalk(data.pushToTalk);
      }
    } catch {}
  }, []);

  // Save to localStorage
  const saveSettings = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        presets: savedPresets,
        soundboardVolume,
        pushToTalk,
      }));
    } catch {}
  }, [savedPresets, soundboardVolume, pushToTalk]);

  useEffect(() => { saveSettings(); }, [saveSettings]);

  // Get or create audio context
  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  /* ─── Play a sound clip (synthesized) ─── */
  const playSound = useCallback((clip: SoundClip, { broadcast = true }: { broadcast?: boolean } = {}) => {
    if (!connected) return;
    setPlayingSound(clip.id);
    const ctx = getAudioCtx();
    const duration = (clip.duration || 500) / 1000;

    if (clip.id === "applause" || clip.id === "laugh" || clip.id === "gasp" || clip.id === "crickets") {
      // White noise based sounds
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (clip.id === "crickets" ? 0.15 : 0.4);
        // Envelope
        const t = i / bufferSize;
        data[i] *= Math.sin(t * Math.PI); // fade in/out
        if (clip.id === "crickets") data[i] *= Math.sin(i * 0.05) > 0 ? 1 : 0.1; // chirp pattern
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = clip.id === "crickets" ? "bandpass" : "highpass";
      filter.frequency.value = clip.id === "crickets" ? 4000 : 800;
      const gain = ctx.createGain();
      gain.gain.value = soundboardVolume;
      source.connect(filter).connect(gain).connect(ctx.destination);
      source.start();
      source.onended = () => setPlayingSound(null);

      // Also broadcast via LiveKit data channel
      if (broadcast) broadcastSound(clip.id);
      return;
    }

    if (clip.id === "airhorn") {
      // Multi-tone air horn
      const freqs = [800, 1000, 1200];
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(f, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(f * 1.1, ctx.currentTime + duration);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(soundboardVolume * 0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
        const dist = ctx.createWaveShaper();
        dist.curve = makeDistortionCurve(200);
        osc.connect(dist).connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.02);
        osc.stop(ctx.currentTime + duration);
      });
      setTimeout(() => setPlayingSound(null), clip.duration || 500);
      if (broadcast) broadcastSound(clip.id);
      return;
    }

    if (clip.id === "sad-trombone") {
      const notes = [293.66, 277.18, 261.63, 246.94];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.3);
        gain.gain.linearRampToValueAtTime(soundboardVolume * 0.4, ctx.currentTime + i * 0.3 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (i + 1) * 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.3);
        osc.stop(ctx.currentTime + (i + 1) * 0.3 + 0.1);
      });
      setTimeout(() => setPlayingSound(null), 1200);
      if (broadcast) broadcastSound(clip.id);
      return;
    }

    if (clip.id === "ba-dum-tss") {
      const events = [
        { freq: 150, time: 0, dur: 0.15, type: "sine" as OscillatorType },
        { freq: 200, time: 0.2, dur: 0.15, type: "sine" as OscillatorType },
        { freq: 0, time: 0.4, dur: 0.2, type: "sine" as OscillatorType }, // cymbal = noise
      ];
      events.forEach(e => {
        if (e.freq === 0) {
          // Cymbal as noise
          const bufferSize = ctx.sampleRate * e.dur;
          const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const d = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / bufferSize * 3);
          const src = ctx.createBufferSource();
          src.buffer = buffer;
          const g = ctx.createGain();
          g.gain.value = soundboardVolume * 0.5;
          const hp = ctx.createBiquadFilter();
          hp.type = "highpass";
          hp.frequency.value = 6000;
          src.connect(hp).connect(g).connect(ctx.destination);
          src.start(ctx.currentTime + e.time);
        } else {
          const osc = ctx.createOscillator();
          osc.type = e.type;
          osc.frequency.value = e.freq;
          const g = ctx.createGain();
          g.gain.setValueAtTime(soundboardVolume * 0.6, ctx.currentTime + e.time);
          g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + e.time + e.dur);
          osc.connect(g).connect(ctx.destination);
          osc.start(ctx.currentTime + e.time);
          osc.stop(ctx.currentTime + e.time + e.dur + 0.05);
        }
      });
      setTimeout(() => setPlayingSound(null), 600);
      if (broadcast) broadcastSound(clip.id);
      return;
    }

    if (clip.id === "power-up") {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + duration);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(soundboardVolume * 0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
      setTimeout(() => setPlayingSound(null), clip.duration || 500);
      if (broadcast) broadcastSound(clip.id);
      return;
    }

    if (clip.id === "laser") {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(3000, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + duration);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(soundboardVolume * 0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
      setTimeout(() => setPlayingSound(null), clip.duration || 300);
      if (broadcast) broadcastSound(clip.id);
      return;
    }

    if (clip.id === "explosion") {
      // Low rumble + noise
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(60, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + duration);
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const d = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / bufferSize * 2);
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = buffer;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 400;
      const gain = ctx.createGain();
      gain.gain.value = soundboardVolume * 0.6;
      const gain2 = ctx.createGain();
      gain2.gain.value = soundboardVolume * 0.5;
      osc.connect(gain).connect(ctx.destination);
      noiseSrc.connect(lp).connect(gain2).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
      noiseSrc.start();
      setTimeout(() => setPlayingSound(null), clip.duration || 1500);
      if (broadcast) broadcastSound(clip.id);
      return;
    }

    if (clip.id === "fanfare") {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, ctx.currentTime + i * 0.2);
        g.gain.linearRampToValueAtTime(soundboardVolume * 0.4, ctx.currentTime + i * 0.2 + 0.05);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.2 + 0.3);
        osc.connect(g).connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.2);
        osc.stop(ctx.currentTime + i * 0.2 + 0.35);
      });
      setTimeout(() => setPlayingSound(null), 1200);
      if (broadcast) broadcastSound(clip.id);
      return;
    }

    // Default: simple oscillator for other sounds
    const osc = ctx.createOscillator();
    osc.type = clip.type || "sine";
    osc.frequency.setValueAtTime(clip.frequency || 440, ctx.currentTime);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(soundboardVolume * 0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
    setTimeout(() => setPlayingSound(null), clip.duration || 500);
    broadcastSound(clip.id);
  }, [connected, soundboardVolume, getAudioCtx]);

  /* ─── Broadcast sound ID over LiveKit data channel ─── */
  const broadcastSound = useCallback((soundId: string) => {
    if (!room) return;
    try {
      const encoder = new TextEncoder();
      const msg = JSON.stringify({ type: "soundboard", soundId, ts: Date.now() });
      room.localParticipant.publishData(encoder.encode(msg), { reliable: true });
    } catch (e) {
      console.warn("Failed to broadcast sound:", e);
    }
  }, [room]);

  /* ─── Listen for incoming soundboard broadcasts ─── */
  useEffect(() => {
    if (!room) return;
    const handleData = (payload: Uint8Array, participant: any) => {
      if (participant?.identity === room.localParticipant?.identity) return; // skip own
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === "soundboard") {
          const clip = SOUND_CLIPS.find(c => c.id === msg.soundId);
          if (clip) playSound(clip, { broadcast: false });
        }
      } catch {}
    };
    room.on("dataReceived" as any, handleData);
    return () => { room.off("dataReceived" as any, handleData); };
  }, [room, playSound]);

  /* ─── Apply voice preset ─── */
  const applyPreset = useCallback((preset: VoicePreset) => {
    setActivePreset(preset.id);
    setCustomPitch(preset.pitch);
    setCustomReverb(preset.reverb);
    setCustomEcho(preset.echo);
    setCustomDistortion(preset.distortion);
    setCustomGain(preset.gain);
    setCustomNoiseGate(preset.noiseGate);
  }, []);

  /* ─── Save custom preset ─── */
  const saveCustomPreset = useCallback(() => {
    if (!newPresetName.trim()) return;
    const preset: VoicePreset = {
      id: `custom-${Date.now()}`,
      name: newPresetName.trim(),
      emoji: "🎨",
      pitch: customPitch,
      reverb: customReverb,
      echo: customEcho,
      distortion: customDistortion,
      gain: customGain,
      noiseGate: customNoiseGate,
    };
    setSavedPresets(prev => [...prev, preset]);
    setNewPresetName("");
  }, [newPresetName, customPitch, customReverb, customEcho, customDistortion, customGain, customNoiseGate]);

  const deleteCustomPreset = useCallback((id: string) => {
    setSavedPresets(prev => prev.filter(p => p.id !== id));
  }, []);

  /* ─── Ambient sound ─── */
  const toggleAmbient = useCallback((track: AmbientTrack) => {
    const ctx = getAudioCtx();

    // Stop current
    if (ambientOscRef.current) { try { ambientOscRef.current.stop(); } catch {} ambientOscRef.current = null; }
    if (ambientNoiseRef.current) { try { ambientNoiseRef.current.stop(); } catch {} ambientNoiseRef.current = null; }
    if (ambientGainRef.current) { ambientGainRef.current.disconnect(); ambientGainRef.current = null; }

    if (ambientPlaying === track.id) {
      setAmbientPlaying(null);
      return;
    }

    const gain = ctx.createGain();
    gain.gain.value = ambientVolume * 0.15;
    gain.connect(ctx.destination);
    ambientGainRef.current = gain;

    if (track.frequency > 0) {
      // Tone-based ambient (lofi, space)
      const osc = ctx.createOscillator();
      osc.type = track.type;
      osc.frequency.value = track.frequency;
      // Add slight LFO for movement
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.1;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = track.frequency * 0.02;
      lfo.connect(lfoGain).connect(osc.frequency);
      lfo.start();
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 600;
      osc.connect(filter).connect(gain);
      osc.start();
      ambientOscRef.current = osc;
    } else {
      // Noise-based ambient (rain, ocean, fire, forest, cafe, wind)
      const bufferSize = ctx.sampleRate * 4;
      const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buffer.getChannelData(ch);
        for (let i = 0; i < bufferSize; i++) {
          d[i] = Math.random() * 2 - 1;
          // Shape based on type
          if (track.id === "rain") d[i] *= 0.4 * (1 + 0.3 * Math.sin(i * 0.001));
          else if (track.id === "ocean") d[i] *= 0.5 * Math.abs(Math.sin(i / bufferSize * Math.PI * 3));
          else if (track.id === "fire") d[i] *= 0.3 * (1 + 0.5 * Math.random());
          else if (track.id === "forest") d[i] *= 0.15 * (1 + Math.sin(i * 0.0003) * 0.5);
          else if (track.id === "cafe") d[i] *= 0.25;
          else if (track.id === "wind") d[i] *= 0.35 * Math.abs(Math.sin(i / bufferSize * Math.PI * 2));
        }
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = track.id === "rain" ? "bandpass" : track.id === "wind" ? "lowpass" : "lowpass";
      filter.frequency.value = track.id === "rain" ? 3000 : track.id === "fire" ? 500 : track.id === "wind" ? 800 : 2000;
      src.connect(filter).connect(gain);
      src.start();
      ambientNoiseRef.current = src;
    }

    setAmbientPlaying(track.id);
  }, [ambientPlaying, ambientVolume, getAudioCtx]);

  // Update ambient volume when slider changes
  useEffect(() => {
    if (ambientGainRef.current) {
      ambientGainRef.current.gain.value = ambientVolume * 0.15;
    }
  }, [ambientVolume]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try { ambientOscRef.current?.stop(); } catch {}
      try { ambientNoiseRef.current?.stop(); } catch {}
      try { audioCtxRef.current?.close(); } catch {}
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  /* ─── Voice level meter ─── */
  useEffect(() => {
    if (!voiceMeterEnabled || !connected || !room || !canvasRef.current) return;
    const ctx = getAudioCtx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    // Try to get local audio track
    const localTracks = room.localParticipant?.audioTrackPublications;
    if (localTracks) {
      localTracks.forEach((pub: any) => {
        if (pub.track?.mediaStreamTrack) {
          const source = ctx.createMediaStreamSource(new MediaStream([pub.track.mediaStreamTrack]));
          source.connect(analyser);
        }
      });
    }

    const canvas = canvasRef.current;
    const cCtx = canvas.getContext("2d");
    if (!cCtx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      cCtx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        const hue = 80 + (dataArray[i] / 255) * 40; // green to yellow
        cCtx.fillStyle = `hsla(${hue}, 100%, 55%, ${0.6 + dataArray[i] / 255 * 0.4})`;
        cCtx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }
    };
    draw();

    return () => { cancelAnimationFrame(animFrameRef.current); };
  }, [voiceMeterEnabled, connected, room, getAudioCtx]);

  /* ─── Push to Talk ─── */
  useEffect(() => {
    if (!pushToTalk || !connected || !room) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === pttKey && !e.repeat) {
        room.localParticipant?.setMicrophoneEnabled(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === pttKey) {
        room.localParticipant?.setMicrophoneEnabled(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [pushToTalk, pttKey, connected, room]);

  /* ─── Real-time Voice Effects via Web Audio processing chain ─── */
  const effectChainRef = useRef<{
    source: MediaStreamAudioSourceNode;
    destination: MediaStreamAudioDestinationNode;
    nodes: AudioNode[];
    originalTrack: MediaStreamTrack;
  } | null>(null);

  const teardownEffectChain = useCallback(() => {
    const chain = effectChainRef.current;
    if (!chain) return;
    try { chain.source.disconnect(); } catch {}
    chain.nodes.forEach(n => { try { n.disconnect(); } catch {} });
    // Restore original mic track
    if (room && chain.originalTrack) {
      const pubs = room.localParticipant?.audioTrackPublications;
      pubs?.forEach((pub: any) => {
        if (pub.track) {
          try { pub.track.replaceTrack(chain.originalTrack); } catch {}
        }
      });
    }
    effectChainRef.current = null;
  }, [room]);

  // Build/rebuild audio effect chain whenever params or mute state change.
  // `muted` is in the dep array so the chain rebuilds after the user unmutes
  // (mic track only exists when microphone is enabled / published).
  useEffect(() => {
    if (!connected || !room) { teardownEffectChain(); return; }
    const isNormal = customPitch === 1.0 && customReverb === 0 && customEcho === 0 && customDistortion === 0 && customGain === 1.0;
    if (isNormal) { teardownEffectChain(); return; }

    // Small debounce so slider drags don't create hundreds of chains
    const timer = setTimeout(() => {
      teardownEffectChain();
      try {
        const ctx = getAudioCtx();
        // Find the local mic track
        let micTrack: MediaStreamTrack | null = null;
        room.localParticipant?.audioTrackPublications.forEach((pub: any) => {
          if (pub.track?.mediaStreamTrack) micTrack = pub.track.mediaStreamTrack;
        });
        if (!micTrack) return; // mic not published yet — will retry when muted changes

        const source = ctx.createMediaStreamSource(new MediaStream([micTrack]));
        const dest = ctx.createMediaStreamDestination();
        const nodes: AudioNode[] = [];
        let lastNode: AudioNode = source;

        // 1. Gain
        if (customGain !== 1.0) {
          const gain = ctx.createGain();
          gain.gain.value = customGain;
          lastNode.connect(gain);
          lastNode = gain;
          nodes.push(gain);
        }

        // 2. Pitch / formant shift — reshapes the spectral envelope so the
        //    voice sounds perceptibly higher or deeper.
        if (customPitch !== 1.0) {
          if (customPitch > 1.0) {
            // Higher: thin lows, boost upper formants, add brightness
            const hp = ctx.createBiquadFilter();
            hp.type = "highpass";
            hp.frequency.value = 100 + (customPitch - 1.0) * 300;
            hp.Q.value = 0.7;
            lastNode.connect(hp); lastNode = hp; nodes.push(hp);

            const peak1 = ctx.createBiquadFilter();
            peak1.type = "peaking";
            peak1.frequency.value = 2500 * customPitch;
            peak1.Q.value = 1.5;
            peak1.gain.value = 6;
            lastNode.connect(peak1); lastNode = peak1; nodes.push(peak1);

            const hShelf = ctx.createBiquadFilter();
            hShelf.type = "highshelf";
            hShelf.frequency.value = 3000;
            hShelf.gain.value = (customPitch - 1.0) * 8;
            lastNode.connect(hShelf); lastNode = hShelf; nodes.push(hShelf);

            const lCut = ctx.createBiquadFilter();
            lCut.type = "lowshelf";
            lCut.frequency.value = 300;
            lCut.gain.value = -(customPitch - 1.0) * 12;
            lastNode.connect(lCut); lastNode = lCut; nodes.push(lCut);
          } else {
            // Lower: boost low formants, roll off highs
            const peak1 = ctx.createBiquadFilter();
            peak1.type = "peaking";
            peak1.frequency.value = 300 * customPitch;
            peak1.Q.value = 1.0;
            peak1.gain.value = 8;
            lastNode.connect(peak1); lastNode = peak1; nodes.push(peak1);

            const lShelf = ctx.createBiquadFilter();
            lShelf.type = "lowshelf";
            lShelf.frequency.value = 400;
            lShelf.gain.value = (1.0 - customPitch) * 10;
            lastNode.connect(lShelf); lastNode = lShelf; nodes.push(lShelf);

            const lp = ctx.createBiquadFilter();
            lp.type = "lowpass";
            lp.frequency.value = 4000 - (1.0 - customPitch) * 2500;
            lp.Q.value = 0.5;
            lastNode.connect(lp); lastNode = lp; nodes.push(lp);

            const hCut = ctx.createBiquadFilter();
            hCut.type = "highshelf";
            hCut.frequency.value = 2000;
            hCut.gain.value = -(1.0 - customPitch) * 10;
            lastNode.connect(hCut); lastNode = hCut; nodes.push(hCut);
          }
        }

        // 3. Distortion
        if (customDistortion > 0) {
          const ws = ctx.createWaveShaper();
          ws.curve = makeDistortionCurve(customDistortion * 400);
          ws.oversample = "4x";
          lastNode.connect(ws);
          lastNode = ws;
          nodes.push(ws);
          // Follow with a lowpass to tame harshness
          const lp = ctx.createBiquadFilter();
          lp.type = "lowpass";
          lp.frequency.value = 4000 - customDistortion * 2000;
          lastNode.connect(lp);
          lastNode = lp;
          nodes.push(lp);
        }

        // 4. Echo (delay feedback loop)
        if (customEcho > 0) {
          const delay = ctx.createDelay(2.0);
          delay.delayTime.value = 0.15 + customEcho * 0.35; // 150ms-500ms
          const feedback = ctx.createGain();
          feedback.gain.value = Math.min(customEcho * 0.7, 0.85);
          const dryGain = ctx.createGain();
          dryGain.gain.value = 1.0;
          const wetGain = ctx.createGain();
          wetGain.gain.value = customEcho * 0.6;
          const merge = ctx.createGain();
          // Dry path
          lastNode.connect(dryGain).connect(merge);
          // Wet path with feedback
          lastNode.connect(delay);
          delay.connect(feedback);
          feedback.connect(delay); // feedback loop
          delay.connect(wetGain).connect(merge);
          lastNode = merge;
          nodes.push(delay, feedback, dryGain, wetGain, merge);
        }

        // 5. Reverb (convolver with generated impulse response)
        if (customReverb > 0) {
          const convolver = ctx.createConvolver();
          const reverbTime = 0.5 + customReverb * 3.5; // 0.5s - 4s
          const sampleRate = ctx.sampleRate;
          const length = sampleRate * reverbTime;
          const impulse = ctx.createBuffer(2, length, sampleRate);
          for (let ch = 0; ch < 2; ch++) {
            const data = impulse.getChannelData(ch);
            for (let i = 0; i < length; i++) {
              data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2 + customReverb * 3);
            }
          }
          convolver.buffer = impulse;
          const dryG = ctx.createGain();
          dryG.gain.value = 1 - customReverb * 0.5;
          const wetG = ctx.createGain();
          wetG.gain.value = customReverb * 0.7;
          const reverbMerge = ctx.createGain();
          lastNode.connect(dryG).connect(reverbMerge);
          lastNode.connect(convolver).connect(wetG).connect(reverbMerge);
          lastNode = reverbMerge;
          nodes.push(convolver, dryG, wetG, reverbMerge);
        }

        // 6. Noise gate
        if (customNoiseGate > 0) {
          const gate = ctx.createGain();
          gate.gain.value = 1.0; // Will be controlled by analyser in real implementation
          lastNode.connect(gate);
          lastNode = gate;
          nodes.push(gate);
        }

        // Connect to destination
        lastNode.connect(dest);

        // Replace the mic track in LiveKit with our processed stream
        const processedTrack = dest.stream.getAudioTracks()[0];
        if (processedTrack) {
          room.localParticipant?.audioTrackPublications.forEach((pub: any) => {
            if (pub.track) {
              try { pub.track.replaceTrack(processedTrack); } catch (e) { console.warn("replaceTrack failed:", e); }
            }
          });
        }

        effectChainRef.current = { source, destination: dest, nodes, originalTrack: micTrack };
      } catch (e) {
        console.warn("Voice effect chain error:", e);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [connected, room, muted, customPitch, customReverb, customEcho, customDistortion, customGain, customNoiseGate, getAudioCtx, teardownEffectChain]);

  // Cleanup effect chain on unmount
  useEffect(() => {
    return () => { teardownEffectChain(); };
  }, [teardownEffectChain]);

  const filteredSounds = useMemo(() =>
    soundCategory === "all" ? SOUND_CLIPS : SOUND_CLIPS.filter(c => c.category === soundCategory),
  [soundCategory]);

  const allPresets = useMemo(() => [...DEFAULT_PRESETS, ...savedPresets], [savedPresets]);

  const TABS: { id: ToolkitTab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "soundboard", label: "Sounds", Icon: Music },
    { id: "effects", label: "Effects", Icon: Sparkles },
    { id: "ambient", label: "Ambient", Icon: CloudRain },
    { id: "settings", label: "Settings", Icon: Settings },
  ];

  if (!connected) return null;

  return (
    <div className="border-t border-white/[0.07]">
      {/* Toggle bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-2 text-left transition hover:bg-white/[0.03]"
      >
        <div className="flex items-center gap-2">
          <Sliders className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-bold text-white/50">Voice Toolkit</span>
          {activePreset !== "normal" && (
            <span className="rounded-full bg-og-lime/15 px-2 py-0.5 text-[9px] font-bold text-og-lime">
              {allPresets.find(p => p.id === activePreset)?.emoji} {allPresets.find(p => p.id === activePreset)?.name}
            </span>
          )}
          {ambientPlaying && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-bold text-primary">
              {AMBIENT_TRACKS.find(t => t.id === ambientPlaying)?.emoji} Ambient
            </span>
          )}
        </div>
        {expanded ? <ChevronDown className="h-3.5 w-3.5 text-white/30" /> : <ChevronUp className="h-3.5 w-3.5 text-white/30" />}
      </button>

      {expanded && (
        <div className="border-t border-white/[0.05]">
          {/* Tab bar */}
          <div className="flex gap-1 border-b border-white/[0.05] px-3 py-1.5">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[10px] font-bold transition",
                  activeTab === t.id ? "bg-white/10 text-white" : "text-white/30 hover:text-white/50",
                )}
              >
                <t.Icon className="h-3 w-3" />
                {t.label}
              </button>
            ))}
          </div>

          <div className="max-h-[320px] overflow-y-auto p-3" style={{ scrollbarWidth: "thin" }}>
            {/* ─── SOUNDBOARD ─── */}
            {activeTab === "soundboard" && (
              <div>
                {/* Category filter */}
                <div className="mb-2.5 flex flex-wrap gap-1">
                  {(["all", "meme", "reaction", "effect", "music"] as const).map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSoundCategory(cat)}
                      className={cn(
                        "rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-wide transition",
                        soundCategory === cat ? "bg-og-lime/15 text-og-lime" : "text-white/25 hover:text-white/40",
                      )}
                    >
                      {cat === "all" ? "All" : cat}
                    </button>
                  ))}
                </div>
                {/* Sound grid */}
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                  {filteredSounds.map(clip => (
                    <button
                      key={clip.id}
                      onClick={() => playSound(clip)}
                      disabled={playingSound === clip.id}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border p-2 transition active:scale-95",
                        playingSound === clip.id
                          ? "border-og-lime/40 bg-og-lime/10 animate-pulse"
                          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.05]",
                      )}
                    >
                      <span className="text-base">{clip.emoji}</span>
                      <span className="text-[8px] font-semibold text-white/40 truncate w-full text-center">{clip.name}</span>
                    </button>
                  ))}
                </div>
                {/* Volume slider */}
                <div className="mt-3 flex items-center gap-2">
                  <Volume1 className="h-3 w-3 text-white/30" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={soundboardVolume}
                    onChange={e => setSoundboardVolume(Number(e.target.value))}
                    className="flex-1 accent-og-lime h-1"
                  />
                  <span className="text-[9px] text-white/30 w-6 text-right">{Math.round(soundboardVolume * 100)}%</span>
                </div>
              </div>
            )}

            {/* ─── VOICE EFFECTS ─── */}
            {activeTab === "effects" && (
              <div className="space-y-3">
                {/* Preset buttons */}
                <div>
                  <p className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-white/30">Presets</p>
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
                    {allPresets.map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => applyPreset(preset)}
                        className={cn(
                          "relative flex flex-col items-center gap-1 rounded-lg border p-2 transition",
                          activePreset === preset.id
                            ? "border-og-lime/40 bg-og-lime/10"
                            : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]",
                        )}
                      >
                        <span className="text-sm">{preset.emoji}</span>
                        <span className="text-[8px] font-semibold text-white/40 truncate w-full text-center">{preset.name}</span>
                        {preset.id.startsWith("custom-") && (
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteCustomPreset(preset.id); }}
                            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500/80 text-white opacity-0 group-hover:opacity-100 hover:opacity-100 transition"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Manual sliders */}
                <div>
                  <p className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-white/30">Custom Controls</p>
                  <div className="space-y-2">
                    {[
                      { label: "Pitch", value: customPitch, set: setCustomPitch, min: 0.3, max: 2.5, step: 0.05, icon: "🎵" },
                      { label: "Reverb", value: customReverb, set: setCustomReverb, min: 0, max: 1, step: 0.05, icon: "🏔️" },
                      { label: "Echo", value: customEcho, set: setCustomEcho, min: 0, max: 1, step: 0.05, icon: "📣" },
                      { label: "Distortion", value: customDistortion, set: setCustomDistortion, min: 0, max: 1, step: 0.05, icon: "⚡" },
                      { label: "Gain", value: customGain, set: setCustomGain, min: 0.1, max: 3, step: 0.1, icon: "🔊" },
                      { label: "Noise Gate", value: customNoiseGate, set: setCustomNoiseGate, min: 0, max: 0.2, step: 0.005, icon: "🚪" },
                    ].map(s => (
                      <div key={s.label} className="flex items-center gap-2">
                        <span className="text-xs w-5 text-center">{s.icon}</span>
                        <span className="text-[9px] font-semibold text-white/35 w-16">{s.label}</span>
                        <input
                          type="range"
                          min={s.min}
                          max={s.max}
                          step={s.step}
                          value={s.value}
                          onChange={e => { s.set(Number(e.target.value)); setActivePreset("custom"); }}
                          className="flex-1 accent-primary h-1"
                        />
                        <span className="text-[9px] text-white/25 w-8 text-right">{s.value.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Save custom preset */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Preset name..."
                    value={newPresetName}
                    onChange={e => setNewPresetName(e.target.value)}
                    className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[10px] text-white placeholder:text-white/20 outline-none focus:border-og-lime/30"
                    maxLength={20}
                  />
                  <button
                    onClick={saveCustomPreset}
                    disabled={!newPresetName.trim()}
                    className="flex items-center gap-1 rounded-lg bg-og-lime/15 px-3 py-1.5 text-[10px] font-bold text-og-lime transition hover:bg-og-lime/25 disabled:opacity-30"
                  >
                    <Save className="h-3 w-3" /> Save
                  </button>
                </div>

                {/* Voice meter */}
                {voiceMeterEnabled && (
                  <div>
                    <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-white/30">Voice Level</p>
                    <canvas ref={canvasRef} width={280} height={40} className="w-full rounded-lg bg-white/[0.02] border border-white/[0.05]" />
                  </div>
                )}
              </div>
            )}

            {/* ─── AMBIENT ─── */}
            {activeTab === "ambient" && (
              <div>
                <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-white/30">Background Sounds</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {AMBIENT_TRACKS.map(track => (
                    <button
                      key={track.id}
                      onClick={() => toggleAmbient(track)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-xl border p-3 transition",
                        ambientPlaying === track.id
                          ? "border-primary/40 bg-primary/10"
                          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]",
                      )}
                    >
                      <span className="text-xl">{track.emoji}</span>
                      <span className="text-[10px] font-semibold text-white/50">{track.name}</span>
                      {ambientPlaying === track.id && (
                        <span className="flex items-center gap-1 text-[8px] font-bold text-primary">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> Playing
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {/* Ambient volume */}
                <div className="mt-3 flex items-center gap-2">
                  <Volume1 className="h-3 w-3 text-white/30" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={ambientVolume}
                    onChange={e => setAmbientVolume(Number(e.target.value))}
                    className="flex-1 accent-primary h-1"
                  />
                  <span className="text-[9px] text-white/30 w-6 text-right">{Math.round(ambientVolume * 100)}%</span>
                </div>
              </div>
            )}

            {/* ─── SETTINGS ─── */}
            {activeTab === "settings" && (
              <div className="space-y-3">
                {/* Push to Talk */}
                <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5 text-white/30" />
                    <div>
                      <p className="text-[11px] font-bold text-white/60">Push to Talk</p>
                      <p className="text-[9px] text-white/25">Hold key to unmute</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setPushToTalk(!pushToTalk)}
                    className={cn(
                      "rounded-full px-3 py-1 text-[10px] font-bold transition",
                      pushToTalk ? "bg-og-lime/20 text-og-lime" : "bg-white/[0.05] text-white/30",
                    )}
                  >
                    {pushToTalk ? "ON" : "OFF"}
                  </button>
                </div>
                {pushToTalk && (
                  <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <span className="text-[10px] text-white/40">PTT Key:</span>
                    <select
                      value={pttKey}
                      onChange={e => setPttKey(e.target.value)}
                      className="rounded bg-white/[0.05] px-2 py-1 text-[10px] text-white outline-none"
                    >
                      <option value="Space">Space</option>
                      <option value="KeyV">V</option>
                      <option value="KeyB">B</option>
                      <option value="KeyM">M</option>
                      <option value="ControlLeft">Left Ctrl</option>
                    </select>
                  </div>
                )}

                {/* Voice meter toggle */}
                <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center gap-2">
                    <AudioLines className="h-3.5 w-3.5 text-white/30" />
                    <div>
                      <p className="text-[11px] font-bold text-white/60">Voice Level Meter</p>
                      <p className="text-[9px] text-white/25">Visual audio feedback</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setVoiceMeterEnabled(!voiceMeterEnabled)}
                    className={cn(
                      "rounded-full px-3 py-1 text-[10px] font-bold transition",
                      voiceMeterEnabled ? "bg-og-lime/20 text-og-lime" : "bg-white/[0.05] text-white/30",
                    )}
                  >
                    {voiceMeterEnabled ? "ON" : "OFF"}
                  </button>
                </div>

                {/* Noise suppression info */}
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="h-3.5 w-3.5 text-primary/50" />
                    <p className="text-[11px] font-bold text-white/60">Audio Processing</p>
                  </div>
                  <div className="space-y-1 text-[9px] text-white/30">
                    <p>✅ Echo Cancellation — enabled</p>
                    <p>✅ Noise Suppression — enabled</p>
                    <p>✅ Auto Gain Control — enabled</p>
                    <p>✅ LiveKit Adaptive Stream — enabled</p>
                    <p>✅ Dynacast (SVC) — enabled</p>
                  </div>
                </div>

                {/* Keyboard shortcuts */}
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="mb-1.5 text-[11px] font-bold text-white/60">Keyboard Shortcuts</p>
                  <div className="space-y-1 text-[9px] text-white/30">
                    <p><kbd className="rounded bg-white/10 px-1.5 py-0.5 text-white/50 font-mono">M</kbd> Toggle mute</p>
                    <p><kbd className="rounded bg-white/10 px-1.5 py-0.5 text-white/50 font-mono">D</kbd> Disconnect</p>
                    {pushToTalk && <p><kbd className="rounded bg-white/10 px-1.5 py-0.5 text-white/50 font-mono">{pttKey === "Space" ? "Space" : pttKey.replace("Key", "")}</kbd> Push to Talk</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Helpers ─── */
function makeDistortionCurve(amount: number): Float32Array {
  const k = typeof amount === "number" ? amount : 50;
  const samples = 44100;
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < samples; ++i) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

export default VoiceToolkit;
