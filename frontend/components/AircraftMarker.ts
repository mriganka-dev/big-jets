import L from "leaflet";
import type { AircraftItem } from "@/lib/schemas";
import { formatAltitude, formatDistance, formatSpeed } from "@/lib/format";
import { PHASE_LABELS, type FlightPhaseKey } from "@/lib/constants";

// Flightradar24 Iconic Airliner Silhouette (Twin Jet, swept wings)
const AIRLINER_SVG_HTML =
  '<svg viewBox="0 0 32 32" width="26" height="26" class="marker-plane-svg" focusable="false" aria-hidden="true"><path d="M16 2 C15.2 2 14.5 3 14.5 4.5 L14.5 12 L3 17.5 L3 20 L14.5 17.5 L14.5 24.5 L11.5 27 L11.5 29 L16 28 L20.5 29 L20.5 27 L17.5 24.5 L17.5 17.5 L29 20 L29 17.5 L17.5 12 L17.5 4.5 C17.5 3 16.8 2 16 2 Z" fill="currentColor" stroke="#000" stroke-width="0.8"/></svg>';

// Flightradar24 Heavy / Jumbo Jet Silhouette (A380 / B747 / C17 / B777)
const HEAVY_SVG_HTML =
  '<svg viewBox="0 0 36 36" width="30" height="30" class="marker-plane-svg" focusable="false" aria-hidden="true"><path d="M18 2 C17 2 16.2 3.2 16.2 5 L16.2 13.5 L2 19 L2 22 L16.2 19.5 L16.2 27.5 L12.5 30.5 L12.5 33 L18 31.8 L23.5 33 L23.5 30.5 L19.8 27.5 L19.8 19.5 L34 22 L34 19 L19.8 13.5 L19.8 5 C19.8 3.2 19 2 18 2 Z" fill="currentColor" stroke="#000" stroke-width="0.8"/></svg>';

// Flightradar24 Fighter Jet Silhouette
const FIGHTER_SVG_HTML =
  '<svg viewBox="0 0 28 28" width="22" height="22" class="marker-plane-svg" focusable="false" aria-hidden="true"><path d="M14 2 L12 9 L4 17 L4 19.5 L12 18 L12 23 L9 25.5 L9 27 L14 26 L19 27 L19 25.5 L16 23 L16 18 L24 19.5 L24 17 L16 9 Z" fill="currentColor" stroke="#000" stroke-width="0.8"/></svg>';

// Light Aircraft / Propeller Silhouette
const PROP_SVG_HTML =
  '<svg viewBox="0 0 24 24" width="20" height="20" class="marker-plane-svg" focusable="false" aria-hidden="true"><path d="M12 2 L10.5 7 L2 9 L2 11 L10.5 11.5 L10.5 17.5 L7.5 19.5 L7.5 21 L12 20.2 L16.5 21 L16.5 19.5 L13.5 17.5 L13.5 11.5 L22 11 L22 9 L13.5 7 Z" fill="currentColor" stroke="#000" stroke-width="0.8"/></svg>';

// Neutral dot for aircraft stationary on ground or without heading
const DOT_SVG_HTML =
  '<svg viewBox="0 0 16 16" width="10" height="10" class="marker-dot-svg" focusable="false" aria-hidden="true"><circle cx="8" cy="8" r="5" fill="currentColor" stroke="#000" stroke-width="1"/></svg>';

export interface ManagedMarker {
  marker: L.Marker;
  aircraft: AircraftItem;
  baseLat: number;
  baseLon: number;
  timestamp: number;
  polyTrail?: L.Polyline;
}

/**
 * Determine CSS class name by importance category
 */
export function getMarkerPriorityClass(categories: string[]): string {
  if (categories.includes("MIL_FIGHTER")) return "marker-importance-fighter";
  if (categories.includes("RARE")) return "marker-importance-rare";
  if (categories.includes("BIG")) return "marker-importance-big";
  if (categories.includes("VIP_JET")) return "marker-importance-vip";
  return "marker-importance-normal";
}

/**
 * Select appropriate FR24 airplane silhouette SVG based on type/category
 */
function getAircraftSvg(aircraft: AircraftItem): string {
  if (typeof aircraft.track !== "number") {
    return DOT_SVG_HTML;
  }
  if (aircraft.categories.includes("MIL_FIGHTER")) {
    return FIGHTER_SVG_HTML;
  }
  if (aircraft.categories.includes("BIG")) {
    return HEAVY_SVG_HTML;
  }
  const typeCode = aircraft.type?.toUpperCase() || "";
  if (["C172", "C182", "P28A", "SR22", "DA40", "C152", "PA28"].includes(typeCode)) {
    return PROP_SVG_HTML;
  }
  return AIRLINER_SVG_HTML;
}

/**
 * Create a Leaflet DivIcon with FR24 styling
 */
