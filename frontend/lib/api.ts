import {
  airportItemSchema,
  airportsResponseSchema,
  airportSearchResponseSchema,
  aircraftResponseSchema,
  flightRouteResponseSchema,
  type AirportItem,
  type AirportsResponse,
  type AircraftResponse,
  type AircraftCategory,
  type FlightRouteInfo,
} from "./schemas";
import { LIMITS, PATTERNS, CATEGORIES } from "./constants";

// Error Classes
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number = 500,
    public readonly code: string = "API_ERROR",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NetworkError extends ApiError {
  constructor(
    message = "Network connection failed. Please check your connection.",
  ) {
    super(message, 0, "NETWORK_ERROR");
    this.name = "NetworkError";
  }
}

export class TimeoutError extends ApiError {
  constructor(
    message = "Request timed out. The server took too long to respond.",
  ) {
    super(message, 408, "TIMEOUT_ERROR");
    this.name = "TimeoutError";
  }
}

export class RateLimitError extends ApiError {
  constructor(
    message = "Too many requests. Please wait a moment before trying again.",
  ) {
    super(message, 429, "RATE_LIMITED");
    this.name = "RateLimitError";
  }
}

export class ValidationError extends ApiError {
  constructor(message = "The server returned data in an unexpected format.") {
    super(message, 502, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export interface AircraftQueryOptions {
  radius?: number;
  categories?: AircraftCategory[];
  all?: boolean;
}

const getApiBaseUrl = (): string => {
  const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  return url.replace(/\/+$/, "");
};

// Helper to merge an external AbortSignal with a timeout
function createCombinedSignal(
  userSignal?: AbortSignal,
  timeoutMs = LIMITS.FETCH_TIMEOUT_MS,
): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new TimeoutError()),
    timeoutMs,
  );

  const onUserAbort = () => {
    controller.abort(userSignal?.reason);
  };

  if (userSignal) {
    if (userSignal.aborted) {
      controller.abort(userSignal.reason);
    } else {
      userSignal.addEventListener("abort", onUserAbort, { once: true });
    }
  }

  const cleanup = () => {
    clearTimeout(timer);
    if (userSignal) {
      userSignal.removeEventListener("abort", onUserAbort);
    }
  };

  return { signal: controller.signal, cleanup };
}

/**
 * Fetch supported airports list from the backend
 */
export async function fetchAirports(
  userSignal?: AbortSignal,
): Promise<AirportsResponse> {
  const { signal, cleanup } = createCombinedSignal(userSignal);
  const baseUrl = getApiBaseUrl();

  try {
    const res = await fetch(`${baseUrl}/api/airports`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
      cache: "default",
    });

    if (res.status === 429) {
      throw new RateLimitError();
    }

    if (!res.ok) {
      throw new ApiError(
        `Server responded with status ${res.status}`,
        res.status,
      );
    }

    const data: unknown = await res.json();
    const parsed = airportsResponseSchema.safeParse(data);

    if (!parsed.success) {
      throw new ValidationError();
    }

    return parsed.data;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    if (err instanceof DOMException && err.name === "AbortError") {
      if (signal.reason instanceof TimeoutError) {
        throw signal.reason;
      }
      throw err;
    }
    if (err instanceof TypeError) {
      throw new NetworkError();
    }
    throw new ApiError("Failed to fetch airports list", 500);
  } finally {
    cleanup();
  }
}

/**
 * Fetch aircraft near a given airport with validated filter parameters
 */
export async function fetchAircraft(
  icaoInput: string,
  options: AircraftQueryOptions = {},
  userSignal?: AbortSignal,
): Promise<AircraftResponse> {
  const cleanIcao = icaoInput.trim().toUpperCase();
  if (!PATTERNS.ICAO.test(cleanIcao)) {
    throw new ApiError(
      `Invalid airport ICAO code: ${cleanIcao}`,
      400,
      "INVALID_ICAO",
    );
  }

  const params = new URLSearchParams();

  // Validate radius
  if (typeof options.radius === "number") {
    const r = Math.min(
      Math.max(Math.floor(options.radius), LIMITS.MIN_RADIUS_NM),
      LIMITS.MAX_RADIUS_NM,
    );
    params.set("radius", r.toString());
  }

  // Validate categories
  if (options.categories && options.categories.length > 0) {
    const validCats = options.categories.filter((cat) =>
      Object.values(CATEGORIES).includes(cat),
    );
    if (validCats.length > 0) {
      params.set("category", validCats.join(","));
    }
  }

  // Validate 'all' traffic flag
  if (options.all === true) {
    params.set("all", "true");
  }

  const queryString = params.toString();
  const url = `${getApiBaseUrl()}/api/airports/${encodeURIComponent(cleanIcao)}/aircraft${
    queryString ? `?${queryString}` : ""
  }`;

  const { signal, cleanup } = createCombinedSignal(userSignal);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
      cache: "no-store",
    });

    if (res.status === 429) {
      throw new RateLimitError();
    }

    if (res.status === 404) {
      throw new ApiError(`Airport ${cleanIcao} not found`, 404, "NOT_FOUND");
    }

    if (!res.ok) {
      throw new ApiError(
        `Server responded with status ${res.status}`,
        res.status,
      );
    }

    const data: unknown = await res.json();
    const parsed = aircraftResponseSchema.safeParse(data);

    if (!parsed.success) {
      throw new ValidationError();
    }

    return parsed.data;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    if (err instanceof DOMException && err.name === "AbortError") {
      if (signal.reason instanceof TimeoutError) {
        throw signal.reason;
      }
      throw err;
    }
    if (err instanceof TypeError) {
      throw new NetworkError();
    }
    throw new ApiError(`Failed to fetch aircraft near ${cleanIcao}`, 500);
  } finally {
    cleanup();
  }
}

