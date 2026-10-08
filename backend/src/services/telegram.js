import { config } from "../config.js";
import { AIRPORTS, CATEGORIES } from "../constants.js";
import { logger } from "../utils/logger.js";
import { generateToken, hashToken } from "../utils/tokens.js";
import {
  findUserByTelegramId,
  createUser,
  setUserPaused,
  setUserEmail,
  addSubscription,
  listSubscriptions,
  removeSubscription,
  saveEmailToken,
} from "../store/store.js";
import {
  icaoSchema,
  aircraftTypeSchema,
  registrationSchema,
  emailSchema,
} from "../utils/validators.js";
import { sendVerificationEmail } from "./email.js";

const TELEGRAM_API_BASE = "https://api.telegram.org";
const MAX_MSG_LENGTH = 200;

// Rate limiting queue for outgoing Telegram messages
// Max 20 msgs/sec globally (50ms interval) and max 1 msg/sec per chat
const messageQueue = [];
let isQueueProcessing = false;
const lastSentPerChat = new Map();

let isPolling = false;
let pollingAbortController = null;

/**
 * Escapes HTML characters for safe Telegram messages.
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Queue and send a message via Telegram Bot API with rate limiting.
 */
export async function sendMessage(chatId, htmlText) {
  if (!config.telegram.botToken) {
    logger.warn("Telegram bot token not configured, skipping sendMessage");
    return false;
  }

  return new Promise((resolve, reject) => {
    messageQueue.push({
      chatId: String(chatId),
      text: htmlText,
      resolve,
      reject,
    });
    processMessageQueue();
  });
}

async function processMessageQueue() {
  if (isQueueProcessing || messageQueue.length === 0) {
    return;
  }

  isQueueProcessing = true;

  while (messageQueue.length > 0) {
    const item = messageQueue.shift();
    const now = Date.now();
    const lastSent = lastSentPerChat.get(item.chatId) || 0;
    const chatWait = Math.max(0, 1000 - (now - lastSent));

    if (chatWait > 0) {
      await new Promise((r) => setTimeout(r, chatWait));
    }

    try {
      await sendDirectTelegramMessage(item.chatId, item.text);
      lastSentPerChat.set(item.chatId, Date.now());
      item.resolve(true);
    } catch (err) {
      item.reject(err);
    }

    // Enforce 50ms spacing between sends (~20 messages / sec maximum)
    await new Promise((r) => setTimeout(r, 50));
  }

  isQueueProcessing = false;
}

async function sendDirectTelegramMessage(chatId, htmlText) {
  const url = `${TELEGRAM_API_BASE}/bot${config.telegram.botToken}/sendMessage`;

  const payload = {
    chat_id: chatId,
    text: htmlText,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const description = errorBody.description || response.statusText;

      // Check if bot was blocked by the user
      if (
        response.status === 403 ||
        (description && description.toLowerCase().includes("blocked"))
      ) {
        const user = findUserByTelegramId(chatId);
        if (user) {
          setUserPaused(user.id, true);
          logger.warn(
            `User ...${String(chatId).slice(-4)} blocked the bot. Marked user as paused.`
          );
        }
      }

      logger.warn(
        `Telegram sendMessage failed [HTTP ${response.status}]: ${description}`
      );
      throw new Error(`Telegram API error: ${description}`);
    }

    return true;
  } catch (err) {
    if (err.name === "TimeoutError") {
      logger.error("Telegram sendMessage request timed out");
    }
    throw err;
  }
}

/**
 * Parses and processes incoming Telegram updates (from webhook or long-polling).
 */
