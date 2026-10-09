"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { AirportItem, AircraftItem, AircraftCategory } from "@/lib/schemas";
import { useAircraftFeed } from "@/hooks/useAircraftFeed";
import { FilterBar } from "./FilterBar";
import { StatusLine } from "./StatusLine";
import { AircraftRow } from "./AircraftRow";
import { LIMITS } from "@/lib/constants";

// Dynamically import Leaflet map component with SSR disabled
const AircraftMap = dynamic(() => import("./AircraftMap"), {
  ssr: false,
  loading: () => (
    <div className="map-loading-placeholder" role="status">
      <p>Loading interactive radar map...</p>
    </div>
  ),
});

interface AircraftBoardProps {
  airport: AirportItem;
  initialCategories?: AircraftCategory[];
  initialShowAll?: boolean;
  initialRadius?: number;
}

/**
 * Sort aircraft sensibly:
 * 1. Approach aircraft first
 * 2. Ground and departing next
 * 3. Rest sorted by distance ascending
 */
function sortAircraft(list: AircraftItem[]): AircraftItem[] {
  return [...list].sort((a, b) => {
    const getPhaseScore = (phase: string) => {
      if (phase === "approach") return 1;
      if (phase === "ground") return 2;
      if (phase === "departing") return 3;
      return 4;
    };

    const scoreA = getPhaseScore(a.phase);
    const scoreB = getPhaseScore(b.phase);

    if (scoreA !== scoreB) {
      return scoreA - scoreB;
    }

    const distA = a.distKm ?? 9999;
    const distB = b.distKm ?? 9999;
    return distA - distB;
  });
}

export function AircraftBoard({
  airport,
  initialCategories = [],
  initialShowAll = false,
  initialRadius = LIMITS.DEFAULT_RADIUS_NM,
}: AircraftBoardProps) {
  const [categories, setCategories] = useState<AircraftCategory[]>(initialCategories);
  const [showAll, setShowAll] = useState<boolean>(initialShowAll);
  const [radius, setRadius] = useState<number>(initialRadius);
  const [showMap, setShowMap] = useState<boolean>(false);

  const { data, status, error, lastUpdated, isStale, refresh } = useAircraftFeed(
    airport.icao,
    {
      categories: categories.length > 0 ? categories : undefined,
      all: showAll,
      radius,
    }
  );

  const rawList = data?.aircraft || [];
  const sortedList = sortAircraft(rawList);

  const handleFilterChange = (nextFilters: {
    categories: AircraftCategory[];
    showAll: boolean;
    radius: number;
  }) => {
    setCategories(nextFilters.categories);
    setShowAll(nextFilters.showAll);
    setRadius(nextFilters.radius);
  };

  return (
    <div className="aircraft-board">
      <div className="board-toolbar">
        <FilterBar
          selectedCategories={categories}
          showAll={showAll}
          radius={radius}
          onFilterChange={handleFilterChange}
        />
        <div className="board-view-toggle">
          <button
            type="button"
            onClick={() => setShowMap(!showMap)}
            className={`btn btn-toggle-map ${showMap ? "btn-map-active" : ""}`}
            aria-pressed={showMap}
            aria-label={showMap ? "Hide interactive map" : "Show interactive map"}
          >
            {showMap ? "🗺 Hide Map" : "🗺 Show Map"}
          </button>
        </div>
      </div>

      <StatusLine
        status={status}
        error={error}
        lastUpdated={lastUpdated}
        isStale={isStale}
        count={sortedList.length}
        onRetry={refresh}
      />

      {showMap && (
        <AircraftMap
          airport={airport}
          aircraft={sortedList}
          radiusNm={radius}
        />
      )}

      <div className="aircraft-list-wrapper">
        {status === "loading" && !data ? (
          <div className="board-loading-box" role="status">
            <p>Scanning ADS-B radar receiver feeds near {airport.name} ({airport.icao})...</p>
          </div>
        ) : sortedList.length === 0 ? (
          <div className="board-empty-box" role="status">
            <h2 className="empty-title">
              No matching aircraft near {airport.icao} right now
            </h2>
            <p className="empty-desc">
              {showAll
                ? `No aircraft detected within ${radius} NM of ${airport.name}.`
                : `No big, rare, or military aircraft detected within ${radius} NM of ${airport.name}.`}
            </p>
            <p className="empty-hint">
              This page automatically checks for updates every 15 seconds.
            </p>
          </div>
        ) : (
          <div className="aircraft-rows-container">
            {sortedList.map((ac) => (
              <AircraftRow
                key={`${ac.hex}-${ac.callsign || ""}-${ac.reg || ""}`}
                aircraft={ac}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
