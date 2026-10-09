import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header" role="banner">
      <div className="container header-inner">
        <Link href="/" className="site-title">
          <span>Big Jets Alert</span>
        </Link>
        <nav className="site-nav" aria-label="Main Navigation">
          <Link href="/" className="nav-link">
            Airports
          </Link>
          <Link href="/alerts" className="nav-link">
            Alerts
          </Link>
          <Link href="/about" className="nav-link">
            About
          </Link>
        </nav>
      </div>
    </header>
  );
}