export async function handleUpdate(update) {
  if (!update || typeof update !== "object") {
    return;
  }

  // Only handle regular text messages in private chats
  const message = update.message;
  if (!message || !message.text || !message.chat) {
    return;
  }

  if (message.chat.type !== "private") {
    return;
  }

  const rawText = message.text.trim();
  if (rawText.length > MAX_MSG_LENGTH) {
    await sendMessage(
      message.chat.id,
      "Message too long. Please keep commands under 200 characters."
    );
    return;
  }

  const chatId = String(message.chat.id);
  const fromId = message.from?.id ? String(message.from.id) : chatId;

  // Access control allow-list check
  if (config.telegram.allowedUserIds.length > 0) {
    const isAllowed =
      config.telegram.allowedUserIds.includes(chatId) ||
      config.telegram.allowedUserIds.includes(fromId);

    if (!isAllowed) {
      // Ignored for unlisted users in private beta
      return;
    }
  }

  let user = findUserByTelegramId(chatId);
  if (!user) {
    user = createUser({ telegramChatId: chatId });
  }

  const tokens = rawText.split(/\s+/);
  const rawCommand = tokens[0].toLowerCase();
  const command = rawCommand.split("@")[0]; // remove @botname suffix if present
  const args = tokens.slice(1);

  try {
    switch (command) {
      case "/start":
      case "/help":
        await handleHelpCommand(chatId);
        break;

      case "/watch":
        await handleWatchCommand(chatId, user, args);
        break;

      case "/mywatches":
        await handleMyWatchesCommand(chatId, user);
        break;

      case "/stop":
        await handleStopCommand(chatId, user, args);
        break;

      case "/pause":
        await handlePauseCommand(chatId, user);
        break;

      case "/resume":
        await handleResumeCommand(chatId, user);
        break;

      case "/email":
        await handleEmailCommand(chatId, user, args);
        break;

      default:
        await sendMessage(
          chatId,
          "Unknown command. Send /help for available commands."
        );
        break;
    }
  } catch (err) {
    logger.error(
      `Error handling telegram command '${command}': ${err.message}`
    );
    await sendMessage(
      chatId,
      "An error occurred while processing your request."
    );
  }
}

async function handleHelpCommand(chatId) {
  const airportCodes = Object.keys(AIRPORTS).join(", ");
  const helpText = [
    "<b>Big Jets Alert Bot</b>",
    "",
    "<b>Commands:</b>",
    "• <code>/watch &lt;ICAO&gt; &lt;what&gt; [event] [via]</code>",
    "  Add an alert subscription for an airport.",
    "  • <b>ICAO:</b> " + airportCodes,
    "  • <b>what:</b> <code>all</code>, <code>big</code>, <code>rare</code>, <code>fighters</code>, <code>military</code>, <code>vip</code>, type code (e.g. <code>A388</code>), or reg (e.g. <code>VT-ALK</code>)",
    "  • <b>event:</b> <code>land</code>, <code>takeoff</code>, <code>both</code>, or <code>nearby [radiusKm]</code> (default: <code>both</code>, or <code>nearby 50</code> for fighters/military)",
    "  • <b>via:</b> <code>telegram</code>, <code>email</code>, or <code>both</code> (default: <code>telegram</code>)",
    "",
    "• <code>/mywatches</code> - View your active subscriptions",
    "• <code>/stop &lt;number&gt;</code> - Remove a subscription",
    "• <code>/pause</code> - Pause all alerts",
    "• <code>/resume</code> - Resume paused alerts",
    "• <code>/email &lt;address&gt;</code> - Link email address for email alerts",
    "• <code>/email off</code> - Disable email alerts",
    "",
    "<i>Example:</i> <code>/watch VECC all</code>",
    "<i>Example:</i> <code>/watch VECC fighters nearby 50</code>",
    "<i>Example:</i> <code>/watch VIDP A388 land both</code>",
  ].join("\n");

  await sendMessage(chatId, helpText);
}

