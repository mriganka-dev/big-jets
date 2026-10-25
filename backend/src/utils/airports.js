import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.resolve(__dirname, "../data/airports.json");

const airportItemSchema = z.object({
  icao: z.string().regex(/^[A-Z]{4}$/),
  iata: z.string().nullable(),
  name: z.string().min(1).max(100),
  city: z.string().max(100).nullable(),
  country: z.string().max(100),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  elevationFt: z.number(),
  type: z.enum(["large_airport", "medium_airport", "small_airport"]),
});

const datasetSchema = z.array(airportItemSchema).min(1);

const TYPE_PRIORITY = {
  large_airport: 1,
  medium_airport: 2,
  small_airport: 3,
};

const FEATURED_ICAOS = [
  "VECC",
  "VIDP",
  "VABB",
  "VOBL",
  "VOMM",
  "VOHS",
  "VOCI",
  "VEGT",
];

function normalizeText(text) {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeSearchQuery(query) {
  if (typeof query !== "string") return "";
  return query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Loads airports.json once at module startup, validates with Zod,
 * and builds in-memory lookup maps and pre-computed search strings.
 */
function initAirports() {
  if (!fs.existsSync(DATA_PATH)) {
    console.error(
      "Error: airports.json is missing. Please run 'npm run build:airports'."
    );
    process.exit(1);
  }

  let rawData;
  try {
    const rawContent = fs.readFileSync(DATA_PATH, "utf8");
    rawData = JSON.parse(rawContent);
  } catch (err) {
    console.error(
      `Error: Failed to parse airports.json: ${err.message}. Please run 'npm run build:airports'.`
    );
    process.exit(1);
  }

  const parseResult = datasetSchema.safeParse(rawData);
  if (!parseResult.success) {
    console.error(
      "Error: airports.json structure is invalid. Please run 'npm run build:airports'."
    );
    process.exit(1);
  }

  const dataset = parseResult.data;

  // Stable sort: large airports first, then medium, then small, then by name
  dataset.sort((a, b) => {
    const diffType =
      (TYPE_PRIORITY[a.type] || 99) - (TYPE_PRIORITY[b.type] || 99);
    if (diffType !== 0) return diffType;
    return a.name.localeCompare(b.name);
  });

  const icaoMap = new Map();
  const iataMap = new Map();
  const preparedList = [];

  for (const item of dataset) {
    const publicShape = {
      icao: item.icao,
      iata: item.iata,
      name: item.name,
      city: item.city,
      country: item.country,
      lat: item.lat,
      lon: item.lon,
      elevationFt: item.elevationFt,
    };

    const prepared = {
      ...publicShape,
      type: item.type,
      normIcao: normalizeText(item.icao),
      normIata: normalizeText(item.iata || ""),
      normName: normalizeText(item.name),
      normCity: normalizeText(item.city || ""),
      normCountry: normalizeText(item.country),
      publicShape,
    };

    icaoMap.set(item.icao, prepared);

    if (item.iata && !iataMap.has(item.iata)) {
      iataMap.set(item.iata, prepared);
    }

    preparedList.push(prepared);
  }

  return { icaoMap, iataMap, preparedList };
}

const { icaoMap, iataMap, preparedList } = initAirports();

/**
 * Returns airport metadata for an ICAO code or null.
 * Uses Map.get with an upper-cased 4-letter ICAO code.
 */
export function getAirport(icao) {
  if (!icao || typeof icao !== "string" || !/^[A-Za-z]{4}$/.test(icao.trim())) {
    return null;
  }
  const entry = icaoMap.get(icao.trim().toUpperCase());
  return entry ? entry.publicShape : null;
}

/**
 * Checks whether an airport exists by ICAO code.
 */
export function hasAirport(icao) {
  if (!icao || typeof icao !== "string" || !/^[A-Za-z]{4}$/.test(icao.trim())) {
    return false;
  }
  return icaoMap.has(icao.trim().toUpperCase());
}

/**
 * Returns the 8 featured airports in defined order.
 */
export function listFeaturedAirports() {
  const result = [];
  for (const icao of FEATURED_ICAOS) {
    const ap = icaoMap.get(icao);
    if (ap) {
      result.push(ap.publicShape);
    }
  }
  return result;
}

/**
 * Searches airports with ranked matching and returns at most `limit` results.
 * Ranking:
 *  1. exact ICAO match
 *  2. exact IATA match
 *  3. ICAO or IATA prefix
 *  4. name or city starts with the query
 *  5. name or city contains the query
 * Within the same rank: large airports first, then medium, then small.
 * Never uses regex constructed from user query.
 */
export function searchAirports(query, limit = 10) {
  const cleanQuery = normalizeSearchQuery(query);
  if (cleanQuery.length < 2) {
    return [];
  }

  const effectiveLimit = Math.max(1, Math.min(20, Number(limit) || 10));

  const rank1 = [];
  const rank2 = [];
  const rank3 = [];
  const rank4 = [];
  const rank5 = [];

  for (const ap of preparedList) {
    let rank = 0;

    if (ap.normIcao === cleanQuery) {
      rank = 1;
    } else if (ap.normIata && ap.normIata === cleanQuery) {
      rank = 2;
    } else if (
      ap.normIcao.startsWith(cleanQuery) ||
      (ap.normIata && ap.normIata.startsWith(cleanQuery))
    ) {
      rank = 3;
    } else if (
      ap.normName.startsWith(cleanQuery) ||
      (ap.normCity && ap.normCity.startsWith(cleanQuery))
    ) {
      rank = 4;
    } else if (
      ap.normName.includes(cleanQuery) ||
      (ap.normCity && ap.normCity.includes(cleanQuery))
    ) {
      rank = 5;
    }

    if (rank === 1) rank1.push(ap.publicShape);
    else if (rank === 2) rank2.push(ap.publicShape);
    else if (rank === 3) rank3.push(ap.publicShape);
    else if (rank === 4) rank4.push(ap.publicShape);
    else if (rank === 5) rank5.push(ap.publicShape);
  }

  const matches = [];
  const buckets = [rank1, rank2, rank3, rank4, rank5];

  for (const bucket of buckets) {
    for (const item of bucket) {
      matches.push(item);
      if (matches.length >= effectiveLimit) {
        return matches;
      }
    }
  }

  return matches;
}
