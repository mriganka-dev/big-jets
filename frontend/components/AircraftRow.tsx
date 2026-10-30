"use client";

import type { AircraftItem } from "@/lib/schemas";
import { CategoryBadge } from "./CategoryBadge";
import {
  formatAltitude,
  formatDistance,
  formatSpeed,
  formatVerticalRate,
  formatETA,
} from "@/lib/format";
import { PHASE_LABELS, type FlightPhaseKey } from "@/lib/constants";

interface AircraftRowProps {
  aircraft: AircraftItem;
  isSelected?: boolean;
  onSelect?: (hex: string) => void;
}

export function AircraftRow({
  aircraft,
  isSelected = false,
  onSelect,
}: AircraftRowProps) {
  const typeDisplay = aircraft.type || "Unknown Type";
  const modelDisplay = aircraft.model || aircraft.type || "Unknown Model";
  const callsignDisplay =
    aircraft.callsign?.trim() || aircraft.hex.toUpperCase();
  const airlineLogoUrl = aircraft.airline?.logoUrl || null;
  const airlineName = aircraft.airline?.name || aircraft.operator?.trim() || null;
  const operatorDisplay = airlineName;
  const phaseLabel =
    PHASE_LABELS[aircraft.phase as FlightPhaseKey] || aircraft.phase;
  const vRateFormatted = formatVerticalRate(aircraft.vRate);
  const eta = formatETA(aircraft.phase, aircraft.speedKt, aircraft.distKm);

  const handleClick = () => {
    if (onSelect) {
      onSelect(aircraft.hex);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`aircraft-row-item ${isSelected ? "is-selected" : ""}`}
      aria-pressed={isSelected}
      aria-label={`Flight ${callsignDisplay}, ${typeDisplay}, ${phaseLabel}`}
    >
      <div className="aircraft-row-top">
        <div className="aircraft-callsign-group">
          {airlineLogoUrl && (
            <img
              src={airlineLogoUrl}
              alt=""
              className="aircraft-row-airline-logo"
              loading="lazy"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = "none";
              }}
            />
          )}
          <span className="aircraft-callsign tabular-nums">
            {callsignDisplay}
          </span>
          {aircraft.reg && (
            <span className="aircraft-reg tabular-nums">{aircraft.reg}</span>
          )}
        </div>
        <span className={`phase-badge phase-${aircraft.phase}`}>
          {phaseLabel}
        </span>
      </div>

      <div className="aircraft-row-mid">
        <span className="aircraft-model" title={modelDisplay}>
          {typeDisplay}
          {aircraft.model && aircraft.model !== aircraft.type
            ? ` · ${aircraft.model}`
            : ""}
        </span>
        {operatorDisplay && (
          <span className="aircraft-operator"> · {operatorDisplay}</span>
        )}
      </div>

      {aircraft.categories.length > 0 && (
        <div className="aircraft-row-badges">
          {aircraft.categories.map((cat) => (
            <CategoryBadge key={cat} category={cat} />
          ))}
        </div>
      )}

      <div className="aircraft-row-metrics">
        <div className="metric-cell">
          <span className="metric-caption">Alt</span>
          <span className="metric-val tabular-nums">
            {formatAltitude(aircraft.altFt, aircraft.onGround)}
          </span>
          {aircraft.vRate != null && !aircraft.onGround && (
            <span className={`metric-sub trend-${vRateFormatted.trend}`}>
              {vRateFormatted.text}
            </span>
          )}
        </div>

        <div className="metric-cell">
          <span className="metric-caption">Dist</span>
          <span className="metric-val tabular-nums">
            {formatDistance(aircraft.distKm)}
          </span>
          {eta && (
            <span className="metric-sub eta-tag" title="Estimated Landing Time">
              {eta}
            </span>
          )}
        </div>

        <div className="metric-cell">
          <span className="metric-caption">Spd</span>
          <span className="metric-val tabular-nums">
            {formatSpeed(aircraft.speedKt)}
          </span>
          {aircraft.track != null && (
            <span className="metric-sub tabular-nums">
              {Math.round(aircraft.track)}&deg;
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
