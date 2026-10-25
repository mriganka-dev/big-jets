"use client";

import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  CATEGORIES,
  CATEGORY_META,
  LIMITS,
  type CategoryKey,
} from "@/lib/constants";
import type { AircraftCategory } from "@/lib/schemas";

interface FilterBarProps {
  selectedCategories: AircraftCategory[];
  showAll: boolean;
  radius: number;
  onFilterChange: (newFilters: {
    categories: AircraftCategory[];
    showAll: boolean;
    radius: number;
  }) => void;
}

const FILTERABLE_CATEGORIES: CategoryKey[] = [
  CATEGORIES.BIG,
  CATEGORIES.RARE,
  CATEGORIES.MIL_FIGHTER,
  CATEGORIES.MIL_OTHER,
  CATEGORIES.VIP_JET,
];

const RADIUS_OPTIONS = [15, 25, 40, 60, 80, 100];

export function FilterBar({
  selectedCategories,
  showAll,
  radius,
  onFilterChange,
}: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const updateUrlParams = (
    cats: AircraftCategory[],
    all: boolean,
    rad: number,
  ) => {
    const params = new URLSearchParams(searchParams?.toString());

    if (cats.length > 0 && !all) {
      params.set("category", cats.join(","));
    } else {
      params.delete("category");
    }

    if (all) {
      params.set("all", "true");
    } else {
      params.delete("all");
    }

    if (rad !== LIMITS.DEFAULT_RADIUS_NM) {
      params.set("radius", rad.toString());
    } else {
      params.delete("radius");
    }

    const query = params.toString();
    const targetUrl = query ? `${pathname}?${query}` : pathname;

    startTransition(() => {
      router.replace(targetUrl, { scroll: false });
    });
  };

  const handleCategoryToggle = (category: AircraftCategory) => {
    let nextCategories: AircraftCategory[];
    if (selectedCategories.includes(category)) {
      nextCategories = selectedCategories.filter((c) => c !== category);
    } else {
      nextCategories = [...selectedCategories, category];
    }

    onFilterChange({
      categories: nextCategories,
      showAll: false,
      radius,
    });
    updateUrlParams(nextCategories, false, radius);
  };

  const handleShowAllToggle = () => {
    const nextShowAll = !showAll;
    onFilterChange({
      categories: nextShowAll ? [] : selectedCategories,
      showAll: nextShowAll,
      radius,
    });
    updateUrlParams(nextShowAll ? [] : selectedCategories, nextShowAll, radius);
  };

  const handleRadiusChange = (newRadius: number) => {
    onFilterChange({
      categories: selectedCategories,
      showAll,
      radius: newRadius,
    });
    updateUrlParams(selectedCategories, showAll, newRadius);
  };

  const handleResetFilters = () => {
    onFilterChange({
      categories: [],
      showAll: false,
      radius: LIMITS.DEFAULT_RADIUS_NM,
    });
    updateUrlParams([], false, LIMITS.DEFAULT_RADIUS_NM);
  };

  return (
    <div className="filter-bar" role="search" aria-label="Aircraft filters">
      <div className="filter-group">
        <span className="filter-group-label" id="category-filter-label">
          Categories:
        </span>
        <div
          className="filter-chips"
          role="group"
          aria-labelledby="category-filter-label"
        >
          {FILTERABLE_CATEGORIES.map((catKey) => {
            const isSelected = selectedCategories.includes(
              catKey as AircraftCategory,
            );
            const meta = CATEGORY_META[catKey];
            return (
              <button
                key={catKey}
                type="button"
                className={`filter-chip ${isSelected ? "filter-chip-active" : ""}`}
                aria-pressed={isSelected}
                disabled={showAll}
                onClick={() => handleCategoryToggle(catKey as AircraftCategory)}
              >
                {meta.label}
              </button>
            );
          })}

          <button
            type="button"
            className={`filter-chip filter-chip-toggle ${showAll ? "filter-chip-active" : ""}`}
            aria-pressed={showAll}
            onClick={handleShowAllToggle}
          >
            {showAll ? "✓ All Traffic (Unfiltered)" : "Show All Traffic"}
          </button>
        </div>
      </div>

      <div className="filter-controls-right">
        <div className="radius-selector">
          <label htmlFor="radius-select" className="radius-label">
            Radius:
          </label>
          <select
            id="radius-select"
            value={radius}
            onChange={(e) => handleRadiusChange(Number(e.target.value))}
            className="radius-select"
          >
            {RADIUS_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r} NM (~{Math.round(r * 1.852)} km)
              </option>
            ))}
          </select>
        </div>

        {(selectedCategories.length > 0 ||
          showAll ||
          radius !== LIMITS.DEFAULT_RADIUS_NM) && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="btn-reset-filters"
            title="Reset filters to default"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