/**
 * Search airports by query string matching name, city, ICAO, or IATA
 */
export async function searchAirports(
  query: string,
  userSignal?: AbortSignal,
): Promise<AirportItem[]> {
  const clean = query.trim();
  if (clean.length < 2) {
    return [];
  }

  const { signal, cleanup } = createCombinedSignal(userSignal);
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api/airports/search?q=${encodeURIComponent(clean)}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
      cache: "default",
    });

    if (res.status === 429) {
      throw new RateLimitError();
    }

    if (!res.ok) {
      throw new ApiError(
        `Server responded with status ${res.status}`,
        res.status,
      );
    }

    const data: unknown = await res.json();
    const parsed = airportSearchResponseSchema.safeParse(data);

    if (!parsed.success) {
      throw new ValidationError();
    }

    return parsed.data.airports;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    if (err instanceof DOMException && err.name === "AbortError") {
      if (signal.reason instanceof TimeoutError) {
        throw signal.reason;
      }
      throw err;
    }
    if (err instanceof TypeError) {
      throw new NetworkError();
    }
    throw new ApiError("Failed to search airports", 500);
  } finally {
    cleanup();
  }
}

/**
 * Fetch a single airport by 4-letter ICAO code
 */
export async function fetchAirport(
  icaoInput: string,
  userSignal?: AbortSignal,
): Promise<AirportItem> {
  const cleanIcao = icaoInput.trim().toUpperCase();
  if (!PATTERNS.ICAO.test(cleanIcao)) {
    throw new ApiError(
      `Invalid airport ICAO code: ${cleanIcao}`,
      400,
      "INVALID_ICAO",
    );
  }

  const { signal, cleanup } = createCombinedSignal(userSignal);
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api/airports/${encodeURIComponent(cleanIcao)}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
      cache: "default",
    });

    if (res.status === 429) {
      throw new RateLimitError();
    }

    if (res.status === 404) {
      throw new ApiError(`Airport ${cleanIcao} not found`, 404, "NOT_FOUND");
    }

    if (!res.ok) {
      throw new ApiError(
        `Server responded with status ${res.status}`,
        res.status,
      );
    }

    const data: unknown = await res.json();
    const parsed = airportItemSchema.safeParse(data);

    if (!parsed.success) {
      throw new ValidationError();
    }

    return parsed.data;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    if (err instanceof DOMException && err.name === "AbortError") {
      if (signal.reason instanceof TimeoutError) {
        throw signal.reason;
      }
      throw err;
    }
    if (err instanceof TypeError) {
      throw new NetworkError();
    }
    throw new ApiError(`Failed to fetch airport ${cleanIcao}`, 500);
  } finally {
    cleanup();
  }
}

// Client-side cache for flight routes to avoid repetitive network requests
const routeClientCache = new Map<string, { timestamp: number; data: FlightRouteInfo | null }>();
const CLIENT_ROUTE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Fetches flight route, airline branding, origin & destination for a callsign.
 */
export async function fetchFlightRoute(
  callsign: string,
  userSignal?: AbortSignal,
): Promise<FlightRouteInfo | null> {
  if (!callsign || typeof callsign !== "string") return null;
  const clean = callsign.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,8}$/.test(clean)) return null;

  const now = Date.now();
  const cached = routeClientCache.get(clean);
  if (cached && now - cached.timestamp < CLIENT_ROUTE_CACHE_TTL_MS) {
    return cached.data;
  }

  const { signal, cleanup } = createCombinedSignal(userSignal, 4000);
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api/routes/${encodeURIComponent(clean)}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
    });

    if (res.status === 404) {
      routeClientCache.set(clean, { timestamp: now, data: null });
      return null;
    }

    if (!res.ok) {
      return null;
    }

    const data: unknown = await res.json();
    const parsed = flightRouteResponseSchema.safeParse(data);
    if (!parsed.success) {
      return null;
    }

    routeClientCache.set(clean, { timestamp: now, data: parsed.data.route });
    return parsed.data.route;
  } catch {
    return null;
  } finally {
    cleanup();
  }
}

