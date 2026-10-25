"use client";

import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { AirportItem, AircraftItem } from "@/lib/schemas";
import {
  createAircraftIcon,
  updateMarkerElement,
  buildSafeTooltipContent,
  buildSafePopupContent,
  type ManagedMarker,
} from "./AircraftMarker";

interface AircraftMapProps {
  airport: AirportItem;
  aircraft: AircraftItem[];
  radiusNm?: number;
  selectedHex?: string | null;
  onSelectAircraft?: (hex: string) => void;
  maxMarkerCapHit?: boolean;
}

export default function AircraftMap({
  airport,
  aircraft,
  selectedHex,
  onSelectAircraft = () => {},
}: AircraftMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersMapRef = useRef<Map<string, ManagedMarker>>(new Map());
  const trailsMapRef = useRef<Map<string, [number, number][]>>(new Map());
  const trailsLayerRef = useRef<L.LayerGroup | null>(null);

  // 1. Initialize Map instance (open global navigation)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) {
      return;
    }

    const map = L.map(mapContainerRef.current, {
      center: [airport.lat, airport.lon],
      zoom: 3,
      minZoom: 2,
      maxZoom: 18,
      maxBounds: [
        [-85, -180],
        [85, 180],
      ],
      maxBoundsViscosity: 0.5,
      scrollWheelZoom: true,
      keyboard: true,
      worldCopyJump: true,
      zoomControl: false,
    });

    // Flightradar24 Style Top-Right Controls Stack
    L.control.zoom({ position: "topright" }).addTo(map);

    // Custom "Center on Airport" Map Control
    const CenterControl = L.Control.extend({
      options: { position: "topright" },
      onAdd: function () {
        const container = L.DomUtil.create("div", "leaflet-bar fr24-center-control");
        const btn = L.DomUtil.create("a", "fr24-center-btn", container);
        btn.href = "#";
        btn.title = `Center view on ${airport.name} (${airport.icao})`;
        btn.setAttribute("role", "button");
        btn.setAttribute("aria-label", "Center view on airport");
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="7"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>`;
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.on(btn, "click", (e) => {
          L.DomEvent.preventDefault(e);
          map.setView([airport.lat, airport.lon], 4, { animate: true });
        });
        return container;
      },
    });
    new CenterControl().addTo(map);

    // OpenStreetMap Tile Layer (with strict CSP compatibility)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Trails layer
    const trailsLayer = L.layerGroup().addTo(map);
    trailsLayerRef.current = trailsLayer;

    // Airport Center Blip
    const airportIcon = L.divIcon({
      className: "radar-airport-marker-container",
      html: `<div class="airport-center-blip" title="${airport.name} (${airport.icao})"><span class="blip-dot"></span><span class="blip-pulse"></span></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const airportMarker = L.marker([airport.lat, airport.lon], {
      icon: airportIcon,
      zIndexOffset: 500,
    }).addTo(map);

    const airportPopup = document.createElement("div");
    airportPopup.className = "airport-center-popup";
    const airportTitle = document.createElement("strong");
    airportTitle.textContent = `${airport.name} (${airport.icao})`;
    airportPopup.appendChild(airportTitle);
    const airportDesc = document.createElement("div");
    airportDesc.textContent = airport.city
      ? `${airport.city}, ${airport.country}`
      : airport.country;
    airportPopup.appendChild(airportDesc);
    airportMarker.bindPopup(airportPopup);

    mapInstanceRef.current = map;

    const markersMap = markersMapRef.current;
    const trailsMap = trailsMapRef.current;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      trailsLayerRef.current = null;
      markersMap.clear();
      trailsMap.clear();
    };
  }, [
    airport.lat,
    airport.lon,
    airport.name,
    airport.icao,
    airport.city,
    airport.country,
  ]);

  // 2. Pan to airport when selected airport changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.panTo([airport.lat, airport.lon]);
  }, [airport.lat, airport.lon]);

  // 3. Diff and Update Aircraft Markers without flicker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // All aircraft with valid coordinates are eligible globally
    const eligibleAircraft = aircraft.filter((ac) => {
      return typeof ac.lat === "number" && typeof ac.lon === "number";
    });

    // Priority sorting (selected first, rare/fighter, big, then nearest)
    const prioritizedAircraft = [...eligibleAircraft].sort((a, b) => {
      const aSelected = selectedHex?.toUpperCase() === a.hex.toUpperCase();
      const bSelected = selectedHex?.toUpperCase() === b.hex.toUpperCase();
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;

      const aRare =
        a.categories.includes("RARE") || a.categories.includes("MIL_FIGHTER");
      const bRare =
        b.categories.includes("RARE") || b.categories.includes("MIL_FIGHTER");
      if (aRare && !bRare) return -1;
      if (!aRare && bRare) return 1;

      const aBig = a.categories.includes("BIG");
      const bBig = b.categories.includes("BIG");
      if (aBig && !bBig) return -1;
      if (!aBig && bBig) return 1;

      return (a.distKm ?? 9999) - (b.distKm ?? 9999);
    });

    const displayAircraft = prioritizedAircraft.slice(0, 2000);
    const activeHexSet = new Set<string>();

    const markersMap = markersMapRef.current;
    const trailsMap = trailsMapRef.current;
    const trailsLayer = trailsLayerRef.current;

    for (const ac of displayAircraft) {
      const hexKey = ac.hex.toUpperCase();
      activeHexSet.add(hexKey);

      const isSelected = selectedHex?.toUpperCase() === hexKey;
      const pos: [number, number] = [ac.lat!, ac.lon!];

      // Update in-memory trail history (up to 20 points, memory only)
      let trail = trailsMap.get(hexKey);
      if (!trail) {
        trail = [pos];
        trailsMap.set(hexKey, trail);
      } else {
        const last = trail[trail.length - 1];
        if (!last || last[0] !== pos[0] || last[1] !== pos[1]) {
          trail.push(pos);
          if (trail.length > 20) {
            trail.shift();
          }
        }
      }

      const existing = markersMap.get(hexKey);

      if (existing) {
        // Move existing marker smoothly
        existing.marker.setLatLng(pos);
        existing.aircraft = ac;
        existing.baseLat = pos[0];
        existing.baseLon = pos[1];
        existing.timestamp = Date.now();

        // Update DOM element rotation & styles without recreating the marker
        const el = existing.marker.getElement();
        updateMarkerElement(el, ac, isSelected);

        // Update popup & tooltip content safely via DOM
        existing.marker.setTooltipContent(buildSafeTooltipContent(ac));

        // Update z-index offset on selection
        existing.marker.setZIndexOffset(isSelected ? 9999 : 100);

        // Update trail polyline
        if (existing.polyTrail) {
          existing.polyTrail.setLatLngs(trail);
          existing.polyTrail.setStyle({
            color: isSelected ? "#d97706" : "#f59e0b",
            weight: isSelected ? 3.5 : 1.5,
            opacity: isSelected ? 0.95 : 0.45,
            dashArray: isSelected ? undefined : "3, 6",
          });
        } else if (trail.length > 1 && trailsLayer) {
          const poly = L.polyline(trail, {
            color: isSelected ? "#d97706" : "#f59e0b",
            weight: isSelected ? 3.5 : 1.5,
            opacity: isSelected ? 0.95 : 0.45,
            dashArray: isSelected ? undefined : "3, 6",
          }).addTo(trailsLayer);
          existing.polyTrail = poly;
        }
      } else {
        // Create new marker
        const icon = createAircraftIcon(ac, isSelected);
        const marker = L.marker(pos, {
          icon,
          zIndexOffset: isSelected ? 9999 : 100,
        }).addTo(map);

        // Bind click-to-select and pan smoothly
        marker.on("click", () => {
          onSelectAircraft(ac.hex);
          map.panTo(pos, { animate: true, duration: 0.5 });
        });

        // Bind safe tooltip
        marker.bindTooltip(buildSafeTooltipContent(ac), {
          direction: "top",
          offset: [0, -14],
          className: "custom-safe-tooltip",
        });

        // Bind safe popup
        marker.bindPopup(buildSafePopupContent(ac, onSelectAircraft), {
          className: "custom-safe-popup",
        });

        // Initialize trail polyline if available
        let polyTrail: L.Polyline | undefined;
        if (trail.length > 1 && trailsLayer) {
          polyTrail = L.polyline(trail, {
            color: isSelected ? "#d97706" : "#f59e0b",
            weight: isSelected ? 3.5 : 1.5,
            opacity: isSelected ? 0.95 : 0.45,
            dashArray: isSelected ? undefined : "3, 6",
          }).addTo(trailsLayer);
        }

        // Apply DOM rotation immediately once mounted
        requestAnimationFrame(() => {
          const el = marker.getElement();
          updateMarkerElement(el, ac, isSelected);
        });

        markersMap.set(hexKey, {
          marker,
          aircraft: ac,
          baseLat: pos[0],
          baseLon: pos[1],
          timestamp: Date.now(),
          polyTrail,
        });
      }
    }

    // Remove disappeared markers
    for (const [hexKey, managed] of markersMap.entries()) {
      if (!activeHexSet.has(hexKey)) {
        managed.marker.remove();
        if (managed.polyTrail) {
          managed.polyTrail.remove();
        }
        markersMap.delete(hexKey);
        trailsMap.delete(hexKey);
      }
    }
  }, [aircraft, selectedHex, onSelectAircraft]);

  // 4. Smooth movement between polls (dead reckoning estimated position)
  // Respects prefers-reduced-motion, applies strictly for up to 15s between polls
  useEffect(() => {
    let animId: number;
    let lastTick = Date.now();

    const tick = () => {
      const now = Date.now();
      // Tick every ~250ms for smooth marker advance
      if (now - lastTick >= 250) {
        lastTick = now;

        const prefersReducedMotion =
          typeof window !== "undefined" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        if (!prefersReducedMotion) {
          const markersMap = markersMapRef.current;
          for (const managed of markersMap.values()) {
            const ac = managed.aircraft;
            if (
              ac.onGround === true ||
              typeof ac.track !== "number" ||
              typeof ac.speedKt !== "number" ||
              ac.speedKt < 30
            ) {
              continue;
            }

            const elapsedSec = (now - managed.timestamp) / 1000;
            // Cap strictly to 15 seconds until the next poll
            if (elapsedSec > 0 && elapsedSec <= 15) {
              const distMeters = ac.speedKt * (1852 / 3600) * elapsedSec;
              const rad = (ac.track * Math.PI) / 180;
              const dLat = (distMeters * Math.cos(rad)) / 111320;
              const cosBase = Math.cos((managed.baseLat * Math.PI) / 180);
              const dLon =
                (distMeters * Math.sin(rad)) /
                (111320 * Math.max(cosBase, 0.1));

              const estimatedLat = managed.baseLat + dLat;
              const estimatedLon = managed.baseLon + dLon;
              managed.marker.setLatLng([estimatedLat, estimatedLon]);
            }
          }
        }
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div
      ref={mapContainerRef}
      className="radar-leaflet-map-canvas"
      tabIndex={0}
      aria-label={`Interactive live radar map centered on ${airport.name} (${airport.icao})`}
      role="application"
    />
  );
}
