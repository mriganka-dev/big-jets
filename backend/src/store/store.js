import fs from "fs";
import path from "path";
import crypto from "crypto";
import { config } from "../config.js";
import { LIMITS } from "../constants.js";
import { logger } from "../utils/logger.js";
import { compareHashes } from "../utils/tokens.js";

let storeFilePath = path.resolve(config.storePath);
let storeDir = path.dirname(storeFilePath);
const DEBOUNCE_DELAY_MS = 1000;
const ALERT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const PRUNE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

function createEmptyStore() {
  return {
    users: [],
    subscriptions: [],
    alertsSent: [],
    emailTokens: [],
  };
}

let store = createEmptyStore();
let saveTimer = null;

function clone(data) {
  if (data === undefined || data === null) {
    return data;
  }
  return structuredClone(data);
}

function loadStore() {
  try {
    fs.mkdirSync(storeDir, { recursive: true });

    if (!fs.existsSync(storeFilePath)) {
      store = createEmptyStore();
      writeStoreAtomic(store);
      return;
    }

    const fileContent = fs.readFileSync(storeFilePath, "utf8");
    const parsed = JSON.parse(fileContent);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray(parsed.users) ||
      !Array.isArray(parsed.subscriptions) ||
      !Array.isArray(parsed.alertsSent) ||
      !Array.isArray(parsed.emailTokens)
    ) {
      throw new Error("Invalid store schema");
    }

    store = parsed;
  } catch (err) {
    const timestamp = Date.now();
    const corruptPath = `${storeFilePath}.corrupt-${timestamp}`;

    logger.error(
      `Store file was corrupt or unreadable (${err.message}). Renaming to ${corruptPath} and initializing empty store.`
    );

    try {
      if (fs.existsSync(storeFilePath)) {
        fs.renameSync(storeFilePath, corruptPath);
      }
    } catch (renameErr) {
      logger.error(`Failed to rename corrupted store: ${renameErr.message}`);
    }

    store = createEmptyStore();
    writeStoreAtomic(store);
  }
}

function writeStoreAtomic(data) {
  const tmpPath = `${storeFilePath}.tmp`;
  const jsonContent = JSON.stringify(data, null, 2);

  fs.writeFileSync(tmpPath, jsonContent, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmpPath, storeFilePath);
}

function scheduleSave() {
  if (saveTimer) return;

  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      writeStoreAtomic(store);
    } catch (err) {
      logger.error(`Failed to save store to disk: ${err.message}`);
    }
  }, DEBOUNCE_DELAY_MS);
}

export function saveNow() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  try {
    writeStoreAtomic(store);
  } catch (err) {
    logger.error(`Failed to synchronously save store to disk: ${err.message}`);
  }
}

// Initial store load
loadStore();

// Hourly automatic pruning of expired alerts and tokens
setInterval(() => {
  pruneOldData();
}, PRUNE_INTERVAL_MS).unref();

// ==================== USER OPERATIONS ====================

export function findUserByTelegramId(telegramChatId) {
  if (!telegramChatId) return null;
  const targetId = String(telegramChatId);
  const user = store.users.find((u) => u.telegramChatId === targetId);
  return clone(user || null);
}

export function findUserById(userId) {
  if (!userId) return null;
  const user = store.users.find((u) => u.id === String(userId));
  return clone(user || null);
}

export function createUser({ telegramChatId }) {
  if (!telegramChatId) {
    throw new Error("Telegram chat ID is required to create a user");
  }

  const targetId = String(telegramChatId);
  const existing = store.users.find((u) => u.telegramChatId === targetId);
  if (existing) {
    return clone(existing);
  }

  if (store.users.length >= LIMITS.MAX_TOTAL_USERS) {
    throw new Error(`Maximum user limit reached (${LIMITS.MAX_TOTAL_USERS})`);
  }

  const newUser = {
    id: `u_${crypto.randomUUID()}`,
    telegramChatId: targetId,
    email: null,
    emailVerified: false,
    emailBounced: false,
    emailUnsubscribed: false,
    paused: false,
    createdAt: new Date().toISOString(),
  };

  store.users.push(newUser);
  scheduleSave();
  return clone(newUser);
}

