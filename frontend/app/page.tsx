import Link from "next/link";
import { fetchAirports, ApiError } from "@/lib/api";
import { AirportPicker } from "@/components/AirportPicker";
import type { AirportItem } from "@/lib/schemas";

// Revalidate airport list every 5 minutes
export const revalidate = 300;

export default async function HomePage() {
  let airports: AirportItem[] = [];
  let fetchError: string | null = null;

  try {
    const data = await fetchAirports();
    airports = data.airports;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      fetchError = err.message;
    } else {
      fetchError = "Unable to load the supported airport list from the backend service.";
    }
  }

  return (
    <div className="container">
      <div className="home-intro">
        <h1 className="home-title">Big Jets Alert</h1>
        <p className="home-description">
          Live arrivals-style board tracking big, rare, and military aircraft near airports using open ADS-B community data. Select an airport to monitor real-time air traffic.
        </p>
      </div>

      {fetchError ? (
        <div className="alert-box alert-error" role="alert">
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            Data Service Unavailable
          </h2>
          <p style={{ marginBottom: "1rem" }}>{fetchError}</p>
          <Link href="/" className="btn btn-sm">
            Retry Connection
          </Link>
        </div>
      ) : (
        <AirportPicker airports={airports} />
      )}
    </div>
  );
}
