import Link from "next/link";
import { ActionLink, BrandMark } from "./ui";

const links = [
  { href: "/#for-you", label: "For brands & creators" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#pilot", label: "The private pilot" },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <BrandMark />
        <nav className="desktop-nav" aria-label="Main navigation">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="desktop-sign-in">
          <ActionLink href="/sign-in" variant="secondary">
            Sign in <span aria-hidden="true">↗</span>
          </ActionLink>
        </div>
        <details className="mobile-menu">
          <summary>
            Menu <span aria-hidden="true">☰</span>
          </summary>
          <nav aria-label="Mobile navigation">
            {links.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
            <Link href="/sign-in">Sign in</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
