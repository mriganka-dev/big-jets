"use client";

import { useState } from "react";
import Link from "next/link";
import type { AirportItem } from "@/lib/schemas";
import { filterAirports } from "@/lib/airports";

interface AirportPickerProps {
  airports: AirportItem[];
}

export function AirportPicker({ airports }: AirportPickerProps) {
  const [query, setQuery] = useState("");

  const filtered = filterAirports(airports, query);

  return (
    <section aria-label="Airport Selection" className="airport-picker-section">
      <div className="search-box">
        <label htmlFor="airport-search" className="search-label">
          Search airport by name, ICAO, or IATA code:
        </label>
        <div className="search-input-wrapper">
          <input
            id="airport-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Kolkata, VECC, CCU, Delhi..."
            className="search-input"
            autoComplete="off"
            spellCheck="false"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="search-clear-btn"
              aria-label="Clear airport search"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="airport-results-header">
        <span className="results-count" aria-live="polite">
          Showing {filtered.length} of {airports.length} supported airports
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-results-box" role="status">
          <p>No supported airport found matching &ldquo;{query}&rdquo;.</p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="btn btn-sm"
            style={{ marginTop: "0.5rem" }}
          >
            Reset search filter
          </button>
        </div>
      ) : (
        <ul className="airport-grid" role="list">
          {filtered.map((airport) => (
            <li key={airport.icao} className="airport-item">
              <Link
                href={`/airport/${airport.icao}`}
                className="airport-card-link"
              >
                <div className="airport-card-top">
                  <span className="airport-name">{airport.name}</span>
                  <div className="airport-codes">
                    <span className="code-badge code-icao">{airport.icao}</span>
                    {airport.iata && (
                      <span className="code-badge code-iata">
                        {airport.iata}
                      </span>
                    )}
                  </div>
                </div>
                <p className="airport-fullname">
                  {airport.city
                    ? `${airport.city}, ${airport.country}`
                    : airport.country}
                </p>
                <span className="view-board-hint" aria-hidden="true">
                  View Live Traffic &rarr;
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
