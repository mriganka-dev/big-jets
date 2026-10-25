import {
  getAirport,
  listFeaturedAirports,
  searchAirports,
} from "../utils/airports.js";
import {
  airportSearchQuerySchema,
  airportCodeParamSchema,
} from "../utils/validators.js";

/**
 * Returns featured airports only (not the whole dataset).
 */
export function getAirports(req, res) {
  const airports = listFeaturedAirports();
  res.json({ airports });
}

/**
 * Searches airports matching query term up to limit.
 * Applies Cache-Control header and never logs the search text.
 */
export function searchAirportsHandler(req, res, next) {
  try {
    const parseResult = airportSearchQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({
        error:
          parseResult.error.issues[0]?.message ||
          "Invalid search query parameters",
      });
    }

    const { q, limit } = parseResult.data;
    const results = searchAirports(q, limit);

    res.set("Cache-Control", "public, max-age=300");
    res.json({ airports: results });
  } catch (err) {
    next(err);
  }
}

/**
 * Returns one airport by 4-letter ICAO code or 404 if unknown.
 */
export function getAirportByIcaoHandler(req, res, next) {
  try {
    const paramParse = airportCodeParamSchema.safeParse(req.params.icao);
    if (!paramParse.success) {
      return res.status(400).json({
        error: "ICAO must be exactly 4 letters",
      });
    }

    const airport = getAirport(paramParse.data);
    if (!airport) {
      return res.status(404).json({
        error: "Airport not found",
      });
    }

    res.set("Cache-Control", "public, max-age=300");
    res.json(airport);
  } catch (err) {
    next(err);
  }
}
