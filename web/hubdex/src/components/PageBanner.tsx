// Shared terminal-style page header used at the top of long-form pages.
export default function PageBanner({ title, subtitle }: { title?: string; subtitle?: string }) {
  return (
    <div className="term-panel bg-term-grid mb-6 px-5 py-6 sm:py-8">
      <div className="term text-[11px] mb-2" style={{ color: "#66707E" }}>
        <span style={{ color: "#00FFA3" }}>orbitx@dex</span>
        <span>:~$</span> cat {String(title || "page").toLowerCase().replace(/[^a-z0-9]+/g, "_")}.md
      </div>
      {title && <h1 className="text-2xl sm:text-4xl font-black tracking-tight">{title}</h1>}
      {subtitle && <p className="term text-[11px] sm:text-sm mt-2" style={{ color: "#A8B3C2" }}>{subtitle}</p>}
    </div>
  );
}
