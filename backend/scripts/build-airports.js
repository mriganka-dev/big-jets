import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_PATH = path.resolve(__dirname, "../data-source/airports.csv");
const OUTPUT_PATH = path.resolve(__dirname, "../src/data/airports.json");

const ALLOWED_TYPES = new Set([
  "large_airport",
  "medium_airport",
  "small_airport",
]);

const TYPE_PRIORITY = {
  large_airport: 1,
  medium_airport: 2,
  small_airport: 3,
};

/**
 * Parses CSV content into rows without third-party dependencies.
 * Handles quoted fields, embedded commas, and doubled quotes.
 */
function parseCsvAndProcess(content, onRow) {
  let currentRow = [];
  let currentField = "";
  let inQuotes = false;
  const len = content.length;

  for (let i = 0; i < len; i++) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < len && content[i + 1] === '"') {
          currentField += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentField);
        currentField = "";
      } else if (char === "\r") {
        if (i + 1 < len && content[i + 1] === "\n") {
          i++;
        }
        currentRow.push(currentField);
        currentField = "";
        if (currentRow.length > 0 && currentRow.some((f) => f.length > 0)) {
          onRow(currentRow);
        }
        currentRow = [];
      } else if (char === "\n") {
        currentRow.push(currentField);
        currentField = "";
        if (currentRow.length > 0 && currentRow.some((f) => f.length > 0)) {
          onRow(currentRow);
        }
        currentRow = [];
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((f) => f.length > 0)) {
      onRow(currentRow);
    }
  }
}

function buildAirports() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(
      `Error: Source file not found at ${CSV_PATH}.\nPlease download OurAirports airports.csv to backend/data-source/airports.csv.`
    );
    process.exit(1);
  }

  console.log(`Reading ${CSV_PATH}...`);
  const content = fs.readFileSync(CSV_PATH, "utf8");

  let headers = null;
  const colIndex = new Map();
  const airportsByIcao = new Map();

  parseCsvAndProcess(content, (row) => {
    if (!headers) {
      headers = row.map((h) => h.trim());
      headers.forEach((h, idx) => colIndex.set(h, idx));
      return;
    }

    const type = (row[colIndex.get("type")] || "").trim();
    if (!ALLOWED_TYPES.has(type)) {
      return;
    }

    // Determine ICAO code: icao_code if present and valid, otherwise ident
    const icaoCodeVal = colIndex.has("icao_code")
      ? (row[colIndex.get("icao_code")] || "").trim().toUpperCase()
      : "";
    const identVal = (row[colIndex.get("ident")] || "").trim().toUpperCase();

    const icao = icaoCodeVal.length > 0 ? icaoCodeVal : identVal;
    if (!/^[A-Z]{4}$/.test(icao)) {
      return;
    }

    const rawLat = parseFloat(row[colIndex.get("latitude_deg")]);
    const rawLon = parseFloat(row[colIndex.get("longitude_deg")]);

    if (
      Number.isNaN(rawLat) ||
      Number.isNaN(rawLon) ||
      !Number.isFinite(rawLat) ||
      !Number.isFinite(rawLon) ||
      rawLat < -90 ||
      rawLat > 90 ||
      rawLon < -180 ||
      rawLon > 180
    ) {
      return;
    }

    const rawIata = colIndex.has("iata_code")
      ? (row[colIndex.get("iata_code")] || "").trim().toUpperCase()
      : "";
    const iata = rawIata.length > 0 ? rawIata.slice(0, 100) : null;

    const rawName = (row[colIndex.get("name")] || "").trim();
    const name = rawName.slice(0, 100);

    const rawCity = colIndex.has("municipality")
      ? (row[colIndex.get("municipality")] || "").trim()
      : "";
    const city = rawCity.length > 0 ? rawCity.slice(0, 100) : null;

    const rawCountry = colIndex.has("iso_country")
      ? (row[colIndex.get("iso_country")] || "").trim().toUpperCase()
      : "";
    const country = rawCountry.slice(0, 100);

    const rawElevation = parseFloat(row[colIndex.get("elevation_ft")]);
    const elevationFt =
      !Number.isNaN(rawElevation) && Number.isFinite(rawElevation)
        ? Math.round(rawElevation)
        : 0;

    const airport = {
      icao,
      iata,
      name,
      city,
      country,
      lat: rawLat,
      lon: rawLon,
      elevationFt,
      type,
    };

    // Deduplicate by ICAO: keep higher priority type if duplicate
    const existing = airportsByIcao.get(icao);
    if (!existing) {
      airportsByIcao.set(icao, airport);
    } else {
      const existingPriority = TYPE_PRIORITY[existing.type] || 99;
      const newPriority = TYPE_PRIORITY[type] || 99;
      if (newPriority < existingPriority) {
        airportsByIcao.set(icao, airport);
      }
    }
  });

  const airportList = Array.from(airportsByIcao.values());

  // Sort large airports first, then medium, then small, then by name
  airportList.sort((a, b) => {
    const diffType =
      (TYPE_PRIORITY[a.type] || 99) - (TYPE_PRIORITY[b.type] || 99);
    if (diffType !== 0) return diffType;
    return a.name.localeCompare(b.name);
  });

  // Count per type
  const counts = {
    large_airport: 0,
    medium_airport: 0,
    small_airport: 0,
  };

  for (const item of airportList) {
    if (counts[item.type] !== undefined) {
      counts[item.type]++;
    }
  }

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(airportList, null, 2) + "\n",
    "utf8"
  );

  const stats = fs.statSync(OUTPUT_PATH);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

  console.log("Airport dataset built successfully:");
  console.log(`- Large airports:  ${counts.large_airport}`);
  console.log(`- Medium airports: ${counts.medium_airport}`);
  console.log(`- Small airports:  ${counts.small_airport}`);
  console.log(`- Total airports:  ${airportList.length}`);
  console.log(`- Output file:     ${OUTPUT_PATH} (${sizeMb} MB)`);
}

buildAirports();
