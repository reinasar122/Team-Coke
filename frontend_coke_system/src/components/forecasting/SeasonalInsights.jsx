// src/components/forecasting/SeasonalInsights.jsx
import React from "react";

export const SeasonalInsights = ({ insights }) => {
  // Accuracy = 100% - MAPE Error
  const mapeError = Number(insights.mapeError || 0);
  const accuracy = Math.max(0, 100 - mapeError);

  const cards = [
    {
      label: "Weekly Peak Day",
      value: insights.primaryPeakValue || "No data",
      icon: "📅",
    },
    {
      label: "Yearly Peak Month",
      value: insights.secondaryPeakValue || "No data",
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
      value: `${accuracy.toFixed(2)}%`,
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

      {/* 🔽 MAPE Accuracy Guide Label */}
      <div className="mt-4 text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-xl p-3">
        <p className="font-semibold text-gray-700 mb-1">
          MAPE Accuracy Guide
        </p>
        <ul className="space-y-0.5">
          <li>
            <span className="font-medium text-emerald-600">0–10%</span> – Excellent (Very reliable)
          </li>
          <li>
            <span className="font-medium text-green-600">10–20%</span> – Good (Reliable for planning)
          </li>
          <li>
            <span className="font-medium text-orange-500">20–50%</span> – Moderate (Use with caution)
          </li>
          <li>
            <span className="font-medium text-red-500">&gt;50%</span> – Low (Not reliable)
          </li>
        </ul>
      </div>
    </>
  );
};