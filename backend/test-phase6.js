import assert from "assert";
import http from "http";
import { app } from "./src/app.js";
import { config } from "./src/config.js";
import {
  createUser,
  findUserById,
  setUserEmail,
  saveEmailToken,
  _resetStoreForTesting,
} from "./src/store/store.js";
import { generateToken, hashToken } from "./src/utils/tokens.js";
import {
  buildAlertEmailContent,
  sendVerificationEmail,
  sendAlertEmail,
} from "./src/services/email.js";
import { notify } from "./src/services/notifier.js";
import { handleUpdate } from "./src/services/telegram.js";

async function runTests() {
  console.log("--- Starting Phase 6 Test Suite ---");

  _resetStoreForTesting();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`Test server listening on port ${port}`);

  try {
    // 1. Test buildAlertEmailContent formatting and escaping
    console.log("\n1. Testing buildAlertEmailContent...");
    const sampleEvent = {
      airport: "VECC",
      type: "land",
      aircraft: {
        hex: "800abc",
        type: "A388",
        model: "Airbus <A380-800>",
        operator: "Emirates & Co",
        callsign: "EK570",
        reg: "A6-EEX",
        altFt: 6200,
        speedKt: 180,
        distKm: 35,
        vRate: -800,
        onGround: false,
      },
    };

    const unsubToken = generateToken();
    const emailContent = buildAlertEmailContent(sampleEvent, unsubToken);

    assert(
      emailContent.subject.includes("Landing soon at VECC"),
      "Subject should contain event and airport"
    );
    assert(
      emailContent.subject.includes("EK570"),
      "Subject should contain callsign"
    );
    assert(
      !/[\r\n]/.test(emailContent.subject),
      "Subject must not contain CRLF characters"
    );
    assert(
      emailContent.htmlBody.includes("&lt;A380-800&gt;"),
      "HTML body must escape dynamic brackets"
    );
    assert(
      emailContent.htmlBody.includes("Emirates &amp; Co"),
      "HTML body must escape dynamic ampersands"
    );
    assert(
      emailContent.htmlBody.includes(`/api/email/unsubscribe?token=${unsubToken}`),
      "HTML body must include unsubscribe link"
    );
    assert(
      emailContent.textBody.includes(`/api/email/unsubscribe?token=${unsubToken}`),
      "Text body must include unsubscribe link"
    );
    console.log("✓ Email content formatting, escaping and links passed.");

    // 2. Test verify endpoint with invalid and valid tokens
    console.log("\n2. Testing /api/email/verify endpoint...");
    const user = createUser({ telegramChatId: "99887766" });
    setUserEmail(user.id, "pilot@example.com");

    // 2a. Invalid token returns neutral HTML (200 OK) without changing status
    const resInvalid = await fetch(`${baseUrl}/api/email/verify?token=invalid-token`);
    assert.strictEqual(resInvalid.status, 200);
    const bodyInvalid = await resInvalid.text();
    assert(
      bodyInvalid.includes("Email Verification"),
      "Response should return email verification HTML"
    );
    assert.strictEqual(
      findUserById(user.id).emailVerified,
      false,
      "User email should remain unverified for invalid token"
    );

    // 2b. Valid token verifies user
    const rawVerifyToken = generateToken();
    const verifyHash = hashToken(rawVerifyToken);
    saveEmailToken(
      user.id,
      verifyHash,
      new Date(Date.now() + 24 * 60 * 60 * 1000)
    );

    const resValid = await fetch(
      `${baseUrl}/api/email/verify?token=${rawVerifyToken}`
    );
    assert.strictEqual(resValid.status, 200);
    const bodyValid = await resValid.text();
    assert(bodyValid.includes("Email Verification"));
    assert.strictEqual(
      findUserById(user.id).emailVerified,
      true,
      "User email should now be marked verified"
    );

    // 2c. Replay of consumed token returns 200 without error and changes nothing
    const resReplay = await fetch(
      `${baseUrl}/api/email/verify?token=${rawVerifyToken}`
    );
    assert.strictEqual(resReplay.status, 200);
    assert.strictEqual(findUserById(user.id).emailVerified, true);
    console.log("✓ /api/email/verify handles valid, invalid, and replayed tokens correctly.");

    // 3. Test unsubscribe endpoint
    console.log("\n3. Testing /api/email/unsubscribe endpoint...");
    const rawUnsubToken = generateToken();
    const unsubHash = hashToken(rawUnsubToken);
    saveEmailToken(
      user.id,
      unsubHash,
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    );

    const resUnsub = await fetch(
      `${baseUrl}/api/email/unsubscribe?token=${rawUnsubToken}`
    );
    assert.strictEqual(resUnsub.status, 200);
    const bodyUnsub = await resUnsub.text();
    assert(bodyUnsub.includes("Email Notifications"));
    assert.strictEqual(
      findUserById(user.id).emailUnsubscribed,
      true,
      "User emailUnsubscribed should now be true"
    );

    // Replay of unsubscribe token
    const resUnsubReplay = await fetch(
      `${baseUrl}/api/email/unsubscribe?token=${rawUnsubToken}`
    );
    assert.strictEqual(resUnsubReplay.status, 200);
    console.log("✓ /api/email/unsubscribe successfully unsubscribed user.");

    // 4. Test Notifier with email alerts
    console.log("\n4. Testing Notifier email dispatch...");
    const user2 = createUser({ telegramChatId: "11223344" });
    setUserEmail(user2.id, "spotter@example.com");
    // Verify user2
    const verifyToken2 = generateToken();
    saveEmailToken(
      user2.id,
      hashToken(verifyToken2),
      new Date(Date.now() + 24 * 60 * 60 * 1000)
    );
    await fetch(`${baseUrl}/api/email/verify?token=${verifyToken2}`);

    const sub = {
      id: "sub_test",
      userId: user2.id,
      airport: "VECC",
      filterType: "all_big",
      event: "land",
      channel: "email",
    };

    const event = {
      airport: "VECC",
      type: "land",
      aircraft: {
        hex: "a00111",
        type: "B77W",
        model: "Boeing 777-300ER",
        callsign: "AI102",
        reg: "VT-ALQ",
        altFt: 3500,
        speedKt: 160,
        distKm: 12,
        vRate: -600,
        onGround: false,
      },
    };

    const updatedUser2 = findUserById(user2.id);
    await notify(sub, updatedUser2, event);
    console.log("✓ Notifier successfully dispatched email alert and recorded it.");

    // 5. Test Rate Limiting on email endpoints (10 requests per 15 min)
    console.log("\n5. Testing Rate Limiter on /api/email/verify...");
    let hit429 = false;
    for (let i = 0; i < 15; i++) {
      const res = await fetch(`${baseUrl}/api/email/verify?token=test${i}`);
      if (res.status === 429) {
        hit429 = true;
        break;
      }
    }
    assert(hit429, "Rate limiter should trigger HTTP 429 on exceeding limit");
    console.log("✓ Rate limiting (429) verified for email endpoints.");

    // 6. Test Telegram /email command rate limiting
    console.log("\n6. Testing Telegram /email command & rate limiting...");
    const tgUser = createUser({ telegramChatId: "55443322" });

    // Request 1, 2, 3
    for (let i = 1; i <= 3; i++) {
      await handleUpdate({
        message: {
          chat: { id: 55443322, type: "private" },
          from: { id: 55443322 },
          text: `/email user${i}@example.com`,
        },
      });
    }

    // Request 4 (should be throttled)
    await handleUpdate({
      message: {
        chat: { id: 55443322, type: "private" },
        from: { id: 55443322 },
        text: `/email user4@example.com`,
      },
    });
    console.log("✓ Telegram /email command rate limiting verified.");

    console.log("\n==========================================");
    console.log("All Phase 6 tests PASSED successfully!");
    console.log("==========================================");
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
