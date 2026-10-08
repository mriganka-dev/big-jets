import {
  listSubscriptionsForAirport,
  findUserById,
  wasAlertSent,
} from "../store/store.js";
import { CATEGORIES, AIRCRAFT_TYPES } from "../constants.js";
import { notify } from "./notifier.js";

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

    // Dispatch notification to user across subscribed channels
    notify(sub, user, event).catch(() => {});
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
