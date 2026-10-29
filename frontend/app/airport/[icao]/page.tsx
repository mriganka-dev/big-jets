import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchAirport, fetchAirports, ApiError } from "@/lib/api";
import { PATTERNS } from "@/lib/constants";
import { RadarView } from "@/components/RadarView";
import type { AirportItem } from "@/lib/schemas";

interface AirportPageProps {
  params: Promise<{ icao: string }>;
}

export async function generateMetadata({
  params,
}: AirportPageProps): Promise<Metadata> {
  const { icao } = await params;
  const cleanIcao = icao.trim().toUpperCase();

  if (!PATTERNS.ICAO.test(cleanIcao)) {
    return { title: "Airport Not Found" };
  }

  try {
    const airport = await fetchAirport(cleanIcao);
    return {
      title: `${airport.name} (${airport.icao}) | Big Jets Radar`,
      description: `Live radar air traffic tracking big, rare, and military aircraft near ${airport.name}${airport.city ? `, ${airport.city}` : ""}.`,
    };
  } catch {
    return { title: `${cleanIcao} Radar` };
  }
}

export default async function AirportPage({ params }: AirportPageProps) {
  const { icao } = await params;
  const cleanIcao = icao.trim().toUpperCase();

  // Validate ICAO code format: strictly 4 letters
  if (!PATTERNS.ICAO.test(cleanIcao)) {
    notFound();
  }

  let airport: AirportItem | null = null;
  let featuredAirports: AirportItem[] = [];
  let serviceError: string | null = null;

  try {
    airport = await fetchAirport(cleanIcao);
  } catch (err: unknown) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    serviceError =
      err instanceof Error
        ? err.message
        : "Failed to load airport metadata from service.";
  }

  // Fetch featured airports for empty search suggestions
  try {
    const data = await fetchAirports();
    featuredAirports = data.airports;
  } catch {
    // Non-fatal: search dropdown handles empty initial list gracefully
  }

  if (serviceError || !airport) {
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
            Airport Data Unavailable
          </h1>
          <p style={{ marginBottom: "1.5rem" }}>
            {serviceError ||
              "Unable to retrieve airport telemetry details from backend."}
          </p>
          <Link href="/" className="btn btn-primary btn-sm">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  return <RadarView airport={airport} allAirports={featuredAirports} />;
}
