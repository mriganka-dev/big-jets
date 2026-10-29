import { getAirlineByCallsign, getAirlineLogoUrl } from "../utils/airlines.js";
import { getAirport } from "../utils/airports.js";
import { logger } from "../utils/logger.js";

// In-memory cache for flight routes (2 hour TTL)
const routeCache = new Map();
const ROUTE_CACHE_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_ROUTE_CACHE_ENTRIES = 500;

function cleanCacheIfNeeded(now) {
  if (routeCache.size < MAX_ROUTE_CACHE_ENTRIES) return;
  for (const [key, entry] of routeCache.entries()) {
    if (now - entry.timestamp > ROUTE_CACHE_TTL_MS) {
      routeCache.delete(key);
    }
  }
}

/**
 * Fetches flight route, origin, destination and airline metadata for a callsign.
 */
export async function getFlightRoute(callsign) {
  if (!callsign || typeof callsign !== "string") return null;

  const cleanCallsign = callsign.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,8}$/.test(cleanCallsign)) return null;

  const now = Date.now();
  const cached = routeCache.get(cleanCallsign);
  if (cached && now - cached.timestamp < ROUTE_CACHE_TTL_MS) {
    return cached.data;
  }

  const airlineFallback = getAirlineByCallsign(cleanCallsign);

  let routeResult = null;

  // 1. Try primary upstream: api.adsbdb.com
  try {
    const res = await fetch(`https://api.adsbdb.com/v0/callsign/${cleanCallsign}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "BigJetsAlert/1.0",
      },
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      const json = await res.json();
      const fr = json?.response?.flightroute;
      if (fr && fr.origin && fr.destination) {
        const airlineIata = fr.airline?.iata || airlineFallback?.iata || null;
        routeResult = {
          callsign: cleanCallsign,
          callsignIcao: fr.callsign_icao || cleanCallsign,
          callsignIata: fr.callsign_iata || null,
          airline: {
            name: fr.airline?.name || airlineFallback?.name || "Commercial Airline",
            icao: fr.airline?.icao || airlineFallback?.icao || null,
            iata: airlineIata,
            callsign: fr.airline?.callsign || airlineFallback?.callsign || null,
            country: fr.airline?.country || airlineFallback?.country || null,
            logoUrl: getAirlineLogoUrl(airlineIata),
          },
          origin: {
            iata: fr.origin.iata_code || null,
            icao: fr.origin.icao_code || null,
            name: fr.origin.name || "Origin Airport",
            city: fr.origin.municipality || fr.origin.country_name || null,
            country: fr.origin.country_name || null,
            countryIso: fr.origin.country_iso_name || null,
            lat: typeof fr.origin.latitude === "number" ? fr.origin.latitude : null,
            lon: typeof fr.origin.longitude === "number" ? fr.origin.longitude : null,
            elevationFt: typeof fr.origin.elevation === "number" ? fr.origin.elevation : null,
          },
          destination: {
            iata: fr.destination.iata_code || null,
            icao: fr.destination.icao_code || null,
            name: fr.destination.name || "Destination Airport",
            city: fr.destination.municipality || fr.destination.country_name || null,
            country: fr.destination.country_name || null,
            countryIso: fr.destination.country_iso_name || null,
            lat: typeof fr.destination.latitude === "number" ? fr.destination.latitude : null,
            lon: typeof fr.destination.longitude === "number" ? fr.destination.longitude : null,
            elevationFt: typeof fr.destination.elevation === "number" ? fr.destination.elevation : null,
          },
        };
      }
    }
  } catch (err) {
    logger.debug(`adsbdb lookup failed for ${cleanCallsign}: ${err.message}`);
  }

  // 2. Try secondary fallback: hexdb.io
  if (!routeResult) {
    try {
      const res = await fetch(`https://hexdb.io/api/v1/route/icao/${cleanCallsign}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "BigJetsAlert/1.0",
        },
        signal: AbortSignal.timeout(2500),
      });

      if (res.ok) {
        const json = await res.json();
        if (typeof json?.route === "string" && json.route.includes("-")) {
          const [origIcao, destIcao] = json.route.split("-").map((s) => s.trim().toUpperCase());
          const origAirport = getAirport(origIcao);
          const destAirport = getAirport(destIcao);

          if (origAirport || destAirport) {
            const airlineIata = airlineFallback?.iata || null;
            routeResult = {
              callsign: cleanCallsign,
              callsignIcao: cleanCallsign,
              callsignIata: null,
              airline: {
                name: airlineFallback?.name || "Commercial Airline",
                icao: airlineFallback?.icao || null,
                iata: airlineIata,
                callsign: airlineFallback?.callsign || null,
                country: airlineFallback?.country || null,
                logoUrl: getAirlineLogoUrl(airlineIata),
              },
              origin: origAirport
                ? {
                    iata: origAirport.iata,
                    icao: origAirport.icao,
                    name: origAirport.name,
                    city: origAirport.city,
                    country: origAirport.country,
                    lat: origAirport.lat,
                    lon: origAirport.lon,
                    elevationFt: origAirport.elevationFt,
                  }
                : {
                    iata: null,
                    icao: origIcao,
                    name: origIcao,
                    city: null,
                    country: null,
                    lat: null,
                    lon: null,
                    elevationFt: null,
                  },
              destination: destAirport
                ? {
                    iata: destAirport.iata,
                    icao: destAirport.icao,
                    name: destAirport.name,
                    city: destAirport.city,
                    country: destAirport.country,
                    lat: destAirport.lat,
                    lon: destAirport.lon,
                    elevationFt: destAirport.elevationFt,
                  }
                : {
                    iata: null,
                    icao: destIcao,
                    name: destIcao,
                    city: null,
                    country: null,
                    lat: null,
                    lon: null,
                    elevationFt: null,
                  },
            };
          }
        }
      }
    } catch (err) {
      logger.debug(`hexdb lookup failed for ${cleanCallsign}: ${err.message}`);
    }
  }

  // 3. Fallback: Airline branding without route
  if (!routeResult && airlineFallback) {
    routeResult = {
      callsign: cleanCallsign,
      callsignIcao: cleanCallsign,
      callsignIata: null,
      airline: {
        name: airlineFallback.name,
        icao: airlineFallback.icao,
        iata: airlineFallback.iata,
        callsign: airlineFallback.callsign,
        country: airlineFallback.country,
        logoUrl: airlineFallback.logoUrl,
      },
      origin: null,
      destination: null,
    };
  }

  cleanCacheIfNeeded(now);
  if (routeResult) {
    routeCache.set(cleanCallsign, { timestamp: now, data: routeResult });
  }

  return routeResult;
}
