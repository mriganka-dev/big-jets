import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export default function NotFound() {
  return (
    <div className="site-content-layout">
      <SiteHeader />
      <main id="main-content" className="main-content" tabIndex={-1}>
        <div className="container">
          <div style={{ maxWidth: "600px", margin: "4rem auto", textAlign: "center" }}>
            <h1 className="page-title" style={{ marginBottom: "1rem" }}>
              Airport Not Found
            </h1>
            <p className="page-lead" style={{ marginBottom: "1.5rem" }}>
              The requested airport code does not exist in our supported regional network or the ICAO format was invalid.
            </p>
            <Link href="/" className="btn btn-primary">
              Back to Live Radar
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
