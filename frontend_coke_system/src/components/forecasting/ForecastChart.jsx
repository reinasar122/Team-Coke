// src/components/forecasting/ForecastChart.jsx
import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;

  const upper = payload.find((p) => p.dataKey === "upper")?.value;
  const lower = payload.find((p) => p.dataKey === "lower")?.value;
  const forecast = payload.find((p) => p.dataKey === "forecast")?.value;

  const fmt = (v) => Math.round(v);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-md px-4 py-3 text-xs text-gray-700">
      <p className="font-semibold mb-1">{label}</p>
      {upper != null && (
        <p className="text-emerald-700">Upper Bound : {fmt(upper)}</p>
      )}
      {lower != null && (
        <p className="text-emerald-700">Lower Bound : {fmt(lower)}</p>
      )}
      {forecast != null && (
        <p className="text-emerald-700">Forecast : {fmt(forecast)}</p>
      )}
    </div>
  );
};

export const ForecastChart = ({ product, data }) => {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Sales Forecast
          </h2>
          <p className="text-xs text-gray-500">
            Historical data and predictions for {product}
          </p>
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 20, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tickFormatter={(d) => d.slice(5)}
              tick={{ fontSize: 11 }}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />

            {/* Band between lower & upper */}
            <Area
              type="monotone"
              dataKey="upper"
              stroke="#a7f3d0"
              fill="#dcfce7"
              fillOpacity={0.8}
              activeDot={false}
            />
            <Area
              type="monotone"
              dataKey="lower"
              stroke="#a7f3d0"
              fill="#ffffff"
              fillOpacity={1}
              activeDot={false}
            />

            {/* Actual sales */}
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#2563eb"
              dot={{ r: 3 }}
              strokeWidth={2}
              name="Actual Sales"
              connectNulls
            />

            {/* Forecast */}
            <Line
              type="monotone"
              dataKey="forecast"
              stroke="#16a34a"
              dot={{ r: 2 }}
              strokeDasharray="4 4"
              strokeWidth={2}
              name="Forecast"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-6 justify-center text-xs mt-3">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-200 border border-emerald-400" />
          <span>Upper Bound</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-50 border border-emerald-300" />
          <span>Lower Bound</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-500" />
          <span>Actual Sales</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-600" />
          <span>Forecast</span>
        </div>
      </div>
    </>
  );
};