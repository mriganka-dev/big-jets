import { config } from "../config.js";
import { LIMITS } from "../constants.js";
import { formatAircraft } from "./classifier.js";
import { logger } from "./logger.js";

// In-memory cache for ADS-B responses
// key: `${icao}_${radiusNm}` -> { timestamp, data }
const cache = new Map();

export async function fetchAircraftForAirport(
  airport,
  radiusNm = LIMITS.DEFAULT_RADIUS_NM
) {
  const cacheKey = `${airport.icao}_${radiusNm}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);

  if (cached && now - cached.timestamp < LIMITS.ADSB_CACHE_TTL_MS) {
    return cached.data;
  }

  // Construct URL with validated airport coordinates and radius
  const lat = airport.lat;
  const lon = airport.lon;
  const url = `${config.adsbApi}/lat/${lat}/lon/${lon}/dist/${radiusNm}`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "BigJetsAlert/1.0",
      },
      signal: AbortSignal.timeout(LIMITS.FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      throw new Error(`ADS-B provider returned HTTP ${res.status}`);
    }

    const json = await res.json();

    if (!json || typeof json !== "object" || !Array.isArray(json.ac)) {
      logger.warn(
        `Invalid response structure from ADS-B API for ${airport.icao}`
      );
      return cached ? cached.data : [];
    }

    const aircraftList = [];
    for (const raw of json.ac) {
      if (!raw || typeof raw !== "object" || !raw.hex) {
        continue;
      }
      try {
        const formatted = formatAircraft(raw, airport);
        aircraftList.push(formatted);
      } catch (err) {
        // Skip malformed individual records safely
        logger.debug(`Skipping unparsable aircraft record: ${err.message}`);
      }
    }

    cache.set(cacheKey, { timestamp: now, data: aircraftList });
    return aircraftList;
  } catch (err) {
    logger.error(
      `Failed to fetch ADS-B data for ${airport.icao}: ${err.message}`
    );
    if (cached) {
      return cached.data;
    }
    throw new Error("ADS-B data provider is temporarily unavailable");
  }
}
