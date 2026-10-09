import {
  airportsResponseSchema,
  aircraftResponseSchema,
  type AirportsResponse,
  type AircraftResponse,
  type AircraftCategory,
} from "./schemas";
import { LIMITS, PATTERNS, CATEGORIES } from "./constants";

// Error Classes
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number = 500,
    public readonly code: string = "API_ERROR"
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NetworkError extends ApiError {
  constructor(message = "Network connection failed. Please check your connection.") {
    super(message, 0, "NETWORK_ERROR");
    this.name = "NetworkError";
  }
}

export class TimeoutError extends ApiError {
  constructor(message = "Request timed out. The server took too long to respond.") {
    super(message, 408, "TIMEOUT_ERROR");
    this.name = "TimeoutError";
  }
}

export class RateLimitError extends ApiError {
  constructor(message = "Too many requests. Please wait a moment before trying again.") {
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
function createCombinedSignal(userSignal?: AbortSignal, timeoutMs = LIMITS.FETCH_TIMEOUT_MS): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new TimeoutError()), timeoutMs);

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
export async function fetchAirports(userSignal?: AbortSignal): Promise<AirportsResponse> {
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
      throw new ApiError(`Server responded with status ${res.status}`, res.status);
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
  userSignal?: AbortSignal
): Promise<AircraftResponse> {
  const cleanIcao = icaoInput.trim().toUpperCase();
  if (!PATTERNS.ICAO.test(cleanIcao)) {
    throw new ApiError(`Invalid airport ICAO code: ${cleanIcao}`, 400, "INVALID_ICAO");
  }

  const params = new URLSearchParams();

  // Validate radius
  if (typeof options.radius === "number") {
    const r = Math.min(Math.max(Math.floor(options.radius), LIMITS.MIN_RADIUS_NM), LIMITS.MAX_RADIUS_NM);
    params.set("radius", r.toString());
  }

  // Validate categories
  if (options.categories && options.categories.length > 0) {
    const validCats = options.categories.filter((cat) => Object.values(CATEGORIES).includes(cat));
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
      throw new ApiError(`Server responded with status ${res.status}`, res.status);
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
