const EARTH_RADIUS_KM = 6371;
const NM_TO_KM = 1.852;

// Converts degrees to radians
function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

// Calculates great-circle distance between two points in kilometers
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_KM * c * 10) / 10;
}

// Converts nautical miles to kilometers
export function nmToKm(nm) {
  return Math.round(nm * NM_TO_KM * 10) / 10;
}

// Converts kilometers to nautical miles
export function kmToNm(km) {
  return Math.round((km / NM_TO_KM) * 10) / 10;
}
