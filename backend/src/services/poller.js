import { config } from "../config.js";
import { AIRPORTS, LIMITS } from "../constants.js";
import { logger } from "../utils/logger.js";
import { listWatchedAirports } from "../store/store.js";
import { fetchAircraftForAirport } from "../utils/adsb.js";
import { processAirportSnapshot } from "./detector.js";

const MAX_BACKOFF_MS = 5 * 60 * 1000; // 5 minutes

let pollTimer = null;
let isPolling = false;
let isRunning = false;
let consecutiveErrors = 0;

export async function pollOnce() {
  if (isPolling) {
    return;
  }

  isPolling = true;

  try {
    const watchedAirports = listWatchedAirports();

    if (watchedAirports.length === 0) {
      consecutiveErrors = 0;
      return;
    }

    for (const icao of watchedAirports) {
      const airport = AIRPORTS[icao];
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
        throw err;
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
}

function scheduleNextPoll() {
  if (!isRunning) {
    return;
  }

  let delayMs = config.pollMs;
  if (consecutiveErrors > 0) {
    delayMs = Math.min(
      config.pollMs * Math.pow(2, consecutiveErrors),
      MAX_BACKOFF_MS
    );
    logger.info(
      `Retrying ADS-B poll in ${Math.round(delayMs / 1000)}s due to backoff...`
    );
  }

  pollTimer = setTimeout(async () => {
    if (!isRunning) return;
    await pollOnce();
    scheduleNextPoll();
  }, delayMs);
}

export function startPoller() {
  if (isRunning) {
    return;
  }

  isRunning = true;
  logger.info(`Starting ADS-B poller (interval: ${config.pollMs}ms)...`);

  // Execute initial poll immediately then schedule subsequent runs
  pollOnce().finally(() => {
    scheduleNextPoll();
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
