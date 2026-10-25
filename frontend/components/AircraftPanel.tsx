"use client";

import { useEffect, useRef } from "react";
import type { AircraftItem } from "@/lib/schemas";
import { PATTERNS, PHASE_LABELS, type FlightPhaseKey } from "@/lib/constants";
import { CategoryBadge } from "./CategoryBadge";
import {
  formatAltitude,
  formatSpeed,
  formatDistance,
  formatHeading,
  formatVerticalRate,
  formatETA,
} from "@/lib/format";

interface AircraftPanelProps {
  aircraft: AircraftItem | null;
  selectedHex?: string | null;
  onClose: () => void;
}

export function AircraftPanel({
  aircraft,
  selectedHex,
  onClose,
}: AircraftPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!aircraft && !selectedHex) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [aircraft, selectedHex, onClose]);

  // Focus close button when panel opens
  useEffect(() => {
    if (aircraft || selectedHex) {
      closeButtonRef.current?.focus();
    }
  }, [aircraft, selectedHex]);

  if (!aircraft && !selectedHex) return null;

  const hex = (aircraft?.hex || selectedHex || "").toUpperCase();
  const callsign = aircraft?.callsign?.trim() || "Unknown Callsign";
  const registration = aircraft?.reg?.trim() || null;
  const typeCode = aircraft?.type?.trim() || "Unknown Type";
  const model = aircraft?.model?.trim() || "Unspecified Model";
  const operator = aircraft?.operator?.trim() || "Private / Community ADS-B";
  const phaseLabel = aircraft?.phase
    ? PHASE_LABELS[aircraft.phase as FlightPhaseKey] || aircraft.phase
    : "Overflying";

  // Validate registration strictly for photos link: ^[A-Z0-9-]{3,10}$
  const isValidRegForPhoto = registration
    ? PATTERNS.REGISTRATION.test(registration)
    : false;
  const photoUrl = isValidRegForPhoto
    ? `https://www.jetphotos.com/showphotos.php?aircraft=&airline=&country=&photographer=&category=&year=&genre=&search-type=reg&search-term=${encodeURIComponent(
        registration!,
      )}`
    : null;

  const eta = aircraft
    ? formatETA(aircraft.phase, aircraft.speedKt, aircraft.distKm)
    : null;

  const vRateInfo = aircraft ? formatVerticalRate(aircraft.vRate) : null;
  const speedMph = aircraft?.speedKt
    ? Math.round(aircraft.speedKt * 1.15078)
    : null;
  const speedKmh = aircraft?.speedKt
    ? Math.round(aircraft.speedKt * 1.852)
    : null;
  const squawkCode = aircraft?.squawk || "N/A";
  const isEmergencySquawk = ["7500", "7600", "7700"].includes(squawkCode);

  return (
    <aside
      ref={panelRef}
      id="aircraft-detail-panel"
      className="aircraft-detail-panel fr24-panel"
      aria-label={`Flight details for ${callsign}`}
      role="region"
    >
      {/* Top Yellow FR24 Accent Stripe */}
      <div className="fr24-panel-stripe" aria-hidden="true" />

      {/* Header with Callsign, Registration & Airline */}
      <div className="detail-header fr24-header">
        <div className="detail-title-group">
          <div className="fr24-operator-tag">{operator}</div>
          <div className="detail-callsign-reg">
            <h2 className="detail-callsign fr24-callsign tabular-nums">{callsign}</h2>
            {registration && (
              <span className="detail-reg fr24-reg tabular-nums">{registration}</span>
            )}
          </div>
          <div className="fr24-meta-pills">
            <span className="detail-hex tabular-nums">HEX: {hex}</span>
            {typeCode && <span className="fr24-type-pill tabular-nums">{typeCode}</span>}
          </div>
        </div>

        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="panel-close-btn fr24-close-btn"
          aria-label="Close aircraft details panel"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="detail-body fr24-body">
        {/* Route / Flight Status Visualizer */}
        <div className="detail-section fr24-route-card">
          <div className="fr24-route-row">
            <div className="fr24-route-node">
              <span className="fr24-node-code">ORIGIN</span>
              <span className="fr24-node-sub">{aircraft?.onGround ? "On Ground" : "Airborne"}</span>
            </div>
            <div className="fr24-route-progress">
              <div className="fr24-route-line" />
              <div className="fr24-route-plane">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
                </svg>
              </div>
            </div>
            <div className="fr24-route-node fr24-node-right">
              <span className="fr24-node-code">DEST</span>
              <span className="fr24-node-sub">{eta ? `ETA ${eta}` : "In Flight"}</span>
            </div>
          </div>
          <div className="fr24-status-strip">
            <span className="detail-phase-tag fr24-status-tag">{phaseLabel}</span>
            {aircraft?.categories && aircraft.categories.length > 0 && (
              <div className="detail-categories">
                {aircraft.categories.map((cat) => (
                  <CategoryBadge key={cat} category={cat} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Flightradar24 Iconic Dual Telemetry Cards (ALTITUDE & SPEED) */}
        <div className="detail-section fr24-gauges-row">
          <div className="fr24-gauge-box fr24-alt-gauge">
            <span className="gauge-label">CALIBRATED ALTITUDE</span>
            <div className="gauge-primary-val tabular-nums">
              {aircraft ? formatAltitude(aircraft.altFt, aircraft.onGround) : "--"}
            </div>
            <div className="gauge-sub-row">
              <span className="gauge-sub-label">VERT SPEED</span>
              <span className={`gauge-trend-val tabular-nums trend-${vRateInfo?.trend || "level"}`}>
                {vRateInfo ? `${vRateInfo.text} (${vRateInfo.trend})` : "--"}
              </span>
            </div>
          </div>

          <div className="fr24-gauge-box fr24-spd-gauge">
            <span className="gauge-label">GROUND SPEED</span>
            <div className="gauge-primary-val tabular-nums">
              {aircraft ? formatSpeed(aircraft.speedKt) : "--"}
            </div>
            <div className="gauge-sub-row">
              <span className="gauge-sub-label">TRUE SPEED</span>
              <span className="gauge-speed-sub tabular-nums">
                {speedMph ? `${speedMph} mph · ${speedKmh} km/h` : "--"}
              </span>
            </div>
          </div>
        </div>

        {/* Secondary Telemetry 4-Cell Matrix */}
        <div className="detail-section fr24-matrix-grid">
          <div className="matrix-tile">
            <span className="matrix-label">TRACK / HEADING</span>
            <span className="matrix-value tabular-nums">
              {aircraft ? formatHeading(aircraft.track) : "--"}
            </span>
          </div>

          <div className="matrix-tile">
            <span className="matrix-label">SQUAWK</span>
            <span className={`matrix-value tabular-nums ${isEmergencySquawk ? "squawk-emergency" : ""}`}>
              {squawkCode}
            </span>
          </div>

          <div className="matrix-tile">
            <span className="matrix-label">DISTANCE</span>
            <span className="matrix-value tabular-nums">
              {aircraft ? formatDistance(aircraft.distKm) : "--"}
            </span>
          </div>

          <div className="matrix-tile">
            <span className="matrix-label">POSITION</span>
            <span className="matrix-value tabular-nums">
              {aircraft?.lat != null && aircraft?.lon != null
                ? `${aircraft.lat.toFixed(2)}°, ${aircraft.lon.toFixed(2)}°`
                : "--"}
            </span>
          </div>
        </div>

        {/* Aircraft Type & Model Spec Card */}
        <div className="detail-section detail-type-card fr24-aircraft-card">
          <div className="detail-model-row">
            <span className="detail-model-name">{model}</span>
            <span className="detail-typecode">{typeCode}</span>
          </div>
          <p className="detail-operator-name">{operator}</p>
        </div>

        {/* Photo Search Link & Community ADS-B Notice */}
        {photoUrl && (
          <div className="detail-section detail-photo-link-wrap">
            <a
              href={photoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="detail-photo-link fr24-photo-btn"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span>View Aircraft Photos on JetPhotos &rarr;</span>
            </a>
          </div>
        )}

        <div className="detail-disclaimer">
          <p>Community ADS-B telemetry · Positions may be subject to latency.</p>
        </div>
      </div>
    </aside>
  );
}
