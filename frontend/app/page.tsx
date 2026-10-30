import type { Metadata } from "next";
import Link from "next/link";
import { fetchAirports, fetchAirport, fetchAircraft, ApiError } from "@/lib/api";
import { DEFAULT_AIRPORT_ICAO } from "@/lib/constants";
import { RadarView } from "@/components/RadarView";
import type { AirportItem, AircraftResponse } from "@/lib/schemas";

// Dynamic rendering ensures fresh live aircraft positions on page load
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Big Jets | Live Flight Radar Map",
    description:
      "Full-screen live flight radar tracking big, rare, and military aircraft near airports using open ADS-B telemetry.",
  };
}

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
      fetchError =
        "Unable to connect to the backend airport telemetry service.";
    }
  }

  if (fetchError || airports.length === 0) {
    return (
      <div
        className="container"
        style={{ paddingTop: "4rem", textAlign: "center" }}
      >
        <div
          className="alert-box alert-error"
          role="alert"
          style={{ maxWidth: "560px", margin: "0 auto" }}
        >
          <h1
            className="page-title"
            style={{ marginBottom: "0.5rem" }}
          >
            Data Service Unavailable
          </h1>
          <p style={{ marginBottom: "1.5rem" }}>
            {fetchError ||
              "No supported airports were returned by the backend service."}
          </p>
          <Link href="/" className="btn btn-primary btn-sm">
            Retry Connection
          </Link>
        </div>
      </div>
    );
  }

  // Validate configured default airport via fetchAirport
  const configuredDefault = (
    process.env.NEXT_PUBLIC_DEFAULT_AIRPORT ||
    DEFAULT_AIRPORT_ICAO ||
    "VECC"
  )
    .trim()
    .toUpperCase();

  let targetAirport: AirportItem = airports[0];
  try {
    targetAirport = await fetchAirport(configuredDefault);
  } catch {
    targetAirport = airports[0];
  }

  // Pre-fetch initial aircraft on the server so aircraft appear immediately on initial load
  let initialAircraft: AircraftResponse | null = null;
  try {
    initialAircraft = await fetchAircraft(targetAirport.icao, { all: true });
  } catch {
    initialAircraft = null;
  }

  return (
    <RadarView
      airport={targetAirport}
      allAirports={airports}
      initialAircraft={initialAircraft}
    />
  );
}
