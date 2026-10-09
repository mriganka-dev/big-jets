import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyAircraft,
  determinePhase,
  formatAircraft,
} from "../src/utils/classifier.js";
import { CATEGORIES, AIRPORTS } from "../src/constants.js";

test("Classifier: Aircraft categorization", () => {
  // A380 is both BIG and RARE
  const a388Cats = classifyAircraft("A388", "A6-EEO", false);
  assert(a388Cats.includes(CATEGORIES.BIG));
  assert(a388Cats.includes(CATEGORIES.RARE));

  // Su-30 with military flag
  const su30Cats = classifyAircraft("SU30", "SB001", true);
  assert(a388Cats.includes(CATEGORIES.BIG));
  assert(su30Cats.includes(CATEGORIES.MIL_FIGHTER));

  // VIP Jet
  const glf6Cats = classifyAircraft("GLF6", "N1234", false);
  assert(glf6Cats.includes(CATEGORIES.VIP_JET));
});

test("Classifier: Flight phase determination", () => {
  // Approach: close distance, low altitude, negative vertical rate
  const approachPhase = determinePhase({
    altFt: 2500,
    onGround: false,
    speedKt: 140,
    vRate: -600,
    distKm: 12,
    airportElevationFt: 16,
  });
  assert.equal(approachPhase, "approach");

  // Ground phase
  const groundPhase = determinePhase({
    altFt: 16,
    onGround: true,
    speedKt: 15,
    vRate: 0,
    distKm: 1,
    airportElevationFt: 16,
  });
  assert.equal(groundPhase, "ground");

  // Departing phase
  const departingPhase = determinePhase({
    altFt: 4000,
    onGround: false,
    speedKt: 220,
    vRate: 1500,
    distKm: 20,
    airportElevationFt: 16,
  });
  assert.equal(departingPhase, "departing");
});
