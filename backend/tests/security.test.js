import test from "node:test";
import assert from "node:assert/strict";
import { telegramSecretMiddleware } from "../src/middlewares/telegramSecret.js";
import { config } from "../src/config.js";
import { errorHandler } from "../src/middlewares/errorHandler.js";
import { handleUpdate } from "../src/services/telegram.js";

test("Security: Webhook secret timing-safe verification", () => {
  const secret =
    config.telegram.webhookSecret || "test_secret_for_middleware_32chars_len";
  config.telegram.webhookSecret = secret;

  function runMiddleware(header) {
    let nextCalled = false;
    const req = {
      headers: header ? { "x-telegram-bot-api-secret-token": header } : {},
    };
    let statusCode = 200;
    let responseBody = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        responseBody = body;
        return this;
      },
    };
    telegramSecretMiddleware(req, res, () => {
      nextCalled = true;
    });
    return { nextCalled, statusCode, responseBody };
  }

  // Missing header -> 401
  assert.equal(runMiddleware(undefined).statusCode, 401);

  // Wrong secret -> 401
  assert.equal(
    runMiddleware("wrong_secret_length_matches_ok_32ch").statusCode,
    401
  );

  // Short secret -> 401
  assert.equal(runMiddleware("short").statusCode, 401);

  // Correct secret -> calls next()
  assert.equal(runMiddleware(secret).nextCalled, true);
});

test("Security: Error handler sanitizes URL path and excludes query tokens", () => {
  let loggedOutput = "";
  const originalError = console.error;
  console.error = (msg) => {
    loggedOutput = msg;
  };

  const fakeReq = {
    method: "GET",
    path: "/api/email/verify",
    originalUrl: "/api/email/verify?token=SENSITIVE_TOKEN_12345",
    url: "/api/email/verify?token=SENSITIVE_TOKEN_12345",
  };

  const fakeRes = {
    status(c) {
      this.code = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };

  errorHandler(new Error("Test error"), fakeReq, fakeRes, () => {});
  console.error = originalError;

  assert(loggedOutput.includes("GET /api/email/verify failed"));
  assert(!loggedOutput.includes("SENSITIVE_TOKEN_12345"));
});

test("Security: Telegram allow-list check with message.from.id and masked logs", async () => {
  config.telegram.allowedUserIds = ["123456"];

  let warnLogged = "";
  const originalWarn = console.warn;
  console.warn = (msg) => {
    warnLogged = msg;
  };

  // Unauthorized user
  await handleUpdate({
    message: {
      chat: { id: 999999, type: "private" },
      from: { id: 999999 },
      text: "/help",
    },
  });

  console.warn = originalWarn;
  assert(warnLogged.includes("Unauthorized Telegram access attempt"));
  assert(warnLogged.includes("...9999"));
});
