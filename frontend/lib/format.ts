import { PATTERNS } from "./constants";

/**
 * Format altitude with comma separation or ground indicator
 */
export function formatAltitude(
  altFt: number | null | undefined,
  onGround?: boolean | null,
): string {
  if (onGround === true) {
    return "On ground";
  }
  if (typeof altFt !== "number" || isNaN(altFt)) {
    return "Unknown";
  }
  return `${altFt.toLocaleString("en-US")} ft`;
}

/**
 * Format distance in nautical/metric units (km)
 */
export function formatDistance(distKm: number | null | undefined): string {
  if (typeof distKm !== "number" || isNaN(distKm) || distKm < 0) {
    return "Unknown";
  }
  const nm = distKm * 0.539957;
  return `${nm.toFixed(1)} NM (${distKm.toFixed(1)} km)`;
}

/**
 * Format ground speed in knots
 */
export function formatSpeed(speedKt: number | null | undefined): string {
  if (typeof speedKt !== "number" || isNaN(speedKt) || speedKt < 0) {
    return "Unknown";
  }
  return `${Math.round(speedKt)} kt`;
}

/**
 * Format vertical rate and determine climb/descent trend
 */
export function formatVerticalRate(vRate: number | null | undefined): {
  text: string;
  trend: "climbing" | "descending" | "level" | "unknown";
} {
  if (typeof vRate !== "number" || isNaN(vRate)) {
    return { text: "Level", trend: "unknown" };
  }

  if (vRate > 100) {
    return {
      text: `+${vRate.toLocaleString("en-US")} fpm`,
      trend: "climbing",
    };
  }

  if (vRate < -100) {
    return {
      text: `${vRate.toLocaleString("en-US")} fpm`,
      trend: "descending",
    };
  }

  return { text: "Level", trend: "level" };
}

/**
 * Format heading/track in degrees (0-360) with cardinal direction
 */
export function formatHeading(trackDeg: number | null | undefined): string {
  if (typeof trackDeg !== "number" || isNaN(trackDeg)) {
    return "Unknown";
  }
  const normalized = Math.round(((trackDeg % 360) + 360) % 360);
  const directions = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  const index = Math.round(normalized / 22.5) % 16;
  return `${normalized}° (${directions[index]})`;
}

/**
 * Calculate estimated time of arrival (ETA) for landing aircraft
 * Only applicable when flight phase is 'approach' and speed & distance are available.
 */
export function formatETA(
  phase: string,
  speedKt: number | null | undefined,
  distKm: number | null | undefined,
): string | null {
  if (phase !== "approach") {
    return null;
  }

  if (
    typeof speedKt !== "number" ||
    typeof distKm !== "number" ||
    speedKt <= 30 ||
    distKm <= 0
  ) {
    return null;
  }

  // 1 knot = 1.852 km/h
  const speedKmh = speedKt * 1.852;
  const minutes = (distKm / speedKmh) * 60;

  if (minutes < 1) {
    return "about <1 min";
  }

  const roundedMinutes = Math.round(minutes);
  return `about ${roundedMinutes} min`;
}

/**
 * Format human readable 'Updated N seconds ago' or timestamp
 */
export function formatUpdatedAgo(dateInput: string | Date | number): string {
  const time =
    typeof dateInput === "number" ? dateInput : new Date(dateInput).getTime();
  if (isNaN(time)) {
    return "Updated recently";
  }

  const elapsedSec = Math.max(0, Math.floor((Date.now() - time) / 1000));

  if (elapsedSec < 5) {
    return "Updated just now";
  }
  if (elapsedSec < 60) {
    return `Updated ${elapsedSec}s ago`;
  }
  const minutes = Math.floor(elapsedSec / 60);
  return `Updated ${minutes}m ago`;
}

/**
 * Build a safe, validated photo search URL for an aircraft registration
 */
export function getPhotoSearchUrl(
  registration: string | null | undefined,
): string | null {
  if (!registration || typeof registration !== "string") {
    return null;
  }

  const cleanReg = registration.trim().toUpperCase();
  if (!PATTERNS.REGISTRATION.test(cleanReg)) {
    return null;
  }

  return `https://www.jetphotos.com/registration/${encodeURIComponent(cleanReg)}`;
}
