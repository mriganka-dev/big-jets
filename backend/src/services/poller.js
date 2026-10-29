import { config } from "../config.js";
import { LIMITS } from "../constants.js";
import { getAirport } from "../utils/airports.js";
import { logger } from "../utils/logger.js";
import { listWatchedAirportsByFrequency } from "../store/store.js";
import { fetchAircraftForAirport } from "../utils/adsb.js";
import { processAirportSnapshot } from "./detector.js";

const MAX_BACKOFF_MS = 5 * 60 * 1000; // 5 minutes

let pollTimer = null;
let isPolling = false;
let isRunning = false;
let consecutiveErrors = 0;

export async function pollOnce() {
  if (isPolling) {
    return 0;
  }

  isPolling = true;
  const startTime = Date.now();

  try {
    const watchedEntries = listWatchedAirportsByFrequency();

    if (watchedEntries.length === 0) {
      consecutiveErrors = 0;
      return 0;
    }

    const maxAirports = LIMITS.MAX_POLLER_AIRPORTS || 25;
    if (watchedEntries.length > maxAirports) {
      logger.warn(
        `Poller: ${watchedEntries.length} airports watched, exceeding cap of ${maxAirports}. Polling top ${maxAirports} most-subscribed airports.`
      );
    }

    const airportsToPoll = watchedEntries.slice(0, maxAirports);
    const spreadMs = LIMITS.POLLER_SPREAD_MS || 1000;

    for (let i = 0; i < airportsToPoll.length; i++) {
      const { airport: icao } = airportsToPoll[i];
      const airport = getAirport(icao);
      if (!airport) {
        logger.warn(`Poller: Unknown airport code watched: ${icao}`);
        continue;
      }

      try {
        const aircraftList = await fetchAircraftForAirport(
          airport,
          LIMITS.DEFAULT_RADIUS_NM
        );
        processAirportSnapshot(airport, aircraftList);
      } catch (err) {
        logger.error(`Poller error for airport ${icao}: ${err.message}`);
      }

      // Spread upstream requests out if more airports remain
      if (i < airportsToPoll.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, spreadMs));
      }
    }

    consecutiveErrors = 0;
  } catch (err) {
    consecutiveErrors += 1;
    logger.warn(
      `ADS-B polling encountered error (${err.message}). Consecutive failures: ${consecutiveErrors}`
    );
  } finally {
    isPolling = false;
  }

  return Date.now() - startTime;
}

function scheduleNextPoll(lastDurationMs = 0) {
  if (!isRunning) {
    return;
  }

  let delayMs;
  if (consecutiveErrors > 0) {
    delayMs = Math.min(
      config.pollMs * Math.pow(2, consecutiveErrors),
      MAX_BACKOFF_MS
    );
    logger.info(
      `Retrying ADS-B poll in ${Math.round(delayMs / 1000)}s due to backoff...`
    );
  } else {
    // Keep 20s cycle by deducting duration already spent in this cycle
    delayMs = Math.max(0, config.pollMs - lastDurationMs);
  }

  pollTimer = setTimeout(async () => {
    if (!isRunning) return;
    const duration = await pollOnce();
    scheduleNextPoll(duration);
  }, delayMs);
}

export function startPoller() {
  if (isRunning) {
    return;
  }

  isRunning = true;
  logger.info(`Starting ADS-B poller (interval: ${config.pollMs}ms)...`);

  // Execute initial poll immediately then schedule subsequent runs
  pollOnce().then((duration) => {
    scheduleNextPoll(duration);
  });
}

export function stopPoller() {
  isRunning = false;
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  logger.info("ADS-B poller stopped.");
}
