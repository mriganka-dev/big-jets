import Link from "next/link";

interface SiteNavProps {
  className?: string;
}

export function SiteNav({ className = "site-nav" }: SiteNavProps) {
  return (
    <nav className={className} aria-label="Main Navigation">
      <Link href="/" className="nav-link">
        Radar
      </Link>
      <Link href="/alerts" className="nav-link">
        Alerts
      </Link>
      <Link href="/about" className="nav-link">
        About
      </Link>
    </nav>
  );
}