async function handleWatchCommand(chatId, user, args) {
  if (args.length < 2) {
    await sendMessage(
      chatId,
      "Usage: <code>/watch &lt;ICAO&gt; &lt;what&gt; [event] [via]</code>\nExample: <code>/watch VECC all</code>"
    );
    return;
  }

  const rawIcao = args[0].toUpperCase();
  const icaoResult = icaoSchema.safeParse(rawIcao);
  if (!icaoResult.success) {
    const known = Object.keys(AIRPORTS).join(", ");
    await sendMessage(
      chatId,
      `Invalid airport ICAO <code>${escapeHtml(rawIcao)}</code>. Supported airports: ${known}`
    );
    return;
  }
  const icao = icaoResult.data;

  const rawWhat = args[1].toLowerCase();
  let filterType = null;
  let filterValue = null;
  let defaultEvent = "both";
  let defaultRadiusKm = null;

  if (rawWhat === "all") {
    filterType = "all_big";
  } else if (rawWhat === "big") {
    filterType = "category";
    filterValue = CATEGORIES.BIG;
  } else if (rawWhat === "rare") {
    filterType = "category";
    filterValue = CATEGORIES.RARE;
  } else if (rawWhat === "fighters" || rawWhat === "fighter") {
    filterType = "category";
    filterValue = CATEGORIES.MIL_FIGHTER;
    defaultEvent = "nearby";
    defaultRadiusKm = 50;
  } else if (rawWhat === "military") {
    filterType = "category";
    filterValue = CATEGORIES.MIL_OTHER;
    defaultEvent = "nearby";
    defaultRadiusKm = 50;
  } else if (rawWhat === "vip") {
    filterType = "category";
    filterValue = CATEGORIES.VIP_JET;
  } else {
    // Try aircraft type or registration
    const typeParse = aircraftTypeSchema.safeParse(rawWhat);
    const regParse = registrationSchema.safeParse(rawWhat);

    if (typeParse.success && rawWhat.length <= 4 && !rawWhat.includes("-")) {
      filterType = "type";
      filterValue = typeParse.data;
    } else if (regParse.success) {
      filterType = "registration";
      filterValue = regParse.data;
    } else {
      await sendMessage(
        chatId,
        "Invalid aircraft target. Use <code>all</code>, a category (<code>big</code>, <code>rare</code>, <code>fighters</code>, <code>military</code>, <code>vip</code>), a type code (e.g. <code>A388</code>), or registration (e.g. <code>VT-ALK</code>)."
      );
      return;
    }
  }

  // Parse event & optional radius & via
  let event = defaultEvent;
  let radiusKm = defaultRadiusKm;
  let channel = "telegram";

  let remainingArgs = args.slice(2);

  if (remainingArgs.length > 0) {
    const candidateEvent = remainingArgs[0].toLowerCase();

    if (["land", "takeoff", "both"].includes(candidateEvent)) {
      event = candidateEvent;
      remainingArgs = remainingArgs.slice(1);
    } else if (candidateEvent === "nearby") {
      event = "nearby";
      remainingArgs = remainingArgs.slice(1);

      if (remainingArgs.length > 0 && /^\d+$/.test(remainingArgs[0])) {
        const parsedRadius = parseInt(remainingArgs[0], 10);
        if (parsedRadius >= 5 && parsedRadius <= 100) {
          radiusKm = parsedRadius;
          remainingArgs = remainingArgs.slice(1);
        }
      }
      if (radiusKm === null) {
        radiusKm = 50;
      }
    }
  }

  if (remainingArgs.length > 0) {
    const candidateChannel = remainingArgs[0].toLowerCase();
    if (["telegram", "email", "both"].includes(candidateChannel)) {
      channel = candidateChannel;
    }
  }

  try {
    const newSub = addSubscription({
      userId: user.id,
      airport: icao,
      filterType,
      filterValue,
      event,
      radiusKm: event === "nearby" ? radiusKm || 50 : null,
      channel,
    });

    const targetDesc =
      filterType === "all_big"
        ? "All Big Jets"
        : filterType === "category"
          ? `Category: ${filterValue}`
          : filterType === "type"
            ? `Type: ${filterValue}`
            : `Reg: ${filterValue}`;

    const eventDesc =
      event === "nearby" ? `nearby (${newSub.radiusKm} km)` : event;

    await sendMessage(
      chatId,
      `<b>Watch created</b>\n` +
        `Airport: <b>${icao}</b> (${AIRPORTS[icao].name})\n` +
        `Target: <b>${escapeHtml(targetDesc)}</b>\n` +
        `Event: <b>${eventDesc}</b>\n` +
        `Via: <b>${channel}</b>`
    );
  } catch (err) {
    await sendMessage(
      chatId,
      `Failed to create watch: ${escapeHtml(err.message)}`
    );
  }
}

