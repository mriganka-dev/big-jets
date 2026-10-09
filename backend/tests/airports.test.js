import test from "node:test";
import assert from "node:assert/strict";
import { getAirports } from "../src/controllers/aircraftController.js";
import { AIRPORTS } from "../src/constants.js";

test("Airports: GET /api/airports returns all supported airports", () => {
  let responseData = null;
  const req = {};
  const res = {
    json(data) {
      responseData = data;
      return this;
    },
  };

  getAirports(req, res);

  assert(responseData && Array.isArray(responseData.airports));
  const expectedCount = Object.keys(AIRPORTS).length;
  assert.equal(responseData.airports.length, expectedCount);

  for (const airport of responseData.airports) {
    const raw = AIRPORTS[airport.icao];
    assert(raw, `Airport ${airport.icao} should exist in AIRPORTS constant`);
    assert.equal(airport.iata, raw.iata);
    assert.equal(airport.name, raw.name);
    assert.equal(airport.fullName, raw.fullName);
    assert.equal(airport.lat, raw.lat);
    assert.equal(airport.lon, raw.lon);
    assert.equal(airport.elevationFt, undefined);
  }
});
