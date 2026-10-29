"use client";

interface RadiusSelectProps {
  radius: number;
  onChangeRadius: (newRadius: number) => void;
}

const RADIUS_OPTIONS = [
  { value: 10, label: "10 nm" },
  { value: 25, label: "25 nm" },
  { value: 40, label: "40 nm (standard)" },
  { value: 60, label: "60 nm" },
  { value: 100, label: "100 nm (max)" },
];

export function RadiusSelect({ radius, onChangeRadius }: RadiusSelectProps) {
  return (
    <div className="radius-select-wrapper">
      <label htmlFor="radar-radius-select" className="radius-label">
        <span className="radius-icon" aria-hidden="true">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        </span>
        <span className="sr-only">Radius:</span>
      </label>
      <select
        id="radar-radius-select"
        value={radius}
        onChange={(e) => onChangeRadius(Number(e.target.value))}
        className="radius-select"
        aria-label="Filter aircraft by distance radius in nautical miles"
      >
        {RADIUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