async function handleMyWatchesCommand(chatId, user) {
  const subs = listSubscriptions(user.id);

  if (subs.length === 0) {
    await sendMessage(
      chatId,
      "You have no active watches.\nCreate one with <code>/watch &lt;ICAO&gt; &lt;what&gt;</code>."
    );
    return;
  }

  const lines = [
    `<b>Your Active Watches (${subs.length}/10):</b>` +
      (user.paused ? " <i>(PAUSED)</i>" : ""),
    "",
  ];

  subs.forEach((sub, index) => {
    const target =
      sub.filterType === "all_big"
        ? "All Big Jets"
        : sub.filterType === "category"
          ? sub.filterValue
          : `${sub.filterType.toUpperCase()}: ${sub.filterValue}`;

    const eventDesc =
      sub.event === "nearby" ? `nearby ${sub.radiusKm}km` : sub.event;

    lines.push(
      `<b>${index + 1}.</b> ${sub.airport} - <b>${escapeHtml(target)}</b> (${eventDesc}) via ${sub.channel}`
    );
  });

  lines.push("");
  lines.push(
    "<i>To remove a watch, send <code>/stop &lt;number&gt;</code>.</i>"
  );

  await sendMessage(chatId, lines.join("\n"));
}

async function handleStopCommand(chatId, user, args) {
  if (args.length === 0) {
    await sendMessage(
      chatId,
      "Usage: <code>/stop &lt;number&gt;</code>\nSend <code>/mywatches</code> to see the numbers."
    );
    return;
  }

  const indexNum = parseInt(args[0], 10);
  const subs = listSubscriptions(user.id);

  if (isNaN(indexNum) || indexNum < 1 || indexNum > subs.length) {
    await sendMessage(
      chatId,
      `Invalid number. You have ${subs.length} active watches. Send /mywatches to check.`
    );
    return;
  }

  const targetSub = subs[indexNum - 1];
  const removed = removeSubscription(user.id, targetSub.id);

  if (removed) {
    await sendMessage(
      chatId,
      `Watch #${indexNum} for <b>${targetSub.airport}</b> removed.`
    );
  } else {
    await sendMessage(chatId, "Failed to remove watch.");
  }
}

async function handlePauseCommand(chatId, user) {
  setUserPaused(user.id, true);
  await sendMessage(
    chatId,
    "Alerts <b>paused</b>. You will not receive notifications until you send <code>/resume</code>."
  );
}

async function handleResumeCommand(chatId, user) {
  setUserPaused(user.id, false);
  await sendMessage(
    chatId,
    "Alerts <b>resumed</b>. You will now receive active notifications."
  );
}

const emailVerificationRateMap = new Map();
const MAX_VERIFICATIONS_PER_DAY = 3;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function canRequestVerification(userId) {
  const now = Date.now();
  const timestamps = emailVerificationRateMap.get(userId) || [];
  const validTimestamps = timestamps.filter((t) => now - t < ONE_DAY_MS);

  if (validTimestamps.length >= MAX_VERIFICATIONS_PER_DAY) {
    emailVerificationRateMap.set(userId, validTimestamps);
    return false;
  }

  validTimestamps.push(now);
  emailVerificationRateMap.set(userId, validTimestamps);
  return true;
}

