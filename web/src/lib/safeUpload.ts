/**
 * Client-side upload validation (defense in depth).
 *
 * NOTE: this is NOT a security boundary — the Supabase anon key means a
 * determined caller can bypass it. The real enforcement for storage buckets
 * is a Supabase storage policy / allowed-MIME-types config on the bucket
 * (dashboard-side). This helper keeps the honest UI path safe and gives
 * users immediate feedback.
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
