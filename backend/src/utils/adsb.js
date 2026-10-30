import { config } from "../config.js";
import { LIMITS } from "../constants.js";
import { formatAircraft } from "./classifier.js";
import { logger } from "./logger.js";

// In-memory cache for ADS-B responses
// key: `${icao}_${roundedRadius}` -> { timestamp, data }
const cache = new Map();

// In-flight shared requests map to coalesce concurrent queries for the same key
const inFlightRequests = new Map();

// Timestamps of upstream requests within sliding 1-minute window
const upstreamTimestamps = [];

/**
 * Rounds radius to the nearest predefined step to prevent cache-busting.
 */
export function roundRadius(radiusNm) {
  const steps = LIMITS.RADIUS_STEPS || [10, 25, 40, 60, 80, 100];
  let closest = steps[0];
  let minDiff = Math.abs(radiusNm - steps[0]);

  for (let i = 1; i < steps.length; i++) {
    const diff = Math.abs(radiusNm - steps[i]);
    if (diff < minDiff) {
      minDiff = diff;
      closest = steps[i];
    }
  }

  return closest;
}

/**
 * Evicts expired or oldest entries if cache exceeds the max entries cap.
 */
function evictCacheIfNeeded(now) {
  const maxEntries = LIMITS.MAX_CACHE_ENTRIES || 300;
  if (cache.size < maxEntries) {
    return;
  }

  // 1. Evict expired entries older than MAX_STALE_MS
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp >= LIMITS.MAX_STALE_MS) {
      cache.delete(key);
    }
  }

  // 2. If still at or over cap, evict the oldest entries
  while (cache.size >= maxEntries) {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, entry] of cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      cache.delete(oldestKey);
    } else {
      break;
    }
  }
}

/**
 * Checks and records global upstream rate limit (sliding 60-second window).
 * Returns true if request is allowed, false if global limit is reached.
 */
function recordUpstreamRequest(now) {
  const windowMs = 60 * 1000;
  const maxPerMinute = LIMITS.MAX_UPSTREAM_REQUESTS_PER_MINUTE || 120;

  // Prune timestamps older than 60 seconds
  while (
    upstreamTimestamps.length > 0 &&
    now - upstreamTimestamps[0] >= windowMs
  ) {
    upstreamTimestamps.shift();
  }

  if (upstreamTimestamps.length >= maxPerMinute) {
    return false;
  }

  upstreamTimestamps.push(now);
  return true;
}

// In-memory cache for global feeds (mil, ladd, pia)
let globalFeedsCache = {
  timestamp: 0,
  data: [],
};
let globalInFlightPromise = null;

async function fetchGlobalFeeds() {
  const now = Date.now();
  const globalTtl = LIMITS.GLOBAL_FEEDS_CACHE_TTL_MS || 60000;
  if (
    globalFeedsCache.data.length > 0 &&
    now - globalFeedsCache.timestamp < globalTtl
  ) {
    return globalFeedsCache.data;
  }
  if (globalInFlightPromise) {
    return globalInFlightPromise;
  }

  globalInFlightPromise = (async () => {
    try {
      const primaryTimeout = LIMITS.PRIMARY_FETCH_TIMEOUT_MS || 4000;
      const endpoints = ["mil", "ladd", "pia"];
      const results = await Promise.allSettled(
        endpoints.map(async (ep) => {
          let url = `${config.adsbApi}/${ep}`;
          let res = null;
          try {
            res = await fetch(url, {
              headers: {
                Accept: "application/json",
                "User-Agent": "BigJetsAlert/1.0 (contact: info@bigjets.local)",
              },
              signal: AbortSignal.timeout(primaryTimeout),
            });
          } catch {
            // Primary network error or timeout, will fallback below
          }

          if (!res || !res.ok && (res.status === 429 || res.status >= 500)) {
            url = `https://opendata.adsb.fi/api/v2/${ep}`;
            try {
              res = await fetch(url, {
                headers: {
                  Accept: "application/json",
                  "User-Agent": "BigJetsAlert/1.0 (contact: info@bigjets.local)",
                },
                signal: AbortSignal.timeout(LIMITS.FETCH_TIMEOUT_MS),
              });
            } catch {
              return [];
            }
          }
          if (!res || !res.ok) return [];
          const json = await res.json();
          return Array.isArray(json?.ac)
            ? json.ac
            : Array.isArray(json?.aircraft)
            ? json.aircraft
            : [];
        })
      );

      const rawList = [];
      for (const res of results) {
        if (res.status === "fulfilled" && Array.isArray(res.value)) {
          rawList.push(...res.value);
        }
      }
      if (rawList.length > 0) {
        globalFeedsCache = { timestamp: Date.now(), data: rawList };
      }
      return rawList.length > 0 ? rawList : globalFeedsCache.data;
    } catch (err) {
      logger.error(`Failed to fetch global feeds: ${err.message}`);
      return globalFeedsCache.data;
    } finally {
      globalInFlightPromise = null;
    }
  })();

  return globalInFlightPromise;
}

