import { handleUpdate } from "../services/telegram.js";
import { logger } from "../utils/logger.js";

/**
 * Controller to handle incoming updates from Telegram Webhook.
 */
export async function handleWebhookUpdate(req, res, next) {
  try {
    const update = req.body;
    await handleUpdate(update);
    return res.status(200).json({ ok: true });
  } catch (err) {
    logger.error(`Error processing webhook update: ${err.message}`);
    // Always return 200 to Telegram so it does not endlessly retry failed updates
    return res.status(200).json({ ok: false });
  }
}