export function setUserPaused(userId, paused) {
  const user = store.users.find((u) => u.id === String(userId));
  if (!user) return null;

  user.paused = Boolean(paused);
  scheduleSave();
  return clone(user);
}

export function setUserEmail(userId, email) {
  const user = store.users.find((u) => u.id === String(userId));
  if (!user) return null;

  user.email = email ? String(email).trim().toLowerCase() : null;
  user.emailVerified = false;
  user.emailUnsubscribed = false;
  user.emailBounced = false;

  // Delete verify tokens for this user when email is changed or switched off
  store.emailTokens = store.emailTokens.filter(
    (t) => !(t.userId === user.id && t.purpose === "verify")
  );

  scheduleSave();
  return clone(user);
}

export function markEmailVerified(userId) {
  const user = store.users.find((u) => u.id === String(userId));
  if (!user) return null;

  user.emailVerified = true;
  user.emailUnsubscribed = false;

  scheduleSave();
  return clone(user);
}

export function markEmailUnsubscribed(userId) {
  const user = store.users.find((u) => u.id === String(userId));
  if (!user) return null;

  user.emailUnsubscribed = true;

  scheduleSave();
  return clone(user);
}

// ==================== SUBSCRIPTION OPERATIONS ====================

export function addSubscription({
  userId,
  airport,
  filterType,
  filterValue = null,
  event = "both",
  radiusKm = null,
  channel = "telegram",
}) {
  const user = store.users.find((u) => u.id === String(userId));
  if (!user) {
    throw new Error("User not found");
  }

  const userSubs = store.subscriptions.filter((s) => s.userId === user.id);
  if (userSubs.length >= LIMITS.MAX_USER_SUBSCRIPTIONS) {
    throw new Error(
      `User reached maximum subscriptions limit (${LIMITS.MAX_USER_SUBSCRIPTIONS})`
    );
  }

  const newSub = {
    id: `s_${crypto.randomUUID()}`,
    userId: user.id,
    airport: String(airport).toUpperCase(),
    filterType: String(filterType),
    filterValue: filterValue ? String(filterValue).toUpperCase() : null,
    event: String(event),
    radiusKm:
      radiusKm !== null && radiusKm !== undefined ? Number(radiusKm) : null,
    channel: String(channel),
  };

  store.subscriptions.push(newSub);
  scheduleSave();
  return clone(newSub);
}

export function listSubscriptions(userId) {
  if (!userId) return [];
  const subs = store.subscriptions.filter((s) => s.userId === String(userId));
  return clone(subs);
}

export function removeSubscription(userId, subscriptionId) {
  const index = store.subscriptions.findIndex(
    (s) => s.userId === String(userId) && s.id === String(subscriptionId)
  );

  if (index === -1) {
    return false;
  }

  store.subscriptions.splice(index, 1);
  scheduleSave();
  return true;
}

export function listSubscriptionsForAirport(icao) {
  if (!icao) return [];
  const targetAirport = String(icao).toUpperCase();
  const subs = store.subscriptions.filter((s) => s.airport === targetAirport);
  return clone(subs);
}

export function listWatchedAirports() {
  const activeUserIds = new Set(
    store.users.filter((u) => !u.paused).map((u) => u.id)
  );

  const watchedSet = new Set();
  for (const sub of store.subscriptions) {
    if (activeUserIds.has(sub.userId)) {
      watchedSet.add(sub.airport);
    }
  }

  return Array.from(watchedSet);
}

// ==================== ALERT TRACKING ====================