export function createAircraftIcon(
  aircraft: AircraftItem,
  isSelected: boolean,
): L.DivIcon {
  const isGround = aircraft.onGround === true;
  const priorityClass = getMarkerPriorityClass(aircraft.categories);

  const classes = [
    "aircraft-marker-node",
    priorityClass,
    isGround ? "marker-is-ground" : "marker-is-airborne",
    isSelected ? "marker-is-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const innerSvg = getAircraftSvg(aircraft);

  const html = `<div class="${classes}" data-hex="${aircraft.hex}">${innerSvg}</div>`;

  return L.divIcon({
    className: "aircraft-div-icon-container",
    html,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

/**
 * Updates an existing marker's DOM rotation and selection state directly via DOM APIs
 */
export function updateMarkerElement(
  element: HTMLElement | null | undefined,
  aircraft: AircraftItem,
  isSelected: boolean,
): void {
  if (!element) return;

  const inner = element.querySelector<HTMLElement>(".aircraft-marker-node");
  if (!inner) return;

  // Set rotation directly via DOM API
  if (typeof aircraft.track === "number") {
    inner.style.transform = `rotate(${aircraft.track}deg)`;
  } else {
    inner.style.transform = "";
  }

  // Update selection outline class
  if (isSelected) {
    inner.classList.add("marker-is-selected");
  } else {
    inner.classList.remove("marker-is-selected");
  }

  // Update ground status class
  if (aircraft.onGround === true) {
    inner.classList.add("marker-is-ground");
    inner.classList.remove("marker-is-airborne");
  } else {
    inner.classList.remove("marker-is-ground");
    inner.classList.add("marker-is-airborne");
  }
}

/**
 * Builds safe tooltip content using strictly DOM APIs and textContent (NO innerHTML)
 */
export function buildSafeTooltipContent(aircraft: AircraftItem): HTMLElement {
  const container = document.createElement("div");
  container.className = "marker-tooltip-content";

  const callsignEl = document.createElement("strong");
  callsignEl.className = "tooltip-callsign tabular-nums";
  callsignEl.textContent =
    aircraft.callsign?.trim() || aircraft.hex.toUpperCase();
  container.appendChild(callsignEl);

  if (aircraft.reg) {
    const regEl = document.createElement("span");
    regEl.className = "tooltip-reg tabular-nums";
    regEl.textContent = ` (${aircraft.reg})`;
    container.appendChild(regEl);
  }

  const subLine = document.createElement("div");
  subLine.className = "tooltip-sub";
  const typeText = aircraft.type || "Aircraft";
  const altText = formatAltitude(aircraft.altFt, aircraft.onGround);
  const spdText = formatSpeed(aircraft.speedKt);
  subLine.textContent = `${typeText} · ${altText} · ${spdText}`;
  container.appendChild(subLine);

  return container;
}

/**
 * Builds safe popup content using strictly DOM APIs and textContent
 */
export function buildSafePopupContent(
  aircraft: AircraftItem,
  onSelect: (hex: string) => void,
): HTMLElement {
  const container = document.createElement("div");
  container.className = "marker-popup-content";

  const header = document.createElement("div");
  header.className = "popup-header";

  const callsign = document.createElement("h3");
  callsign.className = "popup-callsign tabular-nums";
  callsign.textContent =
    aircraft.callsign?.trim() || aircraft.hex.toUpperCase();
  header.appendChild(callsign);

  if (aircraft.reg) {
    const reg = document.createElement("span");
    reg.className = "popup-reg tabular-nums";
    reg.textContent = aircraft.reg;
    header.appendChild(reg);
  }
  container.appendChild(header);

  const typeLine = document.createElement("p");
  typeLine.className = "popup-type";
  typeLine.textContent = `${aircraft.type || "Unknown Type"}${aircraft.model ? ` · ${aircraft.model}` : ""}`;
  container.appendChild(typeLine);

  if (aircraft.operator) {
    const opLine = document.createElement("p");
    opLine.className = "popup-operator";
    opLine.textContent = aircraft.operator;
    container.appendChild(opLine);
  }

  const phaseKey = aircraft.phase as FlightPhaseKey;
  const statusLine = document.createElement("p");
  statusLine.className = "popup-phase";
  statusLine.textContent = `Status: ${PHASE_LABELS[phaseKey] || aircraft.phase}`;
  container.appendChild(statusLine);

  const telemetry = document.createElement("div");
  telemetry.className = "popup-telemetry tabular-nums";
  telemetry.textContent = `Alt: ${formatAltitude(aircraft.altFt, aircraft.onGround)} | Spd: ${formatSpeed(aircraft.speedKt)} | Dist: ${formatDistance(aircraft.distKm)}`;
  container.appendChild(telemetry);

  const selectBtn = document.createElement("button");
  selectBtn.type = "button";
  selectBtn.className = "popup-select-btn";
  selectBtn.textContent = "View Details →";
  selectBtn.addEventListener("click", () => onSelect(aircraft.hex));
  container.appendChild(selectBtn);

  return container;
}
