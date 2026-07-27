import type { ReactNode } from "react";
import { SocialPageHeader } from "../components/SocialPageHeader";

/** Wraps legacy social pages inside the HQ shell with consistent chrome. */
export default function SocialFeatureEmbed({ title, subtitle, children, wide }: { title: string; subtitle?: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`oxs-embed${wide ? " oxs-main--wide" : ""}`}>
      <SocialPageHeader title={title} subtitle={subtitle} />
      <div className="oxs-embed-body">{children}</div>
    </div>
  );
}
