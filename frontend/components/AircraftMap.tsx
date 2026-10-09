"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { AirportItem, AircraftItem } from "@/lib/schemas";
import { formatAltitude, formatDistance, formatSpeed, getPhotoSearchUrl } from "@/lib/format";
import { PHASE_LABELS, type FlightPhaseKey } from "@/lib/constants";

interface AircraftMapProps {
  airport: AirportItem;
  aircraft: AircraftItem[];
  radiusNm: number;
}

export default function AircraftMap({
  airport,
  aircraft,
  radiusNm,
}: AircraftMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) {
      return;
    }

    const map = L.map(mapContainerRef.current, {
      center: [airport.lat, airport.lon],
      zoom: 8,
      minZoom: 6,
      maxZoom: 14,
      scrollWheelZoom: false,
    });

    // OpenStreetMap Tile Layer with required attribution
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Airport Center Marker
    const airportIcon = L.divIcon({
      className: "custom-map-icon airport-map-icon",
      html: `<div class="airport-pin-symbol" title="${airport.name} (${airport.icao})">✈</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const airportMarker = L.marker([airport.lat, airport.lon], {
      icon: airportIcon,
      zIndexOffset: 1000,
    }).addTo(map);

    const airportPopup = document.createElement("div");
    airportPopup.className = "map-popup-node";
    const airportTitle = document.createElement("strong");
    airportTitle.textContent = `${airport.name} (${airport.icao})`;
    airportPopup.appendChild(airportTitle);
    const airportSub = document.createElement("div");
    airportSub.textContent = airport.fullName;
    airportPopup.appendChild(airportSub);
    airportMarker.bindPopup(airportPopup);

    // Aircraft Layer Group
    const layerGroup = L.layerGroup().addTo(map);
    layerGroupRef.current = layerGroup;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
      circleRef.current = null;
    };
  }, [airport.lat, airport.lon, airport.name, airport.icao, airport.fullName]);

  // Manage Radius Circle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!circleRef.current) {
      circleRef.current = L.circle([airport.lat, airport.lon], {
        radius: radiusNm * 1852,
        color: "#005fb8",
        weight: 1.5,
        dashArray: "4, 6",
        fillColor: "#005fb8",
        fillOpacity: 0.04,
      }).addTo(map);
    } else {
      circleRef.current.setRadius(radiusNm * 1852);
    }
  }, [radiusNm, airport.lat, airport.lon]);

  // Update Aircraft Markers
  useEffect(() => {
    const layerGroup = layerGroupRef.current;
    if (!layerGroup) {
      return;
    }

    layerGroup.clearLayers();

    // Respect NEXT_PUBLIC_SHOW_MILITARY_ON_MAP privacy rule
    const showMilitary = process.env.NEXT_PUBLIC_SHOW_MILITARY_ON_MAP === "true";
    const validAircraft = showMilitary
      ? aircraft
      : aircraft.filter(
          (ac) =>
            !ac.categories.includes("MIL_FIGHTER") &&
            !ac.categories.includes("MIL_OTHER")
        );

    for (const ac of validAircraft) {
      if (typeof ac.lat !== "number" || typeof ac.lon !== "number") {
        continue;
      }

      const isRare = ac.categories.includes("RARE");
      const isFighter = ac.categories.includes("MIL_FIGHTER");
      const isBig = ac.categories.includes("BIG");

      let markerClass = "marker-symbol-default";
      if (isRare) markerClass = "marker-symbol-rare";
      else if (isFighter) markerClass = "marker-symbol-fighter";
      else if (isBig) markerClass = "marker-symbol-big";

      const rotation =
        typeof ac.track === "number" ? `transform: rotate(${ac.track}deg);` : "";

      const icon = L.divIcon({
        className: "custom-map-icon aircraft-map-icon",
        html: `<div class="aircraft-marker-symbol ${markerClass}" style="${rotation}" aria-hidden="true">▲</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      const marker = L.marker([ac.lat, ac.lon], { icon }).addTo(layerGroup);

      // Construct popup using safe DOM APIs (NO innerHTML)
      const popupContent = document.createElement("div");
      popupContent.className = "map-popup-node";

      const headerLine = document.createElement("div");
      headerLine.className = "map-popup-header";
      const callsignEl = document.createElement("strong");
      callsignEl.className = "tabular-nums";
      callsignEl.textContent = ac.callsign || ac.hex.toUpperCase();
      headerLine.appendChild(callsignEl);

      if (ac.reg) {
        const regEl = document.createElement("span");
        regEl.className = "map-popup-reg tabular-nums";
        regEl.textContent = ` (${ac.reg})`;
        headerLine.appendChild(regEl);
      }
      popupContent.appendChild(headerLine);

      const typeLine = document.createElement("div");
      typeLine.className = "map-popup-type";
      typeLine.textContent = `${ac.type || "Unknown"}${
        ac.model && ac.model !== ac.type ? ` • ${ac.model}` : ""
      }`;
      popupContent.appendChild(typeLine);

      if (ac.operator) {
        const operatorLine = document.createElement("div");
        operatorLine.className = "map-popup-operator";
        operatorLine.textContent = ac.operator;
        popupContent.appendChild(operatorLine);
      }

      const phaseKey = ac.phase as FlightPhaseKey;
      const phaseLine = document.createElement("div");
      phaseLine.className = "map-popup-phase";
      phaseLine.textContent = `Status: ${PHASE_LABELS[phaseKey] || ac.phase}`;
      popupContent.appendChild(phaseLine);

      const telemetryLine = document.createElement("div");
      telemetryLine.className = "map-popup-telemetry tabular-nums";
      telemetryLine.textContent = `Alt: ${formatAltitude(
        ac.altFt,
        ac.onGround
      )} • Dist: ${formatDistance(ac.distKm)} • Spd: ${formatSpeed(ac.speedKt)}`;
      popupContent.appendChild(telemetryLine);

      if (ac.reg) {
        const photoUrl = getPhotoSearchUrl(ac.reg);
        if (photoUrl) {
          const photoLink = document.createElement("a");
          photoLink.href = photoUrl;
          photoLink.target = "_blank";
          photoLink.rel = "noopener noreferrer";
          photoLink.className = "map-popup-photo-link";
          photoLink.textContent = `Photos for ${ac.reg} ↗`;
          popupContent.appendChild(photoLink);
        }
      }

      marker.bindPopup(popupContent);
    }
  }, [aircraft]);

  return (
    <div className="map-wrapper" aria-label="Interactive radar map">
      <div ref={mapContainerRef} className="map-container" />
      <div className="map-notice">
        <span className="map-attribution-note">
          Map tiles &copy; OpenStreetMap contributors. Demonstration use only.
        </span>
      </div>
    </div>
  );
}
