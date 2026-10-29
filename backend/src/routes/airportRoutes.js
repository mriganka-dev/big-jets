import { Router } from "express";
import {
  getAirports,
  searchAirportsHandler,
  getAirportByIcaoHandler,
} from "../controllers/airportController.js";
import { getAirportAircraft } from "../controllers/aircraftController.js";
import { getFlightRouteHandler } from "../controllers/flightRouteController.js";
import {
  aircraftLimiter,
  airportSearchLimiter,
} from "../middlewares/rateLimiters.js";

export const airportRoutes = Router();

// Order matters: fixed paths before parameterized /:icao
airportRoutes.get("/airports", aircraftLimiter, getAirports);
airportRoutes.get(
  "/airports/search",
  airportSearchLimiter,
  searchAirportsHandler
);
airportRoutes.get("/airports/:icao", aircraftLimiter, getAirportByIcaoHandler);
airportRoutes.get(
  "/airports/:icao/aircraft",
  aircraftLimiter,
  getAirportAircraft
);
airportRoutes.get("/routes/:callsign", aircraftLimiter, getFlightRouteHandler);

