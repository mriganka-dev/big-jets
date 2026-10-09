export default function AirportLoading() {
  return (
    <div className="container">
      <div className="airport-header-skeleton" style={{ marginBottom: "1.5rem" }}>
        <div style={{ height: "2rem", width: "300px", background: "var(--bg-subtle)", borderRadius: "4px", marginBottom: "0.5rem" }} />
        <div style={{ height: "1rem", width: "450px", background: "var(--bg-subtle)", borderRadius: "4px" }} />
      </div>
      <div className="board-loading-box" role="status">
        <p>Loading airport radar feed...</p>
      </div>
    </div>
  );
}
