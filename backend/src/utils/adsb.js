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
      throw new Error(
        `Invalid response structure from ADS-B API for ${airport.icao}`
      );
    }

    const aircraftList = [];
    for (const raw of json.ac) {
      if (
        !raw ||
        typeof raw !== "object" ||
        !raw.hex ||
        typeof raw.lat !== "number" ||
        typeof raw.lon !== "number" ||
        (typeof raw.category === "string" && raw.category.startsWith("C")) ||
        raw.type === "adsb_icao_nt" ||
        (typeof raw.seen_pos === "number" &&
          raw.seen_pos > LIMITS.MAX_POSITION_AGE_SEC)
      ) {
        continue;
      }
      aircraftList.push(formatAircraft(raw, airport));
    }

    cache.set(cacheKey, { timestamp: now, data: aircraftList });
    return aircraftList;
  } catch (err) {
    logger.error(
      `Failed to fetch ADS-B data for ${airport.icao}: ${err.message}`
    );
    if (cached && now - cached.timestamp < LIMITS.MAX_STALE_MS) {
      return cached.data;
    }
    throw new Error("ADS-B data provider is temporarily unavailable");
  }
}
