"use client";

import { useState, useRef, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import type { AirportItem } from "@/lib/schemas";
import { filterAirports } from "@/lib/airports";

interface AirportSearchProps {
  airports: AirportItem[];
  currentAirport?: AirportItem;
}

export function AirportSearch({ airports, currentAirport }: AirportSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  const listboxId = useId();

  // Filter matches based on user input
  const filtered = query.trim() ? filterAirports(airports, query) : airports;

  // Scroll active option into view
  useEffect(() => {
    if (isOpen && activeIndex >= 0 && listboxRef.current) {
      const activeEl = listboxRef.current.children[activeIndex] as HTMLElement | undefined;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex, isOpen]);

  // Click outside listener to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelect = (airport: AirportItem) => {
    setQuery("");
    setIsOpen(false);
    setActiveIndex(-1);
    router.push(`/airport/${airport.icao}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(0);
      } else if (filtered.length > 0) {
        setActiveIndex((prev) => (prev + 1) % filtered.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(filtered.length - 1);
      } else if (filtered.length > 0) {
        setActiveIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      }
    } else if (e.key === "Enter") {
      if (isOpen) {
        e.preventDefault();
        const target = activeIndex >= 0 ? filtered[activeIndex] : filtered[0];
        if (target) {
          handleSelect(target);
        }
      }
    } else if (e.key === "Escape") {
      if (isOpen) {
        e.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
      }
    } else if (e.key === "Tab") {
      setIsOpen(false);
    }
  };

  const placeholderText = currentAirport
    ? `${currentAirport.name} (${currentAirport.icao})`
    : "Search airport (e.g. VECC, DEL)...";

  return (
    <div ref={containerRef} className="airport-search-combobox">
      <div className="combobox-input-wrapper">
        <span className="combobox-icon" aria-hidden="true">
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
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>

        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={
            isOpen && activeIndex >= 0 ? `airport-opt-${activeIndex}` : undefined
          }
          aria-label="Airport search combobox. Type an ICAO code, IATA code or city name"
          placeholder={placeholderText}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(-1);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="combobox-input"
          autoComplete="off"
          spellCheck="false"
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="combobox-clear-btn"
            aria-label="Clear airport search input"
          >
            <svg
              width="14"
              height="14"
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
        )}
      </div>

      {isOpen && (
        <ul
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          aria-label="Airport suggestions"
          className="combobox-dropdown"
        >
          {filtered.length === 0 ? (
            <li className="combobox-no-match" role="status">
              No matching airport found
            </li>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = activeIndex === idx;
              const isCurrent = currentAirport?.icao === item.icao;

              return (
                <li
                  key={item.icao}
                  id={`airport-opt-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`combobox-option ${isSelected ? "active" : ""} ${
                    isCurrent ? "current" : ""
                  }`}
                >
                  <div className="option-primary">
                    <span className="option-name">{item.name}</span>
                    <span className="option-codes">
                      <span className="opt-badge opt-icao">{item.icao}</span>
                      {item.iata && <span className="opt-badge opt-iata">{item.iata}</span>}
                    </span>
                  </div>
                  <div className="option-sub">{item.fullName}</div>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
