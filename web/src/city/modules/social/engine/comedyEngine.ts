/**
 * Comedy club engine — NPC set playback timing + player open-mic recording.
 *
 * Recording uses MediaRecorder (local only, no upload). The returned blob
 * URL is session-scoped; the hook layer notes the persistence gap.
 */

export interface RecordedSet {
  blobUrl: string;
  durationMs: number;
  mimeType: string;
}

const PICK_MIME = () => {
  if (typeof MediaRecorder === "undefined") return "";
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  return "";
};

/**
 * Record an open-mic set. Resolves when the player stops the recording
 * (UI calls the returned `stop`). Rejects if the mic is unavailable.
 */
export function startSetRecording(maxSeconds = 300): Promise<{
  stop: () => void;
  done: Promise<RecordedSet>;
  onTick: (cb: (elapsedMs: number) => void) => void;
}> {
  return (async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = PICK_MIME();
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    const tickCbs = new Set<(ms: number) => void>();
    const startedAt = Date.now();
    let timer: ReturnType<typeof setInterval> | null = null;

    const done = new Promise<RecordedSet>((resolve, reject) => {
      rec.onstop = () => {
        if (timer) clearInterval(timer);
        stream.getTracks().forEach((t) => t.stop());
        if (chunks.length === 0) {
          reject(new Error("No audio captured — the set was silent."));
          return;
        }
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        resolve({
          blobUrl: URL.createObjectURL(blob),
          durationMs: Date.now() - startedAt,
          mimeType: rec.mimeType || "audio/webm",
        });
      };
      rec.onerror = () => reject(new Error("Recording failed."));
    });

    rec.start(250);
    timer = setInterval(() => {
      const el = Date.now() - startedAt;
      tickCbs.forEach((cb) => cb(el));
      if (el >= maxSeconds * 1000) rec.state !== "inactive" && rec.stop();
    }, 250);

    return {
      stop: () => {
        if (rec.state !== "inactive") rec.stop();
      },
      done,
      onTick: (cb: (ms: number) => void) => tickCbs.add(cb),
    };
  })();
}

/** Simulated crowd score for an NPC set — deterministic per set id. */
export function npcCrowdScore(setId: string): number {
  let h = 0;
  for (let i = 0; i < setId.length; i++) h = (h * 31 + setId.charCodeAt(i)) >>> 0;
  return 62 + (h % 34); // 62–95: the Gutter crowd is kind
}

/** Player crowd score: rewards longer sets (up to 3 min), mild randomness. */
export function playerCrowdScore(durationMs: number): number {
  const mins = Math.min(3, durationMs / 60000);
  return Math.round(Math.min(98, 55 + mins * 12 + Math.random() * 10));
}
