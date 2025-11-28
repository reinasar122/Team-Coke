// src/components/forecasting/BestSellerRanking.jsx
import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

const STATUS_COLORS = {
  fast: "#16a34a",   // green  – fast-moving
  stable: "#f97316", // orange – stable
  slow: "#ef4444",   // red    – slow-moving
};

export function BestSellerRanking({ data = [] }) {
  // Expect data like:
  // [{ product: "Sprite", projectedSales: 210000, speedCategory: "fast" }, ...]
  const chartData = data.map((item) => ({
    name: item.product,
    value: item.projectedSales,
    status: item.speedCategory, // "fast" | "stable" | "slow"
  }));

  return (
    <div className="forecast-card">
      <div className="forecast-card-header">
        <h2 className="forecast-card-title">Best-Seller Ranking</h2>
        <p className="forecast-card-subtitle">
          Top products by projected 30-day sales
        </p>
      </div>

      <div className="forecast-card-body" style={{ height: 360 }}>
        {chartData.length === 0 ? (
          <div className="forecast-empty-state">
            No ranking data available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 16, right: 24, bottom: 16, left: 120 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(value) =>
                  new Intl.NumberFormat("en-US").format(value)
                }
                labelFormatter={(label) => `Product: ${label}`}
              />
              <Bar dataKey="value" radius={[4, 4, 4, 4]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      STATUS_COLORS[entry.status] ||
                      "#64748b" /* fallback gray */
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="forecast-card-footer">
        <div className="forecast-legend">
          <span className="legend-item">
            <span
              className="legend-dot"
              style={{ backgroundColor: STATUS_COLORS.fast }}
            />
            Fast-moving
          </span>
          <span className="legend-item">
            <span
              className="legend-dot"
              style={{ backgroundColor: STATUS_COLORS.stable }}
            />
            Stable
          </span>
          <span className="legend-item">
            <span
              className="legend-dot"
              style={{ backgroundColor: STATUS_COLORS.slow }}
            />
            Slow-moving
          </span>
        </div>
      </div>
    </div>
  );
}