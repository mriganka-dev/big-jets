import type { AirportItem } from "./schemas";

/**
 * Filter airports by search term matching name, ICAO, IATA, or full name
 */
export function filterAirports(
  airports: AirportItem[],
  query: string,
): AirportItem[] {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) {
    return airports;
  }

  return airports.filter(
    (airport) =>
      airport.name.toLowerCase().includes(cleanQuery) ||
      airport.icao.toLowerCase().includes(cleanQuery) ||
      (airport.iata && airport.iata.toLowerCase().includes(cleanQuery)) ||
      (airport.city && airport.city.toLowerCase().includes(cleanQuery)),
  );
}

/**
 * Find airport by 4-letter ICAO code
 */
export function findAirportByIcao(
  airports: AirportItem[],
  icao: string,
): AirportItem | undefined {
  const target = icao.trim().toUpperCase();
  return airports.find((a) => a.icao === target);
}
