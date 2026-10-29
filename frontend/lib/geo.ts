/**
 * Haversine formula to calculate great-circle distance between two points in km
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's mean radius in km
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRad) *
      Math.cos(lat2 * toRad) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates intermediate points along a great-circle arc (geodesic curve)
 * between two lat/lon coordinates for realistic Flightradar24-style flight paths.
 */
export function getGreatCirclePoints(
  start: [number, number],
  end: [number, number],
  numPoints = 36,
): [number, number][] {
  const [lat1, lon1] = start;
  const [lat2, lon2] = end;

  // If points are identical or extremely close, return simple segment
  if (Math.abs(lat1 - lat2) < 0.001 && Math.abs(lon1 - lon2) < 0.001) {
    return [start, end];
  }

  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;

  const φ1 = lat1 * toRad;
  const λ1 = lon1 * toRad;
  const φ2 = lat2 * toRad;
  const λ2 = lon2 * toRad;

  const Δφ = φ2 - φ1;
  const Δλ = λ2 - λ1;

  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const d = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  if (d < 0.0001) {
    return [start, end];
  }

  const points: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);

    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);

    const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * toDeg;
    const lon = Math.atan2(y, x) * toDeg;

    points.push([lat, lon]);
  }

  return points;
}

/**
 * Calculates flight progress percentage (0 - 100) based on origin, current position and destination.
 */
export function calculateFlightProgress(
  origin: { lat: number; lon: number },
  current: { lat: number; lon: number },
  dest: { lat: number; lon: number },
): number {
  const distTotal = calculateDistanceKm(origin.lat, origin.lon, dest.lat, dest.lon);
  if (distTotal <= 1) return 50;

  const distFromOrigin = calculateDistanceKm(origin.lat, origin.lon, current.lat, current.lon);
  const distToDest = calculateDistanceKm(current.lat, current.lon, dest.lat, dest.lon);

  // If sum of segments is roughly total distance, ratio from origin is progress
  const progress = Math.min(100, Math.max(0, Math.round((distFromOrigin / (distFromOrigin + distToDest)) * 100)));
  return progress;
}
