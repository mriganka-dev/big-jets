import fs from "fs";
import path from "path";
import assert from "assert";
import * as store from "./src/store/store.js";
import { generateToken, hashToken } from "./src/utils/tokens.js";
import { config } from "./src/config.js";

async function runTests() {
  console.log("--- Starting Store Test Suite ---");

  const storePath = path.resolve(config.storePath);

  // Initialize clean test store
  store._resetStoreForTesting();

  console.log("1. Testing User Operations...");
  const user1 = store.createUser({ telegramChatId: "123456" });
  assert(user1.id.startsWith("u_"), "User ID should have prefix u_");
  assert.strictEqual(user1.telegramChatId, "123456");
  assert.strictEqual(user1.paused, false);

  // Idempotent user creation
  const user1Again = store.createUser({ telegramChatId: "123456" });
  assert.strictEqual(user1Again.id, user1.id);

  // User queries & modifications
  const foundUser = store.findUserByTelegramId("123456");
  assert.strictEqual(foundUser.id, user1.id);

  const updatedUserEmail = store.setUserEmail(user1.id, "Test@Example.COM");
  assert.strictEqual(updatedUserEmail.email, "test@example.com");
  assert.strictEqual(updatedUserEmail.emailVerified, false);

  const verifiedUser = store.markEmailVerified(user1.id);
  assert.strictEqual(verifiedUser.emailVerified, true);

  const pausedUser = store.setUserPaused(user1.id, true);
  assert.strictEqual(pausedUser.paused, true);

  store.setUserPaused(user1.id, false); // unpause

  // 2. Immutability check
  console.log("2. Testing Immutability (copies returned)...");
  const userCopy = store.findUserById(user1.id);
  userCopy.email = "hacked@example.com";
  const userFresh = store.findUserById(user1.id);
  assert.strictEqual(userFresh.email, "test@example.com");

  // 3. Subscription operations
  console.log("3. Testing Subscription Operations...");
  const sub1 = store.addSubscription({
    userId: user1.id,
    airport: "VECC",
    filterType: "category",
    filterValue: "MIL_FIGHTER",
    event: "nearby",
    radiusKm: 30,
    channel: "both",
  });
  assert(sub1.id.startsWith("s_"), "Sub ID should start with s_");
  assert.strictEqual(sub1.airport, "VECC");
  assert.strictEqual(sub1.filterValue, "MIL_FIGHTER");

  const sub2 = store.addSubscription({
    userId: user1.id,
    airport: "vidp",
    filterType: "all_big",
    event: "land",
    channel: "telegram",
  });
  assert.strictEqual(sub2.airport, "VIDP");

  const userSubs = store.listSubscriptions(user1.id);
  assert.strictEqual(userSubs.length, 2);

  const veccSubs = store.listSubscriptionsForAirport("vecc");
  assert.strictEqual(veccSubs.length, 1);
  assert.strictEqual(veccSubs[0].id, sub1.id);

  const watchedAirports = store.listWatchedAirports();
  assert(watchedAirports.includes("VECC"));
  assert(watchedAirports.includes("VIDP"));

  // 4. Subscriptions limit test (max 10 per user)
  console.log("4. Testing Subscription Limit (max 10)...");
  for (let i = 0; i < 8; i++) {
    store.addSubscription({
      userId: user1.id,
      airport: "VABB",
      filterType: "all_big",
      event: "both",
    });
  }
  assert.strictEqual(store.listSubscriptions(user1.id).length, 10);

  assert.throws(() => {
    store.addSubscription({
      userId: user1.id,
      airport: "VOMM",
      filterType: "all_big",
      event: "both",
    });
  }, /maximum subscriptions limit/);

  // Remove subscription
  const removed = store.removeSubscription(user1.id, sub2.id);
  assert.strictEqual(removed, true);
  assert.strictEqual(store.listSubscriptions(user1.id).length, 9);

  // 5. Alert tracking
  console.log("5. Testing Alert Tracking...");
  assert.strictEqual(
    store.wasAlertSent({
      userId: user1.id,
      hex: "800abc",
      event: "land",
      channel: "telegram",
      airport: "VECC",
    }),
    false
  );

  store.recordAlert({
    userId: user1.id,
    hex: "800ABC",
    event: "land",
    airport: "VECC",
    channel: "telegram",
  });

  assert.strictEqual(
    store.wasAlertSent({
      userId: user1.id,
      hex: "800abc",
      event: "land",
      channel: "telegram",
      airport: "VECC",
    }),
    true
  );

  // 6. Email token operations
  console.log("6. Testing Email Tokens...");
  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  store.saveEmailToken(user1.id, tokenHash, expiresAt);

  // Consuming valid token
  const consumed = store.consumeEmailToken(tokenHash);
  assert(consumed !== null);
  assert.strictEqual(consumed.userId, user1.id);

  // Re-consuming same token should return null (single use)
  const consumedAgain = store.consumeEmailToken(tokenHash);
  assert.strictEqual(consumedAgain, null);

  // Expired token test
  const expiredRawToken = generateToken();
  const expiredHash = hashToken(expiredRawToken);
  store.saveEmailToken(user1.id, expiredHash, new Date(Date.now() - 1000));
  const consumedExpired = store.consumeEmailToken(expiredHash);
  assert.strictEqual(consumedExpired, null);

  // 7. Housekeeping & Pruning
  console.log("7. Testing Housekeeping / Prune...");
  const pruneRes = store.pruneOldData();
  assert(typeof pruneRes.prunedAlerts === "number");
  assert(typeof pruneRes.prunedTokens === "number");

  // 8. Disk persistence & saveNow
  console.log("8. Testing Disk Persistence...");
  store.saveNow();
  assert(fs.existsSync(storePath), "store.json must exist on disk");
  const diskData = JSON.parse(fs.readFileSync(storePath, "utf8"));
  assert(Array.isArray(diskData.users) && diskData.users.length > 0);
  assert(
    Array.isArray(diskData.subscriptions) && diskData.subscriptions.length > 0
  );

  console.log("All Store Tests PASSED successfully!");
}

runTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
