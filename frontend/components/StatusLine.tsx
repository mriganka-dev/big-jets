import type { FeedStatus } from "@/hooks/useAircraftFeed";
import { formatUpdatedAgo } from "@/lib/format";

interface StatusLineProps {
  status: FeedStatus;
  error: string | null;
  lastUpdated: Date | null;
  isStale: boolean;
  count: number;
  airportIcao: string;
  onRetry: () => void;
}

export function StatusLine({
  status,
  error,
  lastUpdated,
  isStale,
  count,
  onRetry,
}: Omit<StatusLineProps, "airportIcao"> & { airportIcao?: string }) {
  const timeString = lastUpdated
    ? lastUpdated.toLocaleTimeString("en-GB", { hour12: false })
    : null;

  return (
    <div className="status-line-container">
      <div
        className="status-line"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {status === "loading" && !lastUpdated && (
          <span className="status-item status-loading">
            Loading radar telemetry...
          </span>
        )}

        {lastUpdated && (
          <span className="status-item status-meta">
            <span className="status-dot status-dot-live" aria-hidden="true" />
            <span className="tabular-nums">
              Updated {timeString} ({formatUpdatedAgo(lastUpdated)})
            </span>
            <span className="status-separator">&bull;</span>
            <span className="tabular-nums">
              {count} {count === 1 ? "aircraft" : "aircraft"} tracked
            </span>
          </span>
        )}

        {isStale && (
          <span className="status-badge status-stale-badge" role="alert">
            Data is older than 2 minutes
          </span>
        )}
      </div>

      {error && (
        <div className="status-error-banner" role="alert">
          <span>{error}</span>
          <button
            type="button"
            onClick={onRetry}
            className="btn btn-sm btn-retry"
          >
            Retry Now
          </button>
        </div>
      )}
    </div>
  );
}
