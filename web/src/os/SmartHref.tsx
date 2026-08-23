import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { isHttpUrl } from "../../shared/orbitx-predictions.js";

export function SmartHref({
  href,
  className,
  style,
  children,
}: {
  href: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  if (isHttpUrl(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style}>
        {children}
      </a>
    );
  }
  return (
    <Link to={href} className={className} style={style}>
      {children}
    </Link>
  );
}
