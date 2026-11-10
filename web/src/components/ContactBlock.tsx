import {
  ORBITX_CONTACT_EMAIL,
  ORBITX_CONTACT_GITHUB_URL,
  ORBITX_CONTACT_LOCATION,
  ORBITX_CONTACT_TELEGRAM_HANDLE,
  ORBITX_CONTACT_TELEGRAM_URL,
  ORBITX_CONTACT_X_HANDLE,
  ORBITX_CONTACT_X_URL,
} from "@/lib/contact";

/**
 * The OrbitX contact block, shared by /about, /contact, and the footer.
 * Email, X, Telegram community, GitHub, city + state. No phone — OrbitX
 * offers no phone support.
 */
export function ContactBlock({ compact = false }: { compact?: boolean }) {
  const rows: { label: string; value: string; href?: string }[] = [
    { label: "Email", value: ORBITX_CONTACT_EMAIL, href: `mailto:${ORBITX_CONTACT_EMAIL}` },
    { label: "X", value: ORBITX_CONTACT_X_HANDLE, href: ORBITX_CONTACT_X_URL },
    { label: "Telegram", value: ORBITX_CONTACT_TELEGRAM_HANDLE, href: ORBITX_CONTACT_TELEGRAM_URL },
    { label: "GitHub", value: "audifyx/og-scan", href: ORBITX_CONTACT_GITHUB_URL },
    { label: "Based in", value: ORBITX_CONTACT_LOCATION },
  ];
  return (
    <div className={compact ? "text-sm leading-relaxed" : "space-y-2 text-[15px] leading-relaxed"}>
      {rows.map((row) => (
        <p key={row.label} className="m-0">
          <span className="font-bold text-white">{row.label}: </span>
          {row.href ? (
            <a href={row.href} target="_blank" rel="noreferrer" className="text-[#5aa2ff] hover:underline">
              {row.value}
            </a>
          ) : (
            <span className="text-white/70">{row.value}</span>
          )}
        </p>
      ))}
      <p className="m-0 text-white/50">No phone support — reach us on X, Telegram, or email.</p>
    </div>
  );
}
