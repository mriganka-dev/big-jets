import Link from "next/link";
import { SiteNav } from "./SiteNav";

export function SiteHeader() {
  return (
    <header className="site-header" role="banner">
      <div className="container header-inner">
        <Link href="/" className="site-title">
          <span>Big Jets</span>
        </Link>
        <SiteNav />
      </div>
    </header>
  );
}
