import { matchAndNotify } from "./matcher.js";

const LAND_CONSECUTIVE_POLLS = 2;
const LAND_COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3 hours
const TAKEOFF_COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3 hours
const NEARBY_ABSENCE_RESET_MS = 10 * 60 * 1000; // 10 minutes
const STATE_PRUNE_MS = 15 * 60 * 1000; // 15 minutes
const GROUND_AIRPORT_DIST_KM = 5;
const GROUND_MIN_SPEED_KT = 5;

// In-memory state tracking by aircraft hex
const aircraftState = new Map();

export function processAirportSnapshot(airport, aircraftList) {
  const now = Date.now();

  for (const aircraft of aircraftList) {
    if (!aircraft || !aircraft.hex) continue;

    const hex = aircraft.hex.toLowerCase();
    let state = aircraftState.get(hex);

    if (!state) {
      state = {
        hex,
        lastSeen: now,
        lastAirport: airport.icao,
        consecutiveApproachCount: 0,
        lastLandEventAt: 0,
        lastTakeoffEventAt: 0,
        lastNearbyEventAt: 0,
        wasStationaryOnGround: false,
      };
      aircraftState.set(hex, state);
    }

    const timeSinceLastSeen = now - state.lastSeen;
    state.lastSeen = now;
    state.lastAirport = airport.icao;

    // 1. Landing Detection: 2 consecutive approach phases with 3h cooldown
    if (aircraft.phase === "approach") {
      state.consecutiveApproachCount += 1;
      if (
        state.consecutiveApproachCount >= LAND_CONSECUTIVE_POLLS &&
        now - state.lastLandEventAt > LAND_COOLDOWN_MS
      ) {
        state.lastLandEventAt = now;
        matchAndNotify({
          type: "land",
          airport: airport.icao,
          aircraft,
          timestamp: new Date().toISOString(),
        });
      }
    } else if (
      aircraft.phase === "climbing" ||
      aircraft.phase === "departing"
    ) {
      state.consecutiveApproachCount = 0;
    }

    // 2. Takeoff Detection: stationary on ground near airport (<5km), starts moving >5kt
    // ADS-B ground receiver coverage can be patchy; we trigger once when movement begins
    const isNearAirport =
      aircraft.distKm !== null && aircraft.distKm <= GROUND_AIRPORT_DIST_KM;
    const isGroundPhase = aircraft.onGround || aircraft.phase === "ground";
    const currentSpeed = aircraft.speedKt ?? 0;

    if (
      state.wasStationaryOnGround &&
      isNearAirport &&
      currentSpeed > GROUND_MIN_SPEED_KT &&
      now - state.lastTakeoffEventAt > TAKEOFF_COOLDOWN_MS
    ) {
      state.lastTakeoffEventAt = now;
      state.wasStationaryOnGround = false;
      matchAndNotify({
        type: "takeoff",
        airport: airport.icao,
        aircraft,
        timestamp: new Date().toISOString(),
      });
    } else if (
      isNearAirport &&
      isGroundPhase &&
      currentSpeed <= GROUND_MIN_SPEED_KT
    ) {
      state.wasStationaryOnGround = true;
    }

    // 3. Nearby Detection: first arrival or return after 10+ minutes absence
    const isNewArrival = state.lastNearbyEventAt === 0;
    const isReturningAfterAbsence =
      timeSinceLastSeen > NEARBY_ABSENCE_RESET_MS &&
      now - state.lastNearbyEventAt > NEARBY_ABSENCE_RESET_MS;

    if (isNewArrival || isReturningAfterAbsence) {
      state.lastNearbyEventAt = now;
      matchAndNotify({
        type: "nearby",
        airport: airport.icao,
        aircraft,
        timestamp: new Date().toISOString(),
      });
    }
  }

  pruneStaleState(now);
}

function pruneStaleState(now) {
  for (const [hex, state] of aircraftState.entries()) {
    if (now - state.lastSeen > STATE_PRUNE_MS) {
      aircraftState.delete(hex);
    }
  }
}

export function clearDetectorState() {
  aircraftState.clear();
}
