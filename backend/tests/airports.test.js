import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import * as store from "../src/store/store.js";
import {
  getAirport,
  hasAirport,
  listFeaturedAirports,
  searchAirports,
} from "../src/utils/airports.js";
import {
  getAirports,
  searchAirportsHandler,
  getAirportByIcaoHandler,
} from "../src/controllers/airportController.js";

const tempStorePath = path.join(
  os.tmpdir(),
  `test-airports-store-${Date.now()}.json`
);

test.before(() => {
  store.setStorePath(tempStorePath);
});

test.after(() => {
  try {
    if (fs.existsSync(tempStorePath)) fs.unlinkSync(tempStorePath);
  } catch {}
});

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    set(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    json(data) {
      this.data = data;
      return this;
    },
  };
}

test("Airports: GET /api/airports returns featured airports in specified shape", () => {
  const res = createMockRes();
  getAirports({}, res);

  assert.equal(res.statusCode, 200);
  assert(res.data && Array.isArray(res.data.airports));
  assert.equal(res.data.airports.length, 8);

  const featured = res.data.airports;
  const icaos = featured.map((a) => a.icao);
  assert.deepEqual(icaos, [
    "VECC",
    "VIDP",
    "VABB",
    "VOBL",
    "VOMM",
    "VOHS",
    "VOCI",
    "VEGT",
  ]);

  for (const ap of featured) {
    assert.equal(typeof ap.icao, "string");
    assert.equal(typeof ap.name, "string");
    assert.equal(typeof ap.country, "string");
    assert.equal(typeof ap.lat, "number");
    assert.equal(typeof ap.lon, "number");
    assert.equal(typeof ap.elevationFt, "number");
    assert.equal(Object.hasOwn(ap, "type"), false);
  }
});

test("Airports: Exact ICAO and IATA match ranking", () => {
  // Exact ICAO match
  const icaoResults = searchAirports("EGLL", 5);
  assert(icaoResults.length > 0);
  assert.equal(icaoResults[0].icao, "EGLL");

  // Exact IATA match ranks ahead of prefix matches
  const iataResults = searchAirports("CCU", 5);
  assert(iataResults.length > 0);
  assert.equal(iataResults[0].icao, "VECC");
  assert.equal(iataResults[0].iata, "CCU");
});

test("Airports: Name and city search", () => {
  // Name contains 'heathrow'
  const heathrowResults = searchAirports("heathrow", 5);
  assert(heathrowResults.length > 0);
  assert.equal(heathrowResults[0].icao, "EGLL");

  // City 'New York' finds major NY airports
  const nyResults = searchAirports("new york", 5);
  assert(nyResults.length > 0);
  const nyIcaos = nyResults.map((a) => a.icao);
  assert(nyIcaos.includes("KJFK"));
  assert(nyIcaos.includes("KLGA"));
});

test("Airports: Accent handling (Malaga finds Málaga)", () => {
  const unaccented = searchAirports("Malaga", 5);
  assert(unaccented.length > 0);
  assert.equal(unaccented[0].icao, "LEMG");
  assert(
    unaccented[0].name.includes("Málaga") || unaccented[0].city === "Málaga"
  );

  const accented = searchAirports("Málaga", 5);
  assert(accented.length > 0);
  assert.equal(accented[0].icao, "LEMG");
});

test("Airports: Rejection of too short, too long, and invalid queries", () => {
  const next = () => {};

  // Too short (< 2 chars)
  const shortRes = createMockRes();
  searchAirportsHandler({ query: { q: "a" } }, shortRes, next);
  assert.equal(shortRes.statusCode, 400);

  // Too long (> 40 chars)
  const longRes = createMockRes();
  searchAirportsHandler({ query: { q: "a".repeat(45) } }, longRes, next);
  assert.equal(longRes.statusCode, 400);

  // Disallowed characters
  const invalidRes = createMockRes();
  searchAirportsHandler({ query: { q: "Heathrow<script>" } }, invalidRes, next);
  assert.equal(invalidRes.statusCode, 400);
});

test("Airports: Limit bounds and Cache-Control header", () => {
  const next = () => {};

  // Limit < 1 rejected
  const minLimitRes = createMockRes();
  searchAirportsHandler(
    { query: { q: "london", limit: "0" } },
    minLimitRes,
    next
  );
  assert.equal(minLimitRes.statusCode, 400);

  // Limit > 20 rejected
  const maxLimitRes = createMockRes();
  searchAirportsHandler(
    { query: { q: "london", limit: "25" } },
    maxLimitRes,
    next
  );
  assert.equal(maxLimitRes.statusCode, 400);

  // Valid limit returns bounded results and Cache-Control
  const validRes = createMockRes();
  searchAirportsHandler({ query: { q: "london", limit: "3" } }, validRes, next);
  assert.equal(validRes.statusCode, 200);
  assert(Array.isArray(validRes.data.airports));
  assert.equal(validRes.data.airports.length, 3);
  assert.equal(validRes.headers["cache-control"], "public, max-age=300");
});

test("Airports: GET /api/airports/:icao returns single airport or 404", () => {
  const next = () => {};

  // Known airport
  const knownRes = createMockRes();
  getAirportByIcaoHandler({ params: { icao: "EGLL" } }, knownRes, next);
  assert.equal(knownRes.statusCode, 200);
  assert.equal(knownRes.data.icao, "EGLL");
  assert.equal(knownRes.data.iata, "LHR");
  assert.equal(knownRes.headers["cache-control"], "public, max-age=300");

  // Unknown airport returns 404
  const unknownRes = createMockRes();
  getAirportByIcaoHandler({ params: { icao: "ZZZZ" } }, unknownRes, next);
  assert.equal(unknownRes.statusCode, 404);

  // Invalid ICAO length returns 400
  const invalidRes = createMockRes();
  getAirportByIcaoHandler({ params: { icao: "TOOLONG" } }, invalidRes, next);
  assert.equal(invalidRes.statusCode, 400);
});

test("Airports: Regex-like injection queries return safely without slowness", () => {
  const next = () => {};

  // Injection via HTTP handler rejected with 400
  const dotStarRes = createMockRes();
  searchAirportsHandler({ query: { q: ".*" } }, dotStarRes, next);
  assert.equal(dotStarRes.statusCode, 400);

  const redosRes = createMockRes();
  searchAirportsHandler({ query: { q: "(a+)+$" } }, redosRes, next);
  assert.equal(redosRes.statusCode, 400);

  // Direct search function handles regex-like strings safely and instantly
  const start = Date.now();
  const directResults = searchAirports(".*", 10);
  const elapsed = Date.now() - start;

  assert(Array.isArray(directResults));
  assert(elapsed < 50, `Search took too long (${elapsed} ms)`);
});
