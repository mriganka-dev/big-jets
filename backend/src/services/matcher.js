import {
  listSubscriptionsForAirport,
  findUserById,
  wasAlertSent,
} from "../store/store.js";
import { CATEGORIES, AIRCRAFT_TYPES } from "../constants.js";
import { logger } from "../utils/logger.js";

export function matchAndNotify(event) {
  const { airport, aircraft, type: eventType } = event;
  const subscriptions = listSubscriptionsForAirport(airport);

  if (!subscriptions || subscriptions.length === 0) {
    return [];
  }

  const matchedList = [];

  for (const sub of subscriptions) {
    const user = findUserById(sub.userId);
    if (!user || user.paused) {
      continue;
    }

    if (!isEventMatch(sub.event, eventType)) {
      continue;
    }

    if (eventType === "nearby" && sub.radiusKm !== null) {
      if (aircraft.distKm !== null && aircraft.distKm > sub.radiusKm) {
        continue;
      }
    }

    if (!isFilterMatch(sub, aircraft)) {
      continue;
    }

    const alreadySent = wasAlertSent({
      userId: sub.userId,
      hex: aircraft.hex,
      event: eventType,
      channel: sub.channel,
      airport,
    });

    if (alreadySent) {
      continue;
    }

    matchedList.push({ sub, user, event });

    // Log the match (real notification delivery is wired in Phase 5 & 6)
    const maskedUser = user.telegramChatId
      ? `...${user.telegramChatId.slice(-4)}`
      : `...${user.id.slice(-4)}`;

    const aircraftDesc =
      aircraft.type || aircraft.callsign || aircraft.reg || aircraft.hex;
    const actionDesc =
      eventType === "land"
        ? `landing at ${airport}`
        : eventType === "takeoff"
          ? `taking off from ${airport}`
          : `near ${airport} (${aircraft.distKm ?? "?"} km)`;

    logger.info(
      `[Matcher] Would alert user ${maskedUser} about ${aircraftDesc} ${actionDesc} via ${sub.channel}`
    );
  }

  return matchedList;
}

function isEventMatch(subEvent, incomingEvent) {
  if (subEvent === "both") {
    return incomingEvent === "land" || incomingEvent === "takeoff";
  }
  return subEvent === incomingEvent;
}

function isFilterMatch(sub, aircraft) {
  switch (sub.filterType) {
    case "all_big":
      return (
        aircraft.categories.includes(CATEGORIES.BIG) ||
        (aircraft.type && AIRCRAFT_TYPES.BIG.has(aircraft.type))
      );

    case "category":
      return aircraft.categories.includes(sub.filterValue);

    case "type":
      return (
        Boolean(aircraft.type) &&
        aircraft.type.toUpperCase() === sub.filterValue.toUpperCase()
      );

    case "registration":
      return (
        Boolean(aircraft.reg) &&
        aircraft.reg.toUpperCase() === sub.filterValue.toUpperCase()
      );

    default:
      return false;
  }
}
