export default function TokenLogo({ src, sym, size = 28 }: { src?: string | null; sym?: string; size?: number }) {
  return src ? (
    <img src={src} alt={sym} width={size} height={size}
      onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")}
      className="rounded-full object-cover bg-panel2 border border-line shrink-0" style={{ width: size, height: size }} />
  ) : (
    <span className="rounded-full bg-panel2 border border-line grid place-items-center text-[10px] text-muted shrink-0"
      style={{ width: size, height: size }}>{(sym || "?").slice(0, 3)}</span>
  );
}
