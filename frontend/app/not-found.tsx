import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container">
      <div style={{ maxWidth: "600px", margin: "3rem auto", textAlign: "center" }}>
        <h1 className="page-title" style={{ marginBottom: "1rem" }}>
          Page Not Found
        </h1>
        <p className="page-lead" style={{ marginBottom: "1.5rem" }}>
          The requested page or airport code could not be found. Please check the address or return to the airport list.
        </p>
        <Link href="/" className="btn btn-primary">
          Back to Airports
        </Link>
      </div>
    </div>
  );
}

