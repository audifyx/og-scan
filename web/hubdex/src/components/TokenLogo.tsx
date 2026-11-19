import { useState } from "react";
import { imgProxy } from "../lib/img";

export default function TokenLogo({ src, sym, size = 28 }: { src?: string | null; sym?: string; size?: number }) {
  const [err, setErr] = useState(false);
  const proxied = !err ? imgProxy(src, Math.max(64, Math.round(size * 2))) : undefined;
  return proxied ? (
    <img src={proxied} alt={sym} width={size} height={size} loading="lazy" referrerPolicy="no-referrer"
      onError={() => setErr(true)}
      className="rounded-full object-cover bg-panel2 border border-line shrink-0" style={{ width: size, height: size }} />
  ) : (
    <span className="rounded-full bg-panel2 border border-line grid place-items-center text-[10px] text-muted shrink-0"
      style={{ width: size, height: size }}>{(sym || "?").slice(0, 3)}</span>
  );
}
