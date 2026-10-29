import test from "node:test";
import assert from "node:assert/strict";
import { getAirlineByCallsign } from "../src/utils/airlines.js";
import { getModelNameByType } from "../src/utils/aircraftModels.js";
import { getFlightRoute } from "../src/services/flightRouteService.js";

test("Airlines: Resolves airline name and logo by callsign prefix", () => {
  const thai = getAirlineByCallsign("THA941");
  assert.equal(thai?.name, "Thai Airways");
  assert.equal(thai?.iata, "TG");
  assert.equal(thai?.logoUrl, "https://images.kiwi.com/airlines/64x64/TG.png");

  const indigo = getAirlineByCallsign("IGO5224");
  assert.equal(indigo?.name, "IndiGo");
  assert.equal(indigo?.iata, "6E");

  const emirates = getAirlineByCallsign("UAE202");
  assert.equal(emirates?.name, "Emirates");
  assert.equal(emirates?.iata, "EK");
});

test("Aircraft Models: Resolves full model name by ICAO type", () => {
  assert.equal(getModelNameByType("B789"), "Boeing 787-9 Dreamliner");
  assert.equal(getModelNameByType("B77W"), "Boeing 777-300ER");
  assert.equal(getModelNameByType("A388"), "Airbus A380-800");
  assert.equal(getModelNameByType("A359"), "Airbus A350-900");
});

test("Flight Route Service: Resolves airline and route metadata for callsign", async () => {
  const route = await getFlightRoute("THA941");
  assert.ok(route);
  assert.ok(route.airline);
  assert.equal(route.airline.iata, "TG");
  assert.ok(route.airline.logoUrl.includes("TG.png"));
});
