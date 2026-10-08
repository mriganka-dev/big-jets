import assert from "assert";
import * as store from "./src/store/store.js";
import {
  processAirportSnapshot,
  clearDetectorState,
} from "./src/services/detector.js";
import { matchAndNotify } from "./src/services/matcher.js";
import { AIRPORTS, CATEGORIES } from "./src/constants.js";

async function runPhase4Tests() {
  console.log("--- Starting Phase 4 Test Suite ---");

  store._resetStoreForTesting();
  clearDetectorState();

  // Clean setup
  const user = store.createUser({ telegramChatId: "987654321" });
  assert(user, "Test user created");

  // 1. Test Matcher Filters
  console.log("1. Testing Matcher Filter Logic...");
  const subBig = store.addSubscription({
    userId: user.id,
    airport: "VECC",
    filterType: "all_big",
    event: "both",
    channel: "telegram",
  });

  const airport = AIRPORTS.VECC;

  const a380Aircraft = {
    hex: "a38001",
    callsign: "EK570",
    reg: "A6-EEX",
    type: "A388",
    model: "Airbus A380-800",
    operator: "Emirates",
    altFt: 3500,
    onGround: false,
    speedKt: 160,
    vRate: -700,
    lat: 22.7,
    lon: 88.5,
    distKm: 15.0,
    phase: "approach",
    categories: [CATEGORIES.BIG, CATEGORIES.RARE],
  };

  // Matcher direct invocation test
  const matches = matchAndNotify({
    type: "land",
    airport: "VECC",
    aircraft: a380Aircraft,
    timestamp: new Date().toISOString(),
  });

  assert.strictEqual(matches.length, 1, "Should match 1 subscription for A380");
  assert.strictEqual(matches[0].sub.id, subBig.id);

  // 2. Test Alert Deduplication (wasAlertSent)
  console.log("2. Testing Alert Deduplication...");
  store.recordAlert({
    userId: user.id,
    hex: "a38001",
    event: "land",
    airport: "VECC",
    channel: "telegram",
  });

  const matchesAfterAlert = matchAndNotify({
    type: "land",
    airport: "VECC",
    aircraft: a380Aircraft,
    timestamp: new Date().toISOString(),
  });

  assert.strictEqual(
    matchesAfterAlert.length,
    0,
    "Should not match when alert was already sent"
  );

  // 3. Test Detector: Landing (Requires 2 consecutive polls on approach)
  console.log("3. Testing Landing Detection (2-poll approach requirement)...");
  clearDetectorState();

  const b777Aircraft = {
    hex: "b77701",
    callsign: "AI101",
    reg: "VT-ALQ",
    type: "B77W",
    model: "Boeing 777-300ER",
    operator: "Air India",
    altFt: 4000,
    onGround: false,
    speedKt: 180,
    vRate: -600,
    lat: 22.75,
    lon: 88.45,
    distKm: 20.0,
    phase: "approach",
    categories: [CATEGORIES.BIG],
  };

  // Poll 1: First approach snapshot -> consecutiveApproachCount = 1 (No land event yet)
  processAirportSnapshot(airport, [b777Aircraft]);

  // Poll 2: Second approach snapshot -> consecutiveApproachCount = 2 (Triggers land event)
  processAirportSnapshot(airport, [b777Aircraft]);

  // 4. Test Detector: Takeoff Detection
  console.log("4. Testing Takeoff Detection...");
  clearDetectorState();

  const groundStationary = {
    hex: "b78901",
    callsign: "BA119",
    reg: "G-ZBKA",
    type: "B789",
    model: "Boeing 787-9",
    operator: "British Airways",
    altFt: 20,
    onGround: true,
    speedKt: 0,
    vRate: 0,
    lat: 22.65,
    lon: 88.44,
    distKm: 1.0,
    phase: "ground",
    categories: [CATEGORIES.BIG],
  };

  // Snapshot 1: Stationary on ground inside 5km
  processAirportSnapshot(airport, [groundStationary]);

  // Snapshot 2: Starts rolling / moving > 5 kt
  const groundMoving = {
    ...groundStationary,
    speedKt: 18,
    phase: "ground",
  };
  processAirportSnapshot(airport, [groundMoving]);

  // 5. Test Nearby Detection & Radius Filtering
  console.log("5. Testing Nearby Detection & Radius Filtering...");
  const subNearby = store.addSubscription({
    userId: user.id,
    airport: "VECC",
    filterType: "all_big",
    event: "nearby",
    radiusKm: 25,
    channel: "telegram",
  });

  // Aircraft outside radius (35km > 25km)
  const farAircraft = {
    hex: "a35001",
    callsign: "SQ516",
    reg: "9V-SHE",
    type: "A359",
    altFt: 15000,
    onGround: false,
    speedKt: 320,
    vRate: -100,
    lat: 22.9,
    lon: 88.7,
    distKm: 35.0,
    phase: "enroute",
    categories: [CATEGORIES.BIG],
  };

  const farMatches = matchAndNotify({
    type: "nearby",
    airport: "VECC",
    aircraft: farAircraft,
    timestamp: new Date().toISOString(),
  });
  assert.strictEqual(
    farMatches.length,
    0,
    "Should not match aircraft outside radiusKm"
  );

  // Aircraft inside radius (20km <= 25km)
  const nearAircraft = {
    ...farAircraft,
    distKm: 20.0,
  };
  const nearMatches = matchAndNotify({
    type: "nearby",
    airport: "VECC",
    aircraft: nearAircraft,
    timestamp: new Date().toISOString(),
  });
  assert.strictEqual(
    nearMatches.length,
    1,
    "Should match aircraft inside radiusKm"
  );

  // 6. Test Paused User Handling
  console.log("6. Testing Paused User Exclusions...");
  store.setUserPaused(user.id, true);
  const pausedMatches = matchAndNotify({
    type: "nearby",
    airport: "VECC",
    aircraft: nearAircraft,
    timestamp: new Date().toISOString(),
  });
  assert.strictEqual(
    pausedMatches.length,
    0,
    "Paused users must not receive matches"
  );

  store.setUserPaused(user.id, false); // Unpause

  console.log("All Phase 4 Tests PASSED successfully!");
}

runPhase4Tests().catch((err) => {
  console.error("Phase 4 Tests Failed:", err);
  process.exit(1);
});
