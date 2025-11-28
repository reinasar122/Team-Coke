// src/components/forecasting/SeasonalInsights.jsx
import React from "react";

export const SeasonalInsights = ({ insights }) => {
  const cards = [
    {
      label: "Weekly Peak Day",
      value: insights.weeklyPeakDay,
      icon: "📅",
    },
    {
      label: "Yearly Peak Month",
      value: insights.yearlyPeakMonth,
      icon: "📆",
    },
    {
      label: "Trend Direction",
      value: insights.trendDirection,
      icon: "📈",
      valueClass: "text-emerald-600",
    },
    {
      label: "MAPE Accuracy",
      value: `${insights.mape.toFixed(2)}%`,
      icon: "🎯",
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
    </>
  );
};