async function handleEmailCommand(chatId, user, args) {
  if (args.length === 0) {
    await sendMessage(
      chatId,
      "Usage:\n" +
        "• <code>/email &lt;your-address@domain.com&gt;</code> - Register email\n" +
        "• <code>/email off</code> - Disable email alerts"
    );
    return;
  }

  const input = args[0].trim();

  if (input.toLowerCase() === "off") {
    setUserEmail(user.id, null);
    await sendMessage(chatId, "Email alerts have been disabled.");
    return;
  }

  const emailResult = emailSchema.safeParse(input);
  if (!emailResult.success) {
    await sendMessage(
      chatId,
      "Invalid email address format. Please enter a valid email."
    );
    return;
  }

  if (!canRequestVerification(user.id)) {
    await sendMessage(
      chatId,
      "You have reached the limit of 3 email verification requests per day. Please check your inbox or try again tomorrow."
    );
    return;
  }

  const email = emailResult.data;
  setUserEmail(user.id, email);

  // Generate a verification token valid for 24 hours
  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  saveEmailToken(user.id, tokenHash, expiresAt);

  const verifyUrl = `${config.publicUrl}/api/email/verify?token=${encodeURIComponent(rawToken)}`;

  try {
    await sendVerificationEmail(email, rawToken);

    if (config.smtp.isEnabled) {
      await sendMessage(
        chatId,
        `Email set to <code>${escapeHtml(email)}</code>.\n\n` +
          `A verification link has been sent to your email address (valid for 24h). ` +
          `Please click the link to activate email alerts.`
      );
    } else {
      // In local dev without SMTP configured, include the direct link for easy testing
      await sendMessage(
        chatId,
        `Email set to <code>${escapeHtml(email)}</code>.\n\n` +
          `<i>(SMTP not configured)</i> Verification link (valid 24h):\n` +
          `<a href="${verifyUrl}">${verifyUrl}</a>`
      );
    }
  } catch (err) {
    logger.error(`Failed to dispatch verification email: ${err.message}`);
    await sendMessage(
      chatId,
      "Failed to send verification email. Please check the address or try again later."
    );
  }
}

/**
 * Long-polling loop for development mode (TELEGRAM_MODE=polling)
 */
async function runPollingLoop() {
  let offset = 0;

  logger.info("Starting Telegram Bot long-polling loop...");

  while (isPolling) {
    try {
      pollingAbortController = new AbortController();
      const url = `${TELEGRAM_API_BASE}/bot${config.telegram.botToken}/getUpdates?offset=${offset}&timeout=25`;

      const response = await fetch(url, {
        signal: pollingAbortController.signal,
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        logger.warn(
          `Telegram getUpdates returned status ${response.status}: ${errBody.description || response.statusText}`
        );
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }

      const data = await response.json();
      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          await handleUpdate(update);
        }
      }
    } catch (err) {
      if (err.name === "AbortError" || !isPolling) {
        break;
      }
      logger.warn(`Telegram polling loop error: ${err.message}`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  logger.info("Telegram Bot long-polling loop exited.");
}

/**
 * Registers webhook with Telegram API when running in webhook mode
 */
export async function registerWebhook() {
  if (!config.telegram.botToken || !config.telegram.webhookSecret) {
    logger.warn("Cannot register webhook: bot token or webhook secret missing");
    return false;
  }

  const webhookUrl = `${config.publicUrl}/api/telegram/webhook`;
  const url = `${TELEGRAM_API_BASE}/bot${config.telegram.botToken}/setWebhook`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: config.telegram.webhookSecret,
        allowed_updates: ["message"],
      }),
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json().catch(() => ({}));
    if (data.ok) {
      logger.info(`Telegram webhook successfully registered: ${webhookUrl}`);
      return true;
    } else {
      logger.error(`Failed to register Telegram webhook: ${data.description}`);
      return false;
    }
  } catch (err) {
    logger.error(`Error while registering Telegram webhook: ${err.message}`);
    return false;
  }
}

/**
 * Starts the Telegram service (polling or webhook depending on configuration)
 */
export function startTelegramService() {
  if (!config.telegram.isEnabled) {
    logger.info("Telegram integration disabled (no bot token provided).");
    return;
  }

  if (config.telegram.mode === "polling") {
    isPolling = true;
    runPollingLoop();
  } else if (config.telegram.mode === "webhook") {
    registerWebhook();
  }
}

/**
 * Stops the Telegram polling loop cleanly on shutdown
 */
export function stopTelegramService() {
  isPolling = false;
  if (pollingAbortController) {
    pollingAbortController.abort();
    pollingAbortController = null;
  }
}
