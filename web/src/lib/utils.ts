import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns undefined for invalid / placeholder avatar URLs so <AvatarImage>
 * triggers its fallback instead of making a broken network request.
 */
export function safeAvatarUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const s = url.trim();
  if (!s || s === "default" || s === "null" || s === "undefined") return undefined;
  if (!s.startsWith("http") && !s.startsWith("/") && !s.startsWith("blob:") && !s.startsWith("data:")) return undefined;
  return s;
}
