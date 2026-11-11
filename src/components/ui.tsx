import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function ActionLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: "primary" | "secondary" }) {
  return (
    <Link className={`action action-${variant} ${className}`} {...props} />
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}

export function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function BrandMark() {
  return (
    <Link href="/" className="brand" aria-label="CreatorConnect home">
      <span className="brand-symbol" aria-hidden="true">
        <span />
        <span />
      </span>
      Creator<span className="font-normal">Connect</span>
      <span className="brand-dot" aria-hidden="true" />
    </Link>
  );
}
