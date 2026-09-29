/**
 * MEDIA MODULE — share to X.
 *
 * Draft-then-approve, per platform rules: the module NEVER posts silently.
 * It composes the text, opens the platform's standard X share composer
 * (x.com/intent/post) with the draft pre-filled, and downloads the photo so
 * the user can attach it in the composer. The user confirms the post on X.
 *
 * Image uploads need the platform's X OAuth write flow (authCode) — that path
 * is documented in MODULE.md §5; until then, intent + manual attach is the
 * honest, user-confirmed flow.
 */
import type { GalleryShot } from "./types";

export const X_INTENT_URL = "https://x.com/intent/post";

export function buildShareText(shot: GalleryShot): string {
  const lines = [
    `📸 ${shot.caption || "OrbitXCity"}`,
    "",
    "Taken in-game on OrbitXCity — open-world crypto city.",
    "orbitx.world",
    "",
    "#OrbitXCity #Web3Gaming",
  ];
  let text = lines.join("\n");
  if (text.length > 280) text = text.slice(0, 277) + "…";
  return text;
}

/** X web intent URL with pre-filled draft text (user confirms on X). */
export function xIntentUrl(text: string): string {
  return `${X_INTENT_URL}?text=${encodeURIComponent(text)}`;
}

/** Trigger a download of the shot so the user can attach it to the X draft. */
export function downloadPhoto(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename.endsWith(".jpg") ? filename : `${filename}.jpg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function shotFilename(shot: GalleryShot): string {
  const d = new Date(shot.createdAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `orbitxcity_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
