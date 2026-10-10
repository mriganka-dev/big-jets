"use client";

import { useEffect, useRef, useMemo } from "react";
import type { AircraftItem } from "@/lib/schemas";
import type { FeedStatus } from "@/hooks/useAircraftFeed";
import { AircraftRow } from "./AircraftRow";

interface AircraftListProps {
  isOpen: boolean;
  onClose: () => void;
  aircraft: AircraftItem[];
  selectedHex?: string | null;
  onSelectAircraft: (hex: string) => void;
  status: FeedStatus;
  error?: string | null;
  onRetry?: () => void;
  totalCount?: number;
  radius?: number;
}

/**
 * Sorts aircraft per Phase 4 specification:
 * 1. Approach aircraft first (ordered nearest to airport first)
 * 2. Ground and departing aircraft next
 * 3. Then nearest aircraft (distKm ascending)
 */
export function sortAircraft(list: AircraftItem[]): AircraftItem[] {
  return [...list].sort((a, b) => {
    // 1. Approach aircraft first
    const aApproach = a.phase === "approach";
    const bApproach = b.phase === "approach";
    if (aApproach && !bApproach) return -1;
    if (!aApproach && bApproach) return 1;

    if (aApproach && bApproach) {
      const aDist = a.distKm ?? 999999;
      const bDist = b.distKm ?? 999999;
      return aDist - bDist;
    }

    // 2. Ground and departing next
    const aGroundOrDep = a.phase === "ground" || a.phase === "departing";
    const bGroundOrDep = b.phase === "ground" || b.phase === "departing";
    if (aGroundOrDep && !bGroundOrDep) return -1;
    if (!aGroundOrDep && bGroundOrDep) return 1;

    // 3. Then nearest
    const aDist = a.distKm ?? 999999;
    const bDist = b.distKm ?? 999999;
    return aDist - bDist;
  });
}

export function AircraftList({
  isOpen,
  onClose,
  aircraft,
  selectedHex,
  onSelectAircraft,
  status,
  error,
  onRetry,
  totalCount = 0,
  radius = 40,
}: AircraftListProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Focus close button when panel opens
  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isOpen]);

  const sortedList = useMemo(() => sortAircraft(aircraft), [aircraft]);

  if (!isOpen) return null;

  return (
    <aside
      ref={panelRef}
      id="aircraft-list-panel"
      className="aircraft-list-panel"
      aria-label="Tracked aircraft list"
      role="region"
    >
      <div className="panel-header">
        <div className="panel-title-group">
          <h2 className="panel-title">Tracked Aircraft</h2>
          <span className="panel-badge tabular-nums">
            {sortedList.length} shown {totalCount > sortedList.length ? `(of ${totalCount} in ${radius} NM)` : `(${radius} NM)`}
          </span>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="panel-close-btn"
          aria-label="Close aircraft list panel"
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

      <div className="panel-sorting-hint">
        <span>Order: Landing approach first, then ground &amp; departing, then nearest</span>
      </div>

      <div className="panel-body aircraft-list-body">
        {/* Error state */}
        {error && (
          <div className="panel-error-card" role="alert">
            <p className="error-text">{error}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="btn btn-sm btn-retry"
              >
                Retry Fetch
              </button>
            )}
          </div>
        )}

        {/* Loading state without data */}
        {status === "loading" && sortedList.length === 0 && (
          <div className="panel-loading-state" role="status">
            <span className="status-pulse-dot" aria-hidden="true" />
            <p>Fetching real-time aircraft telemetry...</p>
          </div>
        )}

        {/* Empty state */}
        {status !== "loading" && sortedList.length === 0 && !error && (
          <div className="panel-empty-state" role="status">
            <span className="radar-sweep-icon" aria-hidden="true">
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="12" x2="19" y2="5" />
              </svg>
            </span>
            <p className="panel-empty-title">No Aircraft in Range</p>
            <p className="panel-empty-desc">
              No matching flights detected within {radius} NM of this airport. Try increasing radius or selecting All Traffic.
            </p>
          </div>
        )}

        {/* Aircraft Items */}
        {sortedList.length > 0 && (
          <div className="aircraft-cards-container" role="list">
            {sortedList.map((ac) => (
              <AircraftRow
                key={ac.hex}
                aircraft={ac}
                isSelected={selectedHex?.toUpperCase() === ac.hex.toUpperCase()}
                onSelect={onSelectAircraft}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
