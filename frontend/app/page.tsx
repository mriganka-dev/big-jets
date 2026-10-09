export default function HomePage() {
  return (
    <div className="container">
      <div style={{ maxWidth: "680px", margin: "2rem auto 0 auto" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>
          Big Jets Alert
        </h1>
        <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
          Live arrivals-style board tracking big, rare, and military aircraft near airports using open ADS-B community data.
        </p>
      </div>
    </div>
  );
}
