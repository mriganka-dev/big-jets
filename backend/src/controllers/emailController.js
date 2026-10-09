import { hashToken } from "../utils/tokens.js";
import {
  consumeEmailToken,
  markEmailVerified,
  markEmailUnsubscribed,
} from "../store/store.js";
import { hexTokenSchema } from "../utils/validators.js";

const VERIFY_HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Verification - Big Jets</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background-color: #0f172a;
      color: #f8fafc;
    }
    .card {
      background-color: #1e293b;
      padding: 2.5rem;
      border-radius: 12px;
      max-width: 420px;
      text-align: center;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
      border: 1px solid #334155;
    }
    h1 {
      font-size: 1.35rem;
      margin-top: 0;
      margin-bottom: 0.75rem;
      color: #38bdf8;
    }
    p {
      color: #94a3b8;
      font-size: 0.95rem;
      line-height: 1.5;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Email Verification</h1>
    <p>If the verification link was valid and not expired, your email address has been confirmed and alert delivery is enabled.</p>
  </div>
</body>
</html>`;

const UNSUBSCRIBE_HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribe - Big Jets</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background-color: #0f172a;
      color: #f8fafc;
    }
    .card {
      background-color: #1e293b;
      padding: 2.5rem;
      border-radius: 12px;
      max-width: 420px;
      text-align: center;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
      border: 1px solid #334155;
    }
    h1 {
      font-size: 1.35rem;
      margin-top: 0;
      margin-bottom: 0.75rem;
      color: #38bdf8;
    }
    p {
      color: #94a3b8;
      font-size: 0.95rem;
      line-height: 1.5;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Email Notifications</h1>
    <p>If the unsubscribe link was valid, your email alert preferences have been updated and you will no longer receive alert emails.</p>
  </div>
</body>
</html>`;

export function verifyEmail(req, res) {
  const rawToken = req.query?.token;
  const tokenParse = hexTokenSchema.safeParse(rawToken);

  if (tokenParse.success) {
    const tokenHash = hashToken(tokenParse.data);
    const matchedToken = consumeEmailToken(tokenHash);

    if (matchedToken) {
      markEmailVerified(matchedToken.userId);
    }
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(VERIFY_HTML_PAGE);
}

export function unsubscribeEmail(req, res) {
  const rawToken = req.query?.token;
  const tokenParse = hexTokenSchema.safeParse(rawToken);

  if (tokenParse.success) {
    const tokenHash = hashToken(tokenParse.data);
    const matchedToken = consumeEmailToken(tokenHash);

    if (matchedToken) {
      markEmailUnsubscribed(matchedToken.userId);
    }
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(UNSUBSCRIBE_HTML_PAGE);
}
