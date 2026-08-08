import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import "./ios-app-shell.css";

export type IosAccent = "teal" | "gold" | "blue" | "metal";

export type IosTabItem = {
  id: string;
  label: string;
  ico?: ReactNode;
  /** Route path — when set, tab renders as NavLink */
  to?: string;
  end?: boolean;
  match?: (pathname: string) => boolean;
};

type ShellProps = {
  accent?: IosAccent;
  /** Full-bleed desktop (DEX / launch boards) */
  wide?: boolean;
  /** Show desktop left rail; hides bottom tabbar ≥900px */
  rail?: ReactNode;
  className?: string;
  stageClassName?: string;
  children: ReactNode;
};

export function IosAppShell({
  accent = "teal",
  wide = false,
  rail,
  className,
  stageClassName,
  children,
}: ShellProps) {
  const withRail = Boolean(rail);
  return (
    <div
      className={cn(
        "ios-shell",
        `ios-shell--${accent}`,
        wide && "ios-shell--wide",
        withRail && "ios-shell--with-rail",
        className,
      )}
    >
      <div className={cn("ios-shell__stage", stageClassName)}>
        {withRail ? (
          <div className="ios-shell__frame">
            <aside className="ios-shell__rail" aria-label="App navigation">
              {rail}
            </aside>
            <div className="ios-shell__main">{children}</div>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

type NavProps = {
  title: string;
  canBack?: boolean;
  onBack?: () => void;
  /** Default back uses navigate(-1) when onBack omitted */
  backFallbackTo?: string;
  trail?: ReactNode;
  className?: string;
};

export function IosNav({
  title,
  canBack = false,
  onBack,
  backFallbackTo,
  trail,
  className,
}: NavProps) {
  const navigate = useNavigate();
  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    if (backFallbackTo) navigate(backFallbackTo);
  };

  return (
    <header className={cn("ios-nav", className)}>
      {canBack ? (
        <button type="button" className="ios-nav__back" onClick={handleBack}>
          <span className="ios-nav__back-ico" aria-hidden>
            ‹
          </span>
          Back
        </button>
      ) : (
        <span />
      )}
      <h1 className="ios-nav__title">{title}</h1>
      <div className="ios-nav__trail">{trail}</div>
    </header>
  );
}

type BodyProps = {
  children: ReactNode;
  largeTitle?: string;
  subhead?: ReactNode;
  flush?: boolean;
  noTabPad?: boolean;
  className?: string;
};

export function IosBody({
  children,
  largeTitle,
  subhead,
  flush,
  noTabPad,
  className,
}: BodyProps) {
  return (
    <div
      className={cn(
        "ios-body",
        flush && "ios-body--flush",
        noTabPad && "ios-body--no-tab",
        className,
      )}
    >
      {largeTitle ? <h2 className="ios-large-title">{largeTitle}</h2> : null}
      {subhead ? <p className="ios-subhead">{subhead}</p> : null}
      {children}
    </div>
  );
}

type TabBarProps = {
  tabs: IosTabItem[];
  activeId?: string;
  onChange?: (id: string) => void;
  pathname?: string;
  className?: string;
};

export function IosTabBar({ tabs, activeId, onChange, pathname = "", className }: TabBarProps) {
  return (
    <nav className={cn("ios-tabbar", className)} aria-label="App tabs">
      {tabs.map((t) => {
        const on =
          activeId != null
            ? activeId === t.id
            : t.match
              ? t.match(pathname)
              : t.to
                ? pathname === t.to || (!t.end && pathname.startsWith(`${t.to}/`))
                : false;

        if (t.to) {
          return (
            <NavLink
              key={t.id}
              to={t.to}
              end={t.end}
              className={({ isActive }) => cn("ios-tab", (t.match ? on : isActive || on) && "is-on")}
            >
              <span className="ios-tab__ico" aria-hidden>
                {t.ico ?? "·"}
              </span>
              <span>{t.label}</span>
            </NavLink>
          );
        }

        return (
          <button
            key={t.id}
            type="button"
            className={cn("ios-tab", on && "is-on")}
            onClick={() => onChange?.(t.id)}
          >
            <span className="ios-tab__ico" aria-hidden>
              {t.ico ?? "·"}
            </span>
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

type RailBrandProps = {
  href: string;
  title: string;
  subtitle?: string;
  markSrc?: string;
};

export function IosRailBrand({
  href,
  title,
  subtitle,
  markSrc = "/orbitx-banner.jpg",
}: RailBrandProps) {
  return (
    <Link to={href} className="ios-shell__rail-brand">
      <span className="ios-shell__rail-mark" aria-hidden>
        <img src={markSrc} alt="" />
      </span>
      <span>
        <span className="ios-shell__rail-title">{title}</span>
        {subtitle ? <span className="ios-shell__rail-sub">{subtitle}</span> : null}
      </span>
    </Link>
  );
}

type RailLinkProps = {
  to?: string;
  onClick?: () => void;
  label: string;
  ico?: ReactNode;
  active?: boolean;
};

export function IosRailLink({ to, onClick, label, ico, active }: RailLinkProps) {
  if (to) {
    return (
      <NavLink to={to} className={({ isActive }) => cn("ios-shell__rail-link", (active ?? isActive) && "is-on")}>
        <span className="ios-shell__rail-ico" aria-hidden>
          {ico ?? "·"}
        </span>
        {label}
      </NavLink>
    );
  }
  return (
    <button type="button" className={cn("ios-shell__rail-link", active && "is-on")} onClick={onClick}>
      <span className="ios-shell__rail-ico" aria-hidden>
        {ico ?? "·"}
      </span>
      {label}
    </button>
  );
}
