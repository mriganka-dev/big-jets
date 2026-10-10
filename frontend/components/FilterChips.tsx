"use client";

import { CATEGORIES } from "@/lib/constants";

interface FilterChipsProps {
  selectedCategories: string[];
  showAllTraffic: boolean;
  onToggleAll: () => void;
  onToggleCategory: (categoryKey: string) => void;
}

interface ChipConfig {
  id: string;
  label: string;
  categoryKey?: string;
  isAll?: boolean;
}

const CHIP_CONFIGS: ChipConfig[] = [
  { id: "all", label: "All traffic", isAll: true },
  { id: "big", label: "Big", categoryKey: CATEGORIES.BIG },
  { id: "rare", label: "Rare", categoryKey: CATEGORIES.RARE },
  { id: "fighters", label: "Fighters", categoryKey: CATEGORIES.MIL_FIGHTER },
  { id: "vip", label: "VIP/Business", categoryKey: CATEGORIES.VIP_JET },
];

export function FilterChips({
  selectedCategories,
  showAllTraffic,
  onToggleAll,
  onToggleCategory,
}: FilterChipsProps) {
  return (
    <div
      className="filter-chips-wrapper"
      role="toolbar"
      aria-label="Aircraft category filters"
    >
      <div className="filter-chips-scroll">
        {CHIP_CONFIGS.map((chip) => {
          let isPressed = false;
          if (chip.isAll) {
            isPressed = showAllTraffic && selectedCategories.length === 0;
          } else if (chip.categoryKey) {
            isPressed = selectedCategories.includes(chip.categoryKey);
          }

          const handleClick = () => {
            if (chip.isAll) {
              onToggleAll();
            } else if (chip.categoryKey) {
              onToggleCategory(chip.categoryKey);
            }
          };

          return (
            <button
              key={chip.id}
              type="button"
              className={`filter-chip ${isPressed ? "is-pressed" : ""}`}
              aria-pressed={isPressed}
              onClick={handleClick}
            >
              <span className="chip-indicator" aria-hidden="true" />
              <span className="chip-text">{chip.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
