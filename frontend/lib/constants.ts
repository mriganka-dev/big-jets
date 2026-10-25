// Application constants and configuration values

export const CATEGORIES = {
  BIG: "BIG",
  RARE: "RARE",
  MIL_FIGHTER: "MIL_FIGHTER",
  MIL_OTHER: "MIL_OTHER",
  VIP_JET: "VIP_JET",
  WATCHED: "WATCHED",
} as const;

export type CategoryKey = (typeof CATEGORIES)[keyof typeof CATEGORIES];

export const CATEGORY_META: Record<
  CategoryKey,
  { label: string; description: string; priority: number }
> = {
  RARE: {
    label: "Rare",
    description: "Rare or uncommon aircraft type",
    priority: 1,
  },
  MIL_FIGHTER: {
    label: "Fighter",
    description: "Military fighter jet",
    priority: 2,
  },
  BIG: {
    label: "Big",
    description: "Wide-body or heavy transport",
    priority: 3,
  },
  VIP_JET: {
    label: "VIP",
    description: "Business jet or VIP transport",
    priority: 4,
  },
  MIL_OTHER: {
    label: "Military",
    description: "Other military aircraft",
    priority: 5,
  },
  WATCHED: {
    label: "Watched",
    description: "Custom watched airframe",
    priority: 6,
  },
};

export const FLIGHT_PHASES = {
  GROUND: "ground",
  APPROACH: "approach",
  DEPARTING: "departing",
  DESCENDING: "descending",
  CLIMBING: "climbing",
  ENROUTE: "enroute",
} as const;

export type FlightPhaseKey = (typeof FLIGHT_PHASES)[keyof typeof FLIGHT_PHASES];

export const PHASE_LABELS: Record<FlightPhaseKey, string> = {
  ground: "On the ground",
  approach: "Landing soon",
  departing: "Departing",
  descending: "Descending",
  climbing: "Climbing",
  enroute: "Overflying",
};

export const LIMITS = {
  MIN_RADIUS_NM: 5,
  MAX_RADIUS_NM: 100,
  DEFAULT_RADIUS_NM: 40,
  MAX_AIRCRAFT_RENDER: 300,
  POLL_INTERVAL_MS: 15_000,
  MIN_BACKOFF_MS: 30_000,
  MAX_BACKOFF_MS: 120_000,
  FETCH_TIMEOUT_MS: 10_000,
  STALE_THRESHOLD_MS: 120_000,
};

export const DEFAULT_AIRPORT_ICAO =
  process.env.NEXT_PUBLIC_DEFAULT_AIRPORT || "VECC";

export const PATTERNS = {
  ICAO: /^[A-Za-z]{4}$/,
  REGISTRATION: /^[A-Z0-9-]{3,10}$/,
  BOT_USERNAME: /^[A-Za-z0-9_]{5,32}$/,
  SEARCH_QUERY: /^[\p{L}0-9\s\-'.',]+$/u,
};

export const DEFAULT_API_URL = "http://localhost:4000";

export const SITE_DISCLAIMER =
  "Positions come from community ADS-B receivers and may be delayed, missing or wrong. Not for navigation or any safety-critical use.";

export const SITE_CREDITS = "Aircraft data from adsb.lol (ODbL).";
