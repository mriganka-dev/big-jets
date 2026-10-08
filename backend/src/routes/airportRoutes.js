import { Router } from "express";
import { getAirportAircraft } from "../controllers/aircraftController.js";
import { aircraftLimiter } from "../middlewares/rateLimiters.js";

export const airportRoutes = Router();

airportRoutes.get(
  "/airports/:icao/aircraft",
  aircraftLimiter,
  getAirportAircraft
);
