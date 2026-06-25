// Shared brand banner used at the top of long-form pages (Whitepaper, Roadmap).
export default function PageBanner({ title, subtitle }: { title?: string; subtitle?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 mb-6 ring-brand">
      <img src="/OGDEX/ogdex-article-banner.jpg" alt="OG DEX" className="w-full object-cover" loading="eager" />
      {(title || subtitle) && (
        <div className="absolute inset-0 flex flex-col items-center justify-end text-center p-4 bg-gradient-to-t from-bg via-bg/40 to-transparent">
          {title && <h1 className="text-xl sm:text-3xl font-black tracking-tight drop-shadow-lg">{title}</h1>}
          {subtitle && <p className="text-[11px] sm:text-sm text-white/80 mt-1">{subtitle}</p>}
        </div>
      )}
    </div>
  );
}
