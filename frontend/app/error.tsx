"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="site-content-layout">
      <SiteHeader />
      <main id="main-content" className="main-content" tabIndex={-1}>
        <div className="container">
          <div style={{ maxWidth: "600px", margin: "4rem auto", textAlign: "center" }}>
            <h1 className="page-title" style={{ marginBottom: "1rem" }}>
              Something went wrong
            </h1>
            <p className="page-lead" style={{ marginBottom: "1.5rem" }}>
              An unexpected error occurred while loading this page. You can try refreshing the data or go back to the radar.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => reset()}
                className="btn btn-primary"
              >
                Try again
              </button>
              <Link href="/" className="btn">
                Back to Radar
              </Link>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
