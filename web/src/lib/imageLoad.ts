// Cross-origin-safe image loading for canvas/jsPDF embedding.
export type LoadedImage = { dataUrl: string; width: number; height: number; format: "PNG" | "JPEG" };

export async function fetchImageDataUrl(url?: string | null): Promise<LoadedImage | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
    const dims = await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = dataUrl;
    });
    const format: "PNG" | "JPEG" = blob.type.includes("jpeg") || blob.type.includes("jpg") ? "JPEG" : "PNG";
    return { dataUrl, width: dims.width, height: dims.height, format };
  } catch {
    return null;
  }
}

export function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
