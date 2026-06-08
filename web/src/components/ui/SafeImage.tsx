/**
 * SafeImage — drop-in replacement for <img> that shows a placeholder
 * when the image fails to load instead of a broken-image icon.
 *
 * Usage:
 *   <SafeImage src={token.logo} alt={token.name} className="h-8 w-8 rounded-full" />
 */

import { useState } from "react";
import { ImageOff } from "lucide-react";

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Fallback src to try before showing the placeholder (e.g. a generic token icon) */
  fallbackSrc?: string;
  /** Size of the placeholder icon in px (default: 16) */
  placeholderSize?: number;
}

export function SafeImage({
  src,
  alt = "",
  fallbackSrc,
  placeholderSize = 16,
  className = "",
  ...rest
}: SafeImageProps) {
  const [state, setState] = useState<"ok" | "fallback" | "broken">("ok");

  const handleError = () => {
    if (state === "ok" && fallbackSrc) {
      setState("fallback");
    } else {
      setState("broken");
    }
  };

  if (state === "broken") {
    return (
      <span
        className={`inline-flex items-center justify-center bg-white/5 text-muted-foreground/40 ${className}`}
        title={alt}
        role="img"
        aria-label={alt}
      >
        <ImageOff style={{ width: placeholderSize, height: placeholderSize }} />
      </span>
    );
  }

  return (
    <img
      {...rest}
      src={state === "fallback" ? fallbackSrc : src}
      alt={alt}
      className={className}
      onError={handleError}
    />
  );
}
