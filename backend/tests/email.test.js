import test from "node:test";
import assert from "node:assert/strict";
import os from "os";
import path from "path";
import fs from "fs";
import * as store from "../src/store/store.js";
import { generateToken, hashToken } from "../src/utils/tokens.js";
import {
  escapeHtml as escapeEmailHtml,
  buildAlertEmailContent,
} from "../src/services/email.js";
import {
  showVerifyPage,
  confirmVerifyEmail,
  showUnsubscribePage,
  confirmUnsubscribeEmail,
} from "../src/controllers/emailController.js";

const tempStorePath = path.join(
  os.tmpdir(),
  `test-email-store-${Date.now()}.json`
);

test.before(() => {
  store.setStorePath(tempStorePath);
});

test.after(() => {
  try {
    if (fs.existsSync(tempStorePath)) fs.unlinkSync(tempStorePath);
  } catch {}
});

function mockRes() {
  return {
    headers: {},
    statusCode: 200,
    body: "",
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
}

test("Email: Full quote escaping in email templates", () => {
  const input = `<script>alert("xss")</script> and 'quotes'`;
  const escaped = escapeEmailHtml(input);
  assert.equal(
    escaped,
    `&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; and &#39;quotes&#39;`
  );
});

test("Email: GET confirmation page does not mutate store; POST does", () => {
  const user = store.createUser({ telegramChatId: "555000" });
  store.setUserEmail(user.id, "subscriber@example.com");

  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  store.saveEmailToken(
    user.id,
    tokenHash,
    new Date(Date.now() + 60000),
    "verify",
    "subscriber@example.com"
  );

  // 1. GET request
  const getRes = mockRes();
  showVerifyPage({ query: { token: rawToken } }, getRes);

  assert.equal(getRes.statusCode, 200);
  assert.equal(getRes.headers["Cache-Control"], "no-store");
  assert(
    getRes.body.includes('<form method="POST" action="/api/email/verify">')
  );
  assert.equal(store.findUserById(user.id).emailVerified, false);

  // 2. POST request with body
  const postRes = mockRes();
  confirmVerifyEmail({ body: { token: rawToken } }, postRes);

  assert.equal(postRes.statusCode, 200);
  assert.equal(postRes.headers["Cache-Control"], "no-store");
  assert.equal(store.findUserById(user.id).emailVerified, true);

  // 3. Repeated POST request with same token fails with 400
  const postAgainRes = mockRes();
  confirmVerifyEmail({ body: { token: rawToken } }, postAgainRes);
  assert.equal(postAgainRes.statusCode, 400);
});

test("Email: Unsubscribe GET and POST flow", () => {
  const user = store.createUser({ telegramChatId: "555111" });
  store.setUserEmail(user.id, "unsub@example.com");
  store.markEmailVerified(user.id);

  const rawUnsub = generateToken();
  const unsubHash = hashToken(rawUnsub);
  store.saveEmailToken(
    user.id,
    unsubHash,
    new Date(Date.now() + 60000),
    "unsubscribe"
  );

  // GET confirmation
  const getRes = mockRes();
  showUnsubscribePage({ query: { token: rawUnsub } }, getRes);
  assert.equal(getRes.statusCode, 200);
  assert.equal(store.findUserById(user.id).emailUnsubscribed, false);

  // POST confirm
  const postRes = mockRes();
  confirmUnsubscribeEmail({ body: { token: rawUnsub } }, postRes);
  assert.equal(postRes.statusCode, 200);
  assert.equal(store.findUserById(user.id).emailUnsubscribed, true);
});
