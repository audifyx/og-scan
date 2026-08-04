import { useState } from "react";
import { imgProxy } from "./imgProxy";

type Props = {
  image?: string | null;
  symbol?: string | null;
  mint?: string | null;
  size?: number;
  className?: string;
  fallbackClassName?: string;
};

function initials(symbol?: string | null, mint?: string | null): string {
  const s = (symbol || "").trim();
  if (s) return s.slice(0, 2).toUpperCase();
  const m = (mint || "").trim();
  if (m.length >= 2) return m.slice(0, 2).toUpperCase();
  return "?";
}

/** Shared token avatar with proxy + broken-image fallback. */
export default function TokenAvatar({
  image,
  symbol,
  mint,
  size = 40,
  className = "",
  fallbackClassName = "",
}: Props) {
  const [broken, setBroken] = useState(false);
  const src = !broken ? imgProxy(image, Math.max(size * 2, 80)) : undefined;
  const style = { width: size, height: size };

  if (src) {
    return (
      <img
        src={src}
        alt=""
        style={style}
        className={`shrink-0 rounded-xl object-cover ${className}`}
        loading="lazy"
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <div
      style={style}
      className={`grid shrink-0 place-items-center rounded-xl bg-white/10 text-[10px] font-bold uppercase tracking-wide text-white/70 ${fallbackClassName}`}
      aria-hidden
    >
      {initials(symbol, mint)}
    </div>
  );
}
