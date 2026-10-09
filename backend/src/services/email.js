import nodemailer from "nodemailer";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { escapeHtml } from "./telegram.js";
import { emailSchema } from "../utils/validators.js";

let transporter = null;

function getTransporter() {
  if (!config.smtp.isEnabled) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth:
        config.smtp.user && config.smtp.pass
          ? {
              user: config.smtp.user,
              pass: config.smtp.pass,
            }
          : undefined,
    });
  }

  return transporter;
}

/**
 * Builds email subject, plain text and HTML body for aircraft alert notifications.
 */
export function buildAlertEmailContent(event, rawUnsubToken) {
  const { airport, aircraft, type: eventType } = event;

  const type = aircraft.type || "Unknown Type";
  const model = aircraft.model || type;
  const operator = aircraft.operator || "";
  const callsign = aircraft.callsign || "";
  const reg = aircraft.reg || "";

  // Aircraft identity line
  const identityParts = [];
  if (operator) identityParts.push(operator);
  if (callsign) identityParts.push(callsign);
  const flightIdent = identityParts.join(" ");

  const opCallReg =
    flightIdent && reg
      ? `${flightIdent}, ${reg}`
      : flightIdent || reg || "No callsign";

  // Altitude & movement description
  const altText =
    aircraft.altFt === 0 || aircraft.onGround
      ? "Ground"
      : aircraft.altFt !== null
        ? `${aircraft.altFt.toLocaleString()} ft`
        : "Unknown altitude";

  const vRate = aircraft.vRate ?? 0;
  const vTrend =
    vRate <= -200 ? "descending" : vRate >= 200 ? "climbing" : "level";

  let header = "";
  let subjectPrefix = "";
  let details = "";
  let etaMinutes = null;

  if (eventType === "land") {
    subjectPrefix = `Landing soon at ${airport}`;
    header = `Landing soon at ${airport}`;

    let etaText = "";
    if (aircraft.distKm && aircraft.speedKt && aircraft.speedKt > 30) {
      const speedKmH = aircraft.speedKt * 1.852;
      etaMinutes = Math.round((aircraft.distKm / speedKmH) * 60);
      if (etaMinutes > 0 && etaMinutes <= 180) {
        etaText = `About ${etaMinutes} min out, `;
      }
    }

    details = `${etaText}${altText}, ${vTrend}`;
  } else if (eventType === "takeoff") {
    subjectPrefix = `Departing from ${airport}`;
    header = `Departing from ${airport}`;
    const speed = aircraft.speedKt ? `${aircraft.speedKt} kt` : "taxiing";
    details = `Ground speed ${speed}, departing`;
  } else {
    // "nearby"
    subjectPrefix = `Aircraft near ${airport}`;
    header = `Aircraft near ${airport}`;
    const dist =
      aircraft.distKm !== null ? `${aircraft.distKm} km from airport, ` : "";
    details = `${dist}${altText}`;
  }

  // Subject line construction
  const subjectAircraft = callsign || reg || type;
  const subjectEta =
    etaMinutes && etaMinutes <= 180 ? `, about ${etaMinutes} min` : "";
  const rawSubject = `${subjectPrefix}: ${model} (${subjectAircraft})${subjectEta}`;
  const subject = rawSubject.replace(/[\r\n]+/g, " ").slice(0, 200);

  const unsubUrl = `${config.publicUrl}/api/email/unsubscribe?token=${encodeURIComponent(rawUnsubToken)}`;

  // Plain text body
  const textBody = [
    `Big Jets Alert: ${header}`,
    "----------------------------------------",
    `Aircraft: ${model} (${type})`,
    `Flight:   ${opCallReg}`,
    `Status:   ${details}`,
    `Airport:  ${airport}`,
    "----------------------------------------",
    "",
    "To unsubscribe from these email alerts, visit:",
    unsubUrl,
  ].join("\n");

  // HTML body
  const htmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <div style="background-color: #0284c7; color: #ffffff; padding: 16px 20px;">
      <h2 style="margin: 0; font-size: 18px; font-weight: 600;">${escapeHtml(header)}</h2>
    </div>
    <div style="padding: 20px;">
      <div style="margin-bottom: 16px;">
        <div style="font-size: 16px; font-weight: 600; color: #0f172a;">${escapeHtml(model)} <span style="font-size: 14px; font-weight: normal; color: #64748b;">(${escapeHtml(type)})</span></div>
        <div style="font-size: 14px; color: #334155; margin-top: 4px;">${escapeHtml(opCallReg)}</div>
      </div>
      <div style="background-color: #f1f5f9; padding: 12px 16px; border-radius: 6px; font-size: 14px; color: #334155; margin-bottom: 20px;">
        <strong>Status:</strong> ${escapeHtml(details)}
      </div>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
      <p style="font-size: 12px; color: #94a3b8; margin: 0; text-align: center;">
        You received this alert because you subscribed to aircraft alerts for ${escapeHtml(airport)}.<br>
        <a href="${unsubUrl}" style="color: #64748b; text-decoration: underline;">Unsubscribe from email alerts</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  return { subject, textBody, htmlBody };
}

