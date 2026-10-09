"use client";

import Link from "next/link";

export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container">
      <div style={{ maxWidth: "600px", margin: "2rem auto", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.75rem", marginBottom: "1rem" }}>
          Something went wrong
        </h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
          An unexpected error occurred while loading this page. You can try refreshing the data or go back to the airport list.
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
            Back to Airports
          </Link>
        </div>
      </div>
    </div>
  );
}
