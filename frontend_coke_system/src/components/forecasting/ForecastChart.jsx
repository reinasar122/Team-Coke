// src/components/forecasting/ForecastChart.jsx
import React, { useMemo, useState } from "react";
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

const RECENT_ACTUAL_DAYS = 3;
const TOTAL_DISPLAY_DAYS = 14;

const parseDateKey = (value) => {
  const [year, month, day] = String(value || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const formatAxisDate = (value) => {
  const date = parseDateKey(value);
  if (!date) return "";
  
  // Check if it's a monthly key (YYYY-MM format)
  if (String(value).match(/^\d{4}-\d{2}$/)) {
    const [year, month] = String(value).split("-").map(Number);
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${monthNames[month - 1]} ${year}`;
  }
  
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day}`;
};

const formatTooltipDate = (value) => {
  const date = parseDateKey(value);
  if (!date) return value || "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
};

const buildDailyForecastWindow = (rows) => {
  const source = Array.isArray(rows) ? [...rows] : [];
  if (!source.length) return [];

  source.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

  const lastActualIndex = source.reduce(
    (lastIndex, row, index) => (row.actual != null ? index : lastIndex),
    -1
  );

  const historicalRows =
    lastActualIndex >= 0
      ? source.slice(Math.max(0, lastActualIndex - (RECENT_ACTUAL_DAYS - 1)), lastActualIndex + 1)
      : [];

  const futureDayCount = Math.max(TOTAL_DISPLAY_DAYS - historicalRows.length, 0);

  let futureRows =
    lastActualIndex >= 0
      ? source.slice(lastActualIndex + 1, lastActualIndex + 1 + futureDayCount)
      : source.slice(0, TOTAL_DISPLAY_DAYS);

  if (!futureRows.length) {
    futureRows = source.slice(-TOTAL_DISPLAY_DAYS);
  }

  const seen = new Set();
  return [...historicalRows, ...futureRows].filter((row) => {
    const key = String(row.date || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const buildMonthlyForecastWindow = (rows) => {
  const source = Array.isArray(rows) ? [...rows] : [];
  if (!source.length) return [];

  source.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

  // Group daily data by month key (YYYY-MM)
  const monthlyData = {};
  
  source.forEach((row) => {
    const dateStr = String(row.date || "");
    if (!dateStr) return;
    
    const [year, month] = dateStr.split("-").slice(0, 2).join("-").split("-");
    if (!year || !month) return;
    
    const monthKey = `${year}-${month}`;
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        date: monthKey,
        actual: 0,
        forecast: 0,
        upper: 0,
        lower: 0,
        count: 0,
        actualCount: 0,
      };
    }
    
    monthlyData[monthKey].forecast += Number(row.forecast || 0);
    monthlyData[monthKey].upper += Number(row.upper || 0);
    monthlyData[monthKey].lower += Number(row.lower || 0);
    monthlyData[monthKey].count += 1;
    
    if (row.actual != null) {
      monthlyData[monthKey].actual += Number(row.actual);
      monthlyData[monthKey].actualCount += 1;
    }
  });

  // Convert to array and calculate averages for bounds
  const result = Object.keys(monthlyData)
    .sort()
    .map((monthKey) => {
      const data = monthlyData[monthKey];
      return {
        date: data.date,
        forecast: Math.round(data.forecast),
        actual: data.actualCount > 0 ? Math.round(data.actual) : null,
        upper: Math.round(data.upper / data.count),
        lower: Math.round(data.lower / data.count),
      };
    });

  return result;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;

  const upper = payload.find((point) => point.dataKey === "upper")?.value;
  const lower = payload.find((point) => point.dataKey === "lower")?.value;
  const forecast = payload.find((point) => point.dataKey === "forecast")?.value;
  const actual = payload.find((point) => point.dataKey === "actual")?.value;
  const round = (value) => Math.round(Number(value || 0));

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-md px-4 py-3 text-xs text-gray-700">
      <p className="font-semibold mb-1">{formatTooltipDate(label)}</p>
      {upper != null && <p className="text-emerald-700">Upper Bound : {round(upper)}</p>}
      {lower != null && <p className="text-emerald-700">Lower Bound : {round(lower)}</p>}
      {forecast != null && <p className="text-emerald-700">Forecast : {round(forecast)}</p>}
      {actual != null && <p className="text-blue-700">Actual Sale : {round(actual)}</p>}
    </div>
  );
};

export const ForecastChart = ({ product, data }) => {
  const [forecastType, setForecastType] = useState("daily");

  const chartData = useMemo(() => {
    if (forecastType === "monthly") {
      return buildMonthlyForecastWindow(data);
    }
    return buildDailyForecastWindow(data);
  }, [data, forecastType]);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {forecastType === "monthly" ? "Monthly" : "Daily"} Sales Forecast
          </h2>
          <p className="text-xs text-gray-500">
            {forecastType === "monthly"
              ? "Monthly aggregated forecast data for " + product
              : "14-date daily forecast display for " + product}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setForecastType("daily")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              forecastType === "daily"
                ? "bg-emerald-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Daily
          </button>
          <button
            onClick={() => setForecastType("monthly")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              forecastType === "monthly"
                ? "bg-emerald-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%" minWidth={240} minHeight={180} debounce={80}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tickFormatter={formatAxisDate}
              tick={{ fontSize: 10 }}
              interval={0}
              angle={0}
              textAnchor="middle"
              height={34}
              minTickGap={0}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />

            <Area
              type="monotone"
              dataKey="upper"
              stroke="none"
              fill="#dcfce7"
              fillOpacity={0.45}
              activeDot={false}
            />
            <Area
              type="monotone"
              dataKey="lower"
              stroke="none"
              fill="#ffffff"
              fillOpacity={1}
              activeDot={false}
            />

            <Line
              type="monotone"
              dataKey="actual"
              stroke="#2563eb"
              dot={{ r: 3 }}
              strokeWidth={2}
              name="Actual Sales"
              connectNulls
            />

            <Line
              type="monotone"
              dataKey="forecast"
              stroke="#16a34a"
              dot={false}
              strokeDasharray="4 4"
              strokeWidth={2}
              name="Forecast"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

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
