import { escapeHtml, sendMessage } from "./telegram.js";
import { recordAlert, wasAlertSent } from "../store/store.js";
import { logger } from "../utils/logger.js";

/**
 * Builds formatted HTML text for Telegram notifications based on the flight event.
 */
export function buildNotificationHtml(event) {
  const { airport, aircraft, type: eventType } = event;

  const type = aircraft.type || "Unknown Type";
  const model = aircraft.model || type;
  const operator = aircraft.operator || "";
  const callsign = aircraft.callsign || "";
  const reg = aircraft.reg || "";

  // Aircraft identity line
  const identityParts = [];
  if (operator) identityParts.push(escapeHtml(operator));
  if (callsign) identityParts.push(escapeHtml(callsign));
  const flightIdent = identityParts.join(" ");

  const regStr = reg ? escapeHtml(reg) : "";
  const opCallReg =
    flightIdent && regStr
      ? `${flightIdent}, ${regStr}`
      : flightIdent || regStr || "No callsign";

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
  let details = "";

  if (eventType === "land") {
    header = `Landing soon at ${escapeHtml(airport)}`;

    let etaText = "";
    if (aircraft.distKm && aircraft.speedKt && aircraft.speedKt > 30) {
      const speedKmH = aircraft.speedKt * 1.852;
      const minOut = Math.round((aircraft.distKm / speedKmH) * 60);
      if (minOut > 0 && minOut <= 180) {
        etaText = `About ${minOut} min out, `;
      }
    }

    details = `${etaText}${altText}, ${vTrend}`;
  } else if (eventType === "takeoff") {
    header = `Departing from ${escapeHtml(airport)}`;
    const speed = aircraft.speedKt ? `${aircraft.speedKt} kt` : "taxiing";
    details = `Ground speed ${speed}, departing`;
  } else {
    // "nearby"
    header = `Aircraft near ${escapeHtml(airport)}`;
    const dist =
      aircraft.distKm !== null ? `${aircraft.distKm} km from airport, ` : "";
    details = `${dist}${altText}`;
  }

  return [
    `<b>${header}</b>`,
    `${escapeHtml(model)} (${escapeHtml(type)})`,
    opCallReg,
    details,
  ].join("\n");
}

/**
 * Dispatches alert notifications to subscribed channels (Telegram and/or Email).
 */
export async function notify(sub, user, event) {
  const { aircraft, type: eventType, airport } = event;
  const hex = aircraft.hex;

  const html = buildNotificationHtml(event);

  // 1. Deliver via Telegram if subscribed
  if (sub.channel === "telegram" || sub.channel === "both") {
    const alreadySentTg = wasAlertSent({
      userId: user.id,
      hex,
      event: eventType,
      channel: "telegram",
      airport,
    });

    if (!alreadySentTg && user.telegramChatId) {
      try {
        const sent = await sendMessage(user.telegramChatId, html);
        if (sent) {
          recordAlert({
            userId: user.id,
            hex,
            event: eventType,
            airport,
            channel: "telegram",
          });
          logger.info(
            `[Notifier] Sent Telegram alert to user ...${user.telegramChatId.slice(-4)} for ${aircraft.type || hex} (${eventType} @ ${airport})`
          );
        }
      } catch (err) {
        logger.error(
          `[Notifier] Failed to send Telegram alert to user ...${user.telegramChatId.slice(-4)}: ${err.message}`
        );
      }
    }
  }

  // 2. Deliver via Email if subscribed (full email sending enabled in Phase 6)
  if (sub.channel === "email" || sub.channel === "both") {
    const alreadySentEmail = wasAlertSent({
      userId: user.id,
      hex,
      event: eventType,
      channel: "email",
      airport,
    });

    if (
      !alreadySentEmail &&
      user.email &&
      user.emailVerified &&
      !user.emailBounced &&
      !user.emailUnsubscribed
    ) {
      // Email delivery hook for Phase 6
      logger.info(
        `[Notifier] Email alert queued for verified address (...${user.email.slice(-6)}) for ${aircraft.type || hex}`
      );
    }
  }
}
