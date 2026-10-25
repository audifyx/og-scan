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
