import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container">
      <div style={{ maxWidth: "600px", margin: "2rem auto", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.75rem", marginBottom: "1rem" }}>
          Page Not Found
        </h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
          The requested page or airport code could not be found. Please check the address or return to the airport list.
        </p>
        <Link href="/" className="btn btn-primary">
          Back to Airports
        </Link>
      </div>
    </div>
  );
}
