// src/components/forecasting/SeasonalInsights.jsx
import React from "react";
import { FaCalendar, FaCalendarAlt, FaChartLine, FaBullseye } from "react-icons/fa";

export const SeasonalInsights = ({ insights }) => {
  const cards = [
    {
      label: "Weekly Peak Day",
      value: insights.weeklyPeakDay,
      icon: <FaCalendarAlt />,
    },
    {
      label: "Yearly Peak Month",
      value: insights.yearlyPeakMonth,
      icon: <FaCalendar />,
    },
    {
      label: "Trend Direction",
      value: insights.trendDirection,
      icon: <FaChartLine />,
      valueClass: "text-emerald-600",
    },
    {
      label: "MAPE Accuracy",
      value: `${Number(insights.mape || 0).toFixed(2)}%`,
      icon: <FaBullseye />,
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

      {/* MAPE Accuracy Guide Label */}
      <div className="mt-4 text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-xl p-3">
        <p className="font-semibold text-gray-700 mb-1">
          MAPE Accuracy Guide
        </p>
        <ul className="space-y-0.5">
          <li>
            <span className="font-medium text-emerald-600">0-10%</span> - Excellent (Very reliable)
          </li>
          <li>
            <span className="font-medium text-green-600">10-20%</span> - Good (Reliable for planning)
          </li>
          <li>
            <span className="font-medium text-orange-500">20-50%</span> - Moderate (Use with caution)
          </li>
          <li>
            <span className="font-medium text-red-500">&gt;50%</span> - Low (Not reliable)
          </li>
        </ul>
      </div>
    </>
  );
};