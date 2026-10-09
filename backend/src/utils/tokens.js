import crypto from "crypto";

/**
 * Generate a cryptographically secure random token (64 hex characters).
 */
export function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Compute SHA-256 hash of a token in hex format.
 */
export function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

/**
 * Timing-safe comparison of two hash strings.
 */
export function compareHashes(hashA, hashB) {
  if (typeof hashA !== "string" || typeof hashB !== "string") {
    return false;
  }

  const bufA = Buffer.from(hashA, "utf8");
  const bufB = Buffer.from(hashB, "utf8");

  if (bufA.length !== bufB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}
