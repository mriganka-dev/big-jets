"use client";

import type { FeedStatus } from "@/hooks/useAircraftFeed";
import { formatUpdatedAgo } from "@/lib/format";

interface StatusLineProps {
  status?: FeedStatus;
  error?: string | null;
  lastUpdated?: Date | null;
  isStale?: boolean;
  count?: number;
  totalFilteredCount?: number;
  maxMarkerCapHit?: boolean;
  onRetry?: () => void;
}

export function StatusLine({
  status = "idle",
  error = null,
  lastUpdated = null,
  isStale = false,
  count = 0,
  maxMarkerCapHit = false,
  onRetry,
}: StatusLineProps) {
  const timeString = lastUpdated
    ? lastUpdated.toLocaleTimeString("en-GB", { hour12: false })
    : null;

  return (
    <footer className="status-line-bar" role="contentinfo" aria-label="Radar status and data attribution">
      <div className="status-main-row">
        {/* Status text */}
        <div className="status-info-text" role="status" aria-live="polite">
          {status === "loading" && !lastUpdated && (
            <span className="status-loading">Loading telemetry feed...</span>
          )}

          {lastUpdated && (
            <span className="status-telemetry-meta">
              <span className="status-pulse-dot" aria-hidden="true" />
              <span className="tabular-nums">Updated {timeString}</span>
              {` (${formatUpdatedAgo(lastUpdated)})`}
              <span className="status-sep" aria-hidden="true">
                &middot;
              </span>
              <span className="tabular-nums">
                {count} {count === 1 ? "aircraft" : "aircraft"}
              </span>
              {maxMarkerCapHit && (
                <span className="status-cap-notice"> (showing top 300)</span>
              )}
            </span>
          )}

          {!lastUpdated && status !== "loading" && (
            <span className="status-ready-meta">
              <span className="status-pulse-dot" aria-hidden="true" />
              <span>Radar connected</span>
              <span className="status-sep" aria-hidden="true">
                &middot;
              </span>
              <span className="tabular-nums">{count} aircraft</span>
            </span>
          )}

          {isStale && (
            <span className="status-badge-stale" role="alert">
              Data is older than 2 min
            </span>
          )}
        </div>

        {/* Permanent Credits & Map Attribution */}
        <div className="status-attribution">
          <span>
            Aircraft data:{" "}
            <a
              href="https://adsb.lol"
              target="_blank"
              rel="noopener noreferrer"
              className="status-attr-link"
            >
              adsb.lol (ODbL)
            </a>
          </span>
          <span className="status-sep" aria-hidden="true">
            &middot;
          </span>
          <span>
            Map:{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="status-attr-link"
            >
              &copy; OpenStreetMap contributors
            </a>
          </span>
        </div>
      </div>

      {error && (
        <div className="status-error-row" role="alert">
          <span className="status-error-msg">{error}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="btn btn-sm btn-retry"
            >
              Retry
            </button>
          )}
        </div>
      )}
    </footer>
  );
}
