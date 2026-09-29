/**
 * Custom boot logos (idea 26) — upload your own boot image.
 *
 * Stored as a data URL in localStorage (capped ~240KB; larger images
 * are downscaled on a canvas before saving). The OS home boot screen
 * shows it instead of the ORBITX wordmark.
 */

export const BOOT_LOGO_KEY = "orbitx-boot-logo";
const MAX_BYTES = 240 * 1024;

export function getBootLogo(): string | null {
  try {
    return localStorage.getItem(BOOT_LOGO_KEY);
  } catch {
    return null;
  }
}

export function clearBootLogo() {
  try {
    localStorage.removeItem(BOOT_LOGO_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("orbitx:bootlogo"));
}

/**
 * Load an image file, downscale to fit within 512px, and store as
 * a data URL. Resolves with the data URL.
 */
export function setBootLogoFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const maxDim = 512;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const g = canvas.getContext("2d");
        if (!g) throw new Error("Canvas unavailable");
        g.drawImage(img, 0, 0, canvas.width, canvas.height);
        let dataUrl = canvas.toDataURL("image/png");
        // If still too big, fall back to JPEG at decreasing quality.
        let q = 0.85;
        while (dataUrl.length > MAX_BYTES && q > 0.3) {
          dataUrl = canvas.toDataURL("image/jpeg", q);
          q -= 0.15;
        }
        localStorage.setItem(BOOT_LOGO_KEY, dataUrl);
        window.dispatchEvent(new CustomEvent("orbitx:bootlogo"));
        resolve(dataUrl);
      } catch (e) {
        reject(e instanceof Error ? e : new Error("Could not save boot logo"));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image"));
    };
    img.src = url;
  });
}
