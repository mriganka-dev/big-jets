import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchAirports } from "@/lib/api";
import { findAirportByIcao } from "@/lib/airports";
import { AircraftBoard } from "@/components/AircraftBoard";
import { CATEGORIES, LIMITS, PATTERNS, type CategoryKey } from "@/lib/constants";
import type { AircraftCategory } from "@/lib/schemas";

interface AirportPageProps {
  params: Promise<{ icao: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({
  params,
}: AirportPageProps): Promise<Metadata> {
  const { icao } = await params;
  const cleanIcao = icao.toUpperCase();

  if (!PATTERNS.ICAO.test(cleanIcao)) {
    return { title: "Airport Not Found" };
  }

  try {
    const data = await fetchAirports();
    const airport = findAirportByIcao(data.airports, cleanIcao);
    if (!airport) {
      return { title: `Airport ${cleanIcao} Not Found` };
    }
    return {
      title: `${airport.name} (${airport.icao}) Live Air Traffic`,
      description: `Live aircraft tracking big, rare, and military flights near ${airport.fullName}.`,
    };
  } catch {
    return { title: `${cleanIcao} Live Air Traffic` };
  }
}

export default async function AirportPage({
  params,
  searchParams,
}: AirportPageProps) {
  const { icao } = await params;
  const rawSearchParams = await searchParams;

  const cleanIcao = icao.toUpperCase();
  if (!PATTERNS.ICAO.test(cleanIcao)) {
    notFound();
  }

  let airport;
  try {
    const data = await fetchAirports();
    airport = findAirportByIcao(data.airports, cleanIcao);
  } catch {
    // If backend airports endpoint fails, render notFound or handle gracefully
    notFound();
  }

  if (!airport) {
    notFound();
  }

  // Parse and validate initial search params
  const rawCat = typeof rawSearchParams.category === "string" ? rawSearchParams.category : "";
  const initialCategories: AircraftCategory[] = rawCat
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c): c is AircraftCategory => Object.values(CATEGORIES).includes(c as CategoryKey));

  const initialShowAll = rawSearchParams.all === "true";

  const rawRadius = Number(rawSearchParams.radius);
  const initialRadius =
    !isNaN(rawRadius) && rawRadius >= LIMITS.MIN_RADIUS_NM && rawRadius <= LIMITS.MAX_RADIUS_NM
      ? Math.floor(rawRadius)
      : LIMITS.DEFAULT_RADIUS_NM;

  return (
    <div className="container">
      <nav className="breadcrumb-nav" aria-label="Breadcrumb">
        <Link href="/" className="breadcrumb-link">
          &larr; Back to all airports
        </Link>
      </nav>

      <header className="airport-header">
        <div className="airport-header-main">
          <h1 className="airport-title">{airport.name}</h1>
          <div className="airport-header-badges">
            <span className="code-badge code-icao">{airport.icao}</span>
            {airport.iata && <span className="code-badge code-iata">{airport.iata}</span>}
          </div>
        </div>
        <p className="airport-subtitle">{airport.fullName}</p>
        <div className="airport-telemetry-meta">
          <span className="tabular-nums">
            Lat: {airport.lat.toFixed(4)}&deg;, Lon: {airport.lon.toFixed(4)}&deg;
          </span>
        </div>
      </header>

      <AircraftBoard
        airport={airport}
        initialCategories={initialCategories}
        initialShowAll={initialShowAll}
        initialRadius={initialRadius}
      />
    </div>
  );
}
