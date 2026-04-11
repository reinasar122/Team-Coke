// src/components/forecasting/SeasonalInsights.jsx
import React from "react";
import { FaCalendar, FaCalendarAlt, FaChartLine, FaBullseye } from "react-icons/fa";

export const SeasonalInsights = ({ insights }) => {
  const accuracyValue =
    insights.forecastAccuracy != null
      ? `${Number(insights.forecastAccuracy).toFixed(2)}%`
      : "Pending";

  const accuracyClass =
    insights.forecastAccuracy == null
      ? "text-slate-500"
      : insights.forecastAccuracy >= 90
      ? "text-emerald-600"
      : insights.forecastAccuracy >= 80
      ? "text-green-600"
      : insights.forecastAccuracy >= 60
      ? "text-orange-500"
      : "text-red-500";

  const cards = [
    {
      label: insights.primaryPeakLabel || "Weekly Peak Day",
      value: insights.primaryPeakValue,
      icon: <FaCalendarAlt />,
    },
    {
      label: insights.secondaryPeakLabel || "Yearly Peak Month",
      value: insights.secondaryPeakValue,
      icon: <FaCalendar />,
    },
    {
      label: "Trend Direction",
      value: insights.trendDirection,
      icon: <FaChartLine />,
      valueClass: "text-emerald-600",
    },
    {
      label: "Forecast Accuracy",
      value: accuracyValue,
      icon: <FaBullseye />,
      valueClass: accuracyClass,
    },
  ];

  return (
    <>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">
        Seasonal Insights
      </h2>
      <p className="text-xs text-gray-500 mb-4">
        Key patterns and forecast accuracy metrics
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="flex items-center gap-3 border border-gray-100 rounded-xl px-3 py-3 bg-gray-50"
          >
            <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-lg">
              {card.icon}
            </div>
            <div className="flex-1">
              <p className="text-[11px] text-gray-500">{card.label}</p>
              <p
                className={`text-sm font-semibold text-gray-900 ${
                  card.valueClass || ""
                }`}
              >
                {card.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {insights.forecastAccuracy == null ? (
        <div className="mt-4 text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-xl p-3">
          Forecast accuracy will appear once there are matching actual sales rows to compare against the forecast.
        </div>
      ) : (
        <div className="mt-4 text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-xl p-3">
          <p className="font-semibold text-gray-700 mb-1">
            Forecast Accuracy Guide
          </p>
          <ul className="space-y-0.5">
            <li>
              <span className="font-medium text-emerald-600">90-100%</span> - Excellent
            </li>
            <li>
              <span className="font-medium text-green-600">80-89%</span> - Good
            </li>
            <li>
              <span className="font-medium text-orange-500">60-79%</span> - Moderate
            </li>
            <li>
              <span className="font-medium text-red-500">&lt;60%</span> - Low
            </li>
          </ul>
          <p className="mt-2 text-[11px] text-gray-500">
            Based on {insights.comparableDays || 0} comparable {insights.comparableUnit || "day"}
            {insights.comparableDays === 1 ? "" : "s"}
            {insights.mapeError != null ? ` with a MAPE error of ${Number(insights.mapeError).toFixed(2)}%` : ""}.
          </p>
        </div>
      )}
    </>
  );
};
