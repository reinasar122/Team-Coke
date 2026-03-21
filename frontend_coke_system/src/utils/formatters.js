// src/utils/formatters.js

// safe number conversion with default
export const n = (v, d = 0) =>
  v === null || v === undefined || v === "" || Number.isNaN(Number(v))
    ? d
    : Number(v);

// peso currency formatter
export const peso = (x) =>
  `\u20B1${n(x).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// percentage formatter
export const pct = (x) =>
  `${(n(x) * 100).toLocaleString("en-PH", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;

// color palette (for charts)
export const COLORS = [
  "#4F46E5", // indigo
  "#22C55E", // green
  "#EF4444", // red
  "#F59E0B", // amber
  "#3B82F6", // blue
  "#EC4899", // pink
  "#14B8A6", // teal
  "#8B5CF6", // violet
];
