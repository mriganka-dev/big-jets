import { z } from "zod";
import { AIRPORTS, CATEGORIES, LIMITS } from "../constants.js";

const validCategories = Object.values(CATEGORIES);

export const icaoSchema = z
  .string()
  .regex(/^[A-Za-z]{4}$/, "ICAO must be exactly 4 letters")
  .transform((val) => val.toUpperCase())
  .refine((val) => Object.hasOwn(AIRPORTS, val), {
    message: "Unknown airport ICAO code",
  });

export const radiusSchema = z.coerce
  .number()
  .int("Radius must be an integer")
  .min(
    LIMITS.MIN_RADIUS_NM,
    `Radius must be at least ${LIMITS.MIN_RADIUS_NM} NM`
  )
  .max(LIMITS.MAX_RADIUS_NM, `Radius cannot exceed ${LIMITS.MAX_RADIUS_NM} NM`)
  .default(LIMITS.DEFAULT_RADIUS_NM);

export const categoryQuerySchema = z
  .string()
  .max(100)
  .optional()
  .refine(
    (val) => {
      if (!val) return true;
      const parts = val.split(",").map((s) => s.trim().toUpperCase());
      const unique = new Set(parts);
      if (unique.size > 6) return false;
      return parts.every((cat) => validCategories.includes(cat));
    },
    {
      message: `Category must be a comma-separated list of valid categories: ${validCategories.join(", ")} (max 6)`,
    }
  )
  .transform((val) => {
    if (!val) return [];
    return [...new Set(val.split(",").map((s) => s.trim().toUpperCase()))];
  });

export const booleanStringSchema = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .optional()
  .transform((val) => val === true || val === "true");

export const aircraftTypeSchema = z
  .string()
  .regex(
    /^[A-Za-z0-9]{2,4}$/,
    "Aircraft type must be 2 to 4 alphanumeric characters"
  )
  .transform((val) => val.toUpperCase());

export const registrationSchema = z
  .string()
  .regex(
    /^[A-Za-z0-9-]{3,10}$/,
    "Registration must be 3 to 10 alphanumeric/hyphen characters"
  )
  .transform((val) => val.toUpperCase());

export const emailSchema = z
  .string()
  .trim()
  .max(254, "Email too long")
  .email("Invalid email format")
  .refine(
    (val) => !/[\r\n]/.test(val),
    "Email must not contain newline characters"
  )
  .transform((val) => val.toLowerCase());

export const hexTokenSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{64}$/, "Token must be a 64-character hex string");

// Public aircraft query validator
export const airportAircraftQuerySchema = z.object({
  radius: radiusSchema,
  category: categoryQuerySchema,
  all: booleanStringSchema,
});
