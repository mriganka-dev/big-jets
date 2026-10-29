"use client";

import { useState, useRef, useEffect, useId, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AirportItem } from "@/lib/schemas";
import { searchAirports, RateLimitError } from "@/lib/api";
import { PATTERNS } from "@/lib/constants";

interface AirportSearchProps {
  airports: AirportItem[];
  currentAirport?: AirportItem;
}

/**
 * Highlights matches within the airport name safely using React elements without innerHTML.
 */
function HighlightedName({ text, query }: { text: string; query: string }) {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) {
    return <>{text}</>;
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = trimmed.toLowerCase();
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let index = lowerText.indexOf(lowerQuery);

  if (index === -1) {
    return <>{text}</>;
  }

  while (index !== -1) {
    if (index > lastIndex) {
      parts.push(text.slice(lastIndex, index));
    }
    parts.push(
      <mark key={index} className="match-highlight">
        {text.slice(index, index + lowerQuery.length)}
      </mark>,
    );
    lastIndex = index + lowerQuery.length;
    index = lowerText.indexOf(lowerQuery, lastIndex);
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}

export function AirportSearch({
  airports,
  currentAirport,
}: AirportSearchProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Search network results and state
  const [searchResults, setSearchResults] = useState<AirportItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [asyncError, setAsyncError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const seqIdRef = useRef<number>(0);

  const listboxId = useId();

  // Scroll active option into view
  useEffect(() => {
    if (isOpen && activeIndex >= 0 && listboxRef.current) {
      const activeEl = listboxRef.current.querySelector(
        `#airport-opt-${activeIndex}`,
      ) as HTMLElement | null;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex, isOpen]);

  // Click outside listener to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const trimmedQuery = query.trim();
  const isQueryEmpty = trimmedQuery.length === 0;

  // Compute validation hint synchronously without effect setState
  const validationHint = isQueryEmpty
    ? null
    : trimmedQuery.length < 2
      ? "Type at least 2 characters to search"
      : trimmedQuery.length > 40
        ? "Search query must not exceed 40 characters"
        : !PATTERNS.SEARCH_QUERY.test(trimmedQuery)
          ? "Only letters, numbers, spaces, hyphens, and punctuation (- ' . ,) are allowed"
          : null;

  const canSearch = !isQueryEmpty && validationHint === null;

  // Debounced search logic with cancellation and sequence ID tracking
  useEffect(() => {
    if (!canSearch) {
      return;
    }

    const currentSeq = ++seqIdRef.current;

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setAsyncError(null);
      setIsRateLimited(false);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const results = await searchAirports(trimmedQuery, controller.signal);
        if (seqIdRef.current === currentSeq) {
          setSearchResults(results);
          setHasSearched(true);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (seqIdRef.current !== currentSeq) {
          return; // Ignore stale / superseded responses
        }
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        setIsLoading(false);
        if (
          err instanceof RateLimitError ||
          (err as { code?: string })?.code === "RATE_LIMITED"
        ) {
          setIsRateLimited(true);
          setAsyncError("Too many requests. Please wait a moment.");
        } else {
          setAsyncError(
            err instanceof Error
              ? err.message
              : "Failed to search airports. Please try again.",
          );
        }
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [trimmedQuery, canSearch]);

  // Determine items to display
  let displayedItems: AirportItem[] = [];
  if (isQueryEmpty) {
    displayedItems = airports;
  } else if (
    canSearch &&
    hasSearched &&
    !isLoading &&
    !asyncError &&
    !isRateLimited
  ) {
    displayedItems = searchResults;
  }

  // Retry handler for error state
  const handleRetry = () => {
    if (!canSearch) return;

    const currentSeq = ++seqIdRef.current;
    setIsLoading(true);
    setAsyncError(null);
    setIsRateLimited(false);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    searchAirports(trimmedQuery, controller.signal)
      .then((results) => {
        if (seqIdRef.current === currentSeq) {
          setSearchResults(results);
          setHasSearched(true);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (seqIdRef.current !== currentSeq) return;
        if (err instanceof DOMException && err.name === "AbortError") return;

        setIsLoading(false);
        if (
          err instanceof RateLimitError ||
          (err as { code?: string })?.code === "RATE_LIMITED"
        ) {
          setIsRateLimited(true);
          setAsyncError("Too many requests. Please wait a moment.");
        } else {
          setAsyncError(
            err instanceof Error
              ? err.message
              : "Failed to search airports. Please try again.",
          );
        }
      })
      .finally(() => {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      });
  };

  const handleSelect = (airport: AirportItem) => {
    setQuery("");
    setIsOpen(false);
    setActiveIndex(-1);
    setHasSearched(false);
    startTransition(() => {
      router.push(`/airport/${airport.icao}`);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        if (displayedItems.length > 0) setActiveIndex(0);
      } else if (displayedItems.length > 0) {
        setActiveIndex((prev) => (prev + 1) % displayedItems.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        if (displayedItems.length > 0)
          setActiveIndex(displayedItems.length - 1);
      } else if (displayedItems.length > 0) {
        setActiveIndex(
          (prev) => (prev - 1 + displayedItems.length) % displayedItems.length,
        );
      }
    } else if (e.key === "Home") {
      if (isOpen && displayedItems.length > 0) {
        e.preventDefault();
        setActiveIndex(0);
      }
    } else if (e.key === "End") {
      if (isOpen && displayedItems.length > 0) {
        e.preventDefault();
        setActiveIndex(displayedItems.length - 1);
      }
    } else if (e.key === "Enter") {
      if (isOpen && displayedItems.length > 0) {
        e.preventDefault();
        const target =
          activeIndex >= 0 ? displayedItems[activeIndex] : displayedItems[0];
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

  // Screen reader live region text
  let liveAnnouncement = "";
  if (isLoading) {
    liveAnnouncement = "Searching airports...";
  } else if (validationHint) {
    liveAnnouncement = validationHint;
  } else if (isRateLimited) {
    liveAnnouncement = "Too many requests. Please wait a moment.";
  } else if (asyncError) {
    liveAnnouncement = asyncError;
  } else if (isQueryEmpty) {
    liveAnnouncement = `${airports.length} featured airports available`;
  } else if (canSearch && hasSearched) {
    if (searchResults.length === 0) {
      liveAnnouncement = `No airports match "${trimmedQuery}"`;
    } else if (searchResults.length === 1) {
      liveAnnouncement = "1 airport found";
    } else {
      liveAnnouncement = `${searchResults.length} airports found`;
    }
  }

  const placeholderText = currentAirport
    ? `${currentAirport.name} (${currentAirport.icao})`
    : "Search airport (e.g. VECC, JFK, Heathrow)...";

  return (
    <div ref={containerRef} className="airport-search-combobox">
      {/* Polite live region for screen readers */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {isOpen ? liveAnnouncement : ""}
      </div>

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
            isOpen && activeIndex >= 0
              ? `airport-opt-${activeIndex}`
              : undefined
          }
          aria-label="Airport search combobox. Type an ICAO code, IATA code, airport name, or city"
          placeholder={placeholderText}
          value={query}
          onChange={(e) => {
            const nextVal = e.target.value;
            setQuery(nextVal);
            setActiveIndex(-1);
            setHasSearched(false);
            setAsyncError(null);
            setIsRateLimited(false);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="combobox-input"
          autoComplete="off"
          spellCheck="false"
        />

        {isLoading && (
          <span
            className="combobox-inline-spinner"
            aria-hidden="true"
            title="Searching..."
          />
        )}

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setActiveIndex(-1);
              setHasSearched(false);
              setAsyncError(null);
              setIsRateLimited(false);
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
          {/* 1. Loading state in dropdown */}
          {isLoading && (
            <li className="combobox-status-item combobox-loading" role="status">
              <span className="combobox-spinner" aria-hidden="true" />
              <span>Searching airports...</span>
            </li>
          )}

          {/* 2. Validation / Hint state */}
          {!isLoading && validationHint && (
            <li className="combobox-status-item combobox-hint" role="status">
              <span>{validationHint}</span>
            </li>
          )}

          {/* 3. Rate limited state */}
          {!isLoading && isRateLimited && (
            <li
              className="combobox-status-item combobox-rate-limited"
              role="status"
            >
              <span>Too many requests. Please wait a moment.</span>
            </li>
          )}

          {/* 4. Error state with retry */}
          {!isLoading && !isRateLimited && asyncError && (
            <li className="combobox-status-item combobox-error" role="status">
              <span className="combobox-error-text">{asyncError}</span>
              <button
                type="button"
                onClick={handleRetry}
                className="combobox-retry-btn"
                aria-label="Retry airport search"
              >
                Retry
              </button>
            </li>
          )}

          {/* 5. No results matching query */}
          {!isLoading &&
            canSearch &&
            hasSearched &&
            !asyncError &&
            !isRateLimited &&
            searchResults.length === 0 && (
              <li className="combobox-no-match" role="status">
                No airports match &ldquo;{trimmedQuery}&rdquo;
              </li>
            )}

          {/* 6. Featured airports label when query is empty */}
          {isQueryEmpty && displayedItems.length > 0 && (
            <li className="combobox-group-label" aria-hidden="true">
              Featured Airports
            </li>
          )}

          {/* 7. Display list items (either featured or search results) */}
          {displayedItems.map((item, idx) => {
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
                  <span className="option-name">
                    <HighlightedName text={item.name} query={query} />
                  </span>
                  <span className="option-codes">
                    <span className="opt-badge opt-icao">{item.icao}</span>
                    {item.iata && (
                      <span className="opt-badge opt-iata">{item.iata}</span>
                    )}
                  </span>
                </div>
                <div className="option-sub">
                  {item.city ? `${item.city}, ${item.country}` : item.country}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
