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
  const isValidRegForPhoto = registration ? PATTERNS.REGISTRATION.test(registration) : false;
  const photoUrl = isValidRegForPhoto
    ? `https://www.jetphotos.com/showphotos.php?aircraft=&airline=&country=&photographer=&category=&year=&genre=&search-type=reg&search-term=${encodeURIComponent(
        registration!
      )}`
    : null;

  const eta = aircraft ? formatETA(aircraft.phase, aircraft.speedKt, aircraft.distKm) : null;

  return (
    <aside
      ref={panelRef}
      id="aircraft-detail-panel"
      className="aircraft-detail-panel"
      aria-label={`Flight details for ${callsign}`}
      role="region"
    >
      <div className="detail-header">
        <div className="detail-title-group">
          <div className="detail-callsign-reg">
            <h2 className="detail-callsign">{callsign}</h2>
            {registration && (
              <span className="detail-reg tabular-nums">{registration}</span>
            )}
          </div>
          <span className="detail-hex tabular-nums">HEX: {hex}</span>
        </div>

        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="panel-close-btn"
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

      <div className="detail-body">
        {/* Phase and Badges */}
        <div className="detail-section detail-phase-bar">
          <span className="detail-phase-tag">{phaseLabel}</span>
          {aircraft?.categories && aircraft.categories.length > 0 && (
            <div className="detail-categories">
              {aircraft.categories.map((cat) => (
                <CategoryBadge key={cat} category={cat} />
              ))}
            </div>
          )}
        </div>

        {/* Aircraft & Operator info */}
        <div className="detail-section detail-type-card">
          <div className="detail-model-row">
            <span className="detail-model-name">{model}</span>
            <span className="detail-typecode">{typeCode}</span>
          </div>
          <p className="detail-operator-name">{operator}</p>
        </div>

        {/* Telemetry Metrics Grid */}
        <div className="detail-section detail-metrics-grid">
          <div className="metric-box">
            <span className="metric-label">Altitude</span>
            <span className="metric-value tabular-nums">
              {aircraft ? formatAltitude(aircraft.altFt, aircraft.onGround) : "--"}
            </span>
          </div>

          <div className="metric-box">
            <span className="metric-label">Speed</span>
            <span className="metric-value tabular-nums">
              {aircraft ? formatSpeed(aircraft.speedKt) : "--"}
            </span>
          </div>

          <div className="metric-box">
            <span className="metric-label">Vertical Rate</span>
            <span className="metric-value tabular-nums">
              {aircraft
                ? `${formatVerticalRate(aircraft.vRate).text} (${formatVerticalRate(aircraft.vRate).trend})`
                : "--"}
            </span>
          </div>

          <div className="metric-box">
            <span className="metric-label">Track / Heading</span>
            <span className="metric-value tabular-nums">
              {aircraft ? formatHeading(aircraft.track) : "--"}
            </span>
          </div>

          <div className="metric-box">
            <span className="metric-label">Distance</span>
            <span className="metric-value tabular-nums">
              {aircraft ? formatDistance(aircraft.distKm) : "--"}
            </span>
          </div>

          <div className="metric-box">
            <span className="metric-label">Est. Landing</span>
            <span className="metric-value tabular-nums">
              {eta || "N/A"}
            </span>
          </div>
        </div>

        {/* Photo Search Link */}
        {photoUrl && (
          <div className="detail-section detail-photo-link-wrap">
            <a
              href={photoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="detail-photo-link"
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
              <span>Find photos on JetPhotos &rarr;</span>
            </a>
          </div>
        )}

        <div className="detail-disclaimer">
          <p>Positions are community-reported and may be delayed or wrong.</p>
        </div>
      </div>
    </aside>
  );
}
