/**
 * One-click screenshot → X (idea 37).
 *
 * Flow: user picks a window/tab via the browser's capture picker
 * (getDisplayMedia — real pixels, user-consented), we snap one frame
 * to a canvas, then:
 *   1. copy the PNG to the clipboard (paste-ready for the X composer)
 *   2. download a local copy (orbitx-shot-<ts>.png)
 *   3. open x.com/intent/post with prefilled text in a new tab
 *
 * X's web intent does not accept media attachments, so the clipboard
 * copy is the honest bridge: the user pastes the shot into the composer.
 * Everything is user-gesture driven; failures surface as messages, never
 * silent.
 */

export interface ShareXResult {
  ok: boolean;
  message: string;
}

const INTENT_URL = "https://x.com/intent/post";

export function defaultShareText(): string {
  return `My OrbitX setup 🪐\n\norbitx.world`;
}

/**
 * Capture one frame via the system screen-share picker.
 * Returns a PNG blob, or null if the user cancelled / unsupported.
 */
export async function captureScreenshot(): Promise<Blob | null> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("Screen capture isn't supported in this browser");
  }
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 2 } as MediaTrackConstraints,
      audio: false,
    });
  } catch {
    return null; // user cancelled the picker
  }
  try {
    const track = stream.getVideoTracks()[0];
    if (!track) return null;
    const settings = track.getSettings();
    const w = settings.width || 1280;
    const h = settings.height || 720;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext("2d");
    if (!g) return null;
    // Give the compositor a beat to paint the first frame.
    await new Promise((r) => setTimeout(r, 350));
    const video = document.createElement("video");
    video.muted = true;
    video.srcObject = new MediaStream([track]);
    await video.play();
    g.drawImage(video, 0, 0, w, h);
    video.pause();
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png")
    );
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

/** Copy a PNG blob to the clipboard. Best-effort — returns whether it worked. */
export async function copyImageToClipboard(blob: Blob): Promise<boolean> {
  try {
    if (!navigator.clipboard?.write) return false;
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    return false;
  }
}

function downloadBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `orbitx-shot-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function openXComposer(text: string) {
  window.open(`${INTENT_URL}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
}

/**
 * The one-click flow: capture → clipboard + download → X composer.
 * Never throws; reports what happened so the UI can confirm.
 */
export async function screenshotToX(text: string = defaultShareText()): Promise<ShareXResult> {
  let blob: Blob | null;
  try {
    blob = await captureScreenshot();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Capture failed" };
  }
  if (!blob) return { ok: false, message: "Capture cancelled" };
  const copied = await copyImageToClipboard(blob);
  downloadBlob(blob);
  openXComposer(text);
  return {
    ok: true,
    message: copied
      ? "Screenshot copied — paste it into the X composer"
      : "Screenshot downloaded — attach it in the X composer",
  };
}
