import {
  CATEGORIES,
  AIRCRAFT_TYPES,
  WATCHED_REGISTRATIONS,
  PHASE_THRESHOLDS,
} from "../constants.js";
import { calculateDistanceKm } from "./geo.js";
import { getAirlineByCallsign } from "./airlines.js";
import { getModelNameByType } from "./aircraftModels.js";

// Classify aircraft into categories based on type, registration and ADS-B flags
export function classifyAircraft(type, reg, isMilitaryFlag) {
  const categories = [];

  if (type && AIRCRAFT_TYPES.BIG.has(type)) {
    categories.push(CATEGORIES.BIG);
  }

  if (type && AIRCRAFT_TYPES.RARE.has(type)) {
    categories.push(CATEGORIES.RARE);
  }

  // Military classification requires the dbFlags military bit
  if (isMilitaryFlag) {
    if (type && AIRCRAFT_TYPES.MIL_FIGHTER.has(type)) {
      categories.push(CATEGORIES.MIL_FIGHTER);
    } else {
      categories.push(CATEGORIES.MIL_OTHER);
    }
  }

  if (type && AIRCRAFT_TYPES.VIP_JET.has(type)) {
    categories.push(CATEGORIES.VIP_JET);
  }

  if (reg && WATCHED_REGISTRATIONS.has(reg)) {
    categories.push(CATEGORIES.WATCHED);
  }

  return categories;
}

// Determine flight phase relative to the target airport using named thresholds
export function determinePhase({
  altFt,
  onGround,
  speedKt,
  vRate,
  distKm,
  airportElevationFt = 0,
}) {
  if (
    onGround ||
    (altFt !== null &&
      altFt <= airportElevationFt + PHASE_THRESHOLDS.GROUND_ALT_MARGIN_FT &&
      (speedKt ?? 0) < PHASE_THRESHOLDS.GROUND_SPEED_KT)
  ) {
    return "ground";
  }

  const heightFt = altFt !== null ? altFt - airportElevationFt : null;

  const isHighApproach =
    distKm !== null &&
    distKm <= PHASE_THRESHOLDS.APPROACH_MAX_DIST_KM &&
    heightFt !== null &&
    heightFt < PHASE_THRESHOLDS.APPROACH_ALT_FT &&
    vRate <= PHASE_THRESHOLDS.APPROACH_VRATE_FPM;

  const isCloseApproach =
    distKm !== null &&
    distKm < PHASE_THRESHOLDS.CLOSE_APPROACH_DIST_KM &&
    heightFt !== null &&
    heightFt < PHASE_THRESHOLDS.CLOSE_APPROACH_ALT_FT &&
    vRate <= PHASE_THRESHOLDS.CLOSE_APPROACH_VRATE_FPM;

  if (isHighApproach || isCloseApproach) {
    return "approach";
  }

  if (
    distKm !== null &&
    distKm <= PHASE_THRESHOLDS.DEPARTING_DIST_KM &&
    heightFt !== null &&
    heightFt <= PHASE_THRESHOLDS.DEPARTING_ALT_FT &&
    vRate >= PHASE_THRESHOLDS.DEPARTING_VRATE_FPM
  ) {
    return "departing";
  }

  if (vRate <= PHASE_THRESHOLDS.DESCENT_VRATE_FPM) {
    return "descending";
  }

  if (vRate >= PHASE_THRESHOLDS.CLIMB_VRATE_FPM) {
    return "climbing";
  }

  return "enroute";
}

// Map raw ADS-B record into clean validated shape using adsb.lol fields
export function formatAircraft(raw, airport) {
  const type = typeof raw.t === "string" ? raw.t.trim().toUpperCase() : "";
  const reg = typeof raw.r === "string" ? raw.r.trim().toUpperCase() : "";
  const hex = typeof raw.hex === "string" ? raw.hex.trim().toLowerCase() : "";
  const rawFlight =
    typeof raw.flight === "string" ? raw.flight.trim().toUpperCase() : "";
  const callsign = /^[A-Z0-9]{1,8}$/.test(rawFlight) ? rawFlight : null;
  const airline = getAirlineByCallsign(callsign);
  const operator =
    typeof raw.ownOp === "string" && raw.ownOp.trim().length > 0
      ? raw.ownOp.trim()
      : airline
      ? airline.name
      : null;
  const model =
    typeof raw.desc === "string" && raw.desc.trim().length > 0
      ? raw.desc.trim()
      : getModelNameByType(type);

  let altFt = null;
  let onGround = false;

  if (raw.alt_baro === "ground") {
    altFt = 0;
    onGround = true;
  } else if (typeof raw.alt_baro === "number") {
    altFt = Math.round(raw.alt_baro);
    onGround = false;
  }

  const speedKt = typeof raw.gs === "number" ? Math.round(raw.gs) : null;
  const vRate =
    typeof raw.baro_rate === "number"
      ? Math.round(raw.baro_rate)
      : typeof raw.geom_rate === "number"
        ? Math.round(raw.geom_rate)
        : 0;
  const track = typeof raw.track === "number" ? Math.round(raw.track) : null;
  const lat = typeof raw.lat === "number" ? raw.lat : null;
  const lon = typeof raw.lon === "number" ? raw.lon : null;

  let distKm = null;
  if (
    lat !== null &&
    lon !== null &&
    airport?.lat !== undefined &&
    airport?.lon !== undefined
  ) {
    distKm =
      Math.round(calculateDistanceKm(airport.lat, airport.lon, lat, lon) * 10) /
      10;
  }

  const isMilitary = typeof raw.dbFlags === "number" && (raw.dbFlags & 1) === 1;
  const categories = classifyAircraft(type, reg, isMilitary);
  const phase = determinePhase({
    altFt,
    onGround,
    speedKt,
    vRate,
    distKm,
    airportElevationFt: airport?.elevationFt || 0,
  });

  return {
    hex,
    callsign,
    reg: reg || null,
    type: type || null,
    model,
    operator: operator || null,
    airline: airline
      ? {
          name: airline.name,
          iata: airline.iata,
          icao: airline.icao,
          country: airline.country,
          logoUrl: airline.logoUrl,
        }
      : null,
    altFt,
    onGround,
    speedKt,
    vRate,
    lat,
    lon,
    track,
    distKm,
    phase,
    categories,
  };
}