export function wasAlertSent({ userId, hex, event, channel, airport }) {
  const targetUserId = String(userId);
  const targetHex = String(hex).toLowerCase();
  const targetEvent = String(event);
  const targetChannel = String(channel);
  const targetAirport = airport ? String(airport).toUpperCase() : null;
  const cutoffTime = Date.now() - LIMITS.ALERT_DEDUP_WINDOW_MS;

  return store.alertsSent.some((a) => {
    if (
      a.userId !== targetUserId ||
      a.hex.toLowerCase() !== targetHex ||
      a.event !== targetEvent ||
      a.channel !== targetChannel
    ) {
      return false;
    }
    if (targetAirport && a.airport && a.airport !== targetAirport) {
      return false;
    }
    const alertTime = new Date(a.at).getTime();
    return alertTime >= cutoffTime;
  });
}

export function recordAlert({ userId, hex, event, airport, channel }) {
  const record = {
    userId: String(userId),
    hex: String(hex).toLowerCase(),
    event: String(event),
    airport: airport ? String(airport).toUpperCase() : undefined,
    channel: String(channel),
    at: new Date().toISOString(),
  };

  store.alertsSent.push(record);
  scheduleSave();
  return clone(record);
}

// ==================== EMAIL TOKEN OPERATIONS ====================

export function saveEmailToken(
  userId,
  tokenHash,
  expiresAt,
  purpose,
  email = null
) {
  const targetUserId = String(userId);
  const targetPurpose = String(purpose);

  // When saving an unsubscribe token, keep at most 5 per user (remove oldest)
  if (targetPurpose === "unsubscribe") {
    const userUnsubIndices = [];
    store.emailTokens.forEach((t, i) => {
      if (t.userId === targetUserId && t.purpose === "unsubscribe") {
        userUnsubIndices.push(i);
      }
    });

    while (userUnsubIndices.length >= 5) {
      const removeIdx = userUnsubIndices.shift();
      store.emailTokens.splice(removeIdx, 1);
      for (let j = 0; j < userUnsubIndices.length; j++) {
        userUnsubIndices[j]--;
      }
    }
  }

  const record = {
    userId: targetUserId,
    tokenHash: String(tokenHash),
    purpose: targetPurpose,
    email: email ? String(email).trim().toLowerCase() : null,
    expiresAt:
      expiresAt instanceof Date ? expiresAt.toISOString() : String(expiresAt),
  };

  store.emailTokens.push(record);
  scheduleSave();
  return clone(record);
}

export function consumeEmailToken(tokenHash, purpose) {
  if (!tokenHash || !purpose) return null;

  const now = Date.now();
  const index = store.emailTokens.findIndex((t) => {
    if (t.purpose !== purpose) {
      return false;
    }
    if (!compareHashes(t.tokenHash, tokenHash)) {
      return false;
    }
    const expiresAt = new Date(t.expiresAt).getTime();
    return expiresAt > now;
  });

  if (index === -1) {
    return null;
  }

  const [matched] = store.emailTokens.splice(index, 1);
  scheduleSave();
  return clone(matched);
}

// ==================== HOUSEKEEPING ====================

export function pruneOldData() {
  const now = Date.now();
  const alertCutoffTime = now - ALERT_EXPIRY_MS;

  const initialAlertsCount = store.alertsSent.length;
  const initialTokensCount = store.emailTokens.length;

  store.alertsSent = store.alertsSent.filter(
    (a) => new Date(a.at).getTime() > alertCutoffTime
  );

  store.emailTokens = store.emailTokens.filter(
    (t) => new Date(t.expiresAt).getTime() > now
  );

  const prunedAlerts = initialAlertsCount - store.alertsSent.length;
  const prunedTokens = initialTokensCount - store.emailTokens.length;

  if (prunedAlerts > 0 || prunedTokens > 0) {
    scheduleSave();
    logger.info(
      `Store pruned: removed ${prunedAlerts} old alerts and ${prunedTokens} expired email tokens`
    );
  }

  return { prunedAlerts, prunedTokens };
}

export function setStorePath(newPath) {
  if (saveTimer) {
    saveNow();
  }
  storeFilePath = path.resolve(newPath);
  storeDir = path.dirname(storeFilePath);
  loadStore();
}
