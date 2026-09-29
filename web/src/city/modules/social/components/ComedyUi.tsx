/**
 * ComedyUi — The Gutter comedy club.
 *
 * NPC sets (COMEDY_SETS) play back line-by-line with timing; players sign
 * up for the weekly open mic (Tuesdays 20:00–23:00 local, hangoutEngine),
 * record their set locally with MediaRecorder (comedyEngine), and can
 * play it back. Stage audio via VoiceChannelPanel (openmic channel).
 *
 * Known gap (MODULE.md): recordings are session-scoped blob URLs — they
 * do not survive a page reload. Crowd score for player sets is shown
 * after recording but not yet persisted onto the slot.
 */

import { useEffect, useRef, useState } from "react";
import { useComedy, type NpcSetView } from "../hooks/useComedy";
import { useHangouts } from "../hooks/useHangouts";
import { VoiceChannelPanel } from "./VoiceChannelPanel";
import { NpcAvatar } from "./NpcAvatar";

export interface ComedyUiProps {
  playerName: string;
  playerHandle: string;
  embedded?: boolean;
}

export function ComedyUi({ playerName, playerHandle, embedded = false }: ComedyUiProps) {
  const c = useComedy(playerName);
  const { openMic, fmtCountdown } = useHangouts();

  const [draft, setDraft] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [setId, setSetId] = useState<string | null>(c.npcSets[0]?.id ?? null);
  const [lineIdx, setLineIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const [myScore, setMyScore] = useState<number | null>(null);

  const set = c.npcSets.find((s) => s.id === setId) ?? null;

  // line-by-line playback timing for the selected NPC set
  useEffect(() => {
    setLineIdx(0);
    setPlaying(false);
  }, [setId]);

  useEffect(() => {
    if (!playing || !set) return;
    if (lineIdx >= set.lines.length) {
      setPlaying(false);
      return;
    }
    const iv = setTimeout(() => setLineIdx((i) => i + 1), 3200);
    return () => clearTimeout(iv);
  }, [playing, lineIdx, set]);

  const signUp = () => {
    const ok = c.signUp(draft);
    setNote(ok ? "You're on the list for Tuesday's open mic." : "Sign-up failed — one slot per player per week.");
    setDraft("");
  };

  const startRec = async () => {
    if (!c.mySlot) return;
    setNote(null);
    const h = await c.recordForSlot(c.mySlot.id);
    if (!h) return; // error already in c.recError
    stopRef.current = h.stop;
    h.done
      .then(({ score }) => {
        setMyScore(score);
        stopRef.current = null;
        setNote(`Set recorded — the crowd gives you ${score}/100.`);
      })
      .catch(() => {
        stopRef.current = null;
      });
  };

  const stopRec = () => stopRef.current?.();

  return (
    <div className={`oxs-venue ${embedded ? "oxs-embedded" : ""}`}>
      <h2 className="oxs-title">🎤 The Gutter — Comedy Club</h2>

      <div className="oxs-card">
        <div className="oxs-row">
          <h3 className="oxs-subtitle">Open mic Tuesdays</h3>
          {openMic.live ? (
            <span className="oxs-live-dot" />
          ) : (
            <span className="oxs-chip">in {fmtCountdown(openMic.startsAt - Date.now())}</span>
          )}
        </div>
        <p className="oxs-muted oxs-small">20:00 → 23:00 local. Bombs welcome — it's called art.</p>

        {!c.mySlot ? (
          <div className="oxs-composer-row">
            <input
              className="oxs-input"
              value={draft}
              maxLength={60}
              placeholder="Your set title…"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && signUp()}
            />
            <button className="oxs-btn oxs-btn-primary" disabled={!draft.trim()} onClick={signUp}>
              Sign up
            </button>
          </div>
        ) : (
          <div className="oxs-slot">
            <p>
              <strong>{c.mySlot.title}</strong> <span className="oxs-chip">your slot ✓</span>
            </p>
            {c.recError && <p className="oxs-error">{c.recError}</p>}
            {!c.recording ? (
              <button className="oxs-btn oxs-btn-primary" onClick={startRec}>
                🎙 Record my set (≤5 min)
              </button>
            ) : (
              <div className="oxs-row">
                <span className="oxs-live-dot" />
                <span className="oxs-small">
                  Recording… {Math.floor(c.recElapsed / 60000)}:{String(Math.floor((c.recElapsed / 1000) % 60)).padStart(2, "0")}
                </span>
                <button className="oxs-btn oxs-btn-danger" onClick={stopRec}>
                  Stop
                </button>
              </div>
            )}
            {c.mySlot.audioUrl && (
              <div className="oxs-rec-play">
                <audio controls src={c.mySlot.audioUrl} />
                {myScore !== null && (
                  <span className="oxs-chip">crowd: {myScore}/100</span>
                )}
              </div>
            )}
          </div>
        )}
        {note && <p className="oxs-muted oxs-small">{note}</p>}

        {c.slots.length > 0 && (
          <div className="oxs-lineup">
            <h4 className="oxs-subtitle oxs-small">This week's lineup</h4>
            {c.slots.map((s) => (
              <div key={s.id} className="oxs-contact">
                <div>
                  <div className="oxs-contact-name">{s.playerName}</div>
                  <div className="oxs-muted oxs-small">{s.title}{s.audioUrl ? " · recorded ✓" : ""}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="oxs-card">
        <h3 className="oxs-subtitle">NPC sets — from the archives</h3>
        <div className="oxs-row oxs-wrap">
          {c.npcSets.map((s: NpcSetView) => (
            <button
              key={s.id}
              className={`oxs-btn ${s.id === setId ? "oxs-btn-primary" : "oxs-btn-ghost"}`}
              onClick={() => setSetId(s.id)}
            >
              {s.title}
            </button>
          ))}
        </div>
        {set && (
          <div className="oxs-set">
            <div className="oxs-row">
              <NpcAvatar initials={set.comicInitials} hue={set.comicHue} size={32} />
              <div>
                <div className="oxs-contact-name">{set.comicName}</div>
                <div className="oxs-muted oxs-small">{set.comicHandle} · crowd {set.crowdRating}/100</div>
              </div>
            </div>
            <div className="oxs-set-lines" onClick={() => playing && setLineIdx((i) => i + 1)}>
              {set.lines.slice(0, lineIdx + 1).map((l, i) => (
                <p key={i} className={i === lineIdx ? "oxs-set-line-now" : "oxs-set-line"}>"{l}"</p>
              ))}
              {lineIdx < set.lines.length - 1 && !playing && (
                <p className="oxs-muted oxs-small">Press play, or tap the set to advance the bit.</p>
              )}
            </div>
            <button
              className="oxs-btn oxs-btn-primary"
              onClick={() => {
                if (lineIdx >= set.lines.length - 1) setLineIdx(0);
                setPlaying(!playing);
              }}
            >
              {playing ? "⏸ Pause set" : "▶ Play set"}
            </button>
          </div>
        )}
      </div>

      <VoiceChannelPanel
        channelId="openmic-gutter"
        kind="openmic"
        label="Gutter stage audio"
        npcNames={["Lou Laughs", "Punchline Pam"]}
        identity={playerHandle}
        compact
      />
    </div>
  );
}
