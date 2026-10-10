import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchAirports } from "@/lib/api";
import { findAirportByIcao } from "@/lib/airports";
import { PATTERNS } from "@/lib/constants";
import { RadarView } from "@/components/RadarView";

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
    const data = await fetchAirports();
    const airport = findAirportByIcao(data.airports, cleanIcao);
    if (!airport) {
      return { title: `Airport ${cleanIcao} Not Found` };
    }
    return {
      title: `${airport.name} (${airport.icao}) | Big Jets Radar`,
      description: `Live radar air traffic tracking big, rare, and military aircraft near ${airport.fullName}.`,
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

  let airports;
  try {
    const data = await fetchAirports();
    airports = data.airports;
  } catch {
    notFound();
  }

  const airport = findAirportByIcao(airports, cleanIcao);
  if (!airport) {
    notFound();
  }

  return <RadarView airport={airport} allAirports={airports} />;
}
