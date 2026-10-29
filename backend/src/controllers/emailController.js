import { hashToken } from "../utils/tokens.js";
import {
  findUserById,
  consumeEmailToken,
  markEmailVerified,
  markEmailUnsubscribed,
} from "../store/store.js";
import { hexTokenSchema } from "../utils/validators.js";

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderCardPage({
  title,
  heading,
  message,
  buttonText,
  postAction,
  token,
}) {
  const formHtml =
    buttonText && postAction && token
      ? `<form method="POST" action="${escapeHtml(postAction)}">
          <input type="hidden" name="token" value="${escapeHtml(token)}">
          <button type="submit">${escapeHtml(buttonText)}</button>
        </form>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Big Jets</title>
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
      width: 90%;
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
    button {
      background-color: #0284c7;
      color: #ffffff;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 6px;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      margin-top: 1.25rem;
      width: 100%;
      transition: background-color 0.2s;
    }
    button:hover {
      background-color: #0369a1;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(heading)}</h1>
    <p>${escapeHtml(message)}</p>
    ${formHtml}
  </div>
</body>
</html>`;
}

// GET /api/email/verify -> Shows confirmation page
export function showVerifyPage(req, res) {
  const rawToken = req.query?.token;
  const tokenParse = hexTokenSchema.safeParse(rawToken);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (!tokenParse.success) {
    return res.status(400).send(
      renderCardPage({
        title: "Email Verification",
        heading: "Invalid Verification Link",
        message: "This email verification link is invalid or has expired.",
      })
    );
  }

  return res.status(200).send(
    renderCardPage({
      title: "Email Verification",
      heading: "Confirm Email Verification",
      message:
        "Please click the button below to confirm your email address and activate aircraft alert notifications.",
      buttonText: "Confirm Verification",
      postAction: "/api/email/verify",
      token: tokenParse.data,
    })
  );
}

// POST /api/email/verify -> Consumes token and activates verification
export function confirmVerifyEmail(req, res) {
  const rawToken = req.body?.token;
  const tokenParse = hexTokenSchema.safeParse(rawToken);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (!tokenParse.success) {
    return res.status(400).send(
      renderCardPage({
        title: "Email Verification",
        heading: "Invalid or Expired Link",
        message:
          "This email verification link is invalid, expired, or missing a token.",
      })
    );
  }

  const tokenHash = hashToken(tokenParse.data);
  const matchedToken = consumeEmailToken(tokenHash, "verify");

  if (matchedToken) {
    const user = findUserById(matchedToken.userId);
    if (
      user &&
      user.email &&
      matchedToken.email &&
      user.email === matchedToken.email
    ) {
      markEmailVerified(user.id);
      return res.status(200).send(
        renderCardPage({
          title: "Email Verification",
          heading: "Email Verified",
          message:
            "Your email address has been confirmed and alert delivery is enabled.",
        })
      );
    }
  }

  return res.status(400).send(
    renderCardPage({
      title: "Email Verification",
      heading: "Invalid or Expired Link",
      message:
        "This email verification link is invalid, expired, or has already been used.",
    })
  );
}

// GET /api/email/unsubscribe -> Shows confirmation page
export function showUnsubscribePage(req, res) {
  const rawToken = req.query?.token;
  const tokenParse = hexTokenSchema.safeParse(rawToken);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (!tokenParse.success) {
    return res.status(400).send(
      renderCardPage({
        title: "Unsubscribe",
        heading: "Invalid Unsubscribe Link",
        message: "This unsubscribe link is invalid or has expired.",
      })
    );
  }

  return res.status(200).send(
    renderCardPage({
      title: "Unsubscribe",
      heading: "Confirm Unsubscribe",
      message:
        "Please click the button below to confirm you want to unsubscribe from aircraft alert emails.",
      buttonText: "Confirm Unsubscribe",
      postAction: "/api/email/unsubscribe",
      token: tokenParse.data,
    })
  );
}

// POST /api/email/unsubscribe -> Consumes token and unsubscribes
export function confirmUnsubscribeEmail(req, res) {
  const rawToken = req.body?.token;
  const tokenParse = hexTokenSchema.safeParse(rawToken);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (!tokenParse.success) {
    return res.status(400).send(
      renderCardPage({
        title: "Unsubscribe",
        heading: "Invalid or Expired Link",
        message:
          "This unsubscribe link is invalid, expired, or missing a token.",
      })
    );
  }

  const tokenHash = hashToken(tokenParse.data);
  const matchedToken = consumeEmailToken(tokenHash, "unsubscribe");

  if (matchedToken) {
    markEmailUnsubscribed(matchedToken.userId);
    return res.status(200).send(
      renderCardPage({
        title: "Unsubscribe",
        heading: "Unsubscribed",
        message:
          "Your email alert preferences have been updated and you will no longer receive alert emails.",
      })
    );
  }

  return res.status(400).send(
    renderCardPage({
      title: "Unsubscribe",
      heading: "Invalid or Expired Link",
      message:
        "This unsubscribe link is invalid, expired, or has already been used.",
    })
  );
}
