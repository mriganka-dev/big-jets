import { getFlightRoute } from "../services/flightRouteService.js";

export async function getFlightRouteHandler(req, res, next) {
  try {
    const rawCallsign = req.params.callsign;
    if (!rawCallsign || typeof rawCallsign !== "string") {
      return res.status(400).json({ error: "Invalid callsign parameter" });
    }

    const cleanCallsign = rawCallsign.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,8}$/.test(cleanCallsign)) {
      return res.status(400).json({ error: "Callsign must be 2-8 alphanumeric characters" });
    }

    const route = await getFlightRoute(cleanCallsign);
    if (!route) {
      return res.status(404).json({ error: "Route not found for callsign", callsign: cleanCallsign });
    }

    return res.json({ route });
  } catch (err) {
    next(err);
  }
}