/**
 * Sends an email verification link to a user.
 */
export async function sendVerificationEmail(toEmail, rawToken) {
  const parseResult = emailSchema.safeParse(toEmail);
  if (!parseResult.success) {
    throw new Error("Invalid recipient email address");
  }

  const cleanEmail = parseResult.data;
  const verifyUrl = `${config.publicUrl}/api/email/verify?token=${encodeURIComponent(rawToken)}`;

  const subject = "Verify your email address - Big Jets Alert";

  const textBody = [
    "Big Jets Alert - Email Verification",
    "----------------------------------------",
    "Please verify your email address to receive aircraft alert notifications.",
    "",
    "Click the link below to verify (valid for 24 hours):",
    verifyUrl,
    "",
    "If you did not request this verification, you can safely ignore this email.",
  ].join("\n");

  const htmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Email Verification</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <h2 style="color: #0284c7; margin-top: 0;">Big Jets Alert</h2>
    <p>Please verify your email address to receive aircraft alert notifications.</p>
    <div style="margin: 24px 0;">
      <a href="${verifyUrl}" style="background-color: #0284c7; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">Verify Email Address</a>
    </div>
    <p style="font-size: 13px; color: #64748b;">Or copy and paste this link into your browser:<br><a href="${verifyUrl}" style="color: #0284c7;">${verifyUrl}</a></p>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
    <p style="font-size: 12px; color: #94a3b8; margin: 0;">This link is valid for 24 hours. If you did not request this email, please ignore it.</p>
  </div>
</body>
</html>`;

  const transport = getTransporter();

  if (!transport) {
    logger.info(
      `[Email] SMTP not configured. Verification email simulation for ...${cleanEmail.slice(-6)}: ${verifyUrl}`
    );
    return true;
  }

  try {
    await transport.sendMail({
      from: config.smtp.from,
      to: cleanEmail,
      subject,
      text: textBody,
      html: htmlBody,
    });
    logger.info(
      `[Email] Verification email dispatched to ...${cleanEmail.slice(-6)}`
    );
    return true;
  } catch (err) {
    logger.error(
      `[Email] Failed to send verification email to ...${cleanEmail.slice(-6)}: ${err.message}`
    );
    throw err;
  }
}

/**
 * Sends an aircraft alert notification email to a verified subscriber.
 */
export async function sendAlertEmail(user, event, rawUnsubToken) {
  if (
    !user.email ||
    !user.emailVerified ||
    user.emailBounced ||
    user.emailUnsubscribed
  ) {
    return false;
  }

  const parseResult = emailSchema.safeParse(user.email);
  if (!parseResult.success) {
    logger.warn(`[Email] Skipping alert for malformed email: ${user.id}`);
    return false;
  }

  const cleanEmail = parseResult.data;
  const { subject, textBody, htmlBody } = buildAlertEmailContent(
    event,
    rawUnsubToken
  );

  const transport = getTransporter();

  if (!transport) {
    logger.info(
      `[Email] SMTP not configured. Alert email simulation for ...${cleanEmail.slice(-6)}: ${subject}`
    );
    return true;
  }

  try {
    await transport.sendMail({
      from: config.smtp.from,
      to: cleanEmail,
      subject,
      text: textBody,
      html: htmlBody,
    });
    logger.info(
      `[Email] Alert email dispatched to ...${cleanEmail.slice(-6)}: ${subject}`
    );
    return true;
  } catch (err) {
    logger.error(
      `[Email] Failed to send alert email to ...${cleanEmail.slice(-6)}: ${err.message}`
    );
    return false;
  }
}
