import { z } from "zod";

// Schema for individual airport metadata
export const airportItemSchema = z.object({
  icao: z.string().length(4),
  iata: z.string().max(10).nullable(),
  name: z.string().max(100),
  city: z.string().max(100).nullable(),
  country: z.string().max(100),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  elevationFt: z.number(),
});

// Schema for GET /api/airports response
export const airportsResponseSchema = z.object({
  airports: z.array(airportItemSchema),
});

// Schema for GET /api/airports/search response
export const airportSearchResponseSchema = z.object({
  airports: z.array(airportItemSchema),
});

// Valid aircraft alert categories
export const aircraftCategorySchema = z.enum([
  "BIG",
  "RARE",
  "MIL_FIGHTER",
  "MIL_OTHER",
  "VIP_JET",
  "WATCHED",
]);

// Valid flight phases
export const flightPhaseSchema = z.enum([
  "ground",
  "approach",
  "departing",
  "descending",
  "climbing",
  "enroute",
]);

// Schema for individual aircraft in feed
export const aircraftItemSchema = z.object({
  hex: z.string().max(20),
  callsign: z.string().max(20).nullable().optional(),
  reg: z.string().max(20).nullable().optional(),
  type: z.string().max(20).nullable().optional(),
  model: z.string().max(200).nullable().optional(),
  operator: z.string().max(200).nullable().optional(),
  altFt: z.number().nullable().optional(),
  onGround: z.boolean().nullable().optional(),
  speedKt: z.number().nullable().optional(),
  vRate: z.number().nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lon: z.number().min(-180).max(180).nullable().optional(),
  track: z.number().nullable().optional(),
  distKm: z.number().min(0).nullable().optional(),
  squawk: z.string().nullable().optional(),
  phase: flightPhaseSchema.catch("enroute"),
  categories: z.array(z.string().max(50)).default([]),
});

// Schema for GET /api/airports/:icao/aircraft response
export const aircraftResponseSchema = z.object({
  airport: z.object({
    icao: z.string().length(4),
    name: z.string().max(100),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }),
  radiusNm: z.number().optional().nullable(),
  updatedAt: z.string().max(50),
  count: z.number().min(0),
  aircraft: z.array(aircraftItemSchema),
});

// Inferred TypeScript types
export type AirportItem = z.infer<typeof airportItemSchema>;
export type AirportsResponse = z.infer<typeof airportsResponseSchema>;
export type AirportSearchResponse = z.infer<typeof airportSearchResponseSchema>;
export type AircraftCategory = z.infer<typeof aircraftCategorySchema>;
export type FlightPhase = z.infer<typeof flightPhaseSchema>;
export type AircraftItem = z.infer<typeof aircraftItemSchema>;
export type AircraftResponse = z.infer<typeof aircraftResponseSchema>;
