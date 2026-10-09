import Link from "next/link";
import { SITE_DISCLAIMER, SITE_CREDITS } from "@/lib/constants";

export function SiteFooter() {
  return (
    <footer className="site-footer" role="contentinfo">
      <div className="container footer-inner">
        <p>{SITE_DISCLAIMER}</p>
        <p>{SITE_CREDITS}</p>
        <div className="footer-links">
          <Link href="/" className="footer-link">
            Airports
          </Link>
          <Link href="/alerts" className="footer-link">
            Alerts
          </Link>
          <Link href="/about" className="footer-link">
            About &amp; Disclaimer
          </Link>
        </div>
      </div>
    </footer>
  );
}
