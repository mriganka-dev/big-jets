"use client";

import { useState, useMemo, Suspense, useCallback, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { AirportItem, FlightRouteInfo } from "@/lib/schemas";
import { fetchFlightRoute } from "@/lib/api";
import { useAircraftFeed } from "@/hooks/useAircraftFeed";
import { AirportSearch } from "./AirportSearch";
import { FilterChips } from "./FilterChips";
import { AircraftList } from "./AircraftList";
import { AircraftPanel } from "./AircraftPanel";
import { StatusLine } from "./StatusLine";
import { CATEGORIES, type CategoryKey } from "@/lib/constants";

// Dynamically import Leaflet map with SSR disabled following Next.js guidelines
const AircraftMap = dynamic(() => import("./AircraftMap"), {
  ssr: false,
  loading: () => (
    <div className="radar-map-loading-placeholder" aria-live="polite">
      <div className="radar-placeholder-grid" aria-hidden="true">
        <div className="radar-ring ring-1" />
        <div className="radar-ring ring-2" />
        <div className="radar-ring ring-3" />
        <div className="radar-ring ring-4" />
        <div className="radar-crosshair crosshair-v" />
        <div className="radar-crosshair crosshair-h" />
      </div>
      <div className="radar-placeholder-notice">
        <span className="status-pulse-dot" aria-hidden="true" />
        <p className="placeholder-airport-title">
          Loading Radar Cartography...
        </p>
      </div>
    </div>
  ),
});

interface RadarViewProps {
  airport: AirportItem;
  allAirports: AirportItem[];
}

function RadarViewInner({ airport, allAirports }: RadarViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read URL search params
  const rawHex = searchParams.get("a");
  const selectedHex =
    rawHex && /^[0-9A-Fa-f]{6}$/.test(rawHex) ? rawHex.toUpperCase() : null;

  const rawCat = searchParams.get("category");
  const initialCategories = rawCat
    ? rawCat
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter((c): c is CategoryKey =>
          Object.values(CATEGORIES).includes(c as CategoryKey),
        )
    : [];

  const initialShowAll =
    searchParams.get("all") === "true" || initialCategories.length === 0;

  // Local state initialized from URL
  const [isListOpen, setIsListOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] =
    useState<string[]>(initialCategories);
  const [showAllTraffic, setShowAllTraffic] = useState<boolean>(initialShowAll);
  const [mapError, setMapError] = useState<boolean>(false);
  const [selectedRoute, setSelectedRoute] = useState<FlightRouteInfo | null>(null);
  const [fitRouteTrigger, setFitRouteTrigger] = useState<number>(0);

  // Connect live data feed (15s polling, tab visibility pause, error backoff)
  // Request all=true from backend; client narrows by category
  const { data, status, error, lastUpdated, isStale, refresh } =
    useAircraftFeed(airport.icao, {
      all: true,
    });

  const allAircraft = useMemo(() => data?.aircraft ?? [], [data]);

  // Client-side category filtering
  const filteredAircraft = useMemo(() => {
    if (showAllTraffic || selectedCategories.length === 0) {
      return allAircraft;
    }
    return allAircraft.filter((ac) =>
      ac.categories.some((cat) => selectedCategories.includes(cat)),
    );
  }, [allAircraft, showAllTraffic, selectedCategories]);

  // Selected aircraft entity
  const selectedAircraft = useMemo(() => {
    if (!selectedHex) return null;
    return (
      allAircraft.find((ac) => ac.hex.toUpperCase() === selectedHex) ?? null
    );
  }, [allAircraft, selectedHex]);

  // Fetch flight route whenever selected aircraft callsign changes
  useEffect(() => {
    if (!selectedAircraft?.callsign) {
      setSelectedRoute(null);
      return;
    }

    let active = true;
    const controller = new AbortController();

    fetchFlightRoute(selectedAircraft.callsign, controller.signal)
      .then((route) => {
        if (active) {
          setSelectedRoute(route);
        }
      })
      .catch(() => {
        if (active) {
          setSelectedRoute(null);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedAircraft?.callsign]);

  const maxMarkerCapHit = filteredAircraft.length > 2000;

  // Synchronize state with URL query parameters
  const updateUrlParams = useCallback(
    (
      newHex?: string | null,
      newCats?: string[],
      newAll?: boolean,
    ) => {
      const params = new URLSearchParams();

      const hexVal = newHex !== undefined ? newHex : selectedHex;
      if (hexVal && /^[0-9A-Fa-f]{6}$/.test(hexVal)) {
        params.set("a", hexVal.toLowerCase());
      }

      const allVal = newAll !== undefined ? newAll : showAllTraffic;
      const catsVal = newCats !== undefined ? newCats : selectedCategories;
      if (!allVal && catsVal.length > 0) {
        params.set("category", catsVal.join(","));
      }

      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname, selectedHex, showAllTraffic, selectedCategories],
  );

  const handleSelectAircraft = useCallback(
    (hex: string) => {
      updateUrlParams(hex);
    },
    [updateUrlParams],
  );

  const handleCloseAircraftPanel = useCallback(() => {
    updateUrlParams(null);
  }, [updateUrlParams]);

  const handleToggleCategory = (categoryKey: string) => {
    setShowAllTraffic(false);
    const updated = selectedCategories.includes(categoryKey)
      ? selectedCategories.filter((c) => c !== categoryKey)
      : [...selectedCategories, categoryKey];

    setSelectedCategories(updated);
    updateUrlParams(selectedHex, updated, false);
  };

  const handleToggleAll = () => {
    setShowAllTraffic(true);
    setSelectedCategories([]);
    updateUrlParams(selectedHex, [], true);
  };

  return (
    <div className="radar-layout">
      {/* 1. Full-screen Map Container */}
      <main
        id="main-content"
        className="radar-map-container"
        tabIndex={-1}
        aria-label={`Radar map view for ${airport.name}`}
      >
        {mapError ? (
          <div className="radar-map-fallback-view" role="status">
            <div className="placeholder-badge">Map Display Fallback</div>
            <p className="placeholder-airport-title">
              Map cartography could not be loaded.
            </p>
            <p className="placeholder-hint">
              Live radar list and telemetry remain fully accessible. Click{" "}
              <strong>&quot;List&quot;</strong> in the top-right to view all
              flights.
            </p>
            <button
              type="button"
              onClick={() => setMapError(false)}
              className="btn btn-sm btn-retry"
              style={{ marginTop: "1rem" }}
            >
              Retry Loading Map
            </button>
          </div>
        ) : (
          <AircraftMap
            airport={airport}
            aircraft={filteredAircraft}
            selectedHex={selectedHex}
            selectedRoute={selectedRoute}
            fitRouteTrigger={fitRouteTrigger}
            onSelectAircraft={handleSelectAircraft}
            maxMarkerCapHit={maxMarkerCapHit}
          />
        )}
      </main>

      {/* 2. Top Controls Floating Bar */}
      <header className="radar-top-controls" role="banner">
        {/* Top-Left: Wordmark + Airport Combobox */}
        <div className="controls-left">
          <Link href="/" className="wordmark-link" aria-label="Big Jets Home">
            <span className="fr24-logo-badge" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
              </svg>
            </span>
            <span className="wordmark-text">Big Jets</span>
          </Link>
          <AirportSearch airports={allAirports} currentAirport={airport} />
        </div>

        {/* Top-Centre: Filter Chips */}
        <div className="controls-center">
          <FilterChips
            selectedCategories={selectedCategories}
            showAllTraffic={showAllTraffic}
            onToggleAll={handleToggleAll}
            onToggleCategory={handleToggleCategory}
          />
        </div>

        {/* Top-Right: Live Traffic Pill + Get Alerts + List Button */}
        <div className="controls-right">
          <div
            className="fr24-live-flights-pill"
            title="Global aircraft currently tracked"
            aria-label={`${filteredAircraft.length} live flights tracked`}
          >
            <span className="fr24-live-beacon" aria-hidden="true" />
            <span className="fr24-live-count tabular-nums">{filteredAircraft.length}</span>
            <span className="fr24-live-label">TRACKED</span>
          </div>

          <Link href="/alerts" className="btn btn-alerts">
            <span className="btn-icon" aria-hidden="true">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </span>
            <span className="btn-text">Get alerts</span>
          </Link>

          <button
            type="button"
            onClick={() => setIsListOpen((prev) => !prev)}
            className={`btn btn-list ${isListOpen ? "is-active" : ""}`}
            aria-expanded={isListOpen}
            aria-controls="aircraft-list-panel"
            aria-label={
              isListOpen ? "Close aircraft list" : "Open aircraft list"
            }
          >
            <span className="btn-icon" aria-hidden="true">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </span>
            <span className="btn-text">
              List{" "}
              <span className="btn-count-pill tabular-nums">
                ({filteredAircraft.length})
              </span>
            </span>
          </button>
        </div>
      </header>

      {/* 3. Left Aircraft List Drawer (Opened with "List" button) */}
      <AircraftList
        isOpen={isListOpen}
        onClose={() => setIsListOpen(false)}
        aircraft={filteredAircraft}
        totalCount={allAircraft.length}
        selectedHex={selectedHex}
        onSelectAircraft={handleSelectAircraft}
        status={status}
        error={error}
        onRetry={refresh}
      />

      {/* 4. Right Aircraft Detail Panel / Mobile Bottom Sheet */}
      <AircraftPanel
        aircraft={selectedAircraft}
        selectedHex={selectedHex}
        route={selectedRoute}
        onFitRoute={() => setFitRouteTrigger(Date.now())}
        onClose={handleCloseAircraftPanel}
      />

      {/* 5. Bottom-Left Status Line */}
      <div className="radar-bottom-bar">
        <StatusLine
          status={status}
          count={filteredAircraft.length}
          lastUpdated={lastUpdated}
          isStale={isStale}
          error={error}
          maxMarkerCapHit={maxMarkerCapHit}
          onRetry={refresh}
        />
      </div>
    </div>
  );
}

export function RadarView(props: RadarViewProps) {
  return (
    <Suspense
      fallback={
        <div className="radar-layout-loading">Loading radar interface...</div>
      }
    >
      <RadarViewInner {...props} />
    </Suspense>
  );
}
