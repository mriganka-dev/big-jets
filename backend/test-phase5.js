import assert from "assert";
import { app } from "./src/app.js";
import { config } from "./src/config.js";
import {
  _resetStoreForTesting,
  findUserByTelegramId,
  listSubscriptions,
  wasAlertSent,
} from "./src/store/store.js";
import {
  escapeHtml,
  handleUpdate,
} from "./src/services/telegram.js";
import {
  buildNotificationHtml,
  notify,
} from "./src/services/notifier.js";

async function runTests() {
  console.log("=== Testing Phase 5: Telegram Bot & Notifier ===");

  _resetStoreForTesting();

  // Test 1: HTML Escaping
  console.log("1. Testing HTML escaping...");
  const raw = "Boeing 777 <Heavy> & 'Special' > 100";
  const escaped = escapeHtml(raw);
  assert.strictEqual(escaped, "Boeing 777 &lt;Heavy&gt; &amp; 'Special' &gt; 100");
  console.log("  [PASS] HTML escaping is safe.");

  // Test 2: Telegram Webhook Secret Middleware & HTTP Route
  console.log("2. Testing Webhook route security...");
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 2a. Request without secret header -> 401
    const resNoHeader = await fetch(`${baseUrl}/api/telegram/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.strictEqual(resNoHeader.status, 401, "Should reject missing secret header with 401");

    // 2b. Request with wrong secret header -> 401
    const resWrongHeader = await fetch(`${baseUrl}/api/telegram/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "wrong-secret-token",
      },
      body: JSON.stringify({}),
    });
    assert.strictEqual(resWrongHeader.status, 401, "Should reject wrong secret header with 401");
    console.log("  [PASS] Webhook correctly rejects unauthorized calls.");
  } finally {
    server.close();
  }

  // Test 3: Command parsing and user / subscription creation
  console.log("3. Testing Telegram commands...");
  const testChatId = "99887766";

  // 3a. /start command
  await handleUpdate({
    message: {
      chat: { id: testChatId, type: "private" },
      text: "/start",
    },
  });
  const createdUser = findUserByTelegramId(testChatId);
  assert.ok(createdUser, "User should be created in store");
  assert.strictEqual(createdUser.telegramChatId, testChatId);
  console.log("  [PASS] /start creates user.");

  // 3b. /watch VECC all
  await handleUpdate({
    message: {
      chat: { id: testChatId, type: "private" },
      text: "/watch VECC all",
    },
  });
  let subs = listSubscriptions(createdUser.id);
  assert.strictEqual(subs.length, 1);
  assert.strictEqual(subs[0].airport, "VECC");
  assert.strictEqual(subs[0].filterType, "all_big");
  assert.strictEqual(subs[0].event, "both");
  assert.strictEqual(subs[0].channel, "telegram");
  console.log("  [PASS] /watch VECC all subscribed.");

  // 3c. /watch VECC fighters nearby 30
  await handleUpdate({
    message: {
      chat: { id: testChatId, type: "private" },
      text: "/watch VECC fighters nearby 30",
    },
  });
  subs = listSubscriptions(createdUser.id);
  assert.strictEqual(subs.length, 2);
  assert.strictEqual(subs[1].airport, "VECC");
  assert.strictEqual(subs[1].filterType, "category");
  assert.strictEqual(subs[1].filterValue, "MIL_FIGHTER");
  assert.strictEqual(subs[1].event, "nearby");
  assert.strictEqual(subs[1].radiusKm, 30);
  console.log("  [PASS] /watch VECC fighters nearby 30 subscribed.");

  // 3d. /watch VIDP A388 land both
  await handleUpdate({
    message: {
      chat: { id: testChatId, type: "private" },
      text: "/watch VIDP A388 land both",
    },
  });
  subs = listSubscriptions(createdUser.id);
  assert.strictEqual(subs.length, 3);
  assert.strictEqual(subs[2].airport, "VIDP");
  assert.strictEqual(subs[2].filterType, "type");
  assert.strictEqual(subs[2].filterValue, "A388");
  assert.strictEqual(subs[2].event, "land");
  assert.strictEqual(subs[2].channel, "both");
  console.log("  [PASS] /watch VIDP A388 land both subscribed.");

  // 3e. /stop 2 (removes second subscription)
  await handleUpdate({
    message: {
      chat: { id: testChatId, type: "private" },
      text: "/stop 2",
    },
  });
  subs = listSubscriptions(createdUser.id);
  assert.strictEqual(subs.length, 2);
  assert.strictEqual(subs[1].filterValue, "A388", "Second sub should now be A388");
  console.log("  [PASS] /stop 2 removed target subscription.");

  // 3f. /pause & /resume
  await handleUpdate({
    message: {
      chat: { id: testChatId, type: "private" },
      text: "/pause",
    },
  });
  assert.strictEqual(findUserByTelegramId(testChatId).paused, true);

  await handleUpdate({
    message: {
      chat: { id: testChatId, type: "private" },
      text: "/resume",
    },
  });
  assert.strictEqual(findUserByTelegramId(testChatId).paused, false);
  console.log("  [PASS] /pause and /resume toggle user state.");

  // 3g. /email user@example.com and /email off
  await handleUpdate({
    message: {
      chat: { id: testChatId, type: "private" },
      text: "/email alert@example.com",
    },
  });
  const userWithEmail = findUserByTelegramId(testChatId);
  assert.strictEqual(userWithEmail.email, "alert@example.com");

  await handleUpdate({
    message: {
      chat: { id: testChatId, type: "private" },
      text: "/email off",
    },
  });
  assert.strictEqual(findUserByTelegramId(testChatId).email, null);
  console.log("  [PASS] /email registration and /email off work.");

  // Test 4: Notification formatting & Deduplication
  console.log("4. Testing Notification formatting...");
  const mockEventLand = {
    airport: "VECC",
    type: "land",
    aircraft: {
      hex: "800abc",
      callsign: "AI101",
      reg: "VT-ALK",
      type: "B77W",
      model: "Boeing 777-300ER",
      operator: "Air India",
      altFt: 5200,
      onGround: false,
      speedKt: 160,
      vRate: -700,
      lat: 22.7,
      lon: 88.3,
      distKm: 14.2,
      phase: "approach",
      categories: ["BIG"],
    },
  };

  const formattedHtml = buildNotificationHtml(mockEventLand);
  console.log("Sample Generated Telegram HTML:\n" + formattedHtml);
  assert.ok(formattedHtml.includes("Landing soon at VECC"));
  assert.ok(formattedHtml.includes("Boeing 777-300ER (B77W)"));
  assert.ok(formattedHtml.includes("Air India AI101, VT-ALK"));
  assert.ok(formattedHtml.includes("5,200 ft, descending"));
  console.log("  [PASS] Notification HTML correctly constructed.");

  // Test 5: Notifier Deduplication
  console.log("5. Testing alert delivery deduplication...");
  const userObj = findUserByTelegramId(testChatId);
  const subObj = subs[0];

  await notify(subObj, userObj, mockEventLand);
  // Without real Telegram credentials, notify handles error gracefully
  // Let's verify wasAlertSent logic
  assert.strictEqual(
    wasAlertSent({
      userId: userObj.id,
      hex: mockEventLand.aircraft.hex,
      event: "land",
      channel: "telegram",
      airport: "VECC",
    }),
    false // false because without real Telegram API token, sending throws and alert is not recorded
  );
  console.log("  [PASS] Alerts are only recorded on successful delivery.");

  console.log("\n=== ALL PHASE 5 TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
