import { getAirport, listFeaturedAirports } from "../utils/airports.js";
import { fetchAircraftForAirport, fetchGlobalFeeds } from "../utils/adsb.js";
import { formatAircraft } from "../utils/classifier.js";
import { icaoSchema, airportAircraftQuerySchema } from "../utils/validators.js";

export function getAirports(req, res) {
  const airports = listFeaturedAirports();
  res.json({ airports });
}

export async function getAirportAircraft(req, res, next) {
  try {
    const icaoParse = icaoSchema.safeParse(req.params.icao);
    if (!icaoParse.success) {
      return res.status(400).json({
        error: icaoParse.error.issues[0]?.message || "Invalid airport ICAO",
      });
    }

    const queryParse = airportAircraftQuerySchema.safeParse(req.query);
    if (!queryParse.success) {
      return res.status(400).json({
        error:
          queryParse.error.issues[0]?.message || "Invalid query parameters",
      });
    }

    const icao = icaoParse.data;
    const {
      radius,
      category: requestedCategories,
      all: showAll,
    } = queryParse.data;

    const airport = getAirport(icao);
    if (!airport) {
      return res.status(404).json({ error: "Airport not found" });
    }
    const airportAircraft = await fetchAircraftForAirport(airport, radius);
    const aircraftList = [...airportAircraft];

    try {
      const globalRaw = await fetchGlobalFeeds();
      const seenHexes = new Set(airportAircraft.map((a) => a.hex.toLowerCase()));
      for (const raw of globalRaw) {
        if (
          !raw ||
          typeof raw !== "object" ||
          !raw.hex ||
          typeof raw.lat !== "number" ||
          typeof raw.lon !== "number"
        ) {
          continue;
        }
        const hexLower = raw.hex.toLowerCase();
        if (seenHexes.has(hexLower)) {
          continue;
        }
        seenHexes.add(hexLower);
        aircraftList.push(formatAircraft(raw, airport));
      }
    } catch {
      // Continue with airportAircraft if global feeds encounter transient issues
    }

    let filtered = aircraftList;

    if (!showAll) {
      if (requestedCategories.length > 0) {
        filtered = aircraftList.filter((ac) =>
          ac.categories.some((cat) => requestedCategories.includes(cat))
        );
      } else {
        // Default: return only interesting categorized aircraft
        filtered = aircraftList.filter((ac) => ac.categories.length > 0);
      }
    }

    res.json({
      airport: {
        icao: airport.icao,
        name: airport.name,
        lat: airport.lat,
        lon: airport.lon,
      },
      radiusNm: radius,
      updatedAt: new Date().toISOString(),
      count: filtered.length,
      aircraft: filtered,
    });
  } catch (err) {
    next(err);
  }
}