/**
 * Internal worker to perform upstream fetch and update cache.
 */
async function performUpstreamFetch(airport, roundedRadius, cacheKey) {
  const now = Date.now();
  const cached = cache.get(cacheKey);

  // Check global upstream limit
  if (!recordUpstreamRequest(now)) {
    if (cached && now - cached.timestamp < LIMITS.MAX_STALE_MS) {
      logger.warn(
        `Upstream limit reached: serving stale cache for ${airport.icao}`
      );
      return cached.data;
    }
    const rateLimitError = new Error(
      "ADS-B upstream request limit exceeded. Please try again shortly."
    );
    rateLimitError.statusCode = 503;
    throw rateLimitError;
  }

  const lat = airport.lat;
  const lon = airport.lon;
  const primaryUrl = `${config.adsbApi}/lat/${lat}/lon/${lon}/dist/${roundedRadius}`;
  const fallbackUrl = `https://opendata.adsb.fi/api/v2/lat/${lat}/lon/${lon}/dist/${roundedRadius}`;

  try {
    let res = null;
    let json = null;

    // Fetch from primary (adsb.lol) and fallback (adsb.fi)
    const primaryTimeout = LIMITS.PRIMARY_FETCH_TIMEOUT_MS || 4000;
    try {
      res = await fetch(primaryUrl, {
        headers: {
          Accept: "application/json",
          "User-Agent": "BigJetsAlert/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(primaryTimeout),
      });
      if (res.ok) {
        json = await res.json();
      }
    } catch {
      // Ignore primary network error, fallback will be attempted
    }

    if (!json || (!res?.ok && (res?.status === 429 || res?.status >= 500))) {
      logger.warn(
        `Primary ADS-B provider returned HTTP ${res?.status || "error"}, attempting fallback to secondary mirror...`
      );
      res = await fetch(fallbackUrl, {
        headers: {
          Accept: "application/json",
          "User-Agent": "BigJetsAlert/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(LIMITS.FETCH_TIMEOUT_MS),
      });

      if (!res.ok) {
        throw new Error(`ADS-B provider returned HTTP ${res.status}`);
      }
      json = await res.json();
    }

    const rawAcList = Array.isArray(json?.ac)
      ? json.ac
      : Array.isArray(json?.aircraft)
      ? json.aircraft
      : null;

    if (!rawAcList) {
      throw new Error(
        `Invalid response structure from ADS-B API for ${airport.icao}`
      );
    }

    const aircraftList = [];
    for (const raw of rawAcList) {
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

    evictCacheIfNeeded(now);
    cache.set(cacheKey, { timestamp: now, data: aircraftList });
    return aircraftList;
  } catch (err) {
    logger.error(
      `Failed to fetch ADS-B data for ${airport.icao}: ${err.message}`
    );
    if (cached && now - cached.timestamp < LIMITS.MAX_STALE_MS) {
      return cached.data;
    }
    if (err.statusCode === 503) {
      throw err;
    }
    throw new Error("ADS-B data provider is temporarily unavailable");
  }
}

export { fetchGlobalFeeds };

/**
 * Fetches aircraft near airport with radius rounding, cache capping,
 * coalesced in-flight requests, and global upstream rate limiting.
 */
export async function fetchAircraftForAirport(
  airport,
  radiusNm = LIMITS.DEFAULT_RADIUS_NM
) {
  const roundedRadius = roundRadius(radiusNm);
  const cacheKey = `${airport.icao}_${roundedRadius}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);

  // Return fresh cached data if available within TTL
  if (cached && now - cached.timestamp < LIMITS.ADSB_CACHE_TTL_MS) {
    return cached.data;
  }

  // Share existing in-flight request if present for this key
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  // Start new in-flight request and register coalescing promise
  const requestPromise = performUpstreamFetch(
    airport,
    roundedRadius,
    cacheKey
  ).finally(() => {
    inFlightRequests.delete(cacheKey);
  });

  inFlightRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

// Exported helpers for test assertions
export function _resetAdsbState() {
  cache.clear();
  inFlightRequests.clear();
  upstreamTimestamps.length = 0;
}

export function _resetUpstreamTimestamps() {
  upstreamTimestamps.length = 0;
}

export function _getAdsbCacheSize() {
  return cache.size;
}

export function _getUpstreamTimestampsCount() {
  return upstreamTimestamps.length;
}
