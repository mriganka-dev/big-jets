import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import * as store from "../src/store/store.js";
import { LIMITS } from "../src/constants.js";
import {
  roundRadius,
  fetchAircraftForAirport,
  _resetAdsbState,
  _resetUpstreamTimestamps,
  _getAdsbCacheSize,
  _getUpstreamTimestampsCount,
} from "../src/utils/adsb.js";
import { listWatchedAirportsByFrequency } from "../src/store/store.js";

const tempStorePath = path.join(
  os.tmpdir(),
  `test-protection-store-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
);

const originalFetch = globalThis.fetch;

test.before(() => {
  store.setStorePath(tempStorePath);
});

test.after(() => {
  globalThis.fetch = originalFetch;
  try {
    if (fs.existsSync(tempStorePath)) fs.unlinkSync(tempStorePath);
  } catch {}
});

test("Protection: Radius step rounding maps to allowed steps", () => {
  assert.equal(roundRadius(5), 10);
  assert.equal(roundRadius(14), 10);
  assert.equal(roundRadius(18), 25);
  assert.equal(roundRadius(38), 40);
  assert.equal(roundRadius(42), 40);
  assert.equal(roundRadius(58), 60);
  assert.equal(roundRadius(75), 80);
  assert.equal(roundRadius(95), 100);
});

test("Protection: In-flight requests are shared for identical key", async () => {
  _resetAdsbState();
  let fetchCallCount = 0;

  globalThis.fetch = async () => {
    fetchCallCount++;
    // Simulate slight network latency
    await new Promise((r) => setTimeout(r, 20));
    return {
      ok: true,
      json: async () => ({ ac: [] }),
    };
  };

  const fakeAirport = {
    icao: "TEST",
    lat: 10,
    lon: 20,
    elevationFt: 0,
  };

  // Launch 10 concurrent requests for the same airport
  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(fetchAircraftForAirport(fakeAirport, 40));
  }

  const results = await Promise.all(promises);
  assert.equal(results.length, 10);
  assert.equal(
    fetchCallCount,
    1,
    "Expected 1 upstream request for 10 concurrent calls"
  );
});

test("Protection: Cache size is strictly capped at MAX_CACHE_ENTRIES", async () => {
  _resetAdsbState();

  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ ac: [] }),
  });

  const maxEntries = LIMITS.MAX_CACHE_ENTRIES; // 300
  assert(maxEntries > 0);

  // Request 320 distinct airports sequentially, resetting upstream quota to isolate cache test
  for (let i = 0; i < maxEntries + 20; i++) {
    _resetUpstreamTimestamps();
    const ap = {
      icao: `T${String(i).padStart(3, "0")}`,
      lat: (i % 80) - 40,
      lon: (i % 160) - 80,
      elevationFt: 0,
    };
    await fetchAircraftForAirport(ap, 40);
  }

  const size = _getAdsbCacheSize();
  assert(
    size <= maxEntries,
    `Cache size (${size}) exceeded MAX_CACHE_ENTRIES (${maxEntries})`
  );
});

test("Protection: Global upstream limit triggers 503 or serves stale cache", async () => {
  _resetAdsbState();

  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ ac: [] }),
  });

  const airportA = { icao: "AAAA", lat: 10, lon: 10, elevationFt: 0 };
  const airportB = { icao: "BBBB", lat: 20, lon: 20, elevationFt: 0 };

  // Prime cache for airport A
  await fetchAircraftForAirport(airportA, 40);

  // Max out the 120 upstream requests
  const maxUpstream = LIMITS.MAX_UPSTREAM_REQUESTS_PER_MINUTE; // 120
  for (let i = _getUpstreamTimestampsCount(); i < maxUpstream; i++) {
    const ap = {
      icao: `U${String(i).padStart(3, "0")}`,
      lat: 1,
      lon: 1,
      elevationFt: 0,
    };
    await fetchAircraftForAirport(ap, 40);
  }

  assert.equal(_getUpstreamTimestampsCount(), maxUpstream);

  // When limit is reached:
  // 1. Airport A has cached data -> should return cached data successfully
  const staleData = await fetchAircraftForAirport(airportA, 40);
  assert(Array.isArray(staleData));

  // 2. Airport B has no cached data -> should reject with 503 status
  await assert.rejects(
    async () => {
      await fetchAircraftForAirport(airportB, 40);
    },
    (err) => {
      assert.equal(err.statusCode, 503);
      assert(err.message.includes("limit exceeded"));
      return true;
    }
  );
});

test("Protection: Poller watched airports cap prioritizes highest subscription frequency", () => {
  // Create 37 distinct users subscribing to various airports (30 unique airports total)
  const users = [];
  for (let i = 0; i < 37; i++) {
    users.push(store.createUser({ telegramChatId: `tg_prot_${i}` }));
  }

  // Subscribe users 0-4 to EGLL (5 subscriptions)
  for (let i = 0; i < 5; i++) {
    store.addSubscription({
      userId: users[i].id,
      airport: "EGLL",
      filterType: "all_big",
      filterValue: null,
      event: "both",
      channel: "telegram",
    });
  }

  // Subscribe users 5-8 to KJFK (4 subscriptions)
  for (let i = 5; i < 9; i++) {
    store.addSubscription({
      userId: users[i].id,
      airport: "KJFK",
      filterType: "all_big",
      filterValue: null,
      event: "both",
      channel: "telegram",
    });
  }

  // Subscribe users 9-36 to 28 unique airport codes (1 subscription each)
  for (let i = 9; i < 37; i++) {
    store.addSubscription({
      userId: users[i].id,
      airport: `AP${i}`,
      filterType: "all_big",
      filterValue: null,
      event: "both",
      channel: "telegram",
    });
  }

  const frequencyList = listWatchedAirportsByFrequency();
  assert.equal(frequencyList.length, 30); // 1 (EGLL) + 1 (KJFK) + 28 (AP9..AP36)

  // Verify EGLL is #1 with highest count, KJFK is #2
  assert.equal(frequencyList[0].airport, "EGLL");
  assert.equal(frequencyList[0].count, 5);
  assert.equal(frequencyList[1].airport, "KJFK");
  assert.equal(frequencyList[1].count, 4);

  // Poller capping to MAX_POLLER_AIRPORTS (25)
  const capped = frequencyList.slice(0, LIMITS.MAX_POLLER_AIRPORTS);
  assert.equal(capped.length, LIMITS.MAX_POLLER_AIRPORTS);
  assert.equal(capped[0].airport, "EGLL");
});
