/**
 * Client-side upload validation (defense in depth).
 *
 * NOTE: this is NOT a security boundary — the Supabase anon key means a
 * determined caller can bypass it. The real enforcement for storage buckets
 * is the bucket's file_size_limit + allowed_mime_types config. As of the
 * 2026-11-23 security migration those ARE set on profile-media and
 * dm-media (50 MB + MIME allowlists, no SVG/HTML); other buckets still
 * need the same treatment. This helper keeps the honest UI path safe,
 * gives users immediate feedback, and — via validateUploadFileBytes —
 * checks the file's actual magic bytes instead of trusting the
 * browser-declared MIME type (audit B14).
 */

export const IMAGE_MIME_ALLOWLIST = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export const MEDIA_MIME_ALLOWLIST = [
  ...IMAGE_MIME_ALLOWLIST,
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
] as const;

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "weba",
  "application/pdf": "pdf",
};

/** Returns an error message when the file is rejected, or null when accepted. */
export function validateUploadFile(
  file: File | Blob,
  opts: { allow?: readonly string[]; maxMB?: number } = {},
): string | null {
  const allow = opts.allow ?? IMAGE_MIME_ALLOWLIST;
  const maxMB = opts.maxMB ?? 5;
  const type = (file as File).type || "";
  if (!allow.includes(type as never)) {
    return "Unsupported file type. Use " + allow.map((m) => m.split("/")[1].toUpperCase()).join(", ");
  }
  if (file.size > maxMB * 1024 * 1024) {
    return `File must be under ${maxMB} MB`;
  }
  if (file.size === 0) return "File is empty";
  return null;
}

/** Safe extension for a storage path, derived from the validated MIME type — never the original filename. */
export function safeExtForMime(mime: string): string {
  return EXT_BY_MIME[mime] || "bin";
}

/* ── Magic-byte sniffing (audit B14) ─────────────────────────────────
 * `file.type` is whatever the browser/OS claims — a renamed HTML or
 * SVG file sails through a type-only check. These signatures cover
 * every allowlisted format; all of them have strong magic bytes. */
type MagicFamily = "png" | "jpeg" | "gif" | "webp" | "ftyp" | "ebml" | "wav" | "ogg" | "mp3" | "pdf";

const FAMILY_BY_MIME: Record<string, MagicFamily> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "ftyp",
  "video/quicktime": "ftyp",
  "video/webm": "ebml",
  "audio/webm": "ebml",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "application/pdf": "pdf",
};

function sniffFamily(head: Uint8Array): MagicFamily | null {
  const at = (bytes: number[], offset = 0) => bytes.every((b, i) => head[offset + i] === b);
  const ascii = (s: string, offset = 0) => at([...s].map((c) => c.charCodeAt(0)), offset);
  if (at([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (at([0xff, 0xd8, 0xff])) return "jpeg";
  if (ascii("GIF8")) return "gif";
  if (ascii("RIFF") && ascii("WEBP", 8)) return "webp";
  if (ascii("RIFF") && ascii("WAVE", 8)) return "wav";
  if (ascii("ftyp", 4)) return "ftyp";
  if (at([0x1a, 0x45, 0xdf, 0xa3])) return "ebml";
  if (ascii("OggS")) return "ogg";
  if (ascii("ID3") || at([0xff, 0xfb]) || at([0xff, 0xf3]) || at([0xff, 0xf2])) return "mp3";
  if (ascii("%PDF")) return "pdf";
  return null;
}

/**
 * Full validation: declared-type allowlist + size (sync checks) AND a
 * magic-byte check that the file's contents actually match the format
 * it claims to be. Returns an error message or null when accepted.
 */
export async function validateUploadFileBytes(
  file: File | Blob,
  opts: { allow?: readonly string[]; maxMB?: number } = {},
): Promise<string | null> {
  const syncErr = validateUploadFile(file, opts);
  if (syncErr) return syncErr;
  const type = (file as File).type || "";
  const expected = FAMILY_BY_MIME[type];
  if (!expected) return null; // no signature known for this declared type — sync checks only
  let head: Uint8Array;
  try {
    head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  } catch {
    return "Could not read the file to verify its type";
  }
  const detected = sniffFamily(head);
  if (detected !== expected) {
    return "That file's contents don't match its type. Upload a real " +
      type.split("/")[1].toUpperCase() + " file.";
  }
  return null;
}

/**
 * Downscale + compress a raster image client-side (max 1600px on the long
 * edge, JPEG ~0.82) so uploads stop shipping full-resolution phone photos.
 * GIFs pass through untouched (canvas re-encode would kill animation).
 * Returns the file to upload plus the MIME to store it as.
 */
export async function compressImageFile(file: File): Promise<{ blob: Blob; type: string }> {
  if (file.type === "image/gif" || !file.type.startsWith("image/")) {
    return { blob: file, type: file.type };
  }
  try {
    const bitmap = await createImageBitmap(file);
    const MAX = 1600;
    const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.type === "image/jpeg") {
      bitmap.close();
      return { blob: file, type: file.type };
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) { bitmap.close(); return { blob: file, type: file.type }; }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (!blob) return { blob: file, type: file.type };
    return { blob, type: "image/jpeg" };
  } catch {
    return { blob: file, type: file.type };
  }
}

/**
 * Rewrite a Supabase storage public URL to its image-transformation URL
 * (width + quality), sized to the render box. Non-Supabase URLs pass through.
 * Callers should keep an onError fallback to the original URL in case the
 * project has transformations disabled.
 */
export function supabaseTransformUrl(url: string, width: number): string {
  const m = url.match(/^(https?:\/\/[^/]+\/storage\/v1\/)object\/public\/(.+)$/);
  if (!m) return url;
  return `${m[1]}render/image/public/${m[2]}?width=${width}&quality=80&resize=contain`;
}
