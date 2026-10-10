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
  radiusNm: number;
  selectedHex?: string | null;
  onSelectAircraft?: (hex: string) => void;
  maxMarkerCapHit?: boolean;
}

export default function AircraftMap({
  airport,
  aircraft,
  radiusNm,
  selectedHex,
  onSelectAircraft = () => {},
}: AircraftMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersMapRef = useRef<Map<string, ManagedMarker>>(new Map());
  const trailsMapRef = useRef<Map<string, [number, number][]>>(new Map());
  const circleRef = useRef<L.Circle | null>(null);
  const trailsLayerRef = useRef<L.LayerGroup | null>(null);

  // Helper to calculate airport bounds with 35% padding
  const getAirportBounds = useCallback(
    (lat: number, lon: number, radiusInNm: number) => {
      const radiusKm = radiusInNm * 1.852;
      const latDelta = (radiusKm / 111) * 1.35;
      const cosLat = Math.cos((lat * Math.PI) / 180);
      const lonDelta = (radiusKm / (111 * Math.max(cosLat, 0.1))) * 1.35;

      return L.latLngBounds(
        [lat - latDelta, lon - lonDelta],
        [lat + latDelta, lon + lonDelta]
      );
    },
    []
  );

  // 1. Initialize Map instance
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) {
      return;
    }

    const bounds = getAirportBounds(airport.lat, airport.lon, radiusNm);

    const map = L.map(mapContainerRef.current, {
      center: [airport.lat, airport.lon],
      zoom: 8,
      minZoom: 6,
      maxZoom: 15,
      maxBounds: bounds,
      maxBoundsViscosity: 0.8,
      scrollWheelZoom: true,
      keyboard: true,
    });

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
    airportDesc.textContent = airport.fullName;
    airportPopup.appendChild(airportDesc);
    airportMarker.bindPopup(airportPopup);

    // Detection Radius dashed perimeter circle
    const circle = L.circle([airport.lat, airport.lon], {
      radius: radiusNm * 1852,
      color: "#38bdf8",
      weight: 1.5,
      dashArray: "6, 8",
      fillColor: "#0284c7",
      fillOpacity: 0.03,
    }).addTo(map);
    circleRef.current = circle;

    mapInstanceRef.current = map;

    const markersMap = markersMapRef.current;
    const trailsMap = trailsMapRef.current;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      circleRef.current = null;
      trailsLayerRef.current = null;
      markersMap.clear();
      trailsMap.clear();
    };
  }, [airport.lat, airport.lon, airport.name, airport.icao, airport.fullName, getAirportBounds, radiusNm]);

  // 2. Update Airport Bounds and Radius Circle when radius or airport changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const bounds = getAirportBounds(airport.lat, airport.lon, radiusNm);
    map.setMaxBounds(bounds);

    if (circleRef.current) {
      circleRef.current.setLatLng([airport.lat, airport.lon]);
      circleRef.current.setRadius(radiusNm * 1852);
    }
  }, [airport.lat, airport.lon, radiusNm, getAirportBounds]);

  // 3. Diff and Update Aircraft Markers without flicker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Respect NEXT_PUBLIC_SHOW_MILITARY_ON_MAP privacy rule
    const showMilitary = process.env.NEXT_PUBLIC_SHOW_MILITARY_ON_MAP === "true";

    const eligibleAircraft = aircraft.filter((ac) => {
      if (typeof ac.lat !== "number" || typeof ac.lon !== "number") {
        return false;
      }
      if (!showMilitary) {
        if (
          ac.categories.includes("MIL_FIGHTER") ||
          ac.categories.includes("MIL_OTHER")
        ) {
          return false;
        }
      }
      return true;
    });

    // 300 marker cap with priority sorting (selected, rare/fighter, big, then nearest)
    const prioritizedAircraft = [...eligibleAircraft].sort((a, b) => {
      const aSelected = selectedHex?.toUpperCase() === a.hex.toUpperCase();
      const bSelected = selectedHex?.toUpperCase() === b.hex.toUpperCase();
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;

      const aRare = a.categories.includes("RARE") || a.categories.includes("MIL_FIGHTER");
      const bRare = b.categories.includes("RARE") || b.categories.includes("MIL_FIGHTER");
      if (aRare && !bRare) return -1;
      if (!aRare && bRare) return 1;

      const aBig = a.categories.includes("BIG");
      const bBig = b.categories.includes("BIG");
      if (aBig && !bBig) return -1;
      if (!aBig && bBig) return 1;

      return (a.distKm ?? 9999) - (b.distKm ?? 9999);
    });

    const displayAircraft = prioritizedAircraft.slice(0, 300);
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

        // Update trail polyline
        if (existing.polyTrail) {
          existing.polyTrail.setLatLngs(trail);
        } else if (trail.length > 1 && trailsLayer) {
          const poly = L.polyline(trail, {
            color: isSelected ? "#38bdf8" : "#0284c7",
            weight: isSelected ? 2 : 1,
            opacity: isSelected ? 0.6 : 0.25,
            dashArray: "3, 6",
          }).addTo(trailsLayer);
          existing.polyTrail = poly;
        }
      } else {
        // Create new marker
        const icon = createAircraftIcon(ac, isSelected);
        const marker = L.marker(pos, {
          icon,
          zIndexOffset: isSelected ? 900 : 100,
        }).addTo(map);

        // Bind click-to-select
        marker.on("click", () => {
          onSelectAircraft(ac.hex);
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
            color: isSelected ? "#38bdf8" : "#0284c7",
            weight: isSelected ? 2 : 1,
            opacity: isSelected ? 0.6 : 0.25,
            dashArray: "3, 6",
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
