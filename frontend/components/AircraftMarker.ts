import L from "leaflet";
import type { AircraftItem } from "@/lib/schemas";
import { formatAltitude, formatDistance, formatSpeed } from "@/lib/format";
import { PHASE_LABELS, type FlightPhaseKey } from "@/lib/constants";

// Top-down aircraft silhouette SVG pointing North (0 degrees)
const PLANE_SVG_HTML =
  '<svg viewBox="0 0 24 24" width="22" height="22" class="marker-plane-svg" focusable="false" aria-hidden="true"><path d="M12 2 L14 9 L22 13 L22 15 L14 13.5 L14 19 L17 21 L17 22.5 L12 21.5 L7 22.5 L7 21 L10 19 L10 13.5 L2 15 L2 13 L10 9 Z" fill="currentColor"/></svg>';

// Neutral dot SVG for aircraft without heading/track
const DOT_SVG_HTML =
  '<svg viewBox="0 0 24 24" width="12" height="12" class="marker-dot-svg" focusable="false" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="currentColor"/></svg>';

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
  if (categories.includes("RARE")) return "marker-importance-rare";
  if (categories.includes("MIL_FIGHTER")) return "marker-importance-fighter";
  if (categories.includes("BIG")) return "marker-importance-big";
  if (categories.includes("VIP_JET")) return "marker-importance-vip";
  return "marker-importance-normal";
}

/**
 * Create a Leaflet DivIcon WITHOUT any inline style="..." attribute in the HTML string.
 * Rotation and transformation are applied strictly via DOM properties after creation.
 */
export function createAircraftIcon(aircraft: AircraftItem, isSelected: boolean): L.DivIcon {
  const isGround = aircraft.onGround === true;
  const hasTrack = typeof aircraft.track === "number";
  const priorityClass = getMarkerPriorityClass(aircraft.categories);

  const classes = [
    "aircraft-marker-node",
    priorityClass,
    isGround ? "marker-is-ground" : "marker-is-airborne",
    isSelected ? "marker-is-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const innerSvg = hasTrack ? PLANE_SVG_HTML : DOT_SVG_HTML;

  // Notice: Strict rule compliance - NO style="..." attribute in HTML string
  const html = `<div class="${classes}" data-hex="${aircraft.hex}">${innerSvg}</div>`;

  return L.divIcon({
    className: "aircraft-div-icon-container",
    html,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/**
 * Updates an existing marker's DOM rotation and selection state directly via DOM APIs
 */
export function updateMarkerElement(
  element: HTMLElement | null | undefined,
  aircraft: AircraftItem,
  isSelected: boolean
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
  callsignEl.textContent = aircraft.callsign?.trim() || aircraft.hex.toUpperCase();
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
  onSelect: (hex: string) => void
): HTMLElement {
  const container = document.createElement("div");
  container.className = "marker-popup-content";

  const header = document.createElement("div");
  header.className = "popup-header";

  const callsign = document.createElement("h3");
  callsign.className = "popup-callsign tabular-nums";
  callsign.textContent = aircraft.callsign?.trim() || aircraft.hex.toUpperCase();
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
