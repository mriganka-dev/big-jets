import type { AircraftItem } from "@/lib/schemas";
import { CategoryBadge } from "./CategoryBadge";
import {
  formatAltitude,
  formatDistance,
  formatSpeed,
  formatVerticalRate,
  formatETA,
  getPhotoSearchUrl,
} from "@/lib/format";
import { PHASE_LABELS, type FlightPhaseKey } from "@/lib/constants";

interface AircraftRowProps {
  aircraft: AircraftItem;
}

export function AircraftRow({ aircraft }: AircraftRowProps) {
  const photoUrl = getPhotoSearchUrl(aircraft.reg);
  const typeDisplay = aircraft.type || "Unknown Type";
  const modelDisplay = aircraft.model || aircraft.type || "Unknown Model";
  const callsignDisplay = aircraft.callsign || aircraft.hex.toUpperCase();
  const operatorDisplay = aircraft.operator;
  const phaseLabel =
    PHASE_LABELS[aircraft.phase as FlightPhaseKey] || aircraft.phase;
  const vRateFormatted = formatVerticalRate(aircraft.vRate);
  const eta = formatETA(aircraft.phase, aircraft.speedKt, aircraft.distKm);

  return (
    <article className="aircraft-row" aria-label={`Aircraft ${callsignDisplay}`}>
      <div className="aircraft-main-col">
        <div className="aircraft-header-line">
          <span className="aircraft-callsign tabular-nums">{callsignDisplay}</span>
          {aircraft.reg && (
            photoUrl ? (
              <a
                href={photoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="aircraft-reg-link tabular-nums"
                title={`View photos of registration ${aircraft.reg}`}
              >
                {aircraft.reg} &#x2197;
              </a>
            ) : (
              <span className="aircraft-reg tabular-nums">{aircraft.reg}</span>
            )
          )}
          <span className={`phase-tag phase-${aircraft.phase}`}>
            {phaseLabel}
          </span>
        </div>

        <div className="aircraft-identity-line">
          <span className="aircraft-typecode tabular-nums" title={modelDisplay}>
            {typeDisplay}
          </span>
          {aircraft.model && aircraft.model !== aircraft.type && (
            <span className="aircraft-model">&bull; {aircraft.model}</span>
          )}
          {operatorDisplay && (
            <span className="aircraft-operator">&bull; {operatorDisplay}</span>
          )}
        </div>

        {aircraft.categories.length > 0 && (
          <div className="aircraft-categories">
            {aircraft.categories.map((cat) => (
              <CategoryBadge key={cat} category={cat} />
            ))}
          </div>
        )}
      </div>

      <div className="aircraft-telemetry-col">
        <div className="telemetry-item">
          <span className="telemetry-label">Altitude</span>
          <span className="telemetry-value tabular-nums">
            {formatAltitude(aircraft.altFt, aircraft.onGround)}
          </span>
          {aircraft.vRate !== null && aircraft.vRate !== undefined && !aircraft.onGround && (
            <span className={`telemetry-sub trend-${vRateFormatted.trend}`}>
              {vRateFormatted.text}
            </span>
          )}
        </div>

        <div className="telemetry-item">
          <span className="telemetry-label">Distance</span>
          <span className="telemetry-value tabular-nums">
            {formatDistance(aircraft.distKm)}
          </span>
          {eta && (
            <span className="telemetry-sub eta-badge" title="Estimated Landing Time">
              ETA: {eta}
            </span>
          )}
        </div>

        <div className="telemetry-item">
          <span className="telemetry-label">Speed</span>
          <span className="telemetry-value tabular-nums">
            {formatSpeed(aircraft.speedKt)}
          </span>
          {typeof aircraft.track === "number" && (
            <span className="telemetry-sub tabular-nums">
              Hdg: {Math.round(aircraft.track)}&deg;
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